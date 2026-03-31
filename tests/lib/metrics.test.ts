// tests/lib/metrics.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  recordAgentCall,
  recordCacheHit,
  recordCacheMiss,
  recordRequest,
  getMetricsSummary,
  metrics,
} from '@/lib/metrics';

describe('Metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Agent Metrics', () => {
    it('should record agent calls', () => {
      recordAgentCall('security', 1000, true);
      recordAgentCall('security', 2000, true);

      const summary = getMetricsSummary();
      expect(summary.agents.security.calls).toBe(2);
      expect(summary.agents.security.successRate).toBe(1);
    });

    it('should calculate average duration', () => {
      recordAgentCall('security', 1000, true);
      recordAgentCall('security', 2000, true);
      recordAgentCall('security', 3000, true);

      const summary = getMetricsSummary();
      expect(summary.agents.security.averageDuration).toBe(2000);
    });

    it('should calculate success rate', () => {
      recordAgentCall('security', 1000, true);
      recordAgentCall('security', 1000, false);
      recordAgentCall('security', 1000, true);

      const summary = getMetricsSummary();
      expect(summary.agents.security.successRate).toBe(0.67);
    });

    it('should track multiple agents independently', () => {
      recordAgentCall('security', 1000, true);
      recordAgentCall('quality', 500, true);
      recordAgentCall('language', 750, false);

      const summary = getMetricsSummary();
      expect(summary.agents.security.calls).toBe(1);
      expect(summary.agents.quality.calls).toBe(1);
      expect(summary.agents.language.calls).toBe(1);
    });
  });

  describe('Cache Metrics', () => {
    it('should record cache hits', () => {
      recordCacheHit();
      recordCacheHit();
      recordCacheMiss();

      const summary = getMetricsSummary();
      expect(summary.cache.hits).toBe(2);
      expect(summary.cache.misses).toBe(1);
      expect(summary.cache.total).toBe(3);
    });

    it('should calculate cache hit rate', () => {
      recordCacheHit();
      recordCacheHit();
      recordCacheHit();
      recordCacheMiss();

      const summary = getMetricsSummary();
      expect(summary.cache.hitRate).toBe(0.75);
    });

    it('should return 0 hit rate when no requests', () => {
      const summary = getMetricsSummary();
      expect(summary.cache.hitRate).toBe(0);
    });
  });

  describe('Request Metrics', () => {
    it('should record requests', () => {
      recordRequest(1000, true);
      recordRequest(2000, false);

      const summary = getMetricsSummary();
      expect(summary.requests.total).toBe(2);
      expect(summary.requests.successful).toBe(1);
      expect(summary.requests.failed).toBe(1);
    });

    it('should calculate average duration', () => {
      recordRequest(1000, true);
      recordRequest(2000, true);
      recordRequest(3000, true);

      const summary = getMetricsSummary();
      expect(summary.requests.averageDuration).toBe(2000);
    });

    it('should calculate success rate', () => {
      recordRequest(1000, true);
      recordRequest(1000, true);
      recordRequest(1000, false);

      const summary = getMetricsSummary();
      expect(summary.requests.successRate).toBe(0.67);
    });
  });

  describe('Summary', () => {
    it('should return complete summary', () => {
      recordAgentCall('security', 1000, true);
      recordCacheHit();
      recordCacheMiss();
      recordRequest(500, true);

      const summary = getMetricsSummary();

      expect(summary.uptime).toBeGreaterThanOrEqual(0);
      expect(summary.requests.total).toBe(1);
      expect(summary.cache.total).toBe(2);
      expect(summary.agents.security).toBeDefined();
    });

    it('should handle empty metrics', () => {
      const summary = getMetricsSummary();

      expect(summary.requests.total).toBe(0);
      expect(summary.cache.total).toBe(0);
      expect(Object.keys(summary.agents)).toHaveLength(0);
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      recordAgentCall('security', 1000, true);
      recordCacheHit();
      recordRequest(500, true);

      metrics.reset();

      const summary = getMetricsSummary();
      expect(summary.requests.total).toBe(0);
      expect(summary.cache.total).toBe(0);
      expect(Object.keys(summary.agents)).toHaveLength(0);
    });
  });
});
