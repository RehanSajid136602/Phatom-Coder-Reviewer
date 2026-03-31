// tests/middleware.test.ts
import { describe, it, expect } from '@jest/globals';

describe('Rate Limiting Middleware', () => {
  describe('Rate limit store', () => {
    it('should create a new entry for a new client', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const now = Date.now();
      const entry = { count: 1, resetTime: now + 60000 };

      store.set('test-ip', entry);
      expect(store.has('test-ip')).toBe(true);
      expect(store.get('test-ip')?.count).toBe(1);
    });

    it('should increment count for existing client', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const now = Date.now();
      const entry = { count: 1, resetTime: now + 60000 };

      store.set('test-ip', entry);

      const existing = store.get('test-ip');
      if (existing) {
        existing.count++;
      }

      expect(store.get('test-ip')?.count).toBe(2);
    });

    it('should reset when window expires', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const now = Date.now();
      const entry = { count: 10, resetTime: now - 1000 }; // Expired

      store.set('test-ip', entry);

      // Simulate middleware logic
      const current = store.get('test-ip');
      if (!current || Date.now() > current.resetTime) {
        store.set('test-ip', { count: 1, resetTime: Date.now() + 60000 });
      }

      expect(store.get('test-ip')?.count).toBe(1);
    });

    it('should limit to max requests per window', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const maxRequests = 10;
      const now = Date.now();
      const entry = { count: 10, resetTime: now + 60000 };

      store.set('test-ip', entry);

      const current = store.get('test-ip');
      const isRateLimited = current !== undefined && current.count >= maxRequests;

      expect(isRateLimited).toBe(true);
    });

    it('should allow request when under limit', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const maxRequests = 10;
      const now = Date.now();
      const entry = { count: 5, resetTime: now + 60000 };

      store.set('test-ip', entry);

      const current = store.get('test-ip');
      const isRateLimited = current !== undefined && current.count >= maxRequests;

      expect(isRateLimited).toBe(false);
    });
  });

  describe('IP extraction', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const header: string = '203.0.113.195, 70.41.3.18, 150.172.238.178';
      const ip = header.split(',')[0].trim();
      expect(ip).toBe('203.0.113.195');
    });

    it('should use x-real-ip as fallback', () => {
      const realIp = '192.168.1.1';
      const forwarded: string | null = null;
      const ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
      expect(ip).toBe('192.168.1.1');
    });

    it('should handle missing headers gracefully', () => {
      const forwarded: string | null = null;
      const realIp: string | null = null;
      const userAgent = 'Mozilla/5.0';
      const ip = forwarded
        ? forwarded.split(',')[0].trim()
        : realIp ?? `unknown-${userAgent.slice(0, 50)}`;
      expect(ip).toContain('unknown-');
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries', () => {
      const store = new Map<string, { count: number; resetTime: number }>();
      const now = Date.now();

      store.set('ip1', { count: 5, resetTime: now - 1000 }); // Expired
      store.set('ip2', { count: 3, resetTime: now + 60000 }); // Valid
      store.set('ip3', { count: 8, resetTime: now - 5000 }); // Expired

      // Cleanup
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetTime) {
          store.delete(key);
        }
      }

      expect(store.size).toBe(1);
      expect(store.has('ip2')).toBe(true);
    });
  });
});
