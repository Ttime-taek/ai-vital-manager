import type { InteractionCheckResult, InteractionRuleHit, InteractionTier } from "@/lib/interactionTypes";

/**
 * Vendor-agnostic commercial/clinical drug interaction API adapter.
 *
 * Configure via env:
 * - COMMERCIAL_DI_API_BASE_URL: e.g. https://vendor.example.com/api
 * - COMMERCIAL_DI_API_KEY: bearer token (or vendor-specific key)
 * - COMMERCIAL_DI_TIMEOUT_MS: optional, default 8000
 *
 * Expected endpoint:
 * POST {BASE_URL}/interactions
 * Body: { drugNames: string[] }
 * Response (recommended shape):
 * {
 *   tier: "very_safe" | "caution" | "contraindicated",
 *   resolvedDrugs: string[],
 *   unresolvedInputs: string[],
 *   hits: Array<{ drugA: string, drugB: string, tier: InteractionTier, summaryKo: string, ruleId: string }>,
 *   oneLineKo: string
 * }
 *
 * If your vendor uses a different schema, adapt it here only (keep the rest of the app stable).
 */

function coerceTier(v: unknown): InteractionTier {
  if (v === "very_safe" || v === "caution" || v === "contraindicated") return v;
  return "very_safe";
}

function ensureStringArray(v: unknown, max = 50): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function coerceHits(v: unknown, max = 50): InteractionRuleHit[] {
  if (!Array.isArray(v)) return [];
  const out: InteractionRuleHit[] = [];
  for (const item of v.slice(0, max)) {
    if (typeof item !== "object" || !item) continue;
    const obj = item as Record<string, unknown>;
    const drugA = typeof obj.drugA === "string" ? obj.drugA.trim() : "";
    const drugB = typeof obj.drugB === "string" ? obj.drugB.trim() : "";
    const summaryKo = typeof obj.summaryKo === "string" ? obj.summaryKo.trim() : "";
    const ruleId = typeof obj.ruleId === "string" ? obj.ruleId.trim() : "";
    if (!drugA || !drugB || !summaryKo || !ruleId) continue;
    out.push({
      drugA,
      drugB,
      tier: coerceTier(obj.tier),
      summaryKo,
      ruleId,
    });
  }
  return out;
}

export function hasCommercialDbConfigured() {
  return Boolean(process.env.COMMERCIAL_DI_API_BASE_URL && process.env.COMMERCIAL_DI_API_KEY);
}

export async function checkInteractionsWithCommercialDb(
  drugNames: string[],
): Promise<InteractionCheckResult> {
  const base = (process.env.COMMERCIAL_DI_API_BASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.COMMERCIAL_DI_API_KEY ?? "";
  if (!base || !key) {
    throw new Error("Commercial DI API is not configured");
  }

  const url = `${base}/interactions`;
  const timeoutMs = Number(process.env.COMMERCIAL_DI_TIMEOUT_MS ?? "8000") || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    signal: controller.signal,
    body: JSON.stringify({ drugNames }),
  });

  clearTimeout(timer);

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`Commercial DI API ${res.status}: ${bodyText}`);
  }

  const raw = (await res.json()) as unknown;
  const obj = (typeof raw === "object" && raw) ? (raw as Record<string, unknown>) : {};

  const tier = coerceTier(obj.tier);
  const resolvedDrugs = ensureStringArray(obj.resolvedDrugs);
  const unresolvedInputs = ensureStringArray(obj.unresolvedInputs);
  const hits = coerceHits(obj.hits);
  const oneLineKo =
    typeof obj.oneLineKo === "string" && obj.oneLineKo.trim()
      ? obj.oneLineKo.trim()
      : tier === "very_safe"
        ? "현재 범위(상용/의료 DB)에서는 함께 복용 시 뚜렷한 위험 신호가 확인되지 않았습니다. 개인 상태·용량·기간에 따라 달라질 수 있어요."
        : tier === "caution"
          ? "주의가 필요한 조합 신호가 있습니다(상용/의료 DB 기반)."
          : "병용 금기 가능성이 있는 조합 신호가 있습니다(상용/의료 DB 기반).";

  return { tier, resolvedDrugs, unresolvedInputs, hits, oneLineKo };
}

