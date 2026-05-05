import type { InteractionTier } from "@/lib/interactionTypes";

/**
 * v0 목 데이터: 실제 의학적 판정이 아니라 제품 내 시연·구조 검증용입니다.
 * 향후 `/api/interaction-rules` 같은 소스로 교체할 수 있습니다.
 */
export interface MockInteractionPairRule {
  ruleId: string;
  drugA: string;
  drugB: string;
  tier: InteractionTier;
  summaryKo: string;
}

/** canonical medication `name`(MEDICATION_DATABASE.name) 기준 무순서 쌍 */
export const MOCK_INTERACTION_RULES_V0: MockInteractionPairRule[] = [
  {
    ruleId: "acetaminophen_ibuprofen",
    drugA: "아세트아미노펜",
    drugB: "이부프로펜",
    tier: "caution",
    summaryKo:
      "해열·진통 목적으로 NSAID와 아세트아미노펜을 같은 날 함께 쓸 때는 증량·중복 복용에 주의해야 하며, 위장·신장 부담이 커질 수 있어 용도·용량은 의료진·약사와 확인하는 것이 안전합니다.",
  },
  {
    ruleId: "warfarin_aspirin",
    drugA: "와파린",
    drugB: "아스피린",
    tier: "contraindicated",
    summaryKo:
      "항혈소판 성분과 항응고제 병용은 출혈 위험을 크게 높일 수 있어 원칙적으로 동시 사용을 피하고, 필요 시 전문의가 위험·대안을 평가합니다.",
  },
  {
    ruleId: "warfarin_ibuprofen",
    drugA: "와파린",
    drugB: "이부프로펜",
    tier: "contraindicated",
    summaryKo:
      "NSAID는 위장 출혈 위험을 높이고 와파린과 함께 쓰이면 치료적 출혈 위험이 증가할 수 있어 병용은 피해야 합니다(대안 및 진통 전략은 의료진 의뢰).",
  },
  {
    ruleId: "aspirin_ibuprofen",
    drugA: "아스피린",
    drugB: "이부프로펜",
    tier: "caution",
    summaryKo:
      "저용량 아스피린과 NSAID 계열 진통제는 동시 기간 복용 시 위장점막 보호 기능이 줄어 출혈 위험이 높아질 수 있어 간격·대안 여부를 전문가와 확인해야 합니다.",
  },
];
