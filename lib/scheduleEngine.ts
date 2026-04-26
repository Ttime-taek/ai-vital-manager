import type {
  DoseTime,
  MedicationEntry,
  ScheduleSlot,
} from "./types";

const SLOT_LABELS: Record<DoseTime, { label: string; hour: string }> = {
  morning: { label: "아침", hour: "08:00" },
  lunch: { label: "점심", hour: "13:00" },
  evening: { label: "저녁", hour: "19:00" },
  bedtime: { label: "취침 전", hour: "22:00" },
  asNeeded: { label: "필요시", hour: "—" },
};

/**
 * 하루 복용 횟수에 따라 어떤 시간대에 복용할지 결정합니다.
 * 1회: 아침
 * 2회: 아침 / 저녁
 * 3회: 아침 / 점심 / 저녁
 * 4회: 아침 / 점심 / 저녁 / 취침 전
 */
export function getSlotsForFrequency(frequency: 1 | 2 | 3 | 4): DoseTime[] {
  switch (frequency) {
    case 1:
      return ["morning"];
    case 2:
      return ["morning", "evening"];
    case 3:
      return ["morning", "lunch", "evening"];
    case 4:
      return ["morning", "lunch", "evening", "bedtime"];
  }
}

/**
 * 메디케이션 목록으로부터 시간대별 스케줄을 만듭니다.
 * 빈 슬롯은 제외하지 않고 그대로 반환하여 UI에서 일관된 타임라인을 그릴 수 있게 합니다.
 */
export function buildSchedule(meds: MedicationEntry[]): ScheduleSlot[] {
  const order: DoseTime[] = [
    "morning",
    "lunch",
    "evening",
    "bedtime",
    "asNeeded",
  ];

  const slotMap: Record<DoseTime, MedicationEntry[]> = {
    morning: [],
    lunch: [],
    evening: [],
    bedtime: [],
    asNeeded: [],
  };

  for (const med of meds) {
    const freq = med.customFrequency ?? med.info.defaultFrequency;
    const slots = getSlotsForFrequency(freq);
    for (const s of slots) {
      slotMap[s].push(med);
    }
  }

  return order.map((time) => ({
    time,
    label: SLOT_LABELS[time].label,
    hour: SLOT_LABELS[time].hour,
    meds: slotMap[time],
  }));
}

export function describeFoodTiming(timing: "before" | "with" | "after" | "any"): string {
  switch (timing) {
    case "before":
      return "식전 (보통 30분~1시간 전)";
    case "with":
      return "식사와 함께";
    case "after":
      return "식후";
    case "any":
      return "복용 시간 자유";
  }
}
