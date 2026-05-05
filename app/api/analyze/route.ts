import { NextRequest, NextResponse } from "next/server";
import { findMedication } from "@/lib/medications";
import type { MedicationInfo } from "@/lib/types";
import { coerceMedicationInfoFromUnknown } from "@/lib/medicationSchema";
import { createIpMinuteLimiter, getClientIp } from "@/lib/serverRateLimit";

export const runtime = "nodejs";

const LIMITS = {
  queryMinLen: 1,
  queryMaxLen: 80,
  requestsPerMinutePerIp: 20,
  geminiTimeoutMs: 10_000,
  cerebrasTimeoutMs: 10_000,
};

type AiProvider = "gemini" | "cerebras" | "auto";

function getProviderOrder(): Array<Exclude<AiProvider, "auto">> {
  const raw = (process.env.AI_PROVIDER ?? "auto").toLowerCase();
  if (raw === "gemini") return ["gemini"];
  if (raw === "cerebras") return ["cerebras"];
  return ["gemini", "cerebras"];
}

function hasGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function hasCerebrasConfigured() {
  return Boolean(process.env.CEREBRAS_API_KEY);
}

const isRateLimited = createIpMinuteLimiter(LIMITS.requestsPerMinutePerIp);

function normalizeQuery(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars
    .replace(/\s+/g, " ")
    .trim();
}

function validateQuery(q: string): { ok: true; value: string } | { ok: false; error: string } {
  if (q.length < LIMITS.queryMinLen) return { ok: false, error: "약물 이름을 입력해주세요." };
  if (q.length > LIMITS.queryMaxLen) return { ok: false, error: `약물 이름은 ${LIMITS.queryMaxLen}자 이내로 입력해주세요.` };

  // Allow: Korean, English, numbers, spaces, hyphen, dot, parentheses, plus, slash, percent.
  // (We keep this permissive enough for common drug names while rejecting obvious garbage.)
  const allowed = /^[0-9A-Za-z\u3131-\u318E\uAC00-\uD7A3 .()+/%-]+$/u;
  if (!allowed.test(q)) {
    return { ok: false, error: "약물 이름에 허용되지 않는 문자가 포함되어 있습니다." };
  }
  return { ok: true, value: q };
}

const FALLBACK_INFO = (name: string): MedicationInfo => ({
  name,
  aliases: [],
  category: "확인 필요",
  description:
    "로컬 DB에 등록되지 않은 약물입니다. 정확한 정보는 의사 또는 약사에게 문의하세요.",
  defaultFrequency: 2,
  foodTiming: "with",
  avoidFoods: [
    {
      food: "알코올 (술)",
      reason: "대부분의 약물은 알코올과 상호작용 위험이 있습니다.",
      severity: "medium",
    },
    {
      food: "자몽·자몽주스",
      reason: "여러 약물의 대사를 방해할 수 있어 일반적 주의가 필요합니다.",
      severity: "medium",
    },
  ],
  notes:
    "AI 또는 로컬 DB에서 정보를 찾지 못했습니다. 처방전과 약국 안내문을 우선 따르세요.",
});

interface AnalyzeBody {
  query: string;
}

export async function POST(req: NextRequest) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const normalized = normalizeQuery(body.query ?? "");
  const validated = validateQuery(normalized);
  if (!validated.ok) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400 },
    );
  }
  const query = validated.value;

  const ip = getClientIp(req);
  const rl = isRateLimited(ip);
  if (rl.limited) {
    return new NextResponse(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfterSec),
      },
    });
  }

  const local = findMedication(query);
  if (local) {
    return NextResponse.json({ info: local, source: "database" });
  }

  const order = getProviderOrder();
  const attemptErrors: string[] = [];

  for (const provider of order) {
    if (provider === "gemini" && !hasGeminiConfigured()) continue;
    if (provider === "cerebras" && !hasCerebrasConfigured()) continue;

    try {
      const info =
        provider === "gemini"
          ? await analyzeWithGemini(query, process.env.GEMINI_API_KEY!)
          : await analyzeWithCerebras(query);

      return NextResponse.json({ info, source: "ai", provider });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attemptErrors.push(`${provider}: ${msg}`);
      console.error(`[analyze] ${provider} error:`, err);
    }
  }

  const configured = hasGeminiConfigured() || hasCerebrasConfigured();
  return NextResponse.json({
    info: FALLBACK_INFO(query),
    source: "fallback",
    notice: configured
      ? "AI 분석 중 오류가 발생하여 일반 안내로 대체했습니다. 정확한 정보는 약사·의사에게 확인하세요."
      : "AI API 키가 설정되어 있지 않아 분석을 수행하지 못했습니다. (.env.local에 GEMINI_API_KEY 또는 CEREBRAS_API_KEY를 추가하세요)",
    debug: process.env.NODE_ENV === "development" ? attemptErrors : undefined,
  });
}

