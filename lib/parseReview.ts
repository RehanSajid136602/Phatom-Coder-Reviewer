export type Severity = 'CRITICAL' | 'WARNING' | 'INFO' | 'PRAISE';

export interface Issue {
  severity: Severity;
  line: string;
  title: string;
  explanation: string;
}

export interface ReviewSection {
  summary?: string;
  issues: Issue[];
  suggestions: string;
  verdict?: {
    score: number;
    final: string;
  };
}

export interface ParsedReview {
  summary: string;
  issues: Issue[];
  suggestions: string;
  score: number;
  finalVerdict: string;
  hasSummary: boolean;
  hasIssues: boolean;
  hasSuggestions: boolean;
  hasVerdict: boolean;
}

export function parseReviewStream(text: string): ParsedReview {
  const result: ParsedReview = {
    summary: '',
    issues: [],
    suggestions: '',
    score: 0,
    finalVerdict: '',
    hasSummary: false,
    hasIssues: false,
    hasSuggestions: false,
    hasVerdict: false,
  };

  // Split on section headers (■ or ## or ###)
  const sections = text.split(/(?:■|#{1,3})\s*(SUMMARY|ISSUES|SUGGESTIONS|VERDICT)/i);

  for (let i = 1; i < sections.length; i += 2) {
    const sectionTitle = sections[i].toUpperCase();
    const sectionContent = sections[i + 1]?.trim() || '';

    switch (sectionTitle) {
      case 'SUMMARY':
        result.summary = sectionContent;
        result.hasSummary = true;
        break;

      case 'ISSUUES':  // Handle AI typo
      case 'ISSUES':
        result.issues = parseIssues(sectionContent);
        result.hasIssues = true;
        break;

      case 'SUGGESTIONS':
        result.suggestions = sectionContent;
        result.hasSuggestions = true;
        break;

      case 'VERDICT':
        const verdictMatch = sectionContent.match(/Score:\s*(\d+)\s*\/?\s*10/i);
        const score = verdictMatch ? parseInt(verdictMatch[1], 10) : 0;
        const finalVerdict = sectionContent.replace(/Score:\s*\d+\s*\/?\s*10/i, '').trim();
        result.score = score;
        result.finalVerdict = finalVerdict;
        result.hasVerdict = true;
        break;
    }
  }

  return result;
}

function parseIssues(content: string): Issue[] {
  const issues: Issue[] = [];

  if (!content || content.toLowerCase().includes('no critical issues') || content.toLowerCase().includes('no issues')) {
    return issues;
  }

  // Multiple patterns with increasing flexibility
  const issuePatterns = [
    // Pattern 1: Standard format [SEVERITY]L{N} — Title
    /\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*L(\d+(?:[–-]\d+)?)\s*[—-]\s*([^\n]+)\n([\s\S]*?)(?=\[(CRITICAL|WARNING|INFO|PRAISE)\]|$)/gi,
    
    // Pattern 2: With "Line" prefix [SEVERITY] Line {N} — Title
    /\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*Line\s*(\d+(?:[–-]\d+)?)\s*[—-]\s*([^\n]+)\n([\s\S]*?)(?=\[(CRITICAL|WARNING|INFO|PRAISE)\]|$)/gi,
    
    // Pattern 3: Bullet point format - [SEVERITY] L{N}: Title
    /-\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*L(\d+(?:[–-]\d+)?)\s*:\s*([^\n]+)\n([\s\S]*?)(?=-\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]|$)/gi,
    
    // Pattern 4: Bullet point with "Line" - [SEVERITY] Line {N}: Title
    /-\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*Line\s*(\d+(?:[–-]\d+)?)\s*:\s*([^\n]+)\n([\s\S]*?)(?=-\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]|$)/gi,
    
    // Pattern 5: XML-style <issue severity="X" line="N">Title</issue>
    /<issue\s+severity="(CRITICAL|WARNING|INFO|PRAISE)"\s+line="(\d+(?:[–-]\d+)?)">([^<]+)<\/issue>\n?([\s\S]*?)(?=<issue|$)/gi,
    
    // Pattern 6: Markdown bold ** [SEVERITY] ** L{N} — Title
    /\*\*\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]\s*\*\*\s*L(\d+(?:[–-]\d+)?)\s*[—-]\s*([^\n]+)\n([\s\S]*?)(?=\*\*\s*\[(CRITICAL|WARNING|INFO|PRAISE)\]|$)/gi,
    
    // Pattern 7: Simple format SEVERITY: L{N} - Title
    /(CRITICAL|WARNING|INFO|PRAISE)\s*:\s*L(\d+(?:[–-]\d+)?)\s*[-—]\s*([^\n]+)\n([\s\S]*?)(?=(CRITICAL|WARNING|INFO|PRAISE)\s*:|$)/gi,
  ];

  const seenTitles = new Set<string>();

  for (const pattern of issuePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const severity = match[1].toUpperCase() as Severity;
      const line = match[2];
      const title = match[3].trim();
      let explanation = match[4]?.trim() || '';

      // Clean up explanation (remove trailing whitespace and extra newlines)
      explanation = explanation.replace(/\s+$/, '').split('\n').slice(0, 5).join('\n');

      // Skip if we've already seen this exact issue (deduplication)
      const issueKey = `${severity}-${line}-${title}`;
      if (seenTitles.has(issueKey)) {
        continue;
      }
      seenTitles.add(issueKey);

      issues.push({ severity, line, title, explanation });
    }
    pattern.lastIndex = 0;
  }

  // Sort by severity (CRITICAL first, then WARNING, INFO, PRAISE)
  const severityOrder: Record<Severity, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
    PRAISE: 3,
  };

  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

export function highlightLineRefs(text: string): string {
  return text.replace(
    /L(\d+(?:–\d+)?)/g,
    '<span class="line-ref">L$1</span>'
  );
}
