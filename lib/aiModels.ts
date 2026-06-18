/** Shared LLM defaults — keep in sync with .env.example */
export const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
export const DEFAULT_CEREBRAS_MODEL = "gpt-oss-120b";

export function getGeminiModelPreference(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function getCerebrasModelId(): string {
  return process.env.CEREBRAS_MODEL?.trim() || DEFAULT_CEREBRAS_MODEL;
}

/** User-facing hint from provider attempt errors (no raw API bodies). */
export function summarizeAiAttemptErrors(errors: string[]): string | undefined {
  if (errors.length === 0) return undefined;

  const hints: string[] = [];
  const joined = errors.join(" ").toLowerCase();

  if (joined.includes("429") || joined.includes("resource_exhausted") || joined.includes("quota")) {
    hints.push("Gemini 사용 한도 초과");
  }
  if (joined.includes("404") && joined.includes("model")) {
    hints.push("AI 모델 이름 확인 필요(CEREBRAS_MODEL)");
  }
  if (joined.includes("401") || joined.includes("403") || joined.includes("invalid api key")) {
    hints.push("API 키 확인 필요");
  }
  if (joined.includes("abort") || joined.includes("timeout")) {
    hints.push("응답 시간 초과");
  }
  if (joined.includes("invalid json") || joined.includes("empty response")) {
    hints.push("AI 응답 형식 오류");
  }

  if (hints.length === 0) hints.push("AI 서버 오류");
  return [...new Set(hints)].join(", ");
}
