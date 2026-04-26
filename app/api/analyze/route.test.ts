import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";

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
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("returns fallback when GEMINI_API_KEY missing", async () => {
    const res = await POST(makeReq({ query: "완전처음보는약" }));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.notice).toBeTruthy();
    expect(json.info?.name).toBeTruthy();
  });

  it("falls back when Gemini returns invalid JSON", async () => {
    process.env.GEMINI_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "{not-json" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const res = await POST(makeReq({ query: "someNewDrug" }, "7.7.7.7"));
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.info?.name).toBe("someNewDrug");
  });

  it("coerces schema-violating Gemini JSON into safe MedicationInfo", async () => {
    process.env.GEMINI_API_KEY = "test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
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
                        category: 123,
                        description: null,
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
      }),
    );

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

  it("falls back on Gemini timeout (AbortError)", async () => {
    process.env.GEMINI_API_KEY = "test";
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: any, init: any) => {
        // Emulate abort.
        const signal: AbortSignal | undefined = init?.signal;
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        await new Promise<void>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
          // never resolve, only abort triggers
        });
        return new Response("never", { status: 200 });
      }),
    );

    const pending = POST(makeReq({ query: "timeoutDrug" }, "5.5.5.5"));
    await vi.advanceTimersByTimeAsync(11_000);
    const res = await pending;
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.source).toBe("fallback");
    expect(json.info?.name).toBe("timeoutDrug");
  });
});

