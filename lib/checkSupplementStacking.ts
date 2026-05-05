import type { SupplementIngredientId, SupplementProfile } from "@/lib/supplementTypes";

export type IngredientIntake = {
  ingredient: SupplementIngredientId;
  total: number;
  /** 단위 표기(권장): mg, mcg, IU 등 */
  unit?: string;
  /** 해당 성분이 들어있는 제품들 */
  sources: Array<{ supplement: string; amount: number }>;
  /** 위험도(임계값 대비) */
  risk: "low" | "medium" | "high";
  /** 사용자에게 보여줄 한 줄 문구 */
  messageKo: string;
};

export type SupplementSynergyFinding = {
  /** 충돌을 일으키는 두 성분 */
  pair: [SupplementIngredientId, SupplementIngredientId];
  /** 어떤 제품 조합에서 감지됐는지 */
  supplementsInvolved: string[];
  /** 사용자 메시지 */
  messageKo: string;
  /** 권장 행동 */
  actionKo: string;
  severity: "low" | "medium" | "high";
};

export type SupplementStackingReport = {
  /** 입력 제품 목록 */
  supplements: string[];
  /** 성분 합산 결과 */
  totals: IngredientIntake[];
  /** “과다섭취 가능성”으로 플래그된 성분 */
  overuse: IngredientIntake[];
  /** 상성(흡수 방해/경쟁 등) 감지 결과 */
  synergies: SupplementSynergyFinding[];
  /** UI용 요약 문구 */
  summaryKo: string;
};

export type SupplementStackingConfig = {
  /**
   * 성분별 1일 상한(heuristic).
   * 단위는 프로젝트 내부 관례로 통일해서 사용하세요.
   */
  limits?: Partial<Record<SupplementIngredientId, { max: number; unit?: string; severityAt?: { medium: number; high: number } }>>;

  /**
   * 상성(방해) 페어 규칙.
   * 예) Calcium↔Iron은 흡수 경쟁 → 시간차 복용 권장
   */
  antagonisticPairs?: Array<{
    a: SupplementIngredientId;
    b: SupplementIngredientId;
    messageKo: string;
    actionKo: string;
    severity: "low" | "medium" | "high";
  }>;

  /**
   * 시간차 복용 기본 문구(상성 감지 시 보조 문구로 사용 가능)
   */
  defaultSpacingActionKo?: string;
};

const DEFAULT_CONFIG: Required<Pick<SupplementStackingConfig, "limits" | "antagonisticPairs" | "defaultSpacingActionKo">> = {
  // NOTE: 제품/국가/연령/기저질환에 따라 상한은 달라질 수 있습니다.
  // 여기서는 “과다섭취 가능성”을 잡아내는 가벼운 휴리스틱으로 둡니다.
  limits: {
    // 흔히 쓰는 값만 기본 제공. 필요하면 계속 확장.
    VitaminD: { max: 4000, unit: "IU", severityAt: { medium: 0.8, high: 1.0 } },
    Zinc: { max: 40, unit: "mg", severityAt: { medium: 0.75, high: 1.0 } },
    Iron: { max: 45, unit: "mg", severityAt: { medium: 0.75, high: 1.0 } },
    Calcium: { max: 2500, unit: "mg", severityAt: { medium: 0.8, high: 1.0 } },
  },
  antagonisticPairs: [
    {
      a: "Calcium",
      b: "Iron",
      severity: "medium",
      messageKo: "칼슘과 철분은 서로 흡수를 방해할 수 있어요.",
      actionKo: "칼슘/철분이 들어있는 제품은 2시간 이상 시간차 복용을 권장합니다.",
    },
    {
      a: "Calcium",
      b: "Zinc",
      severity: "low",
      messageKo: "칼슘과 아연은 고용량에서 흡수 경쟁이 있을 수 있어요.",
      actionKo: "위가 예민하거나 고용량이라면 시간차 복용을 고려해보세요.",
    },
    {
      a: "Iron",
      b: "Zinc",
      severity: "low",
      messageKo: "철분과 아연은 함께 복용 시 흡수에 영향을 줄 수 있어요.",
      actionKo: "고용량 복용 중이면 시간차 복용을 고려해보세요.",
    },
  ],
  defaultSpacingActionKo: "가능하면 성분이 겹치거나 상성이 있는 제품은 2시간 이상 간격을 두세요.",
};

