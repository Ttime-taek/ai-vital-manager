export type SupplementIngredientId = string;

export type SupplementConflictSeverity = "high" | "medium" | "low";

export type SupplementConflict = {
  /** 충돌 대상(성분/약물/영양소 등) */
  target: string;
  /** 왜 문제가 되는지 (짧게) */
  reason: string;
  /** 사용자에게 권장할 행동 (예: 시간차 복용) */
  action: string;
  /** 선택: 중요도 */
  severity?: SupplementConflictSeverity;
  /** 선택: 근거 출처(링크/DB/라벨 등) */
  source?: string;
};

export type SupplementProfile = {
  /** 제품명(표준 표시명) */
  supplement: string;
  /** 성분별 함량(제품 라벨 기준, 단위는 프로젝트 규칙에 따름) */
  ingredients: Record<SupplementIngredientId, number>;
  /** 다른 성분/약/영양제와의 충돌 규칙 */
  conflicts: SupplementConflict[];
};

