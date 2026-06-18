export const SCAN_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  requestsPerMinutePerIp: 12,
} as const;

export function normalizeImageMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/jpg" || m === "image/jpeg") return "image/jpeg";
  if (m === "image/png" || m === "image/webp") return m;
  return null;
}

export function validateImageBuffer(
  buffer: Buffer,
  mimeType: string,
): { ok: true; mimeType: string } | { ok: false; error: string } {
  const mime = normalizeImageMime(mimeType);
  if (!mime) {
    return {
      ok: false,
      error: "JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.",
    };
  }
  if (buffer.length === 0) {
    return { ok: false, error: "이미지 파일이 비어 있습니다." };
  }
  if (buffer.length > SCAN_LIMITS.maxBytes) {
    return {
      ok: false,
      error: `이미지는 ${Math.round(SCAN_LIMITS.maxBytes / (1024 * 1024))}MB 이하여야 합니다.`,
    };
  }
  return { ok: true, mimeType: mime };
}
