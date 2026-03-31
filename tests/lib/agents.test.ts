// tests/lib/agents.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock fetch
global.fetch = jest.fn();

describe('Agents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
  });

  describe('callSecurityScanner', () => {
    it('should call NVIDIA API with security system prompt', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '[CRITICAL]|L5|SQL Injection|Vulnerable|Use params' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('SELECT * FROM users', 'python');

      expect(result.success).toBe(true);
      expect(result.agent).toBe('security');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle API error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue('Unauthorized'),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('code', 'python');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 401');
    });

    it('should handle timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('code', 'python');

      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain('timeout');
    });

    it('should handle missing API key', async () => {
      delete process.env.NVIDIA_API_KEY;

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('code', 'python');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NVIDIA_API_KEY not configured');
    });

    it('should try fallback model on primary failure', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Success' } }],
        }),
      };
      // First call fails, second succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Model unavailable'))
        .mockResolvedValueOnce(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('code', 'python');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });
  });

  describe('callQualityReviewer', () => {
    it('should call NVIDIA API with quality system prompt', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '[WARNING]|L10|Unused var|Remove it' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callQualityReviewer } = await import('@/lib/agents');
      const result = await callQualityReviewer('const x = 1;', 'javascript');

      expect(result.success).toBe(true);
      expect(result.agent).toBe('quality');
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callQualityReviewer } = await import('@/lib/agents');
      const result = await callQualityReviewer('code', 'javascript');

      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });
  });

  describe('callLanguageSpecialist', () => {
    it('should call NVIDIA API with language system prompt', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '[INFO]|L1|Good naming' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callLanguageSpecialist } = await import('@/lib/agents');
      const result = await callLanguageSpecialist('function test() {}', 'javascript');

      expect(result.success).toBe(true);
      expect(result.agent).toBe('language');
    });
  });

  describe('callMergerAgent', () => {
    it('should stream merger output', async () => {
      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"■ SUMMARY"}}]}\n\n'),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockStream);

      const { callMergerAgent } = await import('@/lib/agents');
      const stream = await callMergerAgent('agent1', 'agent2', 'agent3', 'python');

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should handle merger API error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error'),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callMergerAgent } = await import('@/lib/agents');
      
      await expect(callMergerAgent('a1', 'a2', 'a3', 'python'))
        .rejects.toThrow('HTTP 500');
    });

    it('should handle missing API key', async () => {
      delete process.env.NVIDIA_API_KEY;

      const { callMergerAgent } = await import('@/lib/agents');
      
      await expect(callMergerAgent('a1', 'a2', 'a3', 'python'))
        .rejects.toThrow('NVIDIA_API_KEY not configured');
    });

    it('should handle empty agent content', async () => {
      const mockStream = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"No issues"}}]}\n\n'),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockStream);

      const { callMergerAgent } = await import('@/lib/agents');
      const stream = await callMergerAgent('', '', '', 'python');

      expect(stream).toBeInstanceOf(ReadableStream);
    });
  });

  describe('AGENT_CONFIGS', () => {
    it('should have security config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.security).toBeDefined();
      expect(AGENT_CONFIGS.security.name).toBe('security');
      expect(AGENT_CONFIGS.security.model).toBeDefined();
    });

    it('should have quality config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.quality).toBeDefined();
      expect(AGENT_CONFIGS.quality.name).toBe('quality');
    });

    it('should have language config', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.language).toBeDefined();
      expect(AGENT_CONFIGS.language.name).toBe('language');
    });

    it('should have fallback models', async () => {
      const { AGENT_CONFIGS } = await import('@/lib/agents');
      expect(AGENT_CONFIGS.security.fallbackModel).toBeDefined();
      expect(AGENT_CONFIGS.quality.fallbackModel).toBeDefined();
      expect(AGENT_CONFIGS.language.fallbackModel).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long code input', async () => {
      const longCode = 'a'.repeat(50000);
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'OK' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner(longCode, 'python');

      expect(result.success).toBe(true);
    });

    it('should handle code with special characters', async () => {
      const code = '<>&"\'\n\t\r\\';
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'OK' } }],
        }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner(code, 'python');

      expect(result.success).toBe(true);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { callSecurityScanner } = await import('@/lib/agents');
      const result = await callSecurityScanner('code', 'python');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      
      (global.fetch as jest.Mock).mockImplementation(() => {
        // Simulate immediate abort
        return new Promise((_, reject) => {
          setTimeout(() => {
            if (abortController.signal.aborted) {
              reject(new Error('Aborted'));
            }
          }, 0);
        });
      });

      const { callSecurityScanner } = await import('@/lib/agents');
      const promise = callSecurityScanner('code', 'python');
      
      // Abort immediately
      abortController.abort();
      
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error.toLowerCase()).toContain('abort');
    }, 5000);
  });
});
