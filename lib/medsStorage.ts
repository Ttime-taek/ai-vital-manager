import type { MedicationEntry } from "./types";

const LS_KEY = "vp:meds:v1";

export function loadStoredMeds(): MedicationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: MedicationEntry[] };
    const items = parsed.items ?? [];
    return items.filter(
      (e) =>
        e &&
        typeof e.id === "string" &&
        e.info &&
        typeof e.info.name === "string" &&
        ["database", "ai", "fallback", "uncertain"].includes(e.source),
    );
  } catch {
    return [];
  }
}

export function saveStoredMeds(items: MedicationEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ items }));
  } catch {
    // quota / private mode — ignore
  }
}
