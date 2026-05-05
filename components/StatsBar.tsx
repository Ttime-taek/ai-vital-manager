import { Pill, Clock, AlertTriangle } from "lucide-react";

interface StatsBarProps {
  medCount: number;
  doseCount: number;
  warningCount: number;
}

export function StatsBar({ medCount, doseCount, warningCount }: StatsBarProps) {
  const items = [
    {
      icon: Pill,
      label: "등록 약물",
      value: medCount,
      unit: "개",
      tone: "from-brand-500 to-brand-700",
    },
    {
      icon: Clock,
      label: "하루 복용",
      value: doseCount,
      unit: "회",
      tone: "from-brand-400 to-brand-600",
    },
    {
      icon: AlertTriangle,
      label: "주의 음식",
      value: warningCount,
      unit: "건",
      tone: "from-amber-500 to-rose-500",
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(({ icon: Icon, label, value, unit, tone }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70"
        >
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-bold text-slate-900">
              {value}
              <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
