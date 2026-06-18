import { describe, expect, it } from "vitest";
import { summarizeAiAttemptErrors } from "@/lib/aiModels";

describe("summarizeAiAttemptErrors", () => {
  it("detects quota and model errors", () => {
    const hint = summarizeAiAttemptErrors([
      "gemini: Gemini API 429: RESOURCE_EXHAUSTED",
      "cerebras: Cerebras API 404: model_not_found",
    ]);
    expect(hint).toContain("Gemini 사용 한도 초과");
    expect(hint).toContain("AI 모델 이름");
  });
});
