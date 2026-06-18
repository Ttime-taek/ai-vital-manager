import { NextRequest, NextResponse } from "next/server";
import { findMedication } from "@/lib/medications";
import type { MedicationInfo } from "@/lib/types";
import { coerceMedicationInfoFromUnknown } from "@/lib/medicationSchema";
import { createIpMinuteLimiter, getClientIp } from "@/lib/serverRateLimit";
import { resolveGeminiModel } from "@/lib/geminiModel";
import {
  getCerebrasApiKey,
  getGeminiApiKey,
  hasCerebrasConfigured,
  hasGeminiConfigured,
  hasPlaceholderApiKeys,
} from "@/lib/aiEnv";
import { buildMedicationSystemPrompt } from "@/lib/analyzePrompts";
import {
  buildAnalyzeUserPrompt,
  resolveAnalyzeOutcome,
} from "@/lib/medicationEnrichment";
import {
  isMedicationWebSearchEnabled,
  searchMedicationWebContext,
  type MedicationWebContext,
} from "@/lib/medicationWebSearch";

export const runtime = "nodejs";

const LIMITS = {
  queryMinLen: 1,
  queryMaxLen: 80,
  requestsPerMinutePerIp: 20,
  geminiTimeoutMs: 15_000,
  cerebrasTimeoutMs: 15_000,
};

type AiProvider = "gemini" | "cerebras" | "auto";

function getProviderOrder(): Array<Exclude<AiProvider, "auto">> {
  const raw = (process.env.AI_PROVIDER ?? "auto").toLowerCase();
  if (raw === "gemini") return ["gemini"];
  if (raw === "cerebras") return ["cerebras"];
  return ["gemini", "cerebras"];
}

const isRateLimited = createIpMinuteLimiter(LIMITS.requestsPerMinutePerIp);

function normalizeQuery(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validateQuery(q: string): { ok: true; value: string } | { ok: false; error: string } {
  if (q.length < LIMITS.queryMinLen) return { ok: false, error: "약물 이름을 입력해주세요." };
  if (q.length > LIMITS.queryMaxLen) return { ok: false, error: `약물 이름은 ${LIMITS.queryMaxLen}자 이내로 입력해주세요.` };

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
  recommendedFoods: [
    {
      food: "규칙적인 식사와 함께 복용",
      reason: "위장 부작용을 줄이고 약 효과를 안정적으로 유지하는 일반적 원칙입니다.",
      severity: "medium",
    },
    {
      food: "처방·약사 안내에 맞는 식사 시간",
      reason: "식전/식후/공복 등 복용법에 맞추면 흡수와 효과가 달라질 수 있습니다.",
      severity: "high",
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const normalized = normalizeQuery(body.query ?? "");
  const validated = validateQuery(normalized);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
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
  const aiConfigured = hasGeminiConfigured() || hasCerebrasConfigured();

  if (!aiConfigured) {
    if (local) {
      return NextResponse.json({ info: local, source: "database" });
    }
    let notice: string;
    if (hasPlaceholderApiKeys()) {
      notice =
        "API 키 값이 잘못 입력된 것 같습니다. Vercel Environment Variables에서 GEMINI_API_KEY / CEREBRAS_API_KEY(필수), SERPER_API_KEY(한국어 웹 검색 권장)에 실제 키를 넣어 주세요.";
    } else {
      notice =
        "AI API 키가 설정되어 있지 않아 웹 검색·AI 보강을 수행하지 못했습니다.";
    }
    return NextResponse.json({
      info: FALLBACK_INFO(query),
      source: "fallback",
      notice,
    });
  }

  let web: MedicationWebContext | null = null;
  if (isMedicationWebSearchEnabled()) {
    try {
      web = await searchMedicationWebContext(query, local);
    } catch (err) {
      console.error("[analyze] web search error:", err);
    }
  }

  const order = getProviderOrder();
  const attemptErrors: string[] = [];

  for (const provider of order) {
    if (provider === "gemini" && !hasGeminiConfigured()) continue;
    if (provider === "cerebras" && !hasCerebrasConfigured()) continue;

    try {
      const ai =
        provider === "gemini"
          ? await analyzeWithGemini(query, getGeminiApiKey()!, local, web)
          : await analyzeWithCerebras(query, local, web);

      const providerFallbackNotice =
        attemptErrors.length > 0
          ? "Gemini 한도 또는 오류로 대체 AI 결과를 사용했습니다. 처방전·약사 안내를 우선하세요."
          : undefined;

      const outcome = resolveAnalyzeOutcome({
        query,
        local,
        ai,
        web,
        providerFallbackNotice,
      });

      return NextResponse.json({
        info: outcome.info,
        source: outcome.source,
        provider,
        webSearchUsed: Boolean(web && web.snippets.length > 0),
        ...(outcome.notice ? { notice: outcome.notice } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attemptErrors.push(`${provider}: ${msg}`);
      console.error(`[analyze] ${provider} error:`, err);
    }
  }

  if (local) {
    return NextResponse.json({
      info: local,
      source: "database",
      notice:
        "AI·웹 보강 중 오류가 발생해 로컬 DB 정보를 사용했습니다. 처방전·약사 안내를 우선하세요.",
      debug: process.env.NODE_ENV === "development" ? attemptErrors : undefined,
    });
  }

  let notice: string;
  if (hasPlaceholderApiKeys()) {
    notice =
      "API 키 값이 잘못 입력된 것 같습니다. Vercel Environment Variables에서 GEMINI_API_KEY / CEREBRAS_API_KEY(필수), SERPER_API_KEY(한국어 웹 검색 권장)에 .env.local과 동일한 실제 키를 넣어 주세요.";
  } else {
    notice =
      "웹 검색·AI 분석 중 오류가 발생하여 일반 안내로 대체했습니다. 정확한 정보는 약사·의사에게 확인하세요.";
  }
  return NextResponse.json({
    info: FALLBACK_INFO(query),
    source: "fallback",
    notice,
    debug: process.env.NODE_ENV === "development" ? attemptErrors : undefined,
  });
}

async function analyzeWithGemini(
  query: string,
  apiKey: string,
  localBaseline: MedicationInfo | null,
  web: MedicationWebContext | null,
): Promise<MedicationInfo> {
  const preferred = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const model = await resolveGeminiModel({ apiKey, preferred });
  const systemPrompt = buildMedicationSystemPrompt();
  const userPrompt = buildAnalyzeUserPrompt(query, web, localBaseline);

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

  return coerceMedicationInfoFromUnknown(parsedUnknown, query);
}

async function analyzeWithCerebras(
  query: string,
  localBaseline: MedicationInfo | null,
  web: MedicationWebContext | null,
): Promise<MedicationInfo> {
  const apiKey = getCerebrasApiKey();
  if (!apiKey) throw new Error("CEREBRAS_API_KEY missing");

  const model = process.env.CEREBRAS_MODEL || "llama3.1-70b";
  const base = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const systemPrompt = buildMedicationSystemPrompt();
  const userPrompt = buildAnalyzeUserPrompt(query, web, localBaseline);

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
      max_tokens: 1200,
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
