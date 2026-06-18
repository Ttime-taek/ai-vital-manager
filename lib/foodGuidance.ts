import type { FoodInteraction, MedicationEntry, Severity } from "@/lib/types";

export interface AggregatedFoodGuidance {
  food: string;
  severity: Severity;
  reasons: { medName: string; reason: string }[];
}

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

function aggregateFromMeds(
  meds: MedicationEntry[],
  field: "avoidFoods" | "recommendedFoods",
): AggregatedFoodGuidance[] {
  const map = new Map<string, AggregatedFoodGuidance>();

  for (const med of meds) {
    const items = field === "avoidFoods" ? med.info.avoidFoods : med.info.recommendedFoods ?? [];
    for (const f of items) {
      const key = f.food.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.reasons.push({ medName: med.info.name, reason: f.reason });
        if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[existing.severity]) {
          existing.severity = f.severity;
        }
      } else {
        map.set(key, {
          food: f.food,
          severity: f.severity,
          reasons: [{ medName: med.info.name, reason: f.reason }],
        });
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

export function aggregateAvoidFoods(meds: MedicationEntry[]) {
  return aggregateFromMeds(meds, "avoidFoods");
}

export function aggregateRecommendedFoods(meds: MedicationEntry[]) {
  return aggregateFromMeds(meds, "recommendedFoods");
}

export const AVOID_SEVERITY_THEME: Record<
  Severity,
  { wrap: string; chip: string; label: string }
> = {
  high: {
    wrap: "border-rose-200 bg-rose-50",
    chip: "bg-rose-600 text-white",
    label: "피하기",
  },
  medium: {
    wrap: "border-amber-200 bg-amber-50",
    chip: "bg-amber-500 text-white",
    label: "주의",
  },
  low: {
    wrap: "border-slate-200 bg-slate-50",
    chip: "bg-slate-400 text-white",
    label: "참고",
  },
};

export const RECOMMEND_SEVERITY_THEME: Record<
  Severity,
  { wrap: string; chip: string; label: string }
> = {
  high: {
    wrap: "border-emerald-200 bg-emerald-50",
    chip: "bg-emerald-600 text-white",
    label: "적극 권장",
  },
  medium: {
    wrap: "border-teal-200 bg-teal-50",
    chip: "bg-teal-600 text-white",
    label: "권장",
  },
  low: {
    wrap: "border-slate-200 bg-slate-50",
    chip: "bg-slate-500 text-white",
    label: "도움됨",
  },
};
