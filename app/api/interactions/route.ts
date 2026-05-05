import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkDrugInteractions } from "@/lib/checkDrugInteractions";
import { INTERACTION_TIER_LABEL_KO } from "@/lib/interactionLabels";
import type { InteractionCheckResult, InteractionTier } from "@/lib/interactionTypes";
import { mockInteractionRulesSource } from "@/lib/interactionDataSource";
import { checkInteractionsWithOpenFda } from "@/lib/openFdaInteractions";
import { checkInteractionsWithCommercialDb, hasCommercialDbConfigured } from "@/lib/commercialInteractions";
import { createIpMinuteLimiter, getClientIp } from "@/lib/serverRateLimit";

export const runtime = "nodejs";

const LIMITS = {
  drugsMax: 12,
  nameMaxLen: 80,
  geminiTimeoutMs: 12_000,
  requestsPerMinutePerIp: 30,
};

const isRateLimited = createIpMinuteLimiter(LIMITS.requestsPerMinutePerIp);

const BodySchema = z.object({
  drugNames: z.array(z.string().trim().min(1).max(LIMITS.nameMaxLen)).min(2).max(LIMITS.drugsMax),
});

function hasGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function hasCerebrasConfigured() {
  return Boolean(process.env.CEREBRAS_API_KEY);
}

type LlmProvider = "gemini" | "cerebras";
function getLlmOrder(): LlmProvider[] {
  // Optional override for this route only:
  // INTERACTIONS_LLM_ORDER="cerebras,gemini" or "gemini,cerebras"
  const raw = (process.env.INTERACTIONS_LLM_ORDER ?? "").trim().toLowerCase();
  if (raw) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const out: LlmProvider[] = [];
    for (const p of parts) {
      if (p === "gemini" || p === "cerebras") out.push(p);
    }
    const uniq = Array.from(new Set(out));
    if (uniq.length > 0) return uniq;
  }

  // If the app-level AI_PROVIDER is set, respect it as the primary for interactions too.
  // (Fallback to the other if available.)
  const aiProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (aiProvider === "cerebras") return ["cerebras", "gemini"];
  if (aiProvider === "gemini") return ["gemini", "cerebras"];

  // Default: Gemini first, then Cerebras.
  return ["gemini", "cerebras"];
}

async function explainInteractionWithGemini(payload: InteractionCheckResult, apiKey: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const tierLabel = INTERACTION_TIER_LABEL_KO[payload.tier];
  const hitBlock = payload.hits
    .map((h, i) => `${i + 1}) ${h.drugA} + ${h.drugB}: ${h.summaryKo}`)
    .join("\n");

  const systemPrompt = `당신은 한국 사용자를 위한 약물 정보만 제공하는 교육용 어시스턴트입니다.
다음 규칙을 지키세요.
- 진단·처방·복약 지시가 아니라, 왜 해당 등급(주의/병용 금기)이 붙었는지 이해를 돕는 설명만 합니다.
- 2~4문장 한국어로 작성합니다.
- 반드시 "의사 또는 약사와 상담" 문구를 포함합니다.
- 추측으로 새로운 약효나 병명을 단정하지 않습니다.
- 사용자 혼자 용량을 바꾸도록 유도하지 않습니다.`;

  const userPrompt = `판정 등급(앱 라벨): ${tierLabel}
선택된 약(정규화): ${payload.resolvedDrugs.join(", ")}

근거 규칙 요약:
${hitBlock}

한 줄 요약(참고): ${payload.oneLineKo}

위를 바탕으로 사용자에게 이해하기 쉬운 설명만 작성하세요.`;

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
        temperature: 0.25,
      },
    }),
  });
  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`Gemini API ${response.status}: ${bodyText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) throw new Error("Gemini empty response");
  return text;
}

async function explainInteractionWithCerebras(payload: InteractionCheckResult, apiKey: string): Promise<string> {
  const model = process.env.CEREBRAS_MODEL || "llama3.1-70b";
  const base = (process.env.CEREBRAS_BASE_URL || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  const tierLabel = INTERACTION_TIER_LABEL_KO[payload.tier];
  const hitBlock = payload.hits
    .map((h, i) => `${i + 1}) ${h.drugA} + ${h.drugB}: ${h.summaryKo}`)
    .join("\n");

  const systemPrompt = `당신은 한국 사용자를 위한 약물 정보만 제공하는 교육용 어시스턴트입니다.
