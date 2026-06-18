export function getUpstreamErrorStatus(err: unknown): number | undefined {
  if (
    err instanceof Error &&
    "status" in err &&
    typeof (err as { status?: number }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

export function isAiQuotaError(status: number | undefined, message = ""): boolean {
  if (status === 429) return true;
  const m = message.toLowerCase();
  return (
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate limit")
  );
}

/** Never forward upstream 429 — clients treat 429 as app rate limit. */
export function clientStatusForUpstreamAi(status: number | undefined): number {
  if (status === 429) return 503;
  if (status && status >= 400 && status < 600) return status;
  return 502;
}

export function userMessageForScanFailure(opts: {
  upstreamStatus?: number;
  message?: string;
}): string {
  if (isAiQuotaError(opts.upstreamStatus, opts.message)) {
    return "AI 서비스 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 약물명을 직접 입력해 주세요.";
  }
  return "라벨 스캔에 실패했습니다. 사진을 더 밝고 선명하게 다시 찍거나, 약물명을 직접 입력해 주세요.";
}
