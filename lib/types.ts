export type DoseTime = "morning" | "lunch" | "evening" | "bedtime" | "asNeeded";

export type FoodTiming = "before" | "with" | "after" | "any";

export type Severity = "high" | "medium" | "low";

export interface FoodInteraction {
  food: string;
  reason: string;
  severity: Severity;
}

export interface MedicationInfo {
  name: string;
  aliases: string[];
  category: string;
  description: string;
  defaultFrequency: 1 | 2 | 3 | 4;
  foodTiming: FoodTiming;
  avoidFoods: FoodInteraction[];
  notes?: string;
}

export interface MedicationEntry {
  id: string;
  info: MedicationInfo;
  customFrequency?: 1 | 2 | 3 | 4;
  source: "database" | "ai" | "fallback" | "uncertain";
  addedAt: number;
}

export interface ScheduleSlot {
  time: DoseTime;
  label: string;
  hour: string;
  meds: MedicationEntry[];
}
