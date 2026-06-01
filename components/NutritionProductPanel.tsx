"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { INTERACTION_TIER_LABEL_KO } from "@/lib/interactionLabels";
import type { InteractionTier } from "@/lib/interactionTypes";

type StackingReport = {
  summaryKo: string;
  totals: Array<{ ingredient: string; total: number; unit?: string; risk: string; messageKo: string }>;
  synergies: Array<{ pair: [string, string]; messageKo: string; actionKo: string; severity: string }>;
};

type ApiOk = {
  resolved: {
    source: "usda-fdc" | "openfoodfacts";
    notices: string[];
    profile: { supplement: string; ingredients: Record<string, number> };
    externalId: string;
    name: string;
    brand?: string;
  };
  stacking: StackingReport;
  disclaimer: string;
};

type ApiErr = { error: string };

type ComboApiResponse = {
  tier?: InteractionTier;
  tierLabelKo?: string;
  oneLineKo?: string;
  hits?: Array<{ drugA: string; drugB: string; summaryKo: string; ruleId: string }>;
  unresolvedInputs?: string[];
  notice?: string;
  error?: string;
};

const TIER_UI: Record<
  InteractionTier,
  { tone: "emerald" | "amber" | "rose"; Icon: typeof CheckCircle2 }
> = {
  very_safe: { tone: "emerald", Icon: CheckCircle2 },
  caution: { tone: "amber", Icon: AlertTriangle },
  contraindicated: { tone: "rose", Icon: ShieldAlert },
};

