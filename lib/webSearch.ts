// lib/webSearch.ts
// RAG pipeline for code review context gathering
// Replaces fragile DuckDuckGo scraping with structured, cached lookups

import { RAGDocument } from '@/types/review';
import { getCachedRAG, setCachedRAG } from '@/lib/cache';

// ── Types ──

export interface SearchQuery {
  query: string;
  purpose: 'documentation' | 'security' | 'anti-patterns' | 'changelog';
  packages: string[];
}

export interface RAGContext {
  documents: RAGDocument[];
  query: string;
  source: string;
}

// ── Dependency Extraction ──

/**
 * Extract package/library names from code imports.
 * Handles JS/TS, Python, Rust, Go, C++, and more.
 */
export function extractDependencies(code: string, language: string): string[] {
  const deps = new Set<string>();

  const patterns: Record<string, RegExp[]> = {
    javascript: [
      /(?:import|require)\s*\(?['"](@?[\w-]+(?:\/[\w-]+)?)/g,
      /from\s+['"](@?[\w-]+(?:\/[\w-]+)?)/g,
    ],
    typescript: [
      /(?:import|require)\s*\(?['"](@?[\w-]+(?:\/[\w-]+)?)/g,
      /from\s+['"](@?[\w-]+(?:\/[\w-]+)?)/g,
    ],
    python: [
      /import\s+(\w+)/g,
      /from\s+(\w+)\s+import/g,
    ],
    rust: [
      /use\s+(\w+)(?:::\w+)?/g,
      /extern\s+crate\s+(\w+)/g,
    ],
    go: [
      /import\s+\(\s*([\s\S]*?)\)/g,
      /import\s+['"]([^'"]+)['"]/g,
    ],
    cpp: [
      /#include\s*[<"]([\w\/]+)[>"]/g,
    ],
  };

  const langPatterns = patterns[language] || patterns.javascript;

  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      let pkg = match[1];
      // Normalize: take first path segment, remove @scope
      pkg = pkg.split('/')[0].replace(/^@/, '');
      if (pkg.length > 1 && !pkg.startsWith('.') && !/^\d+$/.test(pkg)) {
        deps.add(pkg.toLowerCase());
      }
    }
  }

  return Array.from(deps).slice(0, 10);
}

// ── Query Building ──

/**
 * Build targeted search queries based on code dependencies and language.
 */
export function buildRAGQueries(
  code: string,
  language: string
): SearchQuery[] {
  const deps = extractDependencies(code, language);
  const queries: SearchQuery[] = [];

  if (deps.length === 0) {
    queries.push({
      query: `${language} code review best practices security 2025`,
      purpose: 'anti-patterns',
      packages: [],
    });
    return queries;
  }

  const mainDeps = deps.slice(0, 3);

  // Documentation queries for main dependencies
  for (const dep of mainDeps) {
    queries.push({
      query: `${dep} ${language} best practices common mistakes`,
      purpose: 'documentation',
      packages: [dep],
    });
  }

  // Security query for all main deps
  queries.push({
    query: `${mainDeps.join(' ')} security vulnerability CVE 2025`,
    purpose: 'security',
    packages: mainDeps,
  });

  // Anti-patterns query
  queries.push({
    query: `${language} ${mainDeps[0] || ''} anti-patterns code smells`,
    purpose: 'anti-patterns',
    packages: mainDeps,
  });

  return queries.slice(0, 4);
}

// ── Search Execution ──

/**
 * Search DuckDuckGo for a query and return structured results.
 * Non-fatal: returns empty array on failure.
 */
async function searchDuckDuckGo(
  query: string,
  maxResults: number = 3
): Promise<RAGDocument[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn('[RAG] DuckDuckGo returned', response.status);
      return [];
    }

    const html = await response.text();
    const results: RAGDocument[] = [];

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      let url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();

      // Decode DuckDuckGo redirect URLs
      if (url.includes('uddg=')) {
        const uddgMatch = url.match(/uddg=([^&]*)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        }
      }

      if (title && snippet) {
        // Determine source type from URL
        let source: RAGDocument['source'] = 'documentation';
        if (url.includes('cve') || url.includes('security') || url.includes('snyk') || url.includes('github.com/advisories')) {
          source = 'security';
        } else if (url.includes('stackoverflow')) {
          source = 'stackoverflow';
        } else if (url.includes('github.com') && url.includes('releases') || url.includes('changelog')) {
          source = 'changelog';
        }

        results.push({
          title,
          url,
          snippet,
          relevanceScore: 0.5, // Will be re-ranked later
          source,
        });
      }
    }

    return results;
  } catch (error) {
    console.warn('[RAG] DuckDuckGo search failed:', (error as Error).message);
    return [];
  }
}

/**
 * Fetch OSV.dev security advisories for detected dependencies.
 * Free API, no authentication required.
 */
async function fetchSecurityAdvisories(packages: string[]): Promise<RAGDocument[]> {
  const results: RAGDocument[] = [];

  for (const pkg of packages.slice(0, 3)) {
    try {
      const response = await fetch(`https://api.osv.dev/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: { name: pkg, ecosystem: 'npm' },
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) continue;

      const data = await response.json() as { vulns?: Array<{ id: string; summary: string; severity?: string }> };

      if (data.vulns && data.vulns.length > 0) {
        for (const vuln of data.vulns.slice(0, 2)) {
          results.push({
            title: `${vuln.id}: ${vuln.summary || 'Security advisory'}`,
            url: `https://osv.dev/vulnerability/${vuln.id}`,
            snippet: vuln.summary || `Known vulnerability in ${pkg}`,
            relevanceScore: 1.0, // Security advisories are always high priority
            source: 'security',
          });
        }
      }
    } catch {
      // Non-fatal: continue without security advisories
    }
  }

  return results;
}

