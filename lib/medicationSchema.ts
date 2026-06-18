import { z } from "zod";
import type { FoodInteraction, MedicationInfo } from "@/lib/types";

const SeveritySchema = z.enum(["high", "medium", "low"]);
const FoodTimingSchema = z.enum(["before", "with", "after", "any"]);

const FoodInteractionSchema = z.object({
  food: z.string(),
  reason: z.string(),
  severity: SeveritySchema,
});

export const MedicationInfoSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  category: z.string(),
  description: z.string(),
  defaultFrequency: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  foodTiming: FoodTimingSchema,
  avoidFoods: z.array(FoodInteractionSchema),
  recommendedFoods: z.array(FoodInteractionSchema).optional(),
  notes: z.string().optional(),
});

function trimAndLimit(s: unknown, maxLen: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, maxLen);
}

function ensureStringArray(v: unknown, maxItems = 20, maxLen = 60): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((x) => x.slice(0, maxLen));
}

function coerceFrequency(v: unknown): 1 | 2 | 3 | 4 {
  return ([1, 2, 3, 4] as const).find((n) => n === v) ?? 2;
}

function coerceFoodTiming(v: unknown): "before" | "with" | "after" | "any" {
  return (["before", "with", "after", "any"] as const).find((t) => t === v) ?? "with";
}

function coerceSeverity(v: unknown): "high" | "medium" | "low" {
  return (["high", "medium", "low"] as const).find((t) => t === v) ?? "medium";
}

function coerceFoodList(v: unknown): FoodInteraction[] {
  if (!Array.isArray(v)) return [];
  const out: FoodInteraction[] = [];
  for (const item of v.slice(0, 20)) {
    if (typeof item !== "object" || !item) continue;
    const obj = item as Record<string, unknown>;
    const food = trimAndLimit(obj.food, 80);
    const reason = trimAndLimit(obj.reason, 160);
    if (!food || !reason) continue;
    out.push({
      food,
      reason,
      severity: coerceSeverity(obj.severity),
    });
  }
  return out;
}

function coerceAvoidFoods(v: unknown): MedicationInfo["avoidFoods"] {
  return coerceFoodList(v);
}

function coerceRecommendedFoods(v: unknown): NonNullable<MedicationInfo["recommendedFoods"]> {
  return coerceFoodList(v);
}

/**
 * AI output is untrusted. Coerce/normalize it into a safe MedicationInfo.
 * If it still doesn't satisfy the schema, return a conservative fallback.
 */
export function coerceMedicationInfoFromUnknown(
  raw: unknown,
  query: string,
): MedicationInfo {
  const obj = (typeof raw === "object" && raw) ? (raw as Record<string, unknown>) : {};

  const candidate: MedicationInfo = {
    name: trimAndLimit(obj.name, 60) || query,
    aliases: ensureStringArray(obj.aliases, 20, 60),
    category: trimAndLimit(obj.category, 80) || "확인 필요",
    description: trimAndLimit(obj.description, 240) || "약사 확인 필요",
    defaultFrequency: coerceFrequency(obj.defaultFrequency),
    foodTiming: coerceFoodTiming(obj.foodTiming),
    avoidFoods: coerceAvoidFoods(obj.avoidFoods),
    recommendedFoods: coerceRecommendedFoods(obj.recommendedFoods),
    notes: trimAndLimit(obj.notes, 240) || undefined,
  };

  const parsed = MedicationInfoSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  return {
    name: query,
    aliases: [],
    category: "확인 필요",
    description: "약사 확인 필요",
    defaultFrequency: 2,
    foodTiming: "with",
    avoidFoods: [],
    recommendedFoods: [],
    notes: "AI 응답 형식이 불안정하여 안전한 기본값으로 표시했습니다. 처방전/약사 안내를 우선하세요.",
  };
}

