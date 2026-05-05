/** 3단계 상호작용 판정 (UI 표시용 한글은 lib/interactionLabels에서) */
export type InteractionTier = "very_safe" | "caution" | "contraindicated";

export interface InteractionRuleHit {
  drugA: string;
  drugB: string;
  tier: InteractionTier;
  /** Mock 규칙 설명(비LLM 폴백용) */
  summaryKo: string;
  ruleId: string;
}

export interface InteractionCheckResult {
  /** 확인에 사용된 정규화된 약물명(canonical name) */
  resolvedDrugs: string[];
  unresolvedInputs: string[];
  tier: InteractionTier;
  /** 최악 순위를 만든 규칙들(복수 쌍 가능) */
  hits: InteractionRuleHit[];
  oneLineKo: string;
}