function tierToneClass(tone: "emerald" | "amber" | "rose") {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

const USDA_DEMO_QUERIES = ["vitamin d", "omega-3", "magnesium", "vitamin c"];

function formatNutritionError(status: number, mode: "usda_search" | "off_barcode", msg: string) {
  if (status === 502 && mode === "off_barcode") {
    return "Open Food Facts에서 바코드를 찾지 못했거나 서비스가 일시적으로 불안정합니다. 바코드를 확인하거나 USDA 검색을 이용해 주세요.";
  }
  if (status === 502) {
    return "외부 영양 DB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (status === 429) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  return msg;
}

function normalizeDrugKey(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

export interface NutritionProductPanelProps {
  /** 스케줄에 등록된 약 이름 — 있으면 검색 직후 약-영양제 조합 신호를 같은 화면에 붙입니다. */
  registeredMedicationNames?: string[];
}

export function NutritionProductPanel({ registeredMedicationNames = [] }: NutritionProductPanelProps) {
  const [mode, setMode] = useState<"usda_search" | "off_barcode">("usda_search");
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiOk | null>(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const [combo, setCombo] = useState<ComboApiResponse | null>(null);

  const title = useMemo(() => {
    if (mode === "usda_search") return "USDA FoodData Central (검색)";
    return "Open Food Facts (바코드)";
  }, [mode]);

  const fetchComboWithMeds = useCallback(
    async (apiOk: ApiOk) => {
      if (registeredMedicationNames.length === 0) {
        setCombo(null);
        setComboError(null);
        return;
      }

      const supplementLabel =
        apiOk.resolved.profile.supplement?.trim() || apiOk.resolved.name?.trim() || "";
      if (!supplementLabel) {
        setCombo(null);
        setComboError(null);
        return;
      }

      const names: string[] = [];
      const seen = new Set<string>();
      for (const raw of [...registeredMedicationNames, supplementLabel]) {
        const t = raw.trim();
        if (!t) continue;
        const k = normalizeDrugKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        names.push(t);
      }

      if (names.length < 2) {
        setCombo(null);
        setComboError(null);
        return;
      }

      setComboLoading(true);
      setComboError(null);
      setCombo(null);
      try {
        const res = await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drugNames: names }),
        });
        const data = (await res.json()) as ComboApiResponse;
        if (!res.ok || data.error) {
          setComboError(data.error ?? "조합 확인에 실패했습니다.");
          return;
        }
        setCombo(data);
      } catch (e) {
        console.error(e);
        setComboError("조합 확인 중 네트워크 오류가 발생했습니다.");
      } finally {
        setComboLoading(false);
      }
    },
    [registeredMedicationNames],
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCombo(null);
    setComboError(null);
    try {
      const body =
        mode === "usda_search"
          ? { mode: "usda_search" as const, query: query.trim() }
          : { mode: "off_barcode" as const, barcode: barcode.trim() };

      const res = await fetch("/api/nutrition/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok || "error" in json) {
        const msg = "error" in json ? json.error : "요청에 실패했습니다.";
        setError(formatNutritionError(res.status, mode, msg));
        return;
      }
      setResult(json);
      await fetchComboWithMeds(json);
    } catch (e) {
      console.error(e);
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [barcode, fetchComboWithMeds, mode, query]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">영양제·제품 검색</h2>
          <p className="mt-1 text-xs text-slate-500">
            한 번에 성분 요약과 중복·상성(휴리스틱)을 보여 주고, 위에서 등록한 약이 있으면 같은 화면에서 조합 신호까지 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("usda_search")}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-card transition focus-ring ${
              mode === "usda_search"
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/40"
            }`}
          >
            USDA 검색
          </button>
          <button
            type="button"
            onClick={() => setMode("off_barcode")}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold shadow-card transition focus-ring ${
              mode === "off_barcode"
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/40"
            }`}
          >
            OFF 바코드
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        {mode === "usda_search" ? (
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">{title}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="예: vitamin d3 supplement / 센트룸 / 우유"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {USDA_DEMO_QUERIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuery(q)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800 focus-ring"
                >
                  {q}
                </button>
              ))}
            </div>
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">{title}</span>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              inputMode="numeric"
              placeholder="바코드(숫자)를 입력하세요"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        )}

        <button
          type="button"
          onClick={run}
          disabled={loading || (mode === "usda_search" ? query.trim().length === 0 : barcode.trim().length === 0)}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:from-brand-600 hover:to-brand-500 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "불러오는 중..." : "불러오기"}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">연결 결과</p>
            <p className="mt-1 text-sm text-slate-900">
              <span className="font-semibold">{result.resolved.profile.supplement}</span>
              <span className="text-slate-500"> · {result.resolved.source}</span>
            </p>
            {result.resolved.notices?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                {result.resolved.notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-800">추출된 성분</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.keys(result.resolved.profile.ingredients).length === 0 ? (
                <p className="text-sm text-slate-600">추출된 성분이 없습니다(데이터 미기재 또는 미지원 필드).</p>
              ) : (
                Object.entries(result.resolved.profile.ingredients).map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="text-sm font-semibold text-slate-900">{v}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">중복·상성(휴리스틱)</p>
            <p className="mt-2 text-sm text-slate-900">{result.stacking.summaryKo}</p>
            {result.stacking.synergies.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-800">
                {result.stacking.synergies.slice(0, 6).map((s, idx) => (
                  <li key={`${s.messageKo}-${idx}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="font-semibold">{s.messageKo}</div>
                    <div className="text-xs text-slate-600">{s.actionKo}</div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-slate-800">등록한 약과의 조합</p>
            {registeredMedicationNames.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                약을 한 개 이상 등록하면, 이 제품과 함께 상호작용 신호를 여기서 바로 확인할 수 있습니다.
              </p>
            ) : comboLoading || loading ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                조합 확인 중…
              </p>
            ) : comboError ? (
              <p className="mt-2 text-sm text-rose-800">{comboError}</p>
            ) : combo?.tier ? (
              <div className="mt-2 space-y-2">
                {(() => {
                  const ui = TIER_UI[combo.tier];
                  const Icon = ui.Icon;
                  return (
                    <div
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tierToneClass(ui.tone)}`}
                    >
                      <Icon className="h-4 w-4" />
                      {combo.tierLabelKo ?? INTERACTION_TIER_LABEL_KO[combo.tier]}
                    </div>
                  );
                })()}
                {(combo.unresolvedInputs?.length ?? 0) > 0 ? (
                  <p className="text-xs text-amber-800">
                    일부 이름만 DB에 매칭되었습니다: {combo.unresolvedInputs?.join(", ")}
                  </p>
                ) : null}
                <p className="text-sm font-medium text-slate-900">{combo.oneLineKo}</p>
                {combo.hits && combo.hits.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-slate-700">
                    {combo.hits.slice(0, 4).map((h) => (
                      <li key={h.ruleId}>
                        <span className="font-medium">
                          {h.drugA} + {h.drugB}
                        </span>
                        {": "}
                        {h.summaryKo}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {combo.notice ? <p className="text-xs text-slate-500">{combo.notice}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                조합을 계산하려면 서로 다른 항목이 2개 이상 필요합니다. 약 이름과 제품명이 같게 잡히면 한쪽을 &ldquo;약물
                상호작용 체크&rdquo;에서 직접 추가해 보세요.
              </p>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500">{result.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
