import { describe, expect, it } from "vitest";
import { mapFdcFoodToSupplementProfile } from "@/lib/usdaFdcProduct";

describe("mapFdcFoodToSupplementProfile", () => {
  it("maps vitamin D IU + minerals from FDC nutrient rows", () => {
    const { profile, mapped } = mapFdcFoodToSupplementProfile({
      description: "Test supplement",
      brandName: "TestBrand",
      foodNutrients: [
        { nutrientId: 1110, amount: 1000, nutrient: { id: 1110, unitName: "IU" } },
        { nutrientId: 1087, amount: 200, nutrient: { id: 1087, unitName: "MG" } },
        { nutrientId: 1089, amount: 18, nutrient: { id: 1089, unitName: "MG" } },
        { nutrientId: 1095, amount: 11, nutrient: { id: 1095, unitName: "MG" } },
      ],
    });

    expect(profile.supplement).toContain("TestBrand");
    expect(profile.ingredients.VitaminD).toBe(1000);
    expect(profile.ingredients.Calcium).toBe(200);
    expect(profile.ingredients.Iron).toBe(18);
    expect(profile.ingredients.Zinc).toBe(11);
    expect(mapped.join(" ")).toMatch(/VitaminD/);
  });

  it("converts vitamin D micrograms to IU", () => {
    const { profile } = mapFdcFoodToSupplementProfile({
      description: "Test",
      foodNutrients: [{ nutrientId: 1110, amount: 25, nutrient: { id: 1110, unitName: "µg" } }],
    });
    expect(profile.ingredients.VitaminD).toBe(1000);
  });
});
