import { MOCK_INTERACTION_RULES_V0, type MockInteractionPairRule } from "@/lib/interactionMockData";

/**
 * 규칙 소스 추상화. 지금은 동기 목록이고, 추후 원격 API로 바꿀 때 여기만 갈아끼우면 됩니다.
 */
export type InteractionRulesSource = {
  getRules: () => Promise<MockInteractionPairRule[]>;
};

export const mockInteractionRulesSource: InteractionRulesSource = {
  async getRules() {
    return MOCK_INTERACTION_RULES_V0;
  },
};

