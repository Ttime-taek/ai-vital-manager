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

type ManualQuickItem = { name: string };

const LS_KEY = "vp:interactionQuickAdd:v1";

function normalizeKey(s: string) {
  return s.replace(/\s+/g, "").toLowerCase();
}

function manualIdFor(name: string) {
  return `manual:${normalizeKey(name).slice(0, 60)}`;
}

function makeManualEntry(name: string): MedicationEntry {
  const now = Date.now();
  return {
    id: manualIdFor(name),
    source: "fallback",
    addedAt: now,
    info: {
      name,
      aliases: [],
      category: "직접 입력",
      description: "사용자가 직접 입력한 약물명입니다.",
      defaultFrequency: 1,
      foodTiming: "any",
      avoidFoods: [],
    },
  };
}

export const DrugInteractionChecker = forwardRef<DrugInteractionCheckerHandle, Props>(
  function DrugInteractionChecker(
    { medications, onNotice, onResultChange, onLoadingChange },
    ref,
  ) {
  const sectionRef = useRef<HTMLElement>(null);
  const [manualItems, setManualItems] = useState<MedicationEntry[]>([]);
  const [manualInput, setManualInput] = useState("");

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiInteractionResponse | null>(null);

  // load manual quick items
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { items?: ManualQuickItem[] };
      const items = (parsed.items ?? [])
        .map((x) => x?.name?.trim())
        .filter(Boolean) as string[];
      setManualItems(items.map((name) => makeManualEntry(name)));
    } catch {
      // ignore
    }
  }, []);

  // persist manual quick items
  useEffect(() => {
    try {
      const payload = { items: manualItems.map((m) => ({ name: m.info.name })) };
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [manualItems]);

  const allMedications = useMemo(() => {
    const out: MedicationEntry[] = [];
    const seen = new Set<string>();

    for (const m of [...manualItems, ...medications]) {
      const k = normalizeKey(m.info.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(m);
    }
    return out;
  }, [manualItems, medications]);

  // 새 약이 추가되면 상호작용 체크 대상을 자동 선택
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const m of allMedications) {
        if (next[m.id] === undefined) next[m.id] = true;
      }
      return next;
    });
  }, [allMedications]);

  const selectedNames = useMemo(() => {
    return allMedications.filter((m) => selectedIds[m.id]).map((m) => m.info.name);
  }, [allMedications, selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const addManual = useCallback(() => {
    const name = manualInput.trim();
    if (!name) return;
    if (name.length > 80) {
      setError("약 이름이 너무 깁니다. (최대 80자)");
      return;
    }
    const key = normalizeKey(name);
    const exists = allMedications.some((m) => normalizeKey(m.info.name) === key);
    if (exists) {
      setError(`이미 목록에 있습니다: ${name}`);
      return;
    }

    const entry = makeManualEntry(name);
    setManualItems((prev) => [entry, ...prev]);
    setSelectedIds((prev) => ({ ...prev, [entry.id]: true }));
    setManualInput("");
    setError(null);
  }, [allMedications, manualInput]);

  const removeManual = useCallback((id: string) => {
    setManualItems((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

  if (allMedications.length < 2) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
        <h2 className="text-base font-semibold text-slate-900">약물 상호작용 체크</h2>
        <p className="mt-2 text-sm text-slate-500">
          약물을 2개 이상 등록하면 로컬 규칙·openFDA 기반 상호작용 신호를 확인할 수 있습니다.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          현재 등록된 약이 없거나 1개뿐입니다. 위쪽에서 약물을 검색해 추가해 주세요.
        </p>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      id="drug-interaction-checker"
      className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70"
    >
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">약물 상호작용 체크</h2>
        <p className="mt-1 text-xs text-slate-500">
          로컬 규칙(빠름) + 공개 API(openFDA/RxNorm) 기반으로 가능한 범위에서 상호작용 신호를 탐지합니다.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-xs font-semibold text-slate-700">약 이름 직접 입력(빠른 선택에 추가)</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addManual();
            }}
            placeholder="예: 메트포르민, 오메가3, 비타민C"
            className="h-11 w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:w-auto"
          />
          <button
            type="button"
            onClick={() => addManual()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring"
          >
            추가
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          입력한 약은 이 화면의 빠른 선택 목록에만 추가됩니다. (브라우저에 저장됨)
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">체크할 약물</p>
        <button
          type="button"
          onClick={() => {
            const all: Record<string, boolean> = {};
            for (const m of allMedications) all[m.id] = true;
            setSelectedIds(all);
          }}
          className="text-xs font-semibold text-brand-700 hover:text-brand-800 focus-ring rounded-lg px-2 py-1"
        >
          전체 선택
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {allMedications.map((m) => {
          const selected = Boolean(selectedIds[m.id]);
          return (
            <li key={m.id} className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={selected}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-ring ${
                  selected
                    ? "border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-200"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {m.info.name}
                <span className="text-[10px] font-normal text-slate-400">{m.info.category}</span>
              </button>
              {m.id.startsWith("manual:") && (
                <button
                  type="button"
                  onClick={() => removeManual(m.id)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-700 focus-ring rounded-lg px-1"
                >
                  목록에서 제거
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runCheck()}
          disabled={!canRun}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          상호작용 확인
        </button>
        <span className="text-xs text-slate-500">
          선택됨 <span className="font-semibold text-slate-700">{selectedNames.length}</span>개
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      {response && ui && tier && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses(ui.tone)}`}
            >
              <ui.Icon className="h-4 w-4" />
              {response.tierLabelKo ?? INTERACTION_TIER_LABEL_KO[tier]}
            </div>

            {response.evidence?.finalSource && (
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                근거:{" "}
                {response.evidence.finalSource === "commercial_db"
                  ? "상용/의료 DB"
                  : response.evidence.finalSource === "openfda"
                    ? "openFDA 라벨"
                    : "로컬 규칙"}
              </div>
            )}

            {typeof response.coverage?.percent === "number" && (
              <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                커버리지 {response.coverage.percent}%
                {response.coverage.confidence ? (
                  <span className="text-slate-400">
                    (
                    {response.coverage.confidence === "high"
                      ? "높음"
                      : response.coverage.confidence === "medium"
                        ? "보통"
                        : "낮음"}
                    )
                  </span>
                ) : null}
              </div>
            )}

            {response.llmExplanation && response.llmProvider && (
              <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                AI 설명: {response.llmProvider === "gemini" ? "Gemini" : "Cerebras"}
              </div>
            )}
          </div>

          {(response.unresolvedInputs?.length ?? 0) > 0 && (
            <p className="text-xs text-amber-800">
              일부 이름을 규칙 DB에서 찾지 못했습니다: {response.unresolvedInputs?.join(", ")}
            </p>
          )}

          <p className="text-sm font-medium leading-relaxed text-slate-900">{response.oneLineKo}</p>

          {response.coverage?.note && (
            <p className="text-xs text-slate-500">{response.coverage.note}</p>
          )}

          {response.hits && response.hits.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-600">근거 규칙(목 데이터)</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
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
            </div>
          )}

          {(tier === "caution" || tier === "contraindicated") && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">AI 설명</div>
              {response.notice && (
                <p className="mt-2 text-xs text-slate-500">{response.notice}</p>
              )}
              {response.llmExplanation ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{response.llmExplanation}</p>
              ) : (
                !response.notice && (
                  <p className="mt-2 text-xs text-slate-500">
                    설명을 불러오는 중이거나 제공되지 않았습니다. 위 요약과 약사·의사 상담을 참고하세요.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
},
);
