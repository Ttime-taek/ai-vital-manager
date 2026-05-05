import type { SupplementProfile } from "@/lib/supplementTypes";
import type { NutritionProductResolution } from "@/lib/nutritionProductTypes";

type FdcFoodNutrient = {
  nutrientId?: number;
  nutrient?: { id?: number; name?: string; unitName?: string };
  amount?: number;
  value?: number;
};

type FdcFood = {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  dataType?: string;
  gtinUpc?: string;
  foodNutrients?: FdcFoodNutrient[];
};

type FdcSearchResponse = {
  foods?: Array<{
    fdcId?: number;
    description?: string;
    brandName?: string;
    gtinUpc?: string;
    dataType?: string;
  }>;
};

export function getUsdaApiKey(): string {
  const fromEnv = process.env.USDA_FDC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  // USDA exposes a public DEMO_KEY for low-volume development; avoid requiring env during local dev,
  // but do not silently use it in production.
  if (process.env.NODE_ENV !== "production") return "DEMO_KEY";
  throw new Error("USDA_FDC_API_KEY 환경변수가 필요합니다.");
}

function nutrientAmount(n: FdcFoodNutrient): number | undefined {
  const v = n.amount ?? n.value;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

function normalizeFdcUnit(unit: string): string {
  // FDC sometimes uses "µg" which uppercases oddly; normalize micro symbol to ASCII.
  return unit.replaceAll("µ", "u").toUpperCase();
}

function findByNutrientIds(nutrients: FdcFoodNutrient[] | undefined, ids: number[]) {
  if (!nutrients) return undefined;
  const set = new Set(ids);
  for (const n of nutrients) {
    const id = n.nutrientId ?? n.nutrient?.id;
    if (id !== undefined && set.has(id)) {
      const amt = nutrientAmount(n);
      if (amt === undefined) continue;
      const unit = normalizeFdcUnit(n.nutrient?.unitName ?? "");
      return { id, amount: amt, unit };
    }
  }
  return undefined;
}

/**
 * Map USDA FoodData Central `food` payload to our simplified `SupplementProfile.ingredients`.
 *
 * We primarily use well-known FDC nutrient IDs. Units are normalized to:
 * - VitaminD: IU
 * - Calcium / Iron / Zinc / Magnesium: mg
 */
export function mapFdcFoodToSupplementProfile(food: FdcFood): { profile: SupplementProfile; mapped: string[] } {
  const nutrients = food.foodNutrients ?? [];
  const mapped: string[] = [];
  const ingredients: SupplementProfile["ingredients"] = {};

  const vitDIds = [1110, 1114, 1109, 1111, 1112, 1113];
  for (const id of vitDIds) {
    const hit = findByNutrientIds(nutrients, [id]);
    if (!hit) continue;
    const u = normalizeFdcUnit(hit.unit);
    if (u === "IU") {
      ingredients.VitaminD = hit.amount;
      mapped.push(`VitaminD(nutrient ${hit.id})`);
      break;
    }
    if (u === "UG" || u === "MCG") {
      ingredients.VitaminD = hit.amount * 40;
      mapped.push(`VitaminD(nutrient ${hit.id}, µg→IU)`);
      break;
    }
    // Unknown/unsupported unit for vitamin D — skip rather than guess.
  }

  const ca = findByNutrientIds(nutrients, [1087]);
  if (ca) {
    const u = normalizeFdcUnit(ca.unit);
    ingredients.Calcium = u === "G" ? ca.amount * 1000 : ca.amount;
    mapped.push("Calcium(1087)");
  }

  const fe = findByNutrientIds(nutrients, [1089]);
  if (fe) {
    const u = normalizeFdcUnit(fe.unit);
    ingredients.Iron = u === "G" ? fe.amount * 1000 : fe.amount;
    mapped.push("Iron(1089)");
  }

  const zn = findByNutrientIds(nutrients, [1095]);
  if (zn) {
    const u = normalizeFdcUnit(zn.unit);
    if (u === "G") ingredients.Zinc = zn.amount * 1000;
    else if (u === "MG") ingredients.Zinc = zn.amount;
    else if (u === "UG" || u === "MCG") ingredients.Zinc = zn.amount / 1000;
    else ingredients.Zinc = zn.amount;
    mapped.push("Zinc(1095)");
  }

  const mg = findByNutrientIds(nutrients, [1082]);
  if (mg) {
    const u = normalizeFdcUnit(mg.unit);
    ingredients.Magnesium = u === "G" ? mg.amount * 1000 : mg.amount;
    mapped.push("Magnesium(1082)");
  }

  const brand = food.brandName ?? food.brandOwner;
  const name = (food.description ?? "USDA FDC food").trim();

  const profile: SupplementProfile = {
    supplement: brand ? `${brand} ${name}` : name,
    ingredients,
    conflicts: [],
  };

  return { profile, mapped };
}

async function fdcGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`USDA FDC HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function resolveUsdaFdcByQuery(query: string): Promise<NutritionProductResolution> {
  const apiKey = getUsdaApiKey();
  const q = encodeURIComponent(query.trim());
  const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(
    apiKey,
  )}&query=${q}&pageSize=5&dataType=Branded`;
  const search = await fdcGetJson<FdcSearchResponse>(searchUrl);
  const first = search.foods?.[0];
  if (!first?.fdcId) {
    throw new Error("USDA FDC: 검색 결과가 비어 있습니다.");
  }

  const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${first.fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const food = await fdcGetJson<FdcFood>(detailUrl);
  const { profile, mapped } = mapFdcFoodToSupplementProfile(food);

  const notices: string[] = [];
  if (!process.env.USDA_FDC_API_KEY) {
    notices.push("USDA_FDC_API_KEY가 설정되지 않아 공개 DEMO_KEY로 조회했습니다. 운영 환경에서는 키를 설정하세요.");
  }
  notices.push(`USDA FoodData Central(브랜드 푸드 검색 1건)로 매핑했습니다. 포함된 영양소: ${mapped.length ? mapped.join(", ") : "(없음)"}`);

  return {
    source: "usda-fdc",
    externalId: String(food.fdcId ?? first.fdcId),
    name: food.description ?? first.description ?? "USDA FDC",
    brand: food.brandName ?? food.brandOwner ?? first.brandName,
    raw: food,
    profile,
    notices,
  };
}

export async function resolveUsdaFdcByFdcId(fdcId: string | number): Promise<NutritionProductResolution> {
  const apiKey = getUsdaApiKey();
  const id = String(fdcId);
  const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(id)}?api_key=${encodeURIComponent(apiKey)}`;
  const food = await fdcGetJson<FdcFood>(detailUrl);
  const { profile, mapped } = mapFdcFoodToSupplementProfile(food);

  const notices: string[] = [];
  if (!process.env.USDA_FDC_API_KEY) {
    notices.push("USDA_FDC_API_KEY가 설정되지 않아 공개 DEMO_KEY로 조회했습니다. 운영 환경에서는 키를 설정하세요.");
  }
  notices.push(`USDA FoodData Central food/${id}로 매핑했습니다. 포함된 영양소: ${mapped.length ? mapped.join(", ") : "(없음)"}`);

  return {
    source: "usda-fdc",
    externalId: String(food.fdcId ?? id),
    name: food.description ?? `FDC ${id}`,
    brand: food.brandName ?? food.brandOwner,
    raw: food,
    profile,
    notices,
  };
}
