import type { FoodInteraction, MedicationInfo } from "@/lib/types";
import { isLowConfidenceMedicationInfo } from "@/lib/medicationConfidence";
import type { MedicationWebContext } from "@/lib/medicationWebSearch";

export type AnalyzeSource =
  | "database"
  | "database_enriched"
  | "ai"
  | "ai_web"
  | "uncertain"
  | "fallback";

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 } as const;

function foodKey(food: string): string {
  return food.replace(/\s+/g, "").toLowerCase();
}

function mergeFoodList(base: FoodInteraction[], extra: FoodInteraction[]): FoodInteraction[] {
  const map = new Map<string, FoodInteraction>();
  for (const item of base) {
    map.set(foodKey(item.food), item);
  }
  for (const item of extra) {
    const key = foodKey(item.food);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      continue;
    }
    const keep =
      SEVERITY_RANK[item.severity] >= SEVERITY_RANK[prev.severity] ? item : prev;
    const reason =
      keep.reason.length >= prev.reason.length ? keep.reason : prev.reason;
    map.set(key, { ...keep, reason });
  }
  return [...map.values()];
}

/** 로컬 DB를 유지하면서 AI·웹에서 얻은 식이 항목만 보강 */
export function mergeMedicationInfo(
  local: MedicationInfo,
  ai: MedicationInfo,
): MedicationInfo {
  const description =
    ai.description.length > local.description.length + 20 &&
    !/약사\s*확인|확인\s*필요/i.test(ai.description)
      ? ai.description
      : local.description;

  const notes =
    ai.notes && local.notes && ai.notes.length > local.notes.length + 15
      ? ai.notes
      : local.notes ?? ai.notes;

  return {
    ...local,
    name: local.name,
    aliases: [...new Set([...local.aliases, ...ai.aliases])],
    category: local.category !== "확인 필요" ? local.category : ai.category,
    description,
    defaultFrequency: local.defaultFrequency,
    foodTiming: local.foodTiming,
    avoidFoods: mergeFoodList(local.avoidFoods, ai.avoidFoods),
    recommendedFoods: mergeFoodList(
      local.recommendedFoods ?? [],
      ai.recommendedFoods ?? [],
    ),
    notes,
  };
}

function countUniqueFoodItems(local: MedicationInfo, ai: MedicationInfo): number {
  const localKeys = new Set([
    ...local.avoidFoods.map((f) => foodKey(f.food)),
    ...(local.recommendedFoods ?? []).map((f) => foodKey(f.food)),
  ]);
  let added = 0;
  for (const f of [...ai.avoidFoods, ...(ai.recommendedFoods ?? [])]) {
    if (!localKeys.has(foodKey(f.food))) added += 1;
  }
  return added;
}

export function scoreMedicationInfo(info: MedicationInfo): number {
  let score = 0;
  if (info.category && info.category !== "확인 필요") score += 4;
  if (info.description && info.description.length >= 30) score += 3;
  if (!/약사\s*확인|확인\s*필요/i.test(info.description)) score += 2;
  score += Math.min(info.avoidFoods.length * 2, 12);
  score += Math.min((info.recommendedFoods?.length ?? 0) * 2, 12);
  if (info.notes && info.notes.length >= 20) score += 2;
  if (info.aliases.length > 0) score += 1;
  return score;
}

export function shouldPreferAiOverLocal(
  local: MedicationInfo,
  ai: MedicationInfo,
  query: string,
  webUsed = false,
): boolean {
  if (isLowConfidenceMedicationInfo(ai, query)) return false;

  const localScore = scoreMedicationInfo(local);
  const aiScore = scoreMedicationInfo(ai);
  const merged = mergeMedicationInfo(local, ai);
  const mergedScore = scoreMedicationInfo(merged);

  if (mergedScore >= localScore + 2) return true;

  if (webUsed && countUniqueFoodItems(local, ai) >= 1 && mergedScore > localScore) {
    return true;
  }

  if (aiScore >= localScore + 2) return true;

  const localFoodCount =
    local.avoidFoods.length + (local.recommendedFoods?.length ?? 0);
  const aiFoodCount = ai.avoidFoods.length + (ai.recommendedFoods?.length ?? 0);

  if (aiFoodCount >= localFoodCount + 2 && aiScore >= localScore) return true;

  return false;
}

export function buildAnalyzeUserPrompt(
  query: string,
  web: MedicationWebContext | null,
  localBaseline: MedicationInfo | null,
): string {
  const localBlock = localBaseline
    ? JSON.stringify(localBaseline, null, 2)
    : "없음 (로컬 DB 미등록)";

  const webBlock = web?.promptBlock ?? "웹 검색 비활성 또는 결과 없음";

  return `약물명(사용자 입력): ${query}

## 웹 검색·공개 라벨 스니펫
${webBlock}

## 로컬 DB 기준 정보
${localBlock}

위 자료를 종합해 MedicationInfo JSON을 작성하세요.
- 웹/라벨 정보가 로컬 DB보다 구체적이거나 식이 가이드가 더 풍부하면 웹 정보를 우선 반영하세요.
- 로컬 DB가 충분하면 기존 항목을 유지하고, 웹에서 근거 있는 새 식이 상호작용만 추가하세요.
- 확실하지 않은 식이 상호작용은 넣지 마세요.`;
}

export function resolveAnalyzeOutcome(opts: {
  query: string;
  local: MedicationInfo | null;
  ai: MedicationInfo;
  web: MedicationWebContext | null;
  providerFallbackNotice?: string;
}): { info: MedicationInfo; source: AnalyzeSource; notice?: string } {
  const { query, local, ai, web, providerFallbackNotice } = opts;
  const lowConf = isLowConfidenceMedicationInfo(ai, query);
  const webUsed = Boolean(web && web.snippets.length > 0);

  if (local) {
    if (lowConf) {
      return {
        info: local,
        source: "database",
        notice:
          providerFallbackNotice ??
          "AI·웹 보강 결과가 불확실해 로컬 DB 정보를 사용했습니다.",
      };
    }

    if (shouldPreferAiOverLocal(local, ai, query, webUsed)) {
      const enriched = mergeMedicationInfo(local, ai);
      const noticeParts = [
        webUsed
          ? "웹 검색과 AI로 로컬 DB 식이 가이드를 보강했습니다."
          : "AI가 로컬 DB보다 더 구체적인 정보를 제공해 반영했습니다.",
        providerFallbackNotice,
      ].filter(Boolean);
      return {
        info: enriched,
        source: "database_enriched",
        notice: noticeParts.join(" "),
      };
    }

    return { info: local, source: "database" };
  }

  let notice = providerFallbackNotice;
  if (lowConf) {
    notice = [notice, "AI가 약물을 확실히 식별하지 못했습니다. 처방전·약사 안내를 우선하세요."]
      .filter(Boolean)
      .join(" ");
    return { info: ai, source: "uncertain", notice };
  }

  if (webUsed) {
    notice = [
      notice,
      "웹 검색 결과와 AI 분석으로 약물 정보를 구성했습니다.",
    ]
      .filter(Boolean)
      .join(" ");
    return { info: ai, source: "ai_web", notice };
  }

  if (notice) {
    return { info: ai, source: "uncertain", notice };
  }

  return { info: ai, source: "ai" };
}
