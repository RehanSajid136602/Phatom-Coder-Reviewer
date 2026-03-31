// middleware.ts
// Rate limiting middleware for API routes
// Limits to 10 requests per minute per IP address

import { NextRequest, NextResponse } from 'next/server';

// In-memory rate limit store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

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
 * Clean up expired entries from the rate limit store.
 * Runs periodically to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const clientIp = getClientIp(request);
  const now = Date.now();

  // Cleanup expired entries periodically (every 100 requests)
  if (rateLimitStore.size > 100) {
    cleanupExpiredEntries();
  }

  let entry = rateLimitStore.get(clientIp);

  if (!entry || now > entry.resetTime) {
    // New window
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    rateLimitStore.set(clientIp, entry);

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX_REQUESTS - 1));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
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
        },
      }
    );
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(clientIp, entry);

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX_REQUESTS - entry.count));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
