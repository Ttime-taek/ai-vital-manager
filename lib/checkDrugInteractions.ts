import { findMedication } from "@/lib/medications";
import type { InteractionCheckResult, InteractionRuleHit, InteractionTier } from "@/lib/interactionTypes";
import type { MockInteractionPairRule } from "@/lib/interactionMockData";

const TIER_RANK: Record<InteractionTier, number> = {
  very_safe: 0,
  caution: 1,
  contraindicated: 2,
};

function sortPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function buildRuleIndex(rules: MockInteractionPairRule[]): Map<string, MockInteractionPairRule> {
  const m = new Map<string, MockInteractionPairRule>();
  for (const r of rules) {
    const [x, y] = sortPair(r.drugA, r.drugB);
    m.set(`${x}||${y}`, r);
  }
  return m;
}

function worse(a: InteractionTier, b: InteractionTier): InteractionTier {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export function resolveToCanonicalName(input: string): string | null {
  const med = findMedication(input.trim());
  return med ? med.name : null;
}

/**
 * 2개 이상의 약물(표준명 또는 별칭)에 대해 목 규칙 기반 상호작용 최악 등급을 계산합니다.
 * 규칙이 없는 쌍은 `very_safe`로 간주합니다.
 */
export function checkDrugInteractions(
  drugInputs: string[],
  rules: MockInteractionPairRule[],
): InteractionCheckResult {
  if (drugInputs.length < 2) {
    return {
      resolvedDrugs: [],
      unresolvedInputs: [],
      tier: "very_safe",
      hits: [],
      oneLineKo: "상호작용을 확인하려면 약물을 2개 이상 선택하세요.",
    };
  }

  const resolved: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  for (const raw of drugInputs) {
    const name = resolveToCanonicalName(raw);
    if (!name) {
      unresolved.push(raw.trim());
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);
    resolved.push(name);
  }

  if (resolved.length < 2) {
    return {
      resolvedDrugs: resolved,
      unresolvedInputs: unresolved,
      tier: "very_safe",
      hits: [],
      oneLineKo: "상호작용을 확인하려면 약물을 2개 이상 선택하세요.",
    };
  }

  const idx = buildRuleIndex(rules);

  let worstTier: InteractionTier = "very_safe";
  const allHits: InteractionRuleHit[] = [];

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i]!;
      const b = resolved[j]!;
      const [x, y] = sortPair(a, b);
      const hit = idx.get(`${x}||${y}`);
      if (!hit) continue;
      worstTier = worse(worstTier, hit.tier);
      allHits.push({
        drugA: hit.drugA,
        drugB: hit.drugB,
        tier: hit.tier,
        summaryKo: hit.summaryKo,
        ruleId: hit.ruleId,
      });
    }
  }

  const worstHits = allHits.filter((h) => h.tier === worstTier);

  const oneLineKo =
    worstTier === "very_safe"
      ? "현재 범위(로컬 규칙)에서는 함께 복용 시 뚜렷한 위험 신호가 확인되지 않았습니다. 개인 상태·용량·기간에 따라 달라질 수 있어요."
      : worstTier === "caution"
        ? "주의가 필요한 조합이 포함되어 있을 수 있습니다. 아래 근거를 확인하고 전문가와 상담하세요."
        : "병용 금기 신호가 있는 조합이 포함될 수 있습니다. 복용 전 반드시 전문가와 상담하세요.";

  return {
    resolvedDrugs: resolved,
    unresolvedInputs: unresolved,
    tier: worstTier,
    hits: worstHits,
    oneLineKo,
  };
}

