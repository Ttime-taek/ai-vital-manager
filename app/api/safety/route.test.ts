import { describe, expect, it } from "vitest";
import { POST } from "./route";

function makeReq(body: unknown) {
  const req = new Request("http://localhost/api/safety", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
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

describe("/api/safety", () => {
  it("rejects invalid body", async () => {
    const res = await POST(makeReq({ nope: true }));
    expect(res.status).toBe(400);
  });

  it("returns a conservative verdict shape on valid request", async () => {
    const res = await POST(
      makeReq({
        context: {
          persona: "D",
          pregnantOrLactating: "unknown",
          hasPrescriptionMeds: "unknown",
        },
        items: [{ rawName: "와파린", kind: "drug" }],
      }),
    );
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.verdict).toBeTruthy();
    expect(json.reasonOneLineFree).toBeTruthy();
    expect(json.evidenceStrength).toBeTruthy();
  });

  it("does not include paid fields when paid=false", async () => {
    const res = await POST(
      makeReq({
        context: {
          persona: "D",
          pregnantOrLactating: "no",
          hasPrescriptionMeds: "yes",
        },
        items: [
          { rawName: "와파린", kind: "drug" },
          { rawName: "오메가3", kind: "supplement" },
        ],
        paid: false,
      }),
    );
    const json = await readJson(res);
    expect(json.reasonsPaid).toBeUndefined();
    expect(json.tipsPaid).toBeUndefined();
  });

  it("includes paid fields when paid=true", async () => {
    const res = await POST(
      makeReq({
        context: {
          persona: "D",
          pregnantOrLactating: "no",
          hasPrescriptionMeds: "yes",
        },
        items: [
          { rawName: "와파린", kind: "drug" },
          { rawName: "오메가3", kind: "supplement" },
        ],
        paid: true,
      }),
    );
    const json = await readJson(res);
    expect(Array.isArray(json.reasonsPaid)).toBe(true);
    expect(Array.isArray(json.tipsPaid)).toBe(true);
  });
});

