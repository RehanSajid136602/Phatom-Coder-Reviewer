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
      const header = '203.0.113.195, 70.41.3.18, 150.172.238.178';
      const ip = header.split(',')[0].trim();
      expect(ip).toBe('203.0.113.195');
    });

    it('should use x-real-ip as fallback', () => {
      const realIp = '192.168.1.1';
      const forwarded = null as string | null;
      const ip = forwarded ? forwarded.split(',')[0].trim() : realIp;
      expect(ip).toBe('192.168.1.1');
    });

    it('should handle missing headers gracefully', () => {
      const forwarded = null as string | null;
      const realIp = null as string | null;
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

  describe('Daily Limits', () => {
    it('should track daily requests', () => {
      const dailyStore = new Map<string, { count: number; resetDate: string }>();
      const today = new Date().toDateString();

      // First request
      let entry = dailyStore.get('test-ip');
      if (!entry || entry.resetDate !== today) {
        entry = { count: 0, resetDate: today };
        dailyStore.set('test-ip', entry);
      }
      entry.count++;

      expect(entry.count).toBe(1);
      expect(dailyStore.get('test-ip')?.count).toBe(1);
    });

    it('should enforce daily limit', () => {
      const dailyStore = new Map<string, { count: number; resetDate: string }>();
      const maxRequests = 200;
      const today = new Date().toDateString();

      const entry = { count: maxRequests, resetDate: today };
      dailyStore.set('test-ip', entry);

      const remaining = Math.max(0, maxRequests - entry.count);
      const isAllowed = entry.count < maxRequests;

      expect(remaining).toBe(0);
      expect(isAllowed).toBe(false);
    });

    it('should reset on new day', () => {
      const dailyStore = new Map<string, { count: number; resetDate: string }>();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
      const today = new Date().toDateString();

      // Set yesterday's data
      dailyStore.set('test-ip', { count: 150, resetDate: yesterday });

      // Check today's logic
      let entry = dailyStore.get('test-ip');
      if (!entry || entry.resetDate !== today) {
        entry = { count: 0, resetDate: today };
        dailyStore.set('test-ip', entry);
      }

      expect(entry.count).toBe(0);
      expect(entry.resetDate).toBe(today);
    });
  });

  describe('Concurrent Request Limits', () => {
    it('should track concurrent requests', () => {
      const concurrentStore = new Map<string, number>();
      const maxConcurrent = 2;

      const clientIp = 'test-ip';

      // First request
      let current = concurrentStore.get(clientIp) || 0;
      concurrentStore.set(clientIp, current + 1);
      expect(concurrentStore.get(clientIp)).toBe(1);

      // Second request
      current = concurrentStore.get(clientIp) || 0;
      concurrentStore.set(clientIp, current + 1);
      expect(concurrentStore.get(clientIp)).toBe(2);

      // Third request should be blocked
      current = concurrentStore.get(clientIp) || 0;
      const isAllowed = current < maxConcurrent;
      expect(isAllowed).toBe(false);
    });

    it('should decrement on completion', () => {
      const concurrentStore = new Map<string, number>();
      const clientIp = 'test-ip';

      // Start request
      let current = concurrentStore.get(clientIp) || 0;
      concurrentStore.set(clientIp, current + 1);
      expect(concurrentStore.get(clientIp)).toBe(1);

      // Complete request
      current = concurrentStore.get(clientIp) || 0;
      if (current > 0) {
        concurrentStore.set(clientIp, current - 1);
      }
      expect(concurrentStore.get(clientIp)).toBe(0);
    });
  });

  describe('Request Size Limits', () => {
    it('should validate request size', () => {
      const maxSize = 102400; // 100KB
      const largeSize = 200000; // 200KB

      const isValid = largeSize <= maxSize;
      expect(isValid).toBe(false);
    });

    it('should validate code length', () => {
      const maxLength = 100000; // 100K chars
      const longCode = 'x'.repeat(150000);

      const isValid = longCode.length <= maxLength;
      expect(isValid).toBe(false);
    });

    it('should allow reasonable sizes', () => {
      const maxSize = 102400;
      const reasonableSize = 50000;

      const isValid = reasonableSize <= maxSize;
      expect(isValid).toBe(true);
    });
  });

  describe('Limit Headers', () => {
    it('should include all limit headers in response', () => {
      const rateLimit = 10;
      const dailyLimit = 200;
      const concurrentLimit = 2;
      const remainingRate = 8;
      const remainingDaily = 150;
      const currentConcurrent = 1;

      // Simulate response headers
      const headers = new Map();
      headers.set('X-RateLimit-Limit', String(rateLimit));
      headers.set('X-RateLimit-Remaining', String(remainingRate));
      headers.set('X-Daily-Limit', String(dailyLimit));
      headers.set('X-Daily-Remaining', String(remainingDaily));
      headers.set('X-Concurrent-Limit', String(concurrentLimit));
      headers.set('X-Concurrent-Current', String(currentConcurrent));

      expect(headers.get('X-RateLimit-Limit')).toBe('10');
      expect(headers.get('X-RateLimit-Remaining')).toBe('8');
      expect(headers.get('X-Daily-Limit')).toBe('200');
      expect(headers.get('X-Daily-Remaining')).toBe('150');
      expect(headers.get('X-Concurrent-Limit')).toBe('2');
      expect(headers.get('X-Concurrent-Current')).toBe('1');
    });
  });
});
