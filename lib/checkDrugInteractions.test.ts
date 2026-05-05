import { describe, expect, it } from "vitest";
import { checkDrugInteractions } from "@/lib/checkDrugInteractions";
import { MOCK_INTERACTION_RULES_V0 } from "@/lib/interactionMockData";

describe("checkDrugInteractions", () => {
  it("requires at least two inputs to be meaningful", () => {
    const r = checkDrugInteractions(["와파린"], MOCK_INTERACTION_RULES_V0);
    expect(r.oneLineKo).toMatch(/2개/);
  });

  it("flags 타이레놀 + 이부프로펜 as caution (acetaminophen + NSAID mock rule)", () => {
    const r = checkDrugInteractions(["타이레놀", "이부프로펜"], MOCK_INTERACTION_RULES_V0);
    expect(r.resolvedDrugs).toEqual(["아세트아미노펜", "이부프로펜"]);
    expect(r.tier).toBe("caution");
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it("flags 와파린 + 아스피린 as contraindicated", () => {
    const r = checkDrugInteractions(["와파린", "아스피린"], MOCK_INTERACTION_RULES_V0);
    expect(r.tier).toBe("contraindicated");
  });

  it("returns very_safe for unrelated pair", () => {
    const r = checkDrugInteractions(["아세트아미노펜", "아스피린"], MOCK_INTERACTION_RULES_V0);
    expect(r.tier).toBe("very_safe");
    expect(r.hits.length).toBe(0);
  });
});
