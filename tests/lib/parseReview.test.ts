// tests/lib/parseReview.test.ts
import { describe, it, expect } from '@jest/globals';
import { parseReviewStream, highlightLineRefs, Issue } from '@/lib/parseReview';

describe('parseReviewStream', () => {
  describe('Section parsing', () => {
    it('should parse SUMMARY section', () => {
      const input = `■ SUMMARY
This code has several security issues that need to be addressed.`;
      const result = parseReviewStream(input);
      expect(result.hasSummary).toBe(true);
      expect(result.summary).toContain('security issues');
    });

    it('should parse ISSUES section', () => {
      const input = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Direct string interpolation allows attacks.

[WARNING]L28 — Unused variable
Variable is declared but never used.`;
      const result = parseReviewStream(input);
      expect(result.hasIssues).toBe(true);
      expect(result.issues).toHaveLength(2);
    });

    it('should parse SUGGESTIONS section', () => {
      const input = `■ SUGGESTIONS
\`\`\`python
# Fix: Use parameterized queries
cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
\`\`\``;
      const result = parseReviewStream(input);
      expect(result.hasSuggestions).toBe(true);
      expect(result.suggestions).toContain('parameterized');
    });

    it('should parse VERDICT section with score', () => {
      const input = `■ VERDICT
Score: 6/10
Functional but has security vulnerabilities.`;
      const result = parseReviewStream(input);
      expect(result.hasVerdict).toBe(true);
      expect(result.score).toBe(6);
      expect(result.finalVerdict).toContain('Functional');
    });

    it('should parse all sections together', () => {
      const input = `■ SUMMARY
Code review complete.

■ ISSUES
[CRITICAL]L5 — Hardcoded secret
API key is hardcoded.

■ SUGGESTIONS
\`\`\`python
import os
api_key = os.environ.get('API_KEY')
\`\`\`

■ VERDICT
Score: 4/10
Critical security issues found.`;
      const result = parseReviewStream(input);
      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
      expect(result.hasSuggestions).toBe(true);
      expect(result.hasVerdict).toBe(true);
      expect(result.score).toBe(4);
    });
  });

  describe('Issue parsing', () => {
    it('should parse CRITICAL severity', () => {
      const input = `■ ISSUES
[CRITICAL]L10 — SQL Injection
Vulnerable to SQL injection attacks.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].severity).toBe('CRITICAL');
    });

    it('should parse WARNING severity', () => {
      const input = `■ ISSUES
[WARNING]L15 — Unused import
Module imported but not used.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].severity).toBe('WARNING');
    });

    it('should parse INFO severity', () => {
      const input = `■ ISSUES
[INFO]L20 — Consider using const
Variable could be const.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].severity).toBe('INFO');
    });

    it('should parse PRAISE severity', () => {
      const input = `■ ISSUES
[PRAISE]L1 — Good function naming
Function name is descriptive.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].severity).toBe('PRAISE');
    });

    it('should parse single line reference', () => {
      const input = `■ ISSUES
[CRITICAL]L42 — Buffer overflow
Array access out of bounds.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].line).toBe('42');
    });

    it('should parse line range reference with en-dash', () => {
      const input = `■ ISSUES
[WARNING]L10–15 — Duplicate code
Code is duplicated.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].line).toBe('10–15');
    });

    it('should parse line range reference with hyphen', () => {
      const input = `■ ISSUES
[WARNING]L10-15 — Duplicate code
Code is duplicated.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].line).toBe('10-15');
    });

    it('should handle "Line" instead of "L" prefix', () => {
      const input = `■ ISSUES
[CRITICAL]Line 25 — Missing validation
Input not validated.`;
      const result = parseReviewStream(input);
      expect(result.issues[0].line).toBe('25');
    });
  });

  describe('Edge cases and malformed input', () => {
    it('should handle empty input', () => {
      const result = parseReviewStream('');
      expect(result.hasSummary).toBe(false);
      expect(result.hasIssues).toBe(false);
      expect(result.hasSuggestions).toBe(false);
      expect(result.hasVerdict).toBe(false);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle "NO_ISSUES" response', () => {
      const input = `■ ISSUES
NO_ISSUES`;
      const result = parseReviewStream(input);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle "No critical issues" response', () => {
      const input = `■ ISSUES
No critical issues detected.`;
      const result = parseReviewStream(input);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle AI typo "ISSUUES"', () => {
      const input = `■ ISSUUES
[CRITICAL]L5 — SQL Injection
Vulnerable code.`;
      const result = parseReviewStream(input);
      expect(result.hasIssues).toBe(true);
      expect(result.issues).toHaveLength(1);
    });

    it('should handle missing score in VERDICT', () => {
      const input = `■ VERDICT
Code needs improvement.`;
      const result = parseReviewStream(input);
      expect(result.score).toBe(0);
      expect(result.finalVerdict).toContain('improvement');
    });

    it('should handle score without "/10"', () => {
      const input = `■ VERDICT
Score: 7
Good code overall.`;
      const result = parseReviewStream(input);
      expect(result.score).toBe(7);
    });

    it('should handle score with decimal (should parse as int)', () => {
      const input = `■ VERDICT
Score: 7.5/10
Good code.`;
      const result = parseReviewStream(input);
      expect(result.score).toBe(7);
    });

    it('should handle sections in different order', () => {
      const input = `■ VERDICT
Score: 5/10
Average code.

■ SUMMARY
Review complete.`;
      const result = parseReviewStream(input);
      expect(result.hasVerdict).toBe(true);
      expect(result.hasSummary).toBe(true);
    });

    it('should handle multiple issues with varying formats', () => {
      const input = `■ ISSUES
[CRITICAL]L1 — Issue one
Explanation one.

[WARNING]L2–5 — Issue two
Explanation two.

[INFO]L10 — Issue three
Explanation three.`;
      const result = parseReviewStream(input);
      expect(result.issues).toHaveLength(3);
      expect(result.issues[0].severity).toBe('CRITICAL');
      expect(result.issues[1].severity).toBe('WARNING');
      expect(result.issues[2].severity).toBe('INFO');
    });

    it('should handle code blocks within sections', () => {
      const input = `■ SUGGESTIONS
Here's the fix:

\`\`\`python
def secure_query(user_id):
    return cursor.execute(
        "SELECT * FROM users WHERE id = ?",
        (user_id,)
    )
\`\`\`

Additional context here.`;
      const result = parseReviewStream(input);
      expect(result.hasSuggestions).toBe(true);
      expect(result.suggestions).toContain('secure_query');
    });

    it('should handle very long explanations', () => {
      const longExplanation = 'A'.repeat(1000);
      const input = `■ ISSUES
[CRITICAL]L1 — Long issue
${longExplanation}`;
      const result = parseReviewStream(input);
      expect(result.issues[0].explanation.length).toBe(1000);
    });

    it('should handle special characters in titles', () => {
      const input = `■ ISSUES
[CRITICAL]L1 — SQL Injection (CWE-89)
Uses "f-string" for query — $dangerous&<script>`;
      const result = parseReviewStream(input);
      expect(result.issues[0].title).toContain('CWE-89');
    });

    it('should handle markdown formatting in sections', () => {
      const input = `■ SUMMARY
**Bold** and *italic* and \`code\` text.`;
      const result = parseReviewStream(input);
      expect(result.summary).toContain('**Bold**');
    });

    it('should handle case-insensitive section headers', () => {
      const input = `■ summary
Lowercase summary.

■ issues
[INFO]L1 — Test`;
      const result = parseReviewStream(input);
      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
    });
  });

  describe('highlightLineRefs', () => {
    it('should wrap single line reference', () => {
      const result = highlightLineRefs('See L12 for details');
      expect(result).toContain('<span class="line-ref">L12</span>');
    });

    it('should wrap line range reference', () => {
      const result = highlightLineRefs('See L10–20 for details');
      expect(result).toContain('<span class="line-ref">L10–20</span>');
    });

    it('should wrap multiple line references', () => {
      const result = highlightLineRefs('Check L5 and L10–15 for issues');
      expect(result).toContain('<span class="line-ref">L5</span>');
      expect(result).toContain('<span class="line-ref">L10–15</span>');
    });

    it('should not modify text without line references', () => {
      const result = highlightLineRefs('No line references here');
      expect(result).toBe('No line references here');
    });

    it('should handle line references at start of string', () => {
      const result = highlightLineRefs('L1 is the first line');
      expect(result).toContain('<span class="line-ref">L1</span>');
    });

    it('should handle line references at end of string', () => {
      const result = highlightLineRefs('See line L99');
      expect(result).toContain('<span class="line-ref">L99</span>');
    });
  });
});
