import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Basic in-memory IP rate-limiter – suitable for small projects & demos. For
// production workloads, migrate to a durable KV/Redis solution (e.g. Upstash).
// ---------------------------------------------------------------------------
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per IP per WINDOW_MS

// [key: ip] => { count, expires }
const ipMap = new Map<string, { count: number; expires: number }>();

function rateLimit(req: NextRequest): NextResponse | undefined {
  const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const ip = (ipHeader.split(',')[0] || 'unknown').trim();
  const now = Date.now();

  const entry = ipMap.get(ip);

  if (!entry || entry.expires < now) {
    ipMap.set(ip, { count: 1, expires: now + WINDOW_MS });
    return undefined;
  }

  if (entry.count >= MAX_REQUESTS) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  entry.count += 1;
  return undefined;
}

const composedMiddleware = clerkMiddleware((auth, req: NextRequest) => {
  const rateRes = rateLimit(req);
  if (rateRes) return rateRes;

  return NextResponse.next();
});

export default composedMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}