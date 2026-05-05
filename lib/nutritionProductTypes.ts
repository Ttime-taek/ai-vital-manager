import type { SupplementProfile } from "@/lib/supplementTypes";

export type NutritionProductSource = "usda-fdc" | "openfoodfacts";

export type NutritionProductResolution = {
  source: NutritionProductSource;
  externalId: string;
  name: string;
  brand?: string;
  /** Original payload subset for transparency/debugging */
  raw: unknown;
  profile: SupplementProfile;
  /** Parser / coverage notes (Korean, user-facing) */
  notices: string[];
};
