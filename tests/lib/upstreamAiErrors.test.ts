import { describe, expect, it } from "vitest";
import {
  clientStatusForUpstreamAi,
  isAiQuotaError,
  userMessageForScanFailure,
} from "@/lib/upstreamAiErrors";

describe("upstreamAiErrors", () => {
  it("maps Gemini 429 to client 503", () => {
    expect(clientStatusForUpstreamAi(429)).toBe(503);
  });

  it("detects quota errors", () => {
    expect(isAiQuotaError(429)).toBe(true);
    expect(isAiQuotaError(502, "RESOURCE_EXHAUSTED")).toBe(true);
    expect(isAiQuotaError(500, "internal error")).toBe(false);
  });

  it("returns quota-specific scan message", () => {
    expect(userMessageForScanFailure({ upstreamStatus: 429 })).toContain("사용 한도");
  });
});
