// tests/lib/agents-snapshots.test.ts
// Snapshot tests for agent output formats and prompt structures
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock fetch
global.fetch = jest.fn();

describe('Agent Output Snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
  });

  describe('Security Scanner Output Format', () => {
    it('should produce correctly formatted security issues', async () => {
      const securityOutput = `[CRITICAL]|L15|SQL Injection|Direct string interpolation allows data extraction|Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
[WARNING]|L28|Hardcoded API Key|Exposed secret allows unauthorized access|Move to environment variable: process.env.API_KEY
[CRITICAL]|L42|Path Traversal|User input in file path allows reading arbitrary files|Use path.basename() and whitelist allowed directories`;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: securityOutput } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('SELECT * FROM users', 'python');

      expect(result.success).toBe(true);
      expect(result.content).toMatchSnapshot('security-output');
    });

    it('should handle NO_ISSUES_FOUND response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'NO_ISSUES_FOUND' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('safe code', 'python');

      expect(result.success).toBe(true);
      expect(result.content).toBe('NO_ISSUES_FOUND');
    });
  });

  describe('Quality Reviewer Output Format', () => {
    it('should produce correctly formatted quality issues', async () => {
      const qualityOutput = `[WARNING]|L12|Unused Variable|'temp' is declared but never used, causes confusion|Remove the unused variable or use it for its intended purpose
[CRITICAL]|L28|Missing Error Handling|Async operation has no try-catch, unhandled rejection will crash|Wrap in try-catch: try { await fetchData() } catch (err) { handleError(err) }
[INFO]|L45|Magic Number|Value 86400 appears without explanation|Extract to constant: const SECONDS_PER_DAY = 86400;
[PRAISE]|L5|Good Practice|Proper use of context manager ensures file cleanup|Keep this pattern for all file operations`;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: qualityOutput } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callQualityReviewer } = await import('@/lib/agents');
      const result = await callQualityReviewer('const x = 1;', 'javascript');

      expect(result.success).toBe(true);
      expect(result.content).toMatchSnapshot('quality-output');
    });
  });

  describe('Language Specialist Output Format', () => {
    it('should produce correctly formatted language-specific issues', async () => {
      const languageOutput = `[CRITICAL]|L15|Missing Dependency Array|useEffect runs on every render, causes infinite loop|Add dependency array: useEffect(() => {...}, [userId])
[WARNING]|L28|Array Index as Key|Using array index as key causes issues when list reordered|Use unique id: <li key={item.id}> instead of <li key={index}>
[INFO]|L42|Missing TypeScript Return Type|Function lacks explicit return type annotation|Add return type: function getUser(id: number): Promise<User>
[PRAISE]|L5|Proper Hook Usage|Correct use of useMemo for expensive computation|This is the recommended pattern for derived state`;

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: languageOutput } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callLanguageSpecialist } = await import('@/lib/agents');
      const result = await callLanguageSpecialist('function test() {}', 'javascript');

      expect(result.success).toBe(true);
      expect(result.content).toMatchSnapshot('language-output');
    });
  });

  describe('Agent Configuration Snapshots', () => {
    it('should match security agent config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.security).toMatchSnapshot('security-config');
    });

    it('should match quality agent config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.quality).toMatchSnapshot('quality-config');
    });

    it('should match language agent config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.language).toMatchSnapshot('language-config');
    });
  });

  describe('API Request Format Snapshots', () => {
    it('should send correctly structured request to NVIDIA API', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'OK' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      await callSecurityScanner('test code', 'python');

      // Verify the request body structure
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toMatchSnapshot('nvidia-api-request');
    });

    it('should include language in user prompt', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'OK' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callLanguageSpecialist } = await import('@/lib/agents');
      await callLanguageSpecialist('def hello(): pass', 'python');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user');

      expect(userMessage.content).toContain('LANGUAGE: PYTHON');
      expect(userMessage.content).toContain('Apply ONLY rules for python');
    });
  });

  describe('Severity Format Validation', () => {
    it('should extract severity tags correctly', async () => {
      const multiSeverityOutput = `[CRITICAL]|L1|Critical Issue|Dangerous|Fix immediately
[WARNING]|L2|Warning Issue|Concerning|Fix soon
[INFO]|L3|Info Issue|Suggestion|Consider
[PRAISE]|L4|Praise Issue|Good practice|Keep`;

      const issueMatches = multiSeverityOutput.match(/\[(CRITICAL|WARNING|INFO|PRAISE)\]/g);
      expect(issueMatches).toEqual(['[CRITICAL]', '[WARNING]', '[INFO]', '[PRAISE]']);
    });

    it('should count issues by severity', async () => {
      const output = `[CRITICAL]|L1|Critical|Danger|Fix
[CRITICAL]|L2|Another Critical|Danger|Fix
[WARNING]|L3|Warning|Concern|Fix
[INFO]|L4|Info|Note|Consider`;

      const criticalCount = (output.match(/\[CRITICAL\]/g) || []).length;
      const warningCount = (output.match(/\[WARNING\]/g) || []).length;
      const infoCount = (output.match(/\[INFO\]/g) || []).length;

      expect(criticalCount).toBe(2);
      expect(warningCount).toBe(1);
      expect(infoCount).toBe(1);
    });
  });
});
