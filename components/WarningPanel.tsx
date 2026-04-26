import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { MedicationEntry, Severity } from "@/lib/types";

interface WarningPanelProps {
  meds: MedicationEntry[];
}

interface AggregatedWarning {
  food: string;
  severity: Severity;
  reasons: { medName: string; reason: string }[];
}

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

function aggregate(meds: MedicationEntry[]): AggregatedWarning[] {
  const map = new Map<string, AggregatedWarning>();

  for (const med of meds) {
    for (const f of med.info.avoidFoods) {
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

const SEVERITY_THEME: Record<
  Severity,
  { wrap: string; chip: string; label: string }
> = {
  high: {
    wrap: "border-rose-200 bg-rose-50",
    chip: "bg-rose-600 text-white",
    label: "고위험",
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

export function WarningPanel({ meds }: WarningPanelProps) {
  const warnings = aggregate(meds);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            함께 먹지 말아야 할 음식
          </h2>
          <p className="text-xs text-slate-500">
            등록된 모든 약물의 식이 상호작용을 한 번에 모았습니다.
          </p>
        </div>
      </div>

      {warnings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 py-10 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium text-slate-700">
            현재 알려진 음식 상호작용이 없습니다.
          </p>
          <p className="text-xs text-slate-500">
            약을 추가하면 자동으로 분석됩니다.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w) => {
            const theme = SEVERITY_THEME[w.severity];
            return (
              <li
                key={w.food}
                className={`rounded-xl border p-3 ${theme.wrap}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{w.food}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.chip}`}
                  >
                    {theme.label}
                  </span>
                </div>
                <ul className="mt-2 space-y-1">
                  {w.reasons.map((r, idx) => (
                    <li key={idx} className="text-xs text-slate-700">
                      <span className="font-medium text-slate-900">
                        {r.medName}
                      </span>
                      <span className="text-slate-400"> · </span>
                      {r.reason}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        ⚠ 본 정보는 일반적인 참고용입니다. 실제 복약은 반드시 의사·약사의 지시에 따라 진행하세요.
      </p>
    </section>
  );
}