// ── Re-Ranking ──

/**
 * Re-rank documents by relevance to the code review context.
 * Security documents get highest priority, then documentation, then Stack Overflow.
 */
function reRankDocuments(documents: RAGDocument[], language: string): RAGDocument[] {
  const sourceWeights: Record<RAGDocument['source'], number> = {
    security: 1.0,
    documentation: 0.7,
    stackoverflow: 0.5,
    changelog: 0.4,
  };

  for (const doc of documents) {
    doc.relevanceScore = sourceWeights[doc.source] || 0.5;

    // Boost if document mentions the language
    const text = `${doc.title} ${doc.snippet}`.toLowerCase();
    if (text.includes(language.toLowerCase())) {
      doc.relevanceScore += 0.2;
    }

    // Boost recent content (2024-2026 mentions)
    if (/202[4-6]/.test(text)) {
      doc.relevanceScore += 0.1;
    }
  }

  return documents
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 6);
}

// ── Main Entry Point ──

/**
 * Perform RAG context gathering for code review.
 * Combines web search, security advisories, and cached results.
 * Non-fatal: returns empty context on total failure.
 */
export async function gatherRAGContext(
  code: string,
  language: string
): Promise<RAGContext> {
  const queries = buildRAGQueries(code, language);
  const allDocs: RAGDocument[] = [];
  const sources: string[] = [];

  // Check cache first for each query
  for (const { query, purpose, packages: pkgs } of queries) {
    const cacheKey = `${query}|${purpose}`;
    const cached = getCachedRAG(query, purpose);

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as RAGDocument[];
        allDocs.push(...parsed);
        sources.push(`cache:${purpose}`);
        continue;
      } catch {
        // Cache invalid, re-fetch
      }
    }

    // Fetch from web
    const results = await searchDuckDuckGo(query, 3);
    allDocs.push(...results);
    sources.push(`${purpose}:${query.slice(0, 30)}...`);

    // Cache results
    if (results.length > 0) {
      setCachedRAG(query, purpose, JSON.stringify(results));
    }

    // Small delay between searches
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Fetch security advisories for detected dependencies
  const deps = extractDependencies(code, language);
  if (deps.length > 0) {
    const advisories = await fetchSecurityAdvisories(deps);
    allDocs.push(...advisories);
    if (advisories.length > 0) {
      sources.push(`osv:${advisories.length} advisories`);
    }
  }

  // Re-rank and limit
  const ranked = reRankDocuments(allDocs, language);

  return {
    documents: ranked,
    query: queries.map((q) => q.query).join(' | '),
    source: sources.join(', '),
  };
}

/**
 * Format RAG context for injection into agent prompts.
 * Returns a string section to append to the user prompt.
 */
export function formatRAGContext(context: RAGContext): string {
  if (context.documents.length === 0) return '';

  let output = '\n\nRELEVANT CONTEXT FROM RESEARCH:\n';

  for (const doc of context.documents) {
    const sourceTag = doc.source === 'security' ? '[SECURITY]' :
      doc.source === 'stackoverflow' ? '[COMMUNITY]' :
        doc.source === 'changelog' ? '[CHANGELOG]' : '[DOCS]';

    output += `${sourceTag} ${doc.title}\n`;
    output += `URL: ${doc.url}\n`;
    output += `${doc.snippet}\n\n`;
  }

  output += `Research sources: ${context.source}\n`;

  return output;
}

// ── Legacy Compatibility ──

/**
 * Legacy function for backward compatibility.
 * Maps to the new RAG pipeline.
 */
export async function searchCodeContext(
  code: string,
  language: string
): Promise<{ results: Array<{ title: string; url: string; snippet: string }>; query: string; source: string }> {
  const context = await gatherRAGContext(code, language);

  return {
    results: context.documents.map((d) => ({
      title: d.title,
      url: d.url,
      snippet: d.snippet,
    })),
    query: context.query,
    source: context.source,
  };
}
