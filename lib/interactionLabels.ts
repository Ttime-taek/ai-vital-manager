import type { InteractionTier } from "@/lib/interactionTypes";

export const INTERACTION_TIER_LABEL_KO: Record<InteractionTier, string> = {
  very_safe: "괜찮음",
  caution: "주의 필요",
  contraindicated: "병용 금기",
};
