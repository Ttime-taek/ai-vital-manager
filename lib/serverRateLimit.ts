import type { NextRequest } from "next/server";

/** Best-effort client IP for Vercel / reverse proxies. */
export function getClientIp(req: NextRequest): string {
  const vercel = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  return "unknown";
}

export type RateLimitResult = {
  limited: boolean;
  retryAfterSec: number;
};

/**
 * Per-route in-memory limiter (single Node instance).
 * For multi-instance deploys, use Redis/Upstash instead.
 */
export function createIpMinuteLimiter(maxPerMinute: number) {
  const rateState = new Map<string, number[]>();
  return function isRateLimited(ip: string, nowMs = Date.now()): RateLimitResult {
    const windowMs = 60_000;
    const cutoff = nowMs - windowMs;
    const times = (rateState.get(ip) ?? []).filter((t) => t > cutoff);
    times.push(nowMs);
    rateState.set(ip, times);
    const over = times.length > maxPerMinute;
    const oldestInWindow = times[0] ?? nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - nowMs) / 1000));
    return { limited: over, retryAfterSec };
  };
}

/**
 * Applies IP rate limit. Skips throttling when IP cannot be determined so
 * unrelated users are not grouped into one shared "unknown" bucket.
 */
export function checkIpRateLimit(
  limiter: (ip: string) => RateLimitResult,
  ip: string,
): RateLimitResult {
  if (ip === "unknown") {
    return { limited: false, retryAfterSec: 0 };
  }
  return limiter(ip);
}