다음 규칙을 지키세요.
- 진단·처방·복약 지시가 아니라, 왜 해당 등급(주의/병용 금기)이 붙었는지 이해를 돕는 설명만 합니다.
- 2~4문장 한국어로 작성합니다.
- 반드시 "의사 또는 약사와 상담" 문구를 포함합니다.
- 추측으로 새로운 약효나 병명을 단정하지 않습니다.
- 사용자 혼자 용량을 바꾸도록 유도하지 않습니다.`;

  const userPrompt = `판정 등급(앱 라벨): ${tierLabel}
선택된 약(정규화): ${payload.resolvedDrugs.join(", ")}

근거 규칙 요약:
${hitBlock}

한 줄 요약(참고): ${payload.oneLineKo}

위를 바탕으로 사용자에게 이해하기 쉬운 설명만 작성하세요.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.geminiTimeoutMs);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      temperature: 0.25,
      max_tokens: 250,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(`Cerebras API ${response.status}: ${bodyText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Cerebras empty response");
  return text;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ip = getClientIp(req);
  const rl = isRateLimited(ip);
  if (rl.limited) {
    return new NextResponse(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const rules = await mockInteractionRulesSource.getRules();

  const inputCount = parsed.data.drugNames.length;

  const rank: Record<InteractionTier, number> = {
    very_safe: 0,
    caution: 1,
    contraindicated: 2,
  };

  // 1) Fast path: local mock rule engine
  const localResult = checkDrugInteractions(parsed.data.drugNames, rules);
  let result: InteractionCheckResult = localResult;
  let openFdaAttempted = false;
  let commercialAttempted = false;
  let finalSource: "local_rules" | "openfda" | "commercial_db" = "local_rules";

  // 2) Coverage path: if local DB can't resolve, or yields no signal, try openFDA+RxNorm (public APIs)
  const shouldTryOpenFda =
    localResult.unresolvedInputs.length > 0 || localResult.tier === "very_safe";
  if (shouldTryOpenFda) {
    openFdaAttempted = true;
    try {
      const openFda = await checkInteractionsWithOpenFda(parsed.data.drugNames);
      // Prefer openFDA only when it finds a stronger signal than local,
      // or when local couldn't resolve the inputs.
      const openIsWorse = rank[openFda.tier] > rank[result.tier];
      if (openIsWorse || localResult.unresolvedInputs.length > 0) {
        result = openFda;
        finalSource = "openfda";
      }
    } catch (err) {
      console.error("[interactions] openFDA error:", err);
    }
  }

  // 3) Commercial/clinical DB path (if configured): run when we still have gaps
  // (unresolved inputs) or no signal. This keeps the happy-path fast.
  const shouldTryCommercial =
    hasCommercialDbConfigured() &&
    (result.unresolvedInputs.length > 0 || result.tier === "very_safe");
  if (shouldTryCommercial) {
    commercialAttempted = true;
    try {
      const commercial = await checkInteractionsWithCommercialDb(parsed.data.drugNames);
      const commercialIsWorse = rank[commercial.tier] > rank[result.tier];
      const commercialHasBetterCoverage =
        commercial.resolvedDrugs.length > result.resolvedDrugs.length &&
        commercial.unresolvedInputs.length < result.unresolvedInputs.length;

      if (commercialIsWorse || commercialHasBetterCoverage) {
        result = commercial;
        finalSource = "commercial_db";
      }
    } catch (err) {
      console.error("[interactions] commercial DB error:", err);
    }
  }

  const resolvedCount = result.resolvedDrugs.length;
  const unresolvedCount = result.unresolvedInputs.length;
  const coveragePercent =
    inputCount > 0 ? Math.max(0, Math.min(100, Math.round((resolvedCount / inputCount) * 100))) : 0;
  const confidenceTier: "low" | "medium" | "high" =
    coveragePercent >= 85 ? "high" : coveragePercent >= 60 ? "medium" : "low";

  const tierLabelKo = INTERACTION_TIER_LABEL_KO[result.tier];
  let llmExplanation: string | undefined;
  let llmNotice: string | undefined;
  let llmProvider: "gemini" | "cerebras" | undefined;

  const needsLlm =
    result.tier === "caution" ||
    result.tier === "contraindicated";

  if (needsLlm) {
    const order = getLlmOrder();
    const errors: Array<{ provider: LlmProvider; message: string }> = [];

    for (const p of order) {
      if (p === "gemini") {
        if (!hasGeminiConfigured()) continue;
        try {
          llmExplanation = await explainInteractionWithGemini(result, process.env.GEMINI_API_KEY!);
          llmProvider = "gemini";
          break;
        } catch (err) {
          console.error("[interactions] Gemini error:", err);
          errors.push({ provider: "gemini", message: err instanceof Error ? err.message : String(err) });
        }
      } else {
        if (!hasCerebrasConfigured()) continue;
        try {
          llmExplanation = await explainInteractionWithCerebras(result, process.env.CEREBRAS_API_KEY!);
          llmProvider = "cerebras";
          break;
        } catch (err) {
          console.error("[interactions] Cerebras error:", err);
          errors.push({ provider: "cerebras", message: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    if (!llmExplanation) {
      if (!hasGeminiConfigured() && !hasCerebrasConfigured()) {
        llmNotice = "GEMINI_API_KEY/CEREBRAS_API_KEY가 없어 AI 설명 대신 근거 요약만 표시합니다.";
      } else {
        llmNotice =
          "설명 생성에 실패했습니다. 아래 요약 근거를 참고하고, 정확한 복약은 약사·의사에게 문의하세요.";
      }
    } else if (errors.length > 0) {
      // Only show a notice if we actually fell back.
      const firstErr = errors[0];
      const used = llmProvider === "gemini" ? "Gemini" : "Cerebras";
      const failed = firstErr.provider === "gemini" ? "Gemini" : "Cerebras";
      if (failed !== used) {
        llmNotice = `${failed} 오류로 ${used} 기반 설명으로 대체했습니다.`;
      }
    }
  }

  return NextResponse.json({
    tier: result.tier,
    tierLabelKo,
    resolvedDrugs: result.resolvedDrugs,
    unresolvedInputs: result.unresolvedInputs,
    hits: result.hits,
    oneLineKo: result.oneLineKo,
    evidence: {
      finalSource,
      sourcesTried: [
        "local_rules",
        ...(openFdaAttempted ? (["openfda"] as const) : []),
        ...(commercialAttempted ? (["commercial_db"] as const) : []),
      ],
    },
    coverage: {
      inputCount,
      resolvedCount,
      unresolvedCount,
      percent: coveragePercent,
      confidence: confidenceTier,
      note:
        finalSource === "commercial_db"
          ? "상용/의료 DB API 기반으로 판정했습니다."
          : finalSource === "openfda"
            ? "공개 API(RxNorm+openFDA 라벨) 기반으로 판정했습니다."
            : "로컬 규칙(목 데이터) 기반으로 판정했습니다.",
    },
    ...(llmExplanation ? { llmExplanation } : {}),
    ...(llmProvider ? { llmProvider } : {}),
    ...(llmNotice ? { notice: llmNotice } : {}),
  });
}
