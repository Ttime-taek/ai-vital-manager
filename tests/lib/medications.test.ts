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
});
