import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/analyze/route";

function makeReq(body: unknown, ip = "1.2.3.4") {
  const req = new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
  // NextRequest is compatible with Web Request in route handlers
  return req as any;
}

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.CEREBRAS_API_KEY;
  delete process.env.CEREBRAS_MODEL;
  delete process.env.CEREBRAS_BASE_URL;
  delete process.env.AI_PROVIDER;
  delete process.env.MEDICATION_WEB_SEARCH;
  delete process.env.SERPER_API_KEY;
  delete process.env.TAVILY_API_KEY;
});

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
  vi.useRealTimers();
});

describe("/api/analyze", () => {
  it("rejects empty query", async () => {
    const res = await POST(makeReq({ query: "   " }));
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.error).toBeTruthy();
  });

  it("rejects too long query", async () => {
    const long = "a".repeat(200);
    const res = await POST(makeReq({ query: long }));
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(String(json.error)).toContain("80");
  });

  it("rate limits after many requests per minute from same IP", async () => {
    // No GEMINI key, so requests are cheap and hit fallback, but limiter should still trigger.
    let last: Response | null = null;
    for (let i = 0; i < 25; i++) {
      last = await POST(makeReq({ query: "unknownmed" }, "9.9.9.9"));
    }
    expect(last).not.toBeNull();
    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns local DB for known drug when AI keys missing", async () => {
    const res = await POST(makeReq({ query: "타이레놀" }, "8.8.8.8"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("database");
    expect(json.info?.name).toBe("아세트아미노펜");
  });

  it("returns fallback when GEMINI_API_KEY missing", async () => {
    const res = await POST(makeReq({ query: "완전처음보는약" }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.notice).toBeTruthy();
    expect(json.info?.name).toBeTruthy();
  });

  it("rejects placeholder API keys like Gemini/CEREBRAS labels", async () => {
    process.env.GEMINI_API_KEY = "Gemini";
    process.env.CEREBRAS_API_KEY = "CEREBRAS";
    const res = await POST(makeReq({ query: "완전처음보는약" }, "2.2.2.3"));
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.notice).toMatch(/잘못 입력/);
  });

  it("uses Cerebras when only CEREBRAS_API_KEY is set", async () => {
    process.env.CEREBRAS_API_KEY = "test";
    process.env.CEREBRAS_MODEL = "any";
    process.env.CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
    process.env.AI_PROVIDER = "auto";
    process.env.MEDICATION_WEB_SEARCH = "0";

    globalThis.fetch = vi.fn(async (url: any) => {
        const u = String(url);
        expect(u).toContain("api.cerebras.ai");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    name: "세레브라스약",
                    aliases: [],
                    category: "확인 필요",
                    description: "약사 확인 필요",
                    defaultFrequency: 2,
                    foodTiming: "with",
                    avoidFoods: [],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }) as typeof fetch;

    const res = await POST(makeReq({ query: "cerebrasOnly" }, "4.4.4.4"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("uncertain");
    expect(json.provider).toBe("cerebras");
    expect(json.notice).toBeTruthy();
    expect(json.info?.name).toBe("세레브라스약");
  });

  it("falls back from Gemini to Cerebras when Gemini fails", async () => {
    process.env.GEMINI_API_KEY = "test";
    process.env.CEREBRAS_API_KEY = "test";
    process.env.CEREBRAS_MODEL = "any";
    process.env.CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
    process.env.AI_PROVIDER = "auto";
    process.env.MEDICATION_WEB_SEARCH = "0";

    globalThis.fetch = vi.fn(async (url: any) => {
        const u = String(url);
        if (u.includes("generativelanguage.googleapis.com")) {
          return new Response("rate limited", { status: 429 });
        }
        if (u.includes("api.cerebras.ai")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      name: "대체성공",
                      aliases: [],
                      category: "확인 필요",
                      description: "약사 확인 필요",
                      defaultFrequency: 2,
                      foodTiming: "with",
                      avoidFoods: [],
                    }),
                  },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("unknown", { status: 500 });
    }) as typeof fetch;

    const res = await POST(makeReq({ query: "dualProvider" }, "3.3.3.3"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("uncertain");
    expect(json.provider).toBe("cerebras");
    expect(json.notice).toBeTruthy();
    expect(json.info?.name).toBe("대체성공");
  });

  it("falls back when Gemini returns invalid JSON", async () => {
    process.env.GEMINI_API_KEY = "test";
    process.env.MEDICATION_WEB_SEARCH = "0";
    globalThis.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{not-json" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }) as typeof fetch;

    const res = await POST(makeReq({ query: "someNewDrug" }, "7.7.7.7"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.info?.name).toBe("someNewDrug");
  });

  it("coerces schema-violating Gemini JSON into safe MedicationInfo", async () => {
    process.env.GEMINI_API_KEY = "test";
    process.env.MEDICATION_WEB_SEARCH = "0";
    globalThis.fetch = vi.fn(async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        name: "X",
                        aliases: "not-an-array",
                        category: "테스트 분류",
                        description: "테스트 설명",
                        defaultFrequency: 0,
                        foodTiming: "sometimes",
                        avoidFoods: [{ food: 1, reason: 2, severity: "critical" }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }) as typeof fetch;

    const res = await POST(makeReq({ query: "schemabreaker" }, "6.6.6.6"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("ai");
    expect(json.info?.name).toBe("X");
    // Coerced defaults
    expect(json.info?.defaultFrequency).toBe(2);
    expect(json.info?.foodTiming).toBe("with");
    // Invalid avoidFoods items are dropped
    expect(Array.isArray(json.info?.avoidFoods)).toBe(true);
  });

  it.skipIf(typeof vi.advanceTimersByTimeAsync !== "function")(
    "falls back on Gemini timeout (AbortError)",
    async () => {
    process.env.GEMINI_API_KEY = "test";
    process.env.MEDICATION_WEB_SEARCH = "0";
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (_url: any, init: any) => {
        const signal: AbortSignal | undefined = init?.signal;
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
        return new Response("never", { status: 200 });
    }) as typeof fetch;

    const pending = POST(makeReq({ query: "timeoutDrug" }, "5.5.5.5"));
    await vi.advanceTimersByTimeAsync!(11_000);
    const res = await pending;
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.info?.name).toBe("timeoutDrug");
  },
  );
});

