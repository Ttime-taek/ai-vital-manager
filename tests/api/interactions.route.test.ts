import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/interactions/route";

function makeReq(body: unknown) {
  const req = new Request("http://localhost/api/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
  return req as any;
}

async function readJson(res: Response) {
  const text = await res.text();
  return JSON.parse(text);
}

describe("/api/interactions", () => {
  const origKey = process.env.GEMINI_API_KEY;
  const origCerebras = process.env.CEREBRAS_API_KEY;
  const origOrder = process.env.INTERACTIONS_LLM_ORDER;
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.INTERACTIONS_LLM_ORDER;
    globalThis.fetch = vi.fn(async () => new Response("{}", { status: 500 })) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    if (origCerebras !== undefined) process.env.CEREBRAS_API_KEY = origCerebras;
    else delete process.env.CEREBRAS_API_KEY;
    if (origOrder !== undefined) process.env.INTERACTIONS_LLM_ORDER = origOrder;
    else delete process.env.INTERACTIONS_LLM_ORDER;
  });

  it("rejects fewer than two drug names", async () => {
    const res = await POST(makeReq({ drugNames: ["와파린"] }));
    expect(res.status).toBe(400);
  });

  it("returns tier labels and mock hits for 와파린 + 아스피린 without calling Gemini when no key", async () => {
    const res = await POST(makeReq({ drugNames: ["와파린", "아스피린"] }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.tier).toBe("contraindicated");
    expect(json.tierLabelKo).toBe("병용 금기");
    expect(Array.isArray(json.hits)).toBe(true);
    expect(json.notice).toMatch(/GEMINI_API_KEY|CEREBRAS_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns caution tier for acetaminophen + ibuprofen aliases", async () => {
    const res = await POST(makeReq({ drugNames: ["타이레놀", "이부프로펜"] }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.tier).toBe("caution");
    expect(json.tierLabelKo).toBe("주의 필요");
  });

  it("uses Gemini when both keys exist and order prefers gemini", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.CEREBRAS_API_KEY = "test-cerebras";
    process.env.INTERACTIONS_LLM_ORDER = "gemini,cerebras";

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "의사 또는 약사와 상담하세요." }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("api.cerebras.ai")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "의사 또는 약사와 상담하세요." } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 500 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const res = await POST(makeReq({ drugNames: ["와파린", "아스피린"] }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.llmProvider).toBe("gemini");
    expect(json.llmExplanation).toMatch(/상담/);
    expect(json.notice ?? "").not.toMatch(/대체/);
  });

  it("uses Cerebras when both keys exist and order prefers cerebras", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.CEREBRAS_API_KEY = "test-cerebras";
    process.env.INTERACTIONS_LLM_ORDER = "cerebras,gemini";

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("api.cerebras.ai")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "반드시 **의사 또는 약사와 상담**하세요." } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "의사 또는 약사와 상담하세요." }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 500 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const res = await POST(makeReq({ drugNames: ["와파린", "아스피린"] }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.llmProvider).toBe("cerebras");
    expect(json.llmExplanation).toMatch(/상담/);
    expect(json.llmExplanation).not.toContain("**");
    expect(json.notice ?? "").not.toMatch(/대체/);
  });

  it("falls back to Cerebras when gemini fails (both keys exist)", async () => {
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.CEREBRAS_API_KEY = "test-cerebras";
    process.env.INTERACTIONS_LLM_ORDER = "gemini,cerebras";

    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response("{}", { status: 500 });
      }
      if (url.includes("api.cerebras.ai")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "의사 또는 약사와 상담하세요." } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 500 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const res = await POST(makeReq({ drugNames: ["와파린", "아스피린"] }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.llmProvider).toBe("cerebras");
    expect(json.notice).toMatch(/대체/);
  });
});
