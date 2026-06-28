import { describe, expect, it } from "vitest";
import { checkDrugInteractions } from "@/lib/checkDrugInteractions";
import { MOCK_INTERACTION_RULES_V0 } from "@/lib/interactionMockData";

describe("checkDrugInteractions", () => {
  it("flags warfarin and omega-3 as caution", () => {
    const result = checkDrugInteractions(
      ["와파린", "오메가3"],
      MOCK_INTERACTION_RULES_V0,
    );

    expect(result.tier).toBe("caution");
    expect(result.hits).toHaveLength(1);
  });
});
