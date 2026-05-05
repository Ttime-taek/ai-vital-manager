import type {
  EvidenceStrength,
  ItemKind,
  SafetyContext,
  SafetyCta,
  SafetyItemInput,
  SafetyVerdict,
} from "./safetyTypes";

export interface SafetyRuleMatch {
  verdict: SafetyVerdict;
  strength: EvidenceStrength;
  reasonOneLineFree: string;
  reasonsPaid: string[];
  tipsPaid: string[];
  cta: SafetyCta;
}

export interface SafetyRule {
  id: string;
  applies: (ctx: SafetyContext, items: SafetyItemInput[]) => boolean;
  match: SafetyRuleMatch;
}

const strengthRank: Record<EvidenceStrength, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const verdictRank: Record<SafetyVerdict, number> = {
  ban: 4,
  caution: 3,
  insufficient_info: 2,
  ok: 1,
};

export function combineMatches(matches: SafetyRuleMatch[]): SafetyRuleMatch {
  if (matches.length === 0) {
    return {
      verdict: "insufficient_info",
      strength: "low",
      reasonOneLineFree: "정보가 부족해서 안전 여부를 판단할 수 없습니다.",
      reasonsPaid: ["제품명/성분표가 모호하거나, 조건(임신/수유/복용약)이 불명확합니다."],
      tipsPaid: ["정확한 제품명(또는 성분표)과 복용 중인 약 정보를 입력해 주세요."],
      cta: { type: "consult_pharmacist", message: "약사와 상담해 확인하세요." },
    };
  }

  // Most conservative verdict wins.
  const sorted = [...matches].sort((a, b) => verdictRank[b.verdict] - verdictRank[a.verdict]);
  const topVerdict = sorted[0]!;

  // Highest evidence strength across matches, but never claim more than we have.
  const strength = matches.reduce<EvidenceStrength>((acc, m) => {
    return strengthRank[m.strength] > strengthRank[acc] ? m.strength : acc;
  }, "low");

  // Pick the free reason from the most conservative match.
  const reasonOneLineFree = topVerdict.reasonOneLineFree;

  // Paid content: aggregate unique bullets.
  const uniq = (xs: string[]) => Array.from(new Set(xs.map((s) => s.trim()).filter(Boolean)));
  const reasonsPaid = uniq(matches.flatMap((m) => m.reasonsPaid));
  const tipsPaid = uniq(matches.flatMap((m) => m.tipsPaid));

  // CTA: prioritize emergency > doctor > pharmacist > null
  const ctaPriority: Record<NonNullable<SafetyCta["type"]>, number> = {
    emergency: 3,
    consult_doctor: 2,
    consult_pharmacist: 1,
  };
  const cta = matches.reduce<SafetyCta>(
    (best, m) => {
      if (!m.cta.type) return best;
      if (!best.type) return m.cta;
      return ctaPriority[m.cta.type] > ctaPriority[best.type] ? m.cta : best;
    },
    { type: null },
  );

  return {
    verdict: topVerdict.verdict,
    strength,
    reasonOneLineFree,
    reasonsPaid,
    tipsPaid,
    cta,
  };
}

function normalizeName(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function itemNames(items: SafetyItemInput[]): string[] {
  return items.map((i) => normalizeName(i.rawName));
}

function hasAny(items: SafetyItemInput[], keywords: string[]): boolean {
  const names = itemNames(items);
  return keywords.some((k) => {
    const nk = normalizeName(k);
    return names.some((n) => n.includes(nk));
  });
}

function hasKind(items: SafetyItemInput[], kind: ItemKind): boolean {
  return items.some((i) => i.kind === kind);
}

export const SAFETY_RULES_V0: SafetyRule[] = [
  {
    id: "pregnant_unknown",
    applies: (ctx) => ctx.pregnantOrLactating === "unknown",
    match: {
      verdict: "insufficient_info",
      strength: "low",
      reasonOneLineFree: "임신/수유 여부가 불명확해 안전 판정이 어렵습니다.",
      reasonsPaid: ["임신/수유 여부에 따라 금기 성분이 달라질 수 있습니다."],
      tipsPaid: ["임신/수유 여부를 선택한 뒤 다시 확인하세요."],
      cta: { type: "consult_pharmacist", message: "임신/수유 중이면 약사·의사에게 확인하세요." },
    },
  },
  {
    id: "pregnant_retinoid_like",
    applies: (ctx, items) =>
      ctx.pregnantOrLactating === "yes" &&
      hasAny(items, ["비타민A", "레티놀", "retinol"]),
    match: {
      verdict: "caution",
      strength: "medium",
      reasonOneLineFree: "임신/수유 중 비타민 A(레티놀) 계열은 주의가 필요합니다.",
      reasonsPaid: ["임신/수유 중에는 특정 성분이 태아/영유아에 영향을 줄 수 있어 보수적으로 접근해야 합니다."],
      tipsPaid: ["정확한 성분표(비타민 A 형태/함량)를 확인한 뒤 약사·의사와 상담하세요."],
      cta: { type: "consult_doctor", message: "임신/수유 중이면 의사·약사에게 확인하세요." },
    },
  },
  {
    id: "bleeding_risk_combo",
    applies: (_ctx, items) =>
      hasAny(items, ["와파린", "warfarin", "아스피린", "aspirin"]) &&
      hasAny(items, ["은행", "마늘", "ginkgo", "garlic", "오메가3", "omega-3", "fish oil"]),
    match: {
      verdict: "caution",
      strength: "medium",
      reasonOneLineFree: "출혈 위험이 증가할 수 있는 조합입니다.",
      reasonsPaid: ["항응고/항혈소판제와 일부 보충제(은행, 마늘, 오메가3 등)는 출혈 경향을 높일 수 있습니다."],
      tipsPaid: ["복용 전 약사·의사 상담을 권장합니다.", "멍/코피/흑색변 등 출혈 증상이 있으면 즉시 진료가 필요합니다."],
      cta: { type: "consult_doctor", message: "항응고/항혈소판제를 복용 중이면 의사·약사에게 확인하세요." },
    },
  },
  {
    id: "default_ok_low_strength",
    applies: (_ctx, items) => items.length > 0 && hasKind(items, "drug") && hasKind(items, "supplement"),
    match: {
      verdict: "ok",
      strength: "low",
      reasonOneLineFree: "v0 기준, 고위험 신호는 확인되지 않았습니다.",
      reasonsPaid: ["다만 개인차, 용량, 복용 기간, 기저질환에 따라 달라질 수 있습니다."],
      tipsPaid: ["처방약을 복용 중이면 약사에게 한 번 더 확인하는 것이 안전합니다."],
      cta: { type: null },
    },
  },
];

