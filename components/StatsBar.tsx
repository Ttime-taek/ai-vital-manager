import { Pill, Clock, AlertTriangle, ShieldAlert, Leaf } from "lucide-react";
import type { InteractionTier } from "@/lib/interactionTypes";
import { INTERACTION_TIER_LABEL_KO } from "@/lib/interactionLabels";

interface StatsBarProps {
  medCount: number;
  doseCount: number;
  warningCount: number;
  recommendCount: number;
  interactionTier?: InteractionTier | null;
  interactionLabelKo?: string;
}

const TIER_TONE: Record<InteractionTier, string> = {
  very_safe: "from-emerald-500 to-emerald-600",
  caution: "from-amber-500 to-orange-500",
  contraindicated: "from-rose-500 to-rose-700",
};

export function StatsBar({
  medCount,
  doseCount,
  warningCount,
  recommendCount,
  interactionTier,
  interactionLabelKo,
}: StatsBarProps) {
  const items: Array<{
    icon: typeof Pill;
    label: string;
    value: number | string;
    unit: string;
    tone: string;
  }> = [
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
      label: "피할 음식",
      value: warningCount,
      unit: "건",
      tone: "from-amber-500 to-rose-500",
    },
    {
      icon: Leaf,
      label: "추천 식습관",
      value: recommendCount,
      unit: "건",
      tone: "from-emerald-500 to-teal-600",
    },
  ];

  if (interactionTier) {
    items.push({
      icon: ShieldAlert,
      label: "약물 상호작용",
      value: interactionLabelKo ?? INTERACTION_TIER_LABEL_KO[interactionTier],
      unit: "",
      tone: TIER_TONE[interactionTier],
    });
  }

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {items.map(({ icon: Icon, label, value, unit, tone }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70"
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              {value}
              {unit ? (
                <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
              ) : null}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
