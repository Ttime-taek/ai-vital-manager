"use client";

import { Trash2, Sparkles, Database, AlertTriangle, Leaf } from "lucide-react";
import type { MedicationEntry, Severity } from "@/lib/types";
import { describeFoodTiming } from "@/lib/scheduleEngine";

interface MedicationCardProps {
  entry: MedicationEntry;
  onRemove: (id: string) => void;
}

const SEVERITY_STYLES: Record<
  Severity,
  { wrap: string; dot: string; label: string }
> = {
  high: {
    wrap: "border-rose-200 bg-rose-50/70",
    dot: "bg-rose-500",
    label: "고위험",
  },
  medium: {
    wrap: "border-amber-200 bg-amber-50/70",
    dot: "bg-amber-500",
    label: "주의",
  },
  low: {
    wrap: "border-slate-200 bg-slate-50",
    dot: "bg-slate-400",
    label: "참고",
  },
};

const RECOMMEND_STYLES: Record<
  Severity,
  { wrap: string; dot: string; label: string }
> = {
  high: {
    wrap: "border-emerald-200 bg-emerald-50/70",
    dot: "bg-emerald-600",
    label: "적극 권장",
  },
  medium: {
    wrap: "border-teal-200 bg-teal-50/70",
    dot: "bg-teal-600",
    label: "권장",
  },
  low: {
    wrap: "border-slate-200 bg-slate-50",
    dot: "bg-slate-500",
    label: "도움됨",
  },
};

export function MedicationCard({ entry, onRemove }: MedicationCardProps) {
  const { info, source } = entry;
  const frequency = entry.customFrequency ?? info.defaultFrequency;

  const sourceTag =
    source === "ai" || source === "ai_web"
      ? {
          icon: Sparkles,
          label: source === "ai_web" ? "웹·AI" : "AI 분석",
          className: "bg-violet-50 text-violet-700 ring-violet-200",
        }
      : source === "database_enriched"
        ? {
            icon: Sparkles,
            label: "AI 보강",
            className: "bg-teal-50 text-teal-800 ring-teal-200",
          }
        : source === "uncertain"
        ? { icon: AlertTriangle, label: "확인 필요", className: "bg-amber-50 text-amber-800 ring-amber-200" }
        : source === "database"
          ? { icon: Database, label: "내장 DB", className: "bg-brand-50 text-brand-700 ring-brand-200" }
          : { icon: AlertTriangle, label: "정보 부족", className: "bg-slate-100 text-slate-600 ring-slate-200" };

  const SourceIcon = sourceTag.icon;

  return (
    <article className="animate-fade-in-up rounded-2xl bg-white p-card shadow-card ring-1 ring-slate-200/70 transition hover:shadow-soft">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-900">
              {info.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${sourceTag.className}`}
            >
              <SourceIcon className="h-3 w-3" />
              {sourceTag.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{info.category}</p>
          {info.aliases.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              별칭: {info.aliases.slice(0, 4).join(", ")}
            </p>
          )}
        </div>
        <button
          onClick={() => onRemove(entry.id)}
          className="touch-target shrink-0 rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-ring"
          aria-label="약물 삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {info.description && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {info.description}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs min-[420px]:grid-cols-2">
        <div>
          <p className="text-slate-500">복용 횟수</p>
          <p className="mt-0.5 font-semibold text-slate-900">하루 {frequency}회</p>
        </div>
        <div>
          <p className="text-slate-500">식사 타이밍</p>
          <p className="mt-0.5 font-semibold text-slate-900">
            {describeFoodTiming(info.foodTiming)}
          </p>
        </div>
      </div>

      {info.avoidFoods.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            피하거나 줄일 것
          </p>
          <ul className="space-y-2">
            {info.avoidFoods.map((interaction, idx) => {
              const style = SEVERITY_STYLES[interaction.severity];
              return (
                <li
                  key={idx}
                  className={`flex gap-2 rounded-lg border px-3 py-2 text-xs ${style.wrap}`}
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <p className="font-semibold text-slate-900">{interaction.food}</p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-0.5 leading-relaxed text-slate-600">
                      {interaction.reason}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(info.recommendedFoods?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <Leaf className="h-3 w-3" />
            함께 먹으면 좋은 것
          </p>
          <ul className="space-y-2">
            {info.recommendedFoods!.map((interaction, idx) => {
              const style = RECOMMEND_STYLES[interaction.severity];
              return (
                <li
                  key={idx}
                  className={`flex gap-2 rounded-lg border px-3 py-2 text-xs ${style.wrap}`}
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <p className="font-semibold text-slate-900">{interaction.food}</p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-0.5 leading-relaxed text-slate-600">
                      {interaction.reason}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {info.notes && (
        <div className="mt-3 rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-brand-900 ring-1 ring-brand-100">
          <span className="font-semibold">팁: </span>
          {info.notes}
        </div>
      )}
    </article>
  );
}
