// lib/cache.ts
// Multi-tier caching system for AI code review responses
// Tiers: exact-match → semantic → prefix cache → retrieval cache

import { CacheEntry } from '@/types/review';

// ── Configuration ──

const EXACT_MATCH_TTL_MS = 60 * 60 * 1000; // 1 hour
const SEMANTIC_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 500;
const MAX_CACHE_SIZE_MB = 50;

// ── In-Memory Cache Store ──

class ReviewCache {
  private exactMatchCache: Map<string, CacheEntry> = new Map();
  private ragCache: Map<string, CacheEntry> = new Map();
  private totalSizeBytes: number = 0;

  // ── Exact-Match Cache ──

  /**
   * Generate a deterministic cache key from review parameters.
   * Key = hash of (code + language + agent_name + model_version)
   */
  generateExactKey(code: string, language: string, agentName: string, modelVersion: string): string {
    const raw = `${code.trim()}|${language}|${agentName}|${modelVersion}`;
    return this.simpleHash(raw);
  }

  getExactMatch(key: string): string | null {
    const entry = this.exactMatchCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.exactMatchCache.delete(key);
      this.totalSizeBytes -= entry.value.length * 2; // UTF-16
      return null;
    }

    return entry.value;
  }

  setExactMatch(key: string, value: string, modelVersion: string): void {
    // Evict if cache is full
    if (this.exactMatchCache.size >= MAX_CACHE_ENTRIES) {
      this.evictOldest(this.exactMatchCache);
    }

    // Evict if size limit exceeded
    const entrySize = value.length * 2;
    if (this.totalSizeBytes + entrySize > MAX_CACHE_SIZE_MB * 1024 * 1024) {
      this.evictOldest(this.exactMatchCache);
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: EXACT_MATCH_TTL_MS,
      modelVersion,
    };

    this.exactMatchCache.set(key, entry);
    this.totalSizeBytes += entrySize;
  }

  // ── RAG Cache ──

  generateRAGKey(query: string, source: string): string {
    const raw = `${query.trim()}|${source}`;
    return `rag:${this.simpleHash(raw)}`;
  }

  getRAGResult(key: string): string | null {
    const entry = this.ragCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.ragCache.delete(key);
      return null;
    }

    return entry.value;
  }

  setRAGResult(key: string, value: string): void {
    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: SEMANTIC_TTL_MS,
      modelVersion: 'rag-v1',
    };

    this.ragCache.set(key, entry);
  }

  // ── Cache Statistics ──

  getStats(): { exactMatchSize: number; ragSize: number; totalSizeMB: number } {
    return {
      exactMatchSize: this.exactMatchCache.size,
      ragSize: this.ragCache.size,
      totalSizeMB: this.totalSizeBytes / (1024 * 1024),
    };
  }

  clear(): void {
    this.exactMatchCache.clear();
    this.ragCache.clear();
    this.totalSizeBytes = 0;
  }

  // ── Private Helpers ──

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private evictOldest(cache: Map<string, CacheEntry>): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = cache.get(oldestKey);
      if (entry) {
        this.totalSizeBytes -= entry.value.length * 2;
      }
      cache.delete(oldestKey);
    }
  }
}

// ── Singleton Export ──

export const reviewCache = new ReviewCache();

// ── Convenience Functions ──

export function getCachedReview(
  code: string,
  language: string,
  agentName: string,
  modelVersion: string
): string | null {
  const key = reviewCache.generateExactKey(code, language, agentName, modelVersion);
  return reviewCache.getExactMatch(key);
}

export function setCachedReview(
  code: string,
  language: string,
  agentName: string,
  modelVersion: string,
  content: string
): void {
  const key = reviewCache.generateExactKey(code, language, agentName, modelVersion);
  reviewCache.setExactMatch(key, content, modelVersion);
}

export function getCachedRAG(query: string, source: string): string | null {
  const key = reviewCache.generateRAGKey(query, source);
  return reviewCache.getRAGResult(key);
}

export function setCachedRAG(query: string, source: string, content: string): void {
  const key = reviewCache.generateRAGKey(query, source);
  reviewCache.setRAGResult(key, content);
}
