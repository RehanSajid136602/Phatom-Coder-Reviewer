// tests/api/review.test.ts
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('POST /api/review', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Input Validation', () => {
    it('should reject empty body', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_BODY');
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_BODY');
    });

    it('should reject missing code field', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'python' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_CODE_TYPE');
    });

    it('should reject non-string code', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 123, language: 'python' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_CODE_TYPE');
    });

    it('should reject empty code', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '', language: 'python' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('EMPTY_CODE');
    });

    it('should reject whitespace-only code', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '   \n\n   ', language: 'python' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('EMPTY_CODE');
    });

    it('should reject code exceeding 50000 characters', async () => {
      const longCode = 'a'.repeat(50001);
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: longCode, language: 'python' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('CODE_TOO_LONG');
      expect(data.error).toContain('50,001');
    });

    it('should reject missing language field', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_LANGUAGE');
    });

    it('should reject invalid language', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'cobol' }),
      });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('INVALID_LANGUAGE');
      expect(data.error).toContain('cobol');
    });

    it('should accept valid request', async () => {
      process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    });
  });

  describe('API Key Validation', () => {
    it('should reject when NVIDIA_API_KEY is not set', async () => {
      delete process.env.NVIDIA_API_KEY;
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('INVALID_API_KEY');
      expect(data.error).toContain('NVIDIA_API_KEY is not set');
    });

    it('should reject when NVIDIA_API_KEY is placeholder value', async () => {
      process.env.NVIDIA_API_KEY = 'your-nvidia-api-key-here';
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('INVALID_API_KEY');
      expect(data.error).toContain('placeholder');
    });

    it('should reject when NVIDIA_API_KEY is too short', async () => {
      process.env.NVIDIA_API_KEY = 'short';
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.code).toBe('INVALID_API_KEY');
      expect(data.error).toContain('too short');
    });

    it('should accept valid API key format', async () => {
      process.env.NVIDIA_API_KEY = 'nvapi-valid-key-12345678901234567890';
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      // Should pass validation (may fail on API call, but not on key validation)
      expect(response.status).not.toBe(500);
    });
  });

  describe('Valid Languages', () => {
    const validLanguages = [
      'python',
      'javascript',
      'typescript',
      'rust',
      'go',
      'cpp',
      'sql',
      'bash',
      'other',
    ];

    beforeEach(() => {
      process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
    });

    it.each(validLanguages)('should accept language: %s', async (lang) => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'test code', language: lang }),
      });
      expect(response.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
    });

    it('should handle code with exactly 50000 characters', async () => {
      const exactCode = 'a'.repeat(50000);
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: exactCode, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle code with special characters', async () => {
      const code = `print("Hello <>&"'\\n\\t\\r")`;
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle code with unicode characters', async () => {
      const code = `print("Hello 世界 🌍 émojis")`;
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle code with null bytes', async () => {
      const code = `print("test\x00null")`;
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle very long single line', async () => {
      const code = 'x = "' + 'a'.repeat(10000) + '"';
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });

    it('should handle code with many lines', async () => {
      const code = Array(1000).fill('print("line")').join('\n');
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'python' }),
      });
      expect(response.status).toBe(200);
    });
  });

  describe('HTTP Method Validation', () => {
    it('should reject GET requests', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'GET',
      });
      expect(response.status).toBe(405);
    });

    it('should reject PUT requests', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'PUT',
        body: JSON.stringify({ code: 'test', language: 'python' }),
      });
      expect(response.status).toBe(405);
    });

    it('should reject DELETE requests', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'DELETE',
      });
      expect(response.status).toBe(405);
    });
  });

  describe('Response Format', () => {
    beforeEach(() => {
      process.env.NVIDIA_API_KEY = 'nvapi-test-key-12345678901234567890';
    });

    it('should return SSE content type', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    });

    it('should return no-cache header', async () => {
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });

    it('should return error as JSON', async () => {
      delete process.env.NVIDIA_API_KEY;
      const response = await fetch('http://localhost:3000/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'print("hello")', language: 'python' }),
      });
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });
});
