import { AlertTriangle, Leaf, ShieldCheck } from "lucide-react";
import type { MedicationEntry } from "@/lib/types";
import {
  aggregateAvoidFoods,
  aggregateRecommendedFoods,
  AVOID_SEVERITY_THEME,
  RECOMMEND_SEVERITY_THEME,
  type AggregatedFoodGuidance,
} from "@/lib/foodGuidance";

interface WarningPanelProps {
  meds: MedicationEntry[];
}

function FoodGuidanceList({
  items,
  themeMap,
}: {
  items: AggregatedFoodGuidance[];
  themeMap: typeof AVOID_SEVERITY_THEME;
}) {
  return (
    <ul className="space-y-2">
      {items.map((w) => {
        const theme = themeMap[w.severity];
        return (
          <li key={w.food} className={`rounded-xl border p-3 ${theme.wrap}`}>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <p className="font-semibold text-slate-900">{w.food}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme.chip}`}
              >
                {theme.label}
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {w.reasons.map((r, idx) => (
                <li key={idx} className="text-xs text-slate-700">
                  <span className="font-medium text-slate-900">{r.medName}</span>
                  <span className="text-slate-400"> · </span>
                  {r.reason}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export function WarningPanel({ meds }: WarningPanelProps) {
  const avoidItems = aggregateAvoidFoods(meds);
  const recommendItems = aggregateRecommendedFoods(meds);
  const hasAny = avoidItems.length > 0 || recommendItems.length > 0;

  return (
    <section className="rounded-2xl bg-white p-section shadow-card ring-1 ring-slate-200/70">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">식이 가이드</h2>
        <p className="text-xs text-slate-500">
          등록된 모든 약물 기준으로 피해야 할 음식과 함께 먹으면 좋은 식습관을 모았습니다.
        </p>
      </div>

      {!hasAny ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 py-10 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium text-slate-700">
            아직 식이 가이드가 없습니다.
          </p>
          <p className="text-xs text-slate-500">
            약을 추가하면 피할 음식·추천 식습관이 자동으로 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              피하거나 줄일 것
              {avoidItems.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                  {avoidItems.length}건
                </span>
              )}
            </h3>
            {avoidItems.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                등록된 약물에 특별히 피해야 할 음식 정보가 없습니다.
              </p>
            ) : (
              <FoodGuidanceList items={avoidItems} themeMap={AVOID_SEVERITY_THEME} />
            )}
          </div>

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Leaf className="h-4 w-4 text-emerald-600" />
              함께 먹으면 좋은 것
              {recommendItems.length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                  {recommendItems.length}건
                </span>
              )}
            </h3>
            {recommendItems.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                추천 식품 정보가 아직 없습니다. AI 분석 약물은 분석 결과에 따라 표시됩니다.
              </p>
            ) : (
              <FoodGuidanceList
                items={recommendItems}
                themeMap={RECOMMEND_SEVERITY_THEME}
              />
            )}
          </div>
        </div>
      )}

      <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
        ⚠ 본 정보는 일반적인 참고용입니다. 실제 복약·식이는 반드시 의사·약사의 지시에 따라 진행하세요.
      </p>
    </section>
  );
}
