import { describe, expect, it } from "vitest";
import { findMedication } from "@/lib/medications";

describe("findMedication", () => {
  it("matches common Korean levothyroxine search terms", () => {
    const queries = [
      "신지로이드",
      "씬지로이드정",
      "레보티록신나트륨",
      "갑상선 약",
      "갑상선 기능 저하증 약",
      "갑상선 비대증 약",
    ];

    for (const query of queries) {
      expect(findMedication(query)?.name).toBe("레보티록신");
    }
  });

  it.each([
    ["센트룸", "센트룸"],
    ["centrum", "센트룸"],
    ["비타민 C", "비타민 C"],
    ["밀크씨슬", "밀크시슬"],
  ])("matches quick-add supplement %s", (query, expectedName) => {
    expect(findMedication(query)?.name).toBe(expectedName);
  });
});
