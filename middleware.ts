// middleware.ts
// Comprehensive rate limiting and request validation middleware
// Multiple tiers of protection against abuse

import { NextRequest, NextResponse } from 'next/server';

// Export concurrent request tracking for cleanup
export { startConcurrentRequest, endConcurrentRequest };

// Rate limiting stores
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const dailyLimitStore = new Map<string, { count: number; resetDate: string }>();
const concurrentRequests = new Map<string, number>();

// Limits (generous but protective)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute
const DAILY_MAX_REQUESTS = 200; // 200 requests per day per IP (generous!)
const MAX_CONCURRENT_REQUESTS = 2; // Max 2 concurrent requests per IP
const MAX_CODE_LENGTH = 100000; // 100KB max code length
const MAX_REQUEST_SIZE = 102400; // 100KB max request size

/**
 * Extract client IP from request headers.
 * Handles proxy headers (X-Forwarded-For, X-Real-IP) and falls back to connection info.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback: use a combination of headers as identifier
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `unknown-${userAgent.slice(0, 50)}`;
}

/**
 * Clean up expired entries from rate limit stores.
 * Runs periodically to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const today = new Date().toDateString();

  // Clean up per-minute limits
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  // Clean up old daily limits (keep only today's data)
  for (const [key, entry] of dailyLimitStore.entries()) {
    if (entry.resetDate !== today) {
      dailyLimitStore.delete(key);
    }
  }
}

/**
 * Check and update daily request limits.
 */
function checkDailyLimit(clientIp: string): { allowed: boolean; remaining: number; resetTime: string } {
  const today = new Date().toDateString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  let entry = dailyLimitStore.get(clientIp);

  // Reset or initialize daily count
  if (!entry || entry.resetDate !== today) {
    entry = { count: 0, resetDate: today };
    dailyLimitStore.set(clientIp, entry);
  }

  const remaining = Math.max(0, DAILY_MAX_REQUESTS - entry.count);

  if (entry.count >= DAILY_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: tomorrow };
  }

  return { allowed: true, remaining: remaining - 1, resetTime: tomorrow };
}

/**
 * Check and update concurrent request limits.
 */
function checkConcurrentLimit(clientIp: string): { allowed: boolean; current: number } {
  const current = concurrentRequests.get(clientIp) || 0;

  if (current >= MAX_CONCURRENT_REQUESTS) {
    return { allowed: false, current };
  }

  return { allowed: true, current };
}

/**
 * Track concurrent request start.
 */
function startConcurrentRequest(clientIp: string): void {
  const current = concurrentRequests.get(clientIp) || 0;
  concurrentRequests.set(clientIp, current + 1);
}

/**
 * Track concurrent request completion.
 */
function endConcurrentRequest(clientIp: string): void {
  const current = concurrentRequests.get(clientIp) || 0;
  if (current > 0) {
    concurrentRequests.set(clientIp, current - 1);
  }
}

/**
 * Validate request size and content.
 */
function validateRequest(request: NextRequest): { valid: boolean; error?: string } {
  // Check Content-Length header
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  if (contentLength > MAX_REQUEST_SIZE) {
    return { valid: false, error: `Request too large. Maximum ${MAX_REQUEST_SIZE} bytes allowed.` };
  }

  // Content-Length validation is sufficient for middleware
  // Detailed code validation happens in the API route

  return { valid: true };
}

export function middleware(request: NextRequest) {
  // Only apply protections to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const clientIp = getClientIp(request);
  const now = Date.now();

  // Periodic cleanup (every 100 requests)
  if (rateLimitStore.size > 100) {
    cleanupExpiredEntries();
  }

  // ── 1. Request Size Validation ──
  const sizeValidation = validateRequest(request);
  if (!sizeValidation.valid) {
    return new NextResponse(
      JSON.stringify({
        error: sizeValidation.error,
        code: 'REQUEST_TOO_LARGE',
      }),
      {
        status: 413, // Payload Too Large
        headers: {
          'Content-Type': 'application/json',
          'X-Max-Request-Size': String(MAX_REQUEST_SIZE),
          'X-Max-Code-Length': String(MAX_CODE_LENGTH),
        },
      }
    );
  }

  // ── 2. Daily Limit Check ──
  const dailyLimit = checkDailyLimit(clientIp);
  if (!dailyLimit.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: `Daily request limit exceeded. Maximum ${DAILY_MAX_REQUESTS} requests per day. Try again tomorrow.`,
        code: 'DAILY_LIMIT_EXCEEDED',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-Daily-Limit': String(DAILY_MAX_REQUESTS),
          'X-Daily-Remaining': '0',
          'X-Daily-Reset': dailyLimit.resetTime,
          'Retry-After': '86400', // 24 hours in seconds
        },
      }
    );
  }

  // ── 3. Concurrent Request Limit Check ──
  const concurrentLimit = checkConcurrentLimit(clientIp);
  if (!concurrentLimit.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: `Too many concurrent requests. Maximum ${MAX_CONCURRENT_REQUESTS} simultaneous requests allowed.`,
        code: 'CONCURRENT_LIMIT_EXCEEDED',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-Concurrent-Limit': String(MAX_CONCURRENT_REQUESTS),
          'X-Concurrent-Current': String(concurrentLimit.current),
        },
      }
    );
  }

  // ── 4. Per-Minute Rate Limit Check ──
  let entry = rateLimitStore.get(clientIp);

  if (!entry || now > entry.resetTime) {
    // New window - initialize counters
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(clientIp, entry);

    // Update daily counter
    const dailyEntry = dailyLimitStore.get(clientIp)!;
    dailyEntry.count++;

    // Track concurrent request start
    startConcurrentRequest(clientIp);

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX_REQUESTS - 1));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
    response.headers.set('X-Daily-Limit', String(DAILY_MAX_REQUESTS));
    response.headers.set('X-Daily-Remaining', String(dailyLimit.remaining));
    response.headers.set('X-Daily-Reset', dailyLimit.resetTime);
    response.headers.set('X-Concurrent-Limit', String(MAX_CONCURRENT_REQUESTS));
    response.headers.set('X-Concurrent-Current', '1');

    return response;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limited
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    return new NextResponse(
      JSON.stringify({
        error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute. Try again in ${retryAfter} seconds.`,
        code: 'RATE_LIMITED',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
          'X-Daily-Limit': String(DAILY_MAX_REQUESTS),
          'X-Daily-Remaining': String(dailyLimit.remaining),
        },
      }
    );
  }

  // ── 5. All checks passed - allow request ──

  // Increment counters
  entry.count++;
  rateLimitStore.set(clientIp, entry);

  // Update daily counter
  const dailyEntry = dailyLimitStore.get(clientIp)!;
  dailyEntry.count++;

  // Track concurrent request start
  startConcurrentRequest(clientIp);

  // Create response with all limit headers
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX_REQUESTS - entry.count));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
  response.headers.set('X-Daily-Limit', String(DAILY_MAX_REQUESTS));
  response.headers.set('X-Daily-Remaining', String(dailyLimit.remaining));
  response.headers.set('X-Daily-Reset', dailyLimit.resetTime);
  response.headers.set('X-Concurrent-Limit', String(MAX_CONCURRENT_REQUESTS));
  response.headers.set('X-Concurrent-Current', String(concurrentLimit.current + 1));
  response.headers.set('X-Max-Request-Size', String(MAX_REQUEST_SIZE));
  response.headers.set('X-Max-Code-Length', String(MAX_CODE_LENGTH));

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