async function analyzeWithGemini(
  query: string,
  apiKey: string,
): Promise<MedicationInfo> {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

  const systemPrompt = `당신은 임상 약사를 보조하는 전문 약물 정보 어시스턴트입니다.
사용자가 입력한 약물 이름에 대해 다음 항목을 JSON으로 반환합니다.
반드시 유효한 JSON만 출력하세요. 마크다운, 주석, 추가 설명 금지.

스키마:
{
  "name": string,                  // 표준 한국어 약물명
  "aliases": string[],             // 국내 흔한 상품명/별칭/영문명
  "category": string,              // 약물 분류 (예: "혈압강하제 (ARB)")
  "description": string,           // 한국어 1~2문장 설명
  "defaultFrequency": 1 | 2 | 3 | 4, // 일반적인 하루 복용 횟수
  "foodTiming": "before" | "with" | "after" | "any",
  "avoidFoods": [
    { "food": string, "reason": string, "severity": "high" | "medium" | "low" }
  ],
  "notes": string                  // 복약 시 추가 주의사항 (선택)
}

규칙:
- 사용자가 한국어/영어/상품명/일반명 어떤 것을 입력해도 표준 약물로 매칭하여 응답.
- 식이 상호작용이 명확히 알려진 항목만 avoidFoods에 포함 (자몽, 우유, 알코올, 비타민K 등).
- 의학적 확신이 없으면 추측하지 말고 description/notes에 "약사 확인 필요" 명시.
- 한국 사용자를 가정하여 한국어로 작성.`;

  const userPrompt = `약물명: ${query}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.geminiTimeoutMs);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });
  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const status = response.status;
    const msg = `Gemini API ${status}: ${bodyText}`;
    const err = new Error(msg);
    (err as any).status = status;
    throw err;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini empty response");

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }

  const coerced = coerceMedicationInfoFromUnknown(parsedUnknown, query);
  return coerced;
}

async function analyzeWithCerebras(query: string): Promise<MedicationInfo> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY missing");

  const model = process.env.CEREBRAS_MODEL || "llama3.1-70b";
  const base = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  const systemPrompt = `당신은 임상 약사를 보조하는 전문 약물 정보 어시스턴트입니다.
사용자가 입력한 약물 이름에 대해 다음 항목을 JSON으로 반환합니다.
반드시 유효한 JSON만 출력하세요. 마크다운, 주석, 추가 설명 금지.

스키마:
{
  "name": string,
  "aliases": string[],
  "category": string,
  "description": string,
  "defaultFrequency": 1 | 2 | 3 | 4,
  "foodTiming": "before" | "with" | "after" | "any",
  "avoidFoods": [
    { "food": string, "reason": string, "severity": "high" | "medium" | "low" }
  ],
  "notes": string
}

규칙:
- 확신이 없으면 추측하지 말고 "약사 확인 필요"를 명시.
- 한국 사용자를 가정하여 한국어로 작성.`;

  const userPrompt = `약물명: ${query}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.cerebrasTimeoutMs);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const status = response.status;
    const err = new Error(`Cerebras API ${status}: ${bodyText}`);
    (err as any).status = status;
    throw err;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Cerebras empty response");

  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(text);
  } catch {
    throw new Error("Cerebras returned invalid JSON");
  }

  return coerceMedicationInfoFromUnknown(parsedUnknown, query);
}