function normId(id: string) {
  return id.replace(/\s+/g, "").toLowerCase();
}

function resolveLimit(
  ingredient: SupplementIngredientId,
  cfg: SupplementStackingConfig,
) {
  const merged = { ...DEFAULT_CONFIG.limits, ...(cfg.limits ?? {}) };
  // allow case-insensitive match
  const exact = merged[ingredient];
  if (exact) return exact;
  const key = Object.keys(merged).find((k) => normId(k) === normId(ingredient));
  return key ? merged[key as SupplementIngredientId] : undefined;
}

function riskFromRatio(ratio: number, severityAt?: { medium: number; high: number }): "low" | "medium" | "high" {
  const med = severityAt?.medium ?? 0.8;
  const hi = severityAt?.high ?? 1.0;
  if (ratio >= hi) return "high";
  if (ratio >= med) return "medium";
  return "low";
}

export function checkSupplementStacking(
  profiles: SupplementProfile[],
  config: SupplementStackingConfig = {},
): SupplementStackingReport {
  const cfg = {
    limits: { ...DEFAULT_CONFIG.limits, ...(config.limits ?? {}) },
    antagonisticPairs: [...DEFAULT_CONFIG.antagonisticPairs, ...(config.antagonisticPairs ?? [])],
    defaultSpacingActionKo: config.defaultSpacingActionKo ?? DEFAULT_CONFIG.defaultSpacingActionKo,
  };

  const supplements = profiles.map((p) => p.supplement);

  // 1) totals
  const totalsMap = new Map<string, IngredientIntake>();
  for (const p of profiles) {
    for (const [ingredient, amount] of Object.entries(p.ingredients ?? {})) {
      if (!ingredient) continue;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) continue;
      const key = normId(ingredient);
      const existing = totalsMap.get(key);
      if (!existing) {
        const limit = resolveLimit(ingredient, cfg);
        totalsMap.set(key, {
          ingredient,
          total: amount,
          unit: limit?.unit,
          sources: [{ supplement: p.supplement, amount }],
          risk: "low",
          messageKo: "",
        });
      } else {
        existing.total += amount;
        existing.sources.push({ supplement: p.supplement, amount });
      }
    }
  }

  // 2) score risk + message
  const totals: IngredientIntake[] = [];
  for (const t of totalsMap.values()) {
    const limit = resolveLimit(t.ingredient, cfg);
    if (limit?.max) {
      const ratio = t.total / limit.max;
      t.risk = riskFromRatio(ratio, limit.severityAt);
      const unit = t.unit ? ` ${t.unit}` : "";
      const maxStr = `${limit.max}${unit}`;
      const totalStr = `${Math.round(t.total * 100) / 100}${unit}`;
      t.messageKo =
        t.risk === "high"
          ? `${t.ingredient} 합산이 ${totalStr}로, 기준 상한(${maxStr})에 도달/초과할 수 있어요. 제품 중복을 줄이거나 다른 제품으로 바꾸는 것을 고려하세요.`
          : t.risk === "medium"
            ? `${t.ingredient} 합산이 ${totalStr}로, 기준 상한(${maxStr})에 가까워요. 중복 성분을 확인해보세요.`
            : `${t.ingredient} 합산 ${totalStr} (기준 상한 ${maxStr} 대비 여유).`;
    } else {
      t.risk = t.sources.length >= 2 ? "medium" : "low";
      t.messageKo =
        t.sources.length >= 2
          ? `${t.ingredient} 성분이 여러 제품에서 중복됩니다. 제품 라벨/함량을 확인하세요.`
          : `${t.ingredient} 성분이 포함되어 있습니다.`;
    }
    totals.push(t);
  }
  totals.sort((a, b) => {
    const rank = (r: IngredientIntake["risk"]) => (r === "high" ? 2 : r === "medium" ? 1 : 0);
    return rank(b.risk) - rank(a.risk) || b.total - a.total;
  });

  const overuse = totals.filter((t) => t.risk === "high" || t.risk === "medium").filter((t) => t.sources.length >= 2 || t.risk === "high");

  // 3) antagonistic pairs
  const present = new Map<string, string>(); // ingredientKey -> canonical (as seen)
  for (const t of totals) present.set(normId(t.ingredient), t.ingredient);

  // Ingredients duplicated across brands/products are often the root cause of accidental overuse.
  const duplicatedIngredients = totals.filter((t) => t.sources.length >= 2 && t.risk !== "high");

  const synergies: SupplementSynergyFinding[] = [];
  for (const dup of duplicatedIngredients) {
    const names = dup.sources.map((s) => s.supplement).join(", ");
    synergies.push({
      pair: [dup.ingredient, dup.ingredient],
      supplementsInvolved: dup.sources.map((s) => s.supplement),
      messageKo: `${dup.ingredient} 성분이 여러 제품(${names})에서 중복으로 들어가 있어요.`,
      actionKo:
        "중복을 줄이려면 같은 성분의 제품 중 하나를 빼거나, 다른 제품(단일 성분 농도가 낮은 제품)으로 바꾸는 방법을 검토하세요.",
      severity: "medium",
    });
  }
  for (const rule of cfg.antagonisticPairs) {
    const aKey = normId(rule.a);
    const bKey = normId(rule.b);
    if (!present.has(aKey) || !present.has(bKey)) continue;

    const involved: string[] = [];
    for (const p of profiles) {
      const hasA = Object.keys(p.ingredients ?? {}).some((k) => normId(k) === aKey);
      const hasB = Object.keys(p.ingredients ?? {}).some((k) => normId(k) === bKey);
      const hasBoth = hasA && hasB;
      if (hasBoth) {
        involved.push(p.supplement);
        continue;
      }
      if (hasA) involved.push(`${p.supplement} (${rule.a})`);
      if (hasB) involved.push(`${p.supplement} (${rule.b})`);
    }

    const aName = present.get(aKey)!;
    const bName = present.get(bKey)!;
    synergies.push({
      pair: [aName, bName],
      supplementsInvolved: Array.from(new Set(involved)),
      messageKo: rule.messageKo,
      actionKo: rule.actionKo || cfg.defaultSpacingActionKo,
      severity: rule.severity,
    });
  }

  // 4) incorporate per-product explicit conflicts (profile.conflicts)
  for (const p of profiles) {
    for (const c of p.conflicts ?? []) {
      const targetKey = normId(c.target);
      // target may be an ingredient id (e.g. Iron) or a drug name. We only auto-detect ingredient targets here.
      const matchesIngredient = Array.from(present.keys()).some((k) => k === targetKey);
      if (!matchesIngredient) continue;

      const involved: string[] = [];
      for (const pp of profiles) {
        const hasTarget = Object.keys(pp.ingredients ?? {}).some((k) => normId(k) === targetKey);
        const hasAnyFromSource = pp.supplement === p.supplement;
        if (hasTarget || hasAnyFromSource) involved.push(pp.supplement);
      }

      const targetCanonical = present.get(targetKey) ?? c.target;
      synergies.push({
        pair: [p.supplement, targetCanonical],
        supplementsInvolved: Array.from(new Set(involved)),
        messageKo: `${p.supplement} ↔ ${targetCanonical}: ${c.reason}`,
        actionKo: c.action || cfg.defaultSpacingActionKo,
        severity: c.severity ?? "low",
      });
    }
  }

  // de-dup synergies
  const seenSyn = new Set<string>();
  const dedupedSynergies: SupplementSynergyFinding[] = [];
  for (const s of synergies) {
    const k = `${normId(s.pair[0])}||${normId(s.pair[1])}||${s.messageKo}`;
    if (seenSyn.has(k)) continue;
    seenSyn.add(k);
    dedupedSynergies.push(s);
  }

  const summaryKo =
    overuse.length === 0 && dedupedSynergies.length === 0
      ? "현재 등록된 영양제 조합에서 뚜렷한 과다섭취/상성 위험 신호를 찾지 못했습니다."
      : `중복 성분 ${overuse.length}건, 상성(흡수 방해 등) ${dedupedSynergies.length}건을 감지했습니다.`;

  return {
    supplements,
    totals,
    overuse,
    synergies: dedupedSynergies.sort((a, b) => {
      const rank = (s: SupplementSynergyFinding["severity"]) => (s === "high" ? 2 : s === "medium" ? 1 : 0);
      return rank(b.severity) - rank(a.severity);
    }),
    summaryKo,
  };
}

