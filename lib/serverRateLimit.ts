import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Per-route in-memory limiter (single Node instance).
 * For multi-instance deploys, use Redis/Upstash instead.
 */
export function createIpMinuteLimiter(maxPerMinute: number) {
  const rateState = new Map<string, number[]>();
  return function isRateLimited(ip: string, nowMs = Date.now()): {
    limited: boolean;
    retryAfterSec: number;
  } {
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
