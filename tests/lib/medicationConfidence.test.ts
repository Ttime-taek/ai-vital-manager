import { describe, expect, it } from "vitest";
import {
  isLowConfidenceMedicationInfo,
  shouldBlockMedicationRegistration,
} from "@/lib/medicationConfidence";
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

  it("flags unknown category when pharmacist confirmation text is present", () => {
    expect(
      isLowConfidenceMedicationInfo(
        {
          ...base,
          category: "unknown",
          description: "약사 확인 필요",
          notes: "약사 확인 필요",
        },
        "zzzz-not-a-drug",
      ),
    ).toBe(true);
  });

  it("blocks registering unresolved uncertain inputs", () => {
    expect(
      shouldBlockMedicationRegistration(base, "zzzz-not-a-drug", "uncertain"),
    ).toBe(true);
  });

  it("blocks unresolved unknown category inputs from fallback providers", () => {
    expect(
      shouldBlockMedicationRegistration(
        {
          ...base,
          name: "zzzz-not-a-drug",
          category: "unknown",
          description: "약사 확인 필요",
          notes: "약사 확인 필요",
          defaultFrequency: 1,
          foodTiming: "any",
        },
        "zzzz-not-a-drug",
        "uncertain",
      ),
    ).toBe(true);
  });

  it("allows confident AI results to be registered", () => {
    expect(
      shouldBlockMedicationRegistration(
        {
          ...base,
          name: "아세트아미노펜",
          aliases: ["타이레놀"],
          category: "진통제",
          description: "해열·진통에 사용하는 약입니다.",
          avoidFoods: [{ food: "알코올", reason: "간 부담", severity: "medium" }],
        },
        "타이레놀",
        "ai",
      ),
    ).toBe(false);
  });
});
