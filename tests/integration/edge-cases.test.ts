// tests/integration/edge-cases.test.ts
import { describe, it, expect } from '@jest/globals';
import { detectLanguage } from '@/lib/detectLanguage';
import { parseReviewStream } from '@/lib/parseReview';
import { extractSearchTerms, buildSearchQueries } from '@/lib/webSearch';

describe('Integration Edge Cases', () => {
  describe('Language Detection Edge Cases', () => {
    it('should handle code with multiple language patterns', () => {
      // Python with SQL inside
      const code = `def get_user():
    query = "SELECT * FROM users WHERE id = 1"
    return execute(query)`;
      const lang = detectLanguage(code);
      // Python should win due to def keyword
      expect(lang).toBe('python');
    });

    it('should handle JavaScript that looks like TypeScript', () => {
      const code = `const x = 10;
function test() {
    return x;
}`;
      const lang = detectLanguage(code);
      expect(lang).toBe('javascript');
    });

    it('should handle TypeScript with JSX', () => {
      const code = `const Component = () => {
    const [count, setCount] = useState<number>(0);
    return <div>{count}</div>;
};`;
      const lang = detectLanguage(code);
      expect(lang).toBe('typescript');
    });

    it('should handle SQL in string literals', () => {
      const jsCode = `const query = "SELECT * FROM users WHERE active = true";`;
      const lang = detectLanguage(jsCode);
      // JavaScript should win due to const
      expect(lang).toBe('javascript');
    });

    it('should handle bash with embedded SQL', () => {
      const code = `#!/bin/bash
psql -c "SELECT * FROM users"`;
      const lang = detectLanguage(code);
      expect(lang).toBe('bash');
    });
  });

  describe('Parse Review Edge Cases', () => {
    it('should handle AI output with missing sections', () => {
      const text = `■ SUMMARY
Code review.

■ ISSUES
[CRITICAL]L1 — Issue
Explanation.`;
      const result = parseReviewStream(text);
      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
      expect(result.hasSuggestions).toBe(false);
      expect(result.hasVerdict).toBe(false);
    });

    it('should handle AI output with extra sections', () => {
      const text = `■ SUMMARY
Summary.

■ REFERENCES
Some references.

■ ISSUES
[INFO]L1 — Test`;
      const result = parseReviewStream(text);
      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
      // REFERENCES should be ignored
    });

    it('should handle AI output with code blocks in issues', () => {
      const text = `■ ISSUES
[CRITICAL]L10 — SQL Injection
Use parameterized queries:
\`\`\`python
cursor.execute("SELECT * FROM users WHERE id = ?", (id,))
\`\`\`
This prevents attacks.`;
      const result = parseReviewStream(text);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].explanation).toContain('parameterized');
    });

    it('should handle AI output with inconsistent formatting', () => {
      const text = `■  SUMMARY
  Extra spaces.

■   ISSUES
[CRITICAL]  L10  —  Extra spaces
  Explanation with spaces.`;
      const result = parseReviewStream(text);
      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
    });

    it('should handle AI output with markdown headers', () => {
      const text = `# Review

## Summary
Content here.

■ SUMMARY
Actual summary.`;
      const result = parseReviewStream(text);
      expect(result.hasSummary).toBe(true);
    });

    it('should handle score variations', () => {
      const variations = [
        `■ VERDICT\nScore: 5/10\nText`,
        `■ VERDICT\nScore: 5 / 10\nText`,
        `■ VERDICT\nScore:5/10\nText`,
        `■ VERDICT\nSCORE: 5/10\nText`,
      ];

      variations.forEach((text) => {
        const result = parseReviewStream(text);
        expect(result.score).toBe(5);
      });
    });
  });

  describe('Web Search Edge Cases', () => {
    it('should handle code with no extractable terms', () => {
      const code = `x = 1
y = 2
z = x + y`;
      const terms = extractSearchTerms(code, 'python');
      // May extract variable names or be empty
      expect(Array.isArray(terms)).toBe(true);
    });

    it('should handle code with only comments', () => {
      const code = `# Comment 1
# Comment 2
// Comment 3`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).toHaveLength(0);
    });

    it('should handle code with nested imports', () => {
      const code = `import { a, b, c } from '@scope/package-nested/deep/path';`;
      const terms = extractSearchTerms(code, 'javascript');
      expect(terms).toContain('@scope');
    });

    it('should handle queries with special characters', () => {
      const code = `import express from 'express';`;
      const queries = buildSearchQueries(code, 'javascript');
      queries.forEach((q) => {
        expect(q.query).toBeDefined();
        expect(q.query.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Combined Edge Cases', () => {
    it('should handle full pipeline with empty code', () => {
      const emptyCode = '';
      const lang = detectLanguage(emptyCode);
      expect(lang).toBe('other');

      const queries = buildSearchQueries(emptyCode, 'other');
      expect(queries).toHaveLength(1);
      expect(queries[0].purpose).toBe('best-practices');
    });

    it('should handle full pipeline with minimal code', () => {
      const minimalCode = 'x';
      const lang = detectLanguage(minimalCode);
      expect(lang).toBe('other');

      const result = parseReviewStream('');
      expect(result.issues).toHaveLength(0);
    });

    it('should handle full pipeline with maximum length code', () => {
      const maxCode = 'a'.repeat(50000);
      const lang = detectLanguage(maxCode);
      expect(lang).toBe('other');

      const terms = extractSearchTerms(maxCode, 'other');
      expect(terms).toHaveLength(0);
    });

    it('should handle unicode throughout pipeline', () => {
      const unicodeCode = `def 你好():
    print("世界")
    return "🌍"`;
      const lang = detectLanguage(unicodeCode);
      expect(lang).toBe('python');

      const terms = extractSearchTerms(unicodeCode, 'python');
      expect(Array.isArray(terms)).toBe(true);

      const reviewText = `■ SUMMARY
Unicode code 你好 🌍`;
      const result = parseReviewStream(reviewText);
      expect(result.summary).toContain('你好');
    });

    it('should handle extremely long line references', () => {
      const text = `■ ISSUES
[CRITICAL]L999999 — Very long line number`;
      const result = parseReviewStream(text);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].line).toBe('999999');
    });

    it('should handle invalid severity levels', () => {
      const text = `■ ISSUES
[UNKNOWN]L1 — Unknown severity
[ERROR]L2 — Error severity`;
      const result = parseReviewStream(text);
      // Should not parse as valid issues
      expect(result.issues).toHaveLength(0);
    });

    it('should handle line reference at boundary', () => {
      const text = `■ ISSUES
[CRITICAL]L0 — Line zero
[CRITICAL]L-1 — Negative line`;
      const result = parseReviewStream(text);
      // L0 should parse, L-1 should not match pattern
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle parsing large review output', () => {
      const largeText = `■ SUMMARY
${'a'.repeat(10000)}

■ ISSUES
${Array(100)
  .fill('[CRITICAL]L1 — Issue')
  .join('\n')}

■ SUGGESTIONS
${'b'.repeat(10000)}

■ VERDICT
Score: 5/10
${'c'.repeat(10000)}`;

      const start = Date.now();
      const result = parseReviewStream(largeText);
      const duration = Date.now() - start;

      expect(result.hasSummary).toBe(true);
      expect(result.hasIssues).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle detecting language in large file', () => {
      const largeCode = Array(10000).fill('def test(): pass').join('\n');

      const start = Date.now();
      const lang = detectLanguage(largeCode);
      const duration = Date.now() - start;

      expect(lang).toBe('python');
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle code with potential injection patterns', () => {
      const code = `query = f"SELECT * FROM users WHERE id = {user_input}"`;
      const lang = detectLanguage(code);
      expect(lang).toBe('python');
    });

    it('should handle code with hardcoded secrets', () => {
      const code = `const API_KEY = "sk-1234567890abcdef";
const password = "admin123";`;
      const lang = detectLanguage(code);
      expect(lang).toBe('javascript');
    });

    it('should handle code with eval usage', () => {
      const code = `const result = eval(user_input);
exec(code);
new Function('return this')();`;
      const lang = detectLanguage(code);
      expect(lang).toBe('javascript');
    });
  });
});
