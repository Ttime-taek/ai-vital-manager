import { describe, expect, it } from "vitest";
import { checkSupplementStacking } from "@/lib/checkSupplementStacking";
import type { SupplementProfile } from "@/lib/supplementTypes";

describe("checkSupplementStacking", () => {
  it("flags duplicate ingredient totals and antagonistic pairs", () => {
    const profiles: SupplementProfile[] = [
      {
        supplement: "센트룸",
        ingredients: { VitaminD: 1000, Zinc: 15, Calcium: 500 },
        conflicts: [{ target: "Iron", reason: "흡수 저해", action: "시간차 복용 권장" }],
      },
      {
        supplement: "비타민D 단일",
        ingredients: { VitaminD: 3000 },
        conflicts: [],
      },
      {
        supplement: "철분제",
        ingredients: { Iron: 25 },
        conflicts: [],
      },
    ];

    const report = checkSupplementStacking(profiles);
    expect(report.supplements.length).toBe(3);

    // VitaminD total = 4000 (at limit) => medium/high depending on threshold; should be flagged because duplicated
    const vitD = report.totals.find((t) => t.ingredient === "VitaminD");
    expect(vitD?.total).toBe(4000);
    expect(report.overuse.some((t) => t.ingredient === "VitaminD")).toBe(true);

    // Calcium + Iron antagonistic
    const hasCaFe = report.synergies.some(
      (s) =>
        (s.pair[0] === "Calcium" && s.pair[1] === "Iron") ||
        (s.pair[0] === "Iron" && s.pair[1] === "Calcium"),
    );
    expect(hasCaFe).toBe(true);
  });
});

