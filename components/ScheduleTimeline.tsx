import { Sun, Sunrise, Sunset, Moon, Sparkle } from "lucide-react";
import type { ScheduleSlot, DoseTime } from "@/lib/types";

interface ScheduleTimelineProps {
  slots: ScheduleSlot[];
}

const ICONS: Record<DoseTime, typeof Sun> = {
  morning: Sunrise,
  lunch: Sun,
  evening: Sunset,
  bedtime: Moon,
  asNeeded: Sparkle,
};

export function ScheduleTimeline({ slots }: ScheduleTimelineProps) {
  const visible = slots.filter(
    (s) => s.time !== "asNeeded" || s.meds.length > 0,
  );

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            오늘의 복약 스케줄
          </h2>
          <p className="text-xs text-slate-500">
            등록된 약을 시간대별로 자동 분배합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((slot) => {
          const Icon = ICONS[slot.time];
          const empty = slot.meds.length === 0;
          return (
            <div
              key={slot.time}
              className={`relative rounded-xl border p-4 transition ${
                empty
                  ? "border-dashed border-slate-200 bg-slate-50/60"
                  : "border-brand-200 bg-gradient-to-br from-brand-50/80 to-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      empty
                        ? "bg-slate-200 text-slate-500"
                        : "bg-brand-600 text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {slot.label}
                    </p>
                    <p className="text-[11px] text-slate-500">{slot.hour}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    empty
                      ? "bg-white text-slate-400 ring-1 ring-slate-200"
                      : "bg-white text-brand-700 ring-1 ring-brand-200"
                  }`}
                >
                  {slot.meds.length}개
                </span>
              </div>

              {empty ? (
                <p className="mt-3 text-xs text-slate-400">복용할 약 없음</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {slot.meds.map((m) => (
                    <li
                      key={m.id + slot.time}
                      className="rounded-md bg-white/80 px-2.5 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-brand-100"
                    >
                      {m.info.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
