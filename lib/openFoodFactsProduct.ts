import type { SupplementProfile } from "@/lib/supplementTypes";
import type { NutritionProductResolution } from "@/lib/nutritionProductTypes";

const OFF_HEADERS = {
  // Open Food Facts politely requests a descriptive User-Agent:
  // https://openfoodfacts.github.io/openfoodfacts-server/api/
  "User-Agent": "VitalProgram/0.1 (https://example.local; nutrition integration)",
  Accept: "application/json",
};

type OffProductResponse = {
  status: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    nutriments?: Record<string, number | string | undefined>;
    nutrition_data_per?: string;
    serving_quantity?: number | string;
    serving_size?: string;
  };
};

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Pick the best available nutriments scalar for a nutrient base key.
 * Open Food Facts often provides `_100g`, `_serving`, `_value`, plus unit keys.
 */
function pickScalar(nutriments: Record<string, number | string | undefined>, base: string): { value?: number; unit?: string } {
  const candidates = [
    `${base}_serving`,
    `${base}_value`,
    base,
    `${base}_100g`,
  ];
  for (const k of candidates) {
    const value = num(nutriments[k]);
    if (value === undefined) continue;
    const unitRaw = nutriments[`${base}_unit`] ?? nutriments[`${k}_unit`];
    const unit = typeof unitRaw === "string" ? unitRaw.toLowerCase() : undefined;
    return { value, unit };
  }
  return {};
}

function gramsToMg(g: number) {
  return g * 1000;
}

function mcgToMg(mcg: number) {
  return mcg / 1000;
}

/** Cholecalciferol: 1 µg ≈ 40 IU (commonly used labeling conversion). */
function vitDToIU(amount: number, unit?: string) {
  const u = (unit ?? "").toLowerCase();
  if (u === "iu") return amount;
  if (u === "mg") return amount * 1_000_000 / 25; // practically unlikely for vitamin D in foods; keep safe guard
  // µg / mcg
  if (u === "µg" || u === "ug" || u === "mcg") return amount * 40;
  // If unit missing, assume µg for typical OFF vitamin-d fields
  return amount * 40;
}

export async function resolveOpenFoodFactsByBarcode(barcode: string): Promise<NutritionProductResolution> {
  const code = barcode.replace(/\s+/g, "");
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
  const res = await fetch(url, { headers: OFF_HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`OpenFoodFacts HTTP ${res.status}`);
  }
  const json = (await res.json()) as OffProductResponse;
  if (json.status !== 1 || !json.product) {
    throw new Error(json.status_verbose ?? "OpenFoodFacts: product not found");
  }

  const p = json.product;
  const name = (p.product_name ?? p.product_name_en ?? `OFF ${p.code ?? code}`).trim();
  const brand = p.brands?.trim() || undefined;
  const nutriments = (p.nutriments ?? {}) as Record<string, number | string | undefined>;

  const ingredients: SupplementProfile["ingredients"] = {};
  const notices: string[] = [];

  const vd = pickScalar(nutriments, "vitamin-d");
  if (vd.value !== undefined) {
    ingredients.VitaminD = vitDToIU(vd.value, vd.unit);
  }

  const ca = pickScalar(nutriments, "calcium");
  if (ca.value !== undefined) {
    const u = ca.unit ?? "";
    if (u === "g") ingredients.Calcium = gramsToMg(ca.value);
    else if (u === "mg") ingredients.Calcium = ca.value;
    else ingredients.Calcium = ca.value;
  }

  const fe = pickScalar(nutriments, "iron");
  if (fe.value !== undefined) {
    const u = fe.unit ?? "";
    if (u === "g") ingredients.Iron = gramsToMg(fe.value);
    else if (u === "mg") ingredients.Iron = fe.value;
    else ingredients.Iron = fe.value;
  }

  const zn = pickScalar(nutriments, "zinc");
  if (zn.value !== undefined) {
    const u = zn.unit ?? "";
    if (u === "g") ingredients.Zinc = gramsToMg(zn.value);
    else if (u === "mg") ingredients.Zinc = zn.value;
    else if (u === "µg" || u === "ug" || u === "mcg") ingredients.Zinc = mcgToMg(zn.value);
    else ingredients.Zinc = zn.value;
  }

  if (Object.keys(ingredients).length === 0) {
    notices.push(
      "Open Food Facts에 구조화된 비타민/미네랄 데이터가 없거나 0으로 기록된 제품입니다. 바코드 다른 제품을 시도하거나 USDA FoodData Central 검색을 권장합니다.",
    );
  } else {
    notices.push("Open Food Facts nutriments 필드를 내부 성분 키로 매핑했습니다. 라벨 단위/환산은 제품마다 다를 수 있어 근사값입니다.");
  }

  const profile: SupplementProfile = {
    supplement: brand ? `${brand} ${name}` : name,
    ingredients,
    conflicts: [],
  };

  return {
    source: "openfoodfacts",
    externalId: String(p.code ?? code),
    name,
    brand,
    raw: json,
    profile,
    notices,
  };
}
