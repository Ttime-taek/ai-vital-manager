import { describe, expect, it } from "vitest";
import { isLowConfidenceMedicationInfo } from "@/lib/medicationConfidence";
import type { MedicationInfo } from "@/lib/types";

describe("isLowConfidenceMedicationInfo", () => {
  const base: MedicationInfo = {
    name: "테스트약",
    aliases: [],
    category: "확인 필요",
    description: "약사 확인 필요",
    defaultFrequency: 2,
    foodTiming: "with",
    avoidFoods: [],
  };

  it("flags placeholder category", () => {
    expect(isLowConfidenceMedicationInfo(base, "테스트약")).toBe(true);
  });

  it("accepts confident DB-like info", () => {
    expect(
      isLowConfidenceMedicationInfo(
        {
          ...base,
          category: "NSAID",
          description: "소염·진통제",
          avoidFoods: [{ food: "알코올", reason: "위장 출혈", severity: "high" }],
        },
        "ibuprofen",
      ),
    ).toBe(false);
  });
});
