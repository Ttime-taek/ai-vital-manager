import { describe, expect, it } from "vitest";
import {
  mergeMedicationInfo,
  resolveAnalyzeOutcome,
  scoreMedicationInfo,
  shouldPreferAiOverLocal,
} from "@/lib/medicationEnrichment";
import { buildWebSearchTerms } from "@/lib/medicationWebSearch";
import type { MedicationInfo } from "@/lib/types";

const localRich: MedicationInfo = {
  name: "위고비",
  aliases: ["wegovy"],
  category: "GLP-1",
  description: "비만·체중 관리용 주사제입니다.",
  defaultFrequency: 1,
  foodTiming: "any",
  avoidFoods: [{ food: "알코올", reason: "위장 자극", severity: "medium" }],
  recommendedFoods: [{ food: "저지방 단백질", reason: "포만감", severity: "high" }],
};

const aiRicher: MedicationInfo = {
  ...localRich,
  avoidFoods: [
    { food: "튀김", reason: "구토", severity: "high" },
    { food: "알코올", reason: "위장 자극", severity: "high" },
    { food: "과식", reason: "복부 팽만", severity: "high" },
  ],
  recommendedFoods: [
    { food: "저지방 단백질", reason: "포만감", severity: "high" },
    { food: "소량 자주", reason: "구역 완화", severity: "high" },
    { food: "수분", reason: "탈수 예방", severity: "high" },
  ],
};

describe("medicationEnrichment", () => {
  it("prefers AI when food guidance is materially richer", () => {
    expect(shouldPreferAiOverLocal(localRich, aiRicher, "위고비")).toBe(true);
  });

  it("keeps local DB when AI is low confidence", () => {
    const weak: MedicationInfo = {
      ...aiRicher,
      category: "확인 필요",
      description: "약사 확인 필요",
    };
    const out = resolveAnalyzeOutcome({
      query: "위고비",
      local: localRich,
      ai: weak,
      web: null,
    });
    expect(out.source).toBe("database");
    expect(out.info.name).toBe("위고비");
  });

  it("prefers enrichment when web adds unique foods to rich local DB", () => {
    const aiWithExtra: MedicationInfo = {
      ...localRich,
      avoidFoods: [
        ...localRich.avoidFoods,
        { food: "매운 음식", reason: "위장 자극", severity: "high" },
      ],
    };
    expect(shouldPreferAiOverLocal(localRich, aiWithExtra, "위고비", true)).toBe(true);
  });

  it("merges local and AI foods without dropping DB items", () => {
    const merged = mergeMedicationInfo(localRich, aiRicher);
    expect(merged.avoidFoods.length).toBeGreaterThanOrEqual(localRich.avoidFoods.length);
    expect(merged.name).toBe("위고비");
  });

  it("builds search terms from local aliases", () => {
    const terms = buildWebSearchTerms("위고비", localRich);
    expect(terms).toContain("위고비");
    expect(terms.some((t) => /wegovy/i.test(t))).toBe(true);
  });

  it("upgrades local when AI wins", () => {
    const out = resolveAnalyzeOutcome({
      query: "위고비",
      local: localRich,
      ai: aiRicher,
      web: { query: "위고비", snippets: [{ source: "test", title: "t", text: "x" }], promptBlock: "x" },
    });
    expect(out.source).toBe("database_enriched");
    expect(out.info.avoidFoods.length).toBeGreaterThan(localRich.avoidFoods.length);
  });

  it("marks unknown drugs with web as ai_web", () => {
    const out = resolveAnalyzeOutcome({
      query: "신약XYZ",
      local: null,
      ai: aiRicher,
      web: { query: "신약XYZ", snippets: [{ source: "test", title: "t", text: "x" }], promptBlock: "x" },
    });
    expect(out.source).toBe("ai_web");
  });

  it("scores richer info higher", () => {
    expect(scoreMedicationInfo(aiRicher)).toBeGreaterThan(scoreMedicationInfo(localRich));
  });
});
