// lib/webSearch.ts
// Optimized RAG pipeline for fast code review context gathering
// Uses parallel searches and efficient caching for speed

import { RAGDocument } from '@/types/review';
import { getCachedRAG, setCachedRAG } from '@/lib/cache';

// ── Types ──

export interface SearchQuery {
  query: string;
  purpose: 'documentation' | 'security' | 'anti-patterns';
  packages: string[];
}

export interface RAGContext {
  documents: RAGDocument[];
  query: string;
  source: string;
}

// ── Dependency Extraction ──

export function extractDependencies(code: string, language: string): string[] {
  const deps = new Set<string>();

  const patterns: Record<string, RegExp[]> = {
    javascript: [/(?:import|require)\s*\(?['"](@?[\w-]+(?:\/[\w-]+)?)/g, /from\s+['"](@?[\w-]+(?:\/[\w-]+)?)/g],
    typescript: [/(?:import|require)\s*\(?['"](@?[\w-]+(?:\/[\w-]+)?)/g, /from\s+['"](@?[\w-]+(?:\/[\w-]+)?)/g],
    python: [/import\s+(\w+)/g, /from\s+(\w+)\s+import/g],
    rust: [/use\s+(\w+)(?:::\w+)?/g, /extern\s+crate\s+(\w+)/g],
    go: [/import\s+\(\s*([\s\S]*?)\)/g, /import\s+['"]([^'"]+)['"]/g],
    cpp: [/#include\s*[<"]([\w\/]+)[>"]/g],
  };

  const langPatterns = patterns[language] || patterns.javascript;

  for (const pattern of langPatterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      let pkg = match[1].split('/')[0].replace(/^@/, '');
      if (pkg.length > 1 && !pkg.startsWith('.') && !/^\d+$/.test(pkg)) {
        deps.add(pkg.toLowerCase());
      }
    }
  }

  return Array.from(deps).slice(0, 10);
}

// ── Query Building ──

export function buildRAGQueries(code: string, language: string): SearchQuery[] {
  const deps = extractDependencies(code, language);
  const queries: SearchQuery[] = [];

  if (deps.length === 0) {
    queries.push({ query: `${language} code review best practices security 2025`, purpose: 'anti-patterns', packages: [] });
    return queries;
  }

  const mainDep = deps[0];

  queries.push({
    query: `${mainDep} security vulnerability CVE best practices ${language} 2025`,
    purpose: 'security',
    packages: deps.slice(0, 2),
  });

  if (mainDep) {
    queries.push({
      query: `${mainDep} ${language} common mistakes code example`,
      purpose: 'documentation',
      packages: [mainDep],
    });
  }

  return queries.slice(0, 2);
}

// ── Search Execution ──

async function searchDuckDuckGo(query: string, maxResults: number = 2): Promise<RAGDocument[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: RAGDocument[] = [];

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      let url = match[1];
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      const snippet = match[3].replace(/<[^>]*>/g, '').trim();

      if (url.includes('uddg=')) {
        const uddgMatch = url.match(/uddg=([^&]*)/);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
      }

      if (title && snippet) {
        let source: RAGDocument['source'] = 'documentation';
        if (url.includes('cve') || url.includes('security') || url.includes('snyk')) source = 'security';
        else if (url.includes('stackoverflow')) source = 'stackoverflow';
        else if (url.includes('github.com') && url.includes('releases')) source = 'changelog';

        results.push({ title, url, snippet, relevanceScore: 0.5, source });
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Security Advisories ──

async function fetchSecurityAdvisories(packages: string[]): Promise<RAGDocument[]> {
  const results: RAGDocument[] = [];

  for (const pkg of packages.slice(0, 2)) {
    try {
      const response = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: { name: pkg, ecosystem: 'npm' } }),
        signal: AbortSignal.timeout(3_000),
      });

      if (!response.ok) continue;

      const data = await response.json() as { vulns?: Array<{ id: string; summary: string }> };

      if (data.vulns) {
        for (const vuln of data.vulns.slice(0, 1)) {
          results.push({
            title: `${vuln.id}: ${vuln.summary || 'Security advisory'}`,
            url: `https://osv.dev/vulnerability/${vuln.id}`,
            snippet: vuln.summary || `Known vulnerability in ${pkg}`,
            relevanceScore: 1.0,
            source: 'security',
          });
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return results;
}

// ── Re-Ranking ──

function reRankDocuments(documents: RAGDocument[], language: string): RAGDocument[] {
  const sourceWeights: Record<RAGDocument['source'], number> = {
    security: 1.0,
    documentation: 0.7,
    stackoverflow: 0.5,
    changelog: 0.4,
  };

  for (const doc of documents) {
    doc.relevanceScore = sourceWeights[doc.source] || 0.5;
    const text = `${doc.title} ${doc.snippet}`.toLowerCase();
    if (text.includes(language.toLowerCase())) doc.relevanceScore += 0.2;
    if (/202[4-6]/.test(text)) doc.relevanceScore += 0.1;
  }

  return documents.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 6);
}

// ── Main Entry Point ──

export async function gatherRAGContext(code: string, language: string): Promise<RAGContext> {
  const queries = buildRAGQueries(code, language);
  const allDocs: RAGDocument[] = [];
  const sources: string[] = [];

  // Execute searches in PARALLEL for speed
  const searchPromises = queries.map(async ({ query, purpose }) => {
    const cached = getCachedRAG(query, purpose);

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as RAGDocument[];
        sources.push(`cache:${purpose}`);
        return parsed;
      } catch {
        // Cache invalid, re-fetch
      }
    }

    const results = await searchDuckDuckGo(query, 2);
    sources.push(`${purpose}:${query.slice(0, 20)}...`);

    if (results.length > 0) {
      setCachedRAG(query, purpose, JSON.stringify(results));
    }

    return results;
  });

  const resultsArray = await Promise.all(searchPromises);
  for (const results of resultsArray) {
    allDocs.push(...results);
  }

  // Fire and forget security advisories (non-blocking)
  const deps = extractDependencies(code, language);
  if (deps.length > 0) {
    fetchSecurityAdvisories(deps).then((advisories) => {
      if (advisories.length > 0) allDocs.push(...advisories);
    }).catch(() => {});
  }

  const ranked = reRankDocuments(allDocs, language);

  return {
    documents: ranked.slice(0, 4),
    query: queries.map((q) => q.query).join(' | '),
    source: sources.join(', '),
  };
}

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

export async function searchCodeContext(
  code: string,
  language: string
): Promise<{ results: Array<{ title: string; url: string; snippet: string }>; query: string; source: string }> {
  const context = await gatherRAGContext(code, language);

  return {
    results: context.documents.map((d) => ({ title: d.title, url: d.url, snippet: d.snippet })),
    query: context.query,
    source: context.source,
  };
}
