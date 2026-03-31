// lib/metrics.ts
// Basic metrics logging for agent performance and cache statistics

interface MetricEntry {
  timestamp: number;
  duration: number;
  success: boolean;
}

interface AgentMetrics {
  calls: MetricEntry[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalDuration: number;
}

class MetricsCollector {
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private cacheMetrics: CacheMetrics = { hits: 0, misses: 0, totalRequests: 0 };
  private requestMetrics: RequestMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDuration: 0,
  };
  private startTime: number = Date.now();

  // ── Agent Metrics ──

  /**
   * Record an agent call with its duration and success status.
   */
  recordAgentCall(agent: string, duration: number, success: boolean): void {
    let metrics = this.agentMetrics.get(agent);
    if (!metrics) {
      metrics = {
        calls: [],
        totalDuration: 0,
        successCount: 0,
        failureCount: 0,
      };
      this.agentMetrics.set(agent, metrics);
    }

    metrics.calls.push({ timestamp: Date.now(), duration, success });
    metrics.totalDuration += duration;

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    // Keep only last 100 calls for memory efficiency
    if (metrics.calls.length > 100) {
      metrics.calls.shift();
    }
  }

  /**
   * Get average duration for a specific agent.
   */
  getAgentAverageDuration(agent: string): number {
    const metrics = this.agentMetrics.get(agent);
    if (!metrics || metrics.calls.length === 0) return 0;
    return metrics.totalDuration / metrics.calls.length;
  }

  /**
   * Get success rate for a specific agent (0-1).
   */
  getAgentSuccessRate(agent: string): number {
    const metrics = this.agentMetrics.get(agent);
    if (!metrics) return 0;
    const total = metrics.successCount + metrics.failureCount;
    if (total === 0) return 0;
    return metrics.successCount / total;
  }

  // ── Cache Metrics ──

  /**
   * Record a cache hit.
   */
  recordCacheHit(): void {
    this.cacheMetrics.hits++;
    this.cacheMetrics.totalRequests++;
  }

  /**
   * Record a cache miss.
   */
  recordCacheMiss(): void {
    this.cacheMetrics.misses++;
    this.cacheMetrics.totalRequests++;
  }

  /**
   * Get cache hit rate (0-1).
   */
  getCacheHitRate(): number {
    if (this.cacheMetrics.totalRequests === 0) return 0;
    return this.cacheMetrics.hits / this.cacheMetrics.totalRequests;
  }

  // ── Request Metrics ──

  /**
   * Record a completed request with its duration and success status.
   */
  recordRequest(duration: number, success: boolean): void {
    this.requestMetrics.totalRequests++;
    this.requestMetrics.totalDuration += duration;

    if (success) {
      this.requestMetrics.successfulRequests++;
    } else {
      this.requestMetrics.failedRequests++;
    }
  }

  /**
   * Get average request duration.
   */
  getAverageRequestDuration(): number {
    if (this.requestMetrics.totalRequests === 0) return 0;
    return this.requestMetrics.totalDuration / this.requestMetrics.totalRequests;
  }

  /**
   * Get request success rate (0-1).
   */
  getRequestSuccessRate(): number {
    if (this.requestMetrics.totalRequests === 0) return 0;
    return this.requestMetrics.successfulRequests / this.requestMetrics.totalRequests;
  }

  // ── Summary ──

  /**
   * Get a summary of all metrics.
   */
  getSummary(): {
    uptime: number;
    requests: {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
      successRate: number;
    };
    cache: {
      hits: number;
      misses: number;
      total: number;
      hitRate: number;
    };
    agents: Record<string, {
      calls: number;
      averageDuration: number;
      successRate: number;
    }>;
  } {
    const agents: Record<string, { calls: number; averageDuration: number; successRate: number }> = {};

    for (const [name, metrics] of this.agentMetrics.entries()) {
      agents[name] = {
        calls: metrics.successCount + metrics.failureCount,
        averageDuration: Math.round(this.getAgentAverageDuration(name)),
        successRate: Math.round(this.getAgentSuccessRate(name) * 100) / 100,
      };
    }

    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestMetrics.totalRequests,
        successful: this.requestMetrics.successfulRequests,
        failed: this.requestMetrics.failedRequests,
        averageDuration: Math.round(this.getAverageRequestDuration()),
        successRate: Math.round(this.getRequestSuccessRate() * 100) / 100,
      },
      cache: {
        hits: this.cacheMetrics.hits,
        misses: this.cacheMetrics.misses,
        total: this.cacheMetrics.totalRequests,
        hitRate: Math.round(this.getCacheHitRate() * 100) / 100,
      },
      agents,
    };
  }

  /**
   * Log metrics summary to console.
   */
  logSummary(): void {
    const summary = this.getSummary();
    console.log('[METRICS] Summary:', JSON.stringify(summary, null, 2));
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.agentMetrics.clear();
    this.cacheMetrics = { hits: 0, misses: 0, totalRequests: 0 };
    this.requestMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalDuration: 0,
    };
    this.startTime = Date.now();
  }
}

// ── Singleton Export ──

export const metrics = new MetricsCollector();

// ── Convenience Functions ──

export function recordAgentCall(agent: string, duration: number, success: boolean): void {
  metrics.recordAgentCall(agent, duration, success);
}

export function recordCacheHit(): void {
  metrics.recordCacheHit();
}

export function recordCacheMiss(): void {
  metrics.recordCacheMiss();
}

export function recordRequest(duration: number, success: boolean): void {
  metrics.recordRequest(duration, success);
}

export function getMetricsSummary(): ReturnType<MetricsCollector['getSummary']> {
  return metrics.getSummary();
}
