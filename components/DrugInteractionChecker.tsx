"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { INTERACTION_TIER_LABEL_KO } from "@/lib/interactionLabels";
import type { InteractionTier } from "@/lib/interactionTypes";
import type { MedicationEntry } from "@/lib/types";

const TIER_UI: Record<
  InteractionTier,
  { tone: "emerald" | "amber" | "rose"; Icon: typeof CheckCircle2 }
> = {
  very_safe: { tone: "emerald", Icon: CheckCircle2 },
  caution: { tone: "amber", Icon: AlertTriangle },
  contraindicated: { tone: "rose", Icon: ShieldAlert },
};

function toneClasses(tone: "emerald" | "amber" | "rose") {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

type ApiInteractionResponse = {
  tier?: InteractionTier;
  tierLabelKo?: string;
  resolvedDrugs?: string[];
  unresolvedInputs?: string[];
  hits?: Array<{ drugA: string; drugB: string; tier: InteractionTier; summaryKo: string; ruleId: string }>;
  oneLineKo?: string;
  llmProvider?: "gemini" | "cerebras";
  evidence?: {
    finalSource?: "local_rules" | "openfda" | "commercial_db";
    sourcesTried?: Array<"local_rules" | "openfda" | "commercial_db">;
  };
  coverage?: {
    inputCount?: number;
    resolvedCount?: number;
    unresolvedCount?: number;
    percent?: number;
    confidence?: "low" | "medium" | "high";
    note?: string;
  };
  llmExplanation?: string;
  notice?: string;
  error?: string;
};

interface Props {
  medications: MedicationEntry[];
  onNotice?: (message: string | null) => void;
  onResultChange?: (tier: InteractionTier | null, labelKo?: string) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export type DrugInteractionCheckerHandle = {
  runCheck: () => void;
  scrollIntoView: () => void;
  canRun: boolean;
  loading: boolean;
};

export const DrugInteractionChecker = forwardRef<DrugInteractionCheckerHandle, Props>(
  function DrugInteractionChecker(
    { medications, onNotice, onResultChange, onLoadingChange },
    ref,
  ) {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiInteractionResponse | null>(null);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const m of medications) {
        if (next[m.id] === undefined) next[m.id] = true;
      }
      for (const id of Object.keys(next)) {
        if (!medications.some((m) => m.id === id)) delete next[id];
      }
      return next;
    });
  }, [medications]);

  const selectedNames = useMemo(() => {
    return medications.filter((m) => selectedIds[m.id]).map((m) => m.info.name);
  }, [medications, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const runCheck = useCallback(async () => {
    setError(null);
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugNames: selectedNames }),
      });
      const data = (await res.json()) as ApiInteractionResponse;

      if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        const msg = retry
          ? `요청이 너무 많습니다. ${retry}초 후 다시 시도해 주세요.`
          : "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
        setError(msg);
        onNotice?.(msg);
        onResultChange?.(null);
        return;
      }

      if (!res.ok || data.error) {
        setError(data.error ?? "요청에 실패했습니다.");
        onResultChange?.(null);
        onNotice?.(null);
        return;
      }
      setResponse(data);
      onNotice?.(data.notice?.trim() || null);
      onResultChange?.(data.tier ?? null, data.tierLabelKo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedNames, onNotice, onResultChange]);

  const canRun = selectedNames.length >= 2 && !loading;

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useImperativeHandle(
    ref,
    () => ({
      runCheck: () => {
        if (selectedNames.length >= 2 && !loading) void runCheck();
      },
      scrollIntoView: () => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      canRun,
      loading,
    }),
    [canRun, loading, runCheck, selectedNames.length],
  );
  const tier = response?.tier;
  const ui = tier ? TIER_UI[tier] : null;

  if (medications.length < 2) {
    return (
      <section className="rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-slate-200/70">
        <h2 className="text-sm font-semibold text-slate-900">약물 상호작용</h2>
        <p className="mt-1 text-xs text-slate-500">
          위에서 약·영양제를 2개 이상 추가하면 상호작용을 확인할 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="drug-interaction-checker"
      className="rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-slate-200/70"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">약물 상호작용</h2>
        <button
          type="button"
          onClick={() => {
            const all: Record<string, boolean> = {};
            for (const m of medications) all[m.id] = true;
            setSelectedIds(all);
          }}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 focus-ring rounded-lg px-2 py-1"
        >
          전체 선택
        </button>
      </div>

      <ul className="flex flex-wrap gap-1.5">
        {medications.map((m) => {
          const selected = Boolean(selectedIds[m.id]);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={selected}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-ring ${
                  selected
                    ? "border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {m.info.name}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runCheck()}
          disabled={!canRun}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          상호작용 확인 ({selectedNames.length}개)
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      {response && ui && tier && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneClasses(ui.tone)}`}
            >
              <ui.Icon className="h-3.5 w-3.5" />
              {response.tierLabelKo ?? INTERACTION_TIER_LABEL_KO[tier]}
            </div>
            {response.llmProvider && (
              <span className="text-[11px] text-slate-500">
                AI: {response.llmProvider === "gemini" ? "Gemini" : "Cerebras"}
              </span>
            )}
          </div>

          {(response.unresolvedInputs?.length ?? 0) > 0 && (
            <p className="text-xs text-amber-800">
              미매칭: {response.unresolvedInputs?.join(", ")}
            </p>
          )}

          <p className="text-sm leading-relaxed text-slate-900">{response.oneLineKo}</p>

          {response.hits && response.hits.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
              {response.hits.map((h) => (
                <li key={h.ruleId}>
                  <span className="font-medium">
                    {h.drugA} + {h.drugB}
                  </span>
                  {": "}
                  {h.summaryKo}
                </li>
              ))}
            </ul>
          )}

          {(tier === "caution" || tier === "contraindicated") && response.llmExplanation && (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {response.llmExplanation}
            </p>
          )}
        </div>
      )}
    </section>
  );
},
);
