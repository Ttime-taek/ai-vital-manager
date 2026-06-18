import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { POST } from "@/app/api/scan/route";

function makeJsonReq(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }) as any;
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/api/scan", () => {
  it("rejects missing imageBase64", async () => {
    const res = await POST(makeJsonReq({}));
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.error).toBeTruthy();
  });

  it("rejects unsupported content type", async () => {
    const req = new Request("http://localhost/api/scan", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "hello",
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it("returns 503 when Gemini key missing", async () => {
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const res = await POST(
      makeJsonReq({
        imageBase64: tinyPng.toString("base64"),
        mimeType: "image/png",
      }),
    );
    expect(res.status).toBe(503);
    const json = await readJson(res);
    expect(json.error).toContain("GEMINI");
  });

  it("rate limits after many requests", async () => {
    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const body = {
      imageBase64: tinyPng.toString("base64"),
      mimeType: "image/png",
    };
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await POST(makeJsonReq(body, "7.7.7.7"));
    }
    expect(last).not.toBeNull();
    expect(last!.status).toBe(429);
  });
});
