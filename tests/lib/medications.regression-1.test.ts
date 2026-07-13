import { describe, expect, it } from "vitest";
import { findMedication } from "@/lib/medications";

// Regression: ISSUE-001 — 와파린의 비타민 K 채소 안내가 회피와 권장을 동시에 표시함
// Found by /qa on 2026-07-13
// Report: .gstack/qa-reports/qa-report-ai-vital-manager-xmi5-vercel-app-2026-07-13.md
describe("warfarin vitamin K guidance", () => {
  it("recommends consistent vitamin K intake without classifying it as food to avoid", () => {
    const warfarin = findMedication("와파린");

    expect(warfarin).toBeTruthy();
    expect(warfarin?.avoidFoods.some((item) => item.food.includes("비타민 K"))).toBe(false);
    expect(
      warfarin?.recommendedFoods?.some(
        (item) => item.food.includes("비타민 K") && item.reason.includes("일정한 섭취량"),
      ),
    ).toBe(true);
  });
});
