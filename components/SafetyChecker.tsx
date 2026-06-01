"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, HelpCircle, Loader2, ShieldAlert } from "lucide-react";
import type {
  EvidenceStrength,
  ItemKind,
  Persona,
  SafetyResult,
  SafetyVerdict,
  YesNoUnknown,
} from "@/lib/safetyTypes";

const VERDICT_UI: Record<
  SafetyVerdict,
  { label: string; tone: "emerald" | "amber" | "rose" | "slate"; icon: React.ReactNode }
> = {
  ok: {
    label: "문제 신호 없음",
    tone: "emerald",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  caution: {
    label: "주의 필요",
    tone: "amber",
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  ban: {
    label: "금지",
    tone: "rose",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  insufficient_info: {
    label: "정보 부족",
    tone: "slate",
    icon: <HelpCircle className="h-4 w-4" />,
  },
};

function toneClasses(tone: "emerald" | "amber" | "rose" | "slate") {
  if (tone === "emerald") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (tone === "rose") return "bg-rose-50 text-rose-900 ring-rose-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
}

function strengthLabel(s: EvidenceStrength) {
  if (s === "high") return "높음";
  if (s === "medium") return "중간";
  return "낮음";
}

type CandidatePick = {
  rawName: string;
  id: string;
  name: string;
  kind: ItemKind;
};

export function SafetyChecker({ embedded = false }: { embedded?: boolean }) {
  const [persona, setPersona] = useState<Persona>("D");
  const [pregnantOrLactating, setPregnantOrLactating] = useState<YesNoUnknown>("unknown");
  const [hasPrescriptionMeds, setHasPrescriptionMeds] = useState<YesNoUnknown>("unknown");

  const [rawItems, setRawItems] = useState<string>("");
  const [kind, setKind] = useState<ItemKind>("unknown");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [selected, setSelected] = useState<Record<string, CandidatePick>>({});
  const [needsPick, setNeedsPick] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paidLoading, setPaidLoading] = useState(false);

  const items = useMemo(() => {
    const parts = rawItems
      .split(/[,\n]/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    return parts.map((rawName) => ({ rawName, kind }));
  }, [rawItems, kind]);

  const submit = useCallback(
    async (paid: boolean) => {
      setError(null);
      setLoading(!paid);
      setPaidLoading(paid);
      try {
        const res = await fetch("/api/safety", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context: { persona, pregnantOrLactating, hasPrescriptionMeds },
            items,
            selected,
            paid,
          }),
        });
        const data = (await res.json()) as SafetyResult & { error?: string };
        if (!res.ok || data.error) {
          setError(data.error ?? "요청에 실패했습니다.");
          return;
        }

        setResult(data);

        // Find first item that has candidate suggestions and is not selected yet.
        const firstNeed = data.normalized.find(
          (n) => n.candidates.length > 0 && !selected[n.rawName],
        );
        setNeedsPick(firstNeed?.rawName ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
      } finally {
        setLoading(false);
        setPaidLoading(false);
      }
    },
    [persona, pregnantOrLactating, hasPrescriptionMeds, items, selected],
  );

  const canSubmit = items.length > 0 && !loading && !paidLoading;

  useEffect(() => {
    if (!needsPick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNeedsPick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [needsPick]);

  const verdictUi = result ? VERDICT_UI[result.verdict] : null;

  const candidateModal = useMemo(() => {
    if (!result || !needsPick) return null;
    const norm = result.normalized.find((n) => n.rawName === needsPick);
    if (!norm || norm.candidates.length === 0) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-pick-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") setNeedsPick(null);
        }}
      >
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-200/70">
          <div className="mb-3">
            <h3 id="safety-pick-title" className="text-sm font-semibold text-slate-900">
              후보 선택
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              입력한 <span className="font-medium text-slate-700">“{needsPick}”</span>에 대해 가장 가까운 항목을 선택해 주세요.
            </p>
          </div>
          <div className="space-y-2">
            {norm.candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelected((prev) => ({
                    ...prev,
                    [needsPick]: { rawName: needsPick, id: c.id, name: c.name, kind: c.kind },
                  }));
                  setNeedsPick(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 transition hover:border-brand-400 hover:bg-brand-50 focus-ring"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-slate-500">
                    신뢰도 {Math.round(c.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500">종류: {c.kind}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setNeedsPick(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-ring"
            >
              나중에
            </button>
          </div>
        </div>
      </div>
    );
  }, [result, needsPick]);

  return (
    <section
      className={
        embedded
          ? ""
          : "rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70"
      }
    >
      {!embedded ? (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">30초 안전 판정</h2>
            <p className="text-xs text-slate-500">
              임신/수유, 복용 중인 약, 영양제 조합을 입력하면 OK/주의/금지/정보 부족으로 빠르게 판단합니다.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600">
          페르소나
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            value={persona}
            onChange={(e) => setPersona(e.target.value as Persona)}
          >
            <option value="B">B: 특수 상황</option>
            <option value="D">D: 보호자/자녀</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600">
          임신/수유
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            value={pregnantOrLactating}
            onChange={(e) => setPregnantOrLactating(e.target.value as YesNoUnknown)}
          >
            <option value="unknown">모름</option>
            <option value="no">아니오</option>
            <option value="yes">예</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600">
          처방약 복용
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            value={hasPrescriptionMeds}
            onChange={(e) => setHasPrescriptionMeds(e.target.value as YesNoUnknown)}
          >
            <option value="unknown">모름</option>
            <option value="no">아니오</option>
            <option value="yes">예</option>
          </select>
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
          입력 종류
          <select
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            value={kind}
            onChange={(e) => setKind(e.target.value as ItemKind)}
          >
            <option value="unknown">자동(모름)</option>
            <option value="supplement">영양제</option>
            <option value="drug">약</option>
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
          약/영양제 이름 (쉼표 또는 줄바꿈으로 여러 개)
          <textarea
            value={rawItems}
            onChange={(e) => setRawItems(e.target.value)}
            rows={2}
            placeholder={"예: 와파린, 오메가3\n또는: 레보티록신, 철분제"}
            className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          무료로 판정
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setSelected({});
              setNeedsPick(null);
              setError(null);
              setRawItems("");
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-ring"
          >
            초기화
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
          {error}
        </div>
      )}

      {result && verdictUi && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${toneClasses(
                  verdictUi.tone,
                )}`}
              >
                {verdictUi.icon}
                {verdictUi.label}
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{result.reasonOneLineFree}</p>
              <p className="mt-1 text-xs text-slate-500">
                근거 강도: <span className="font-medium text-slate-700">{strengthLabel(result.evidenceStrength)}</span>
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={paidLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-ring disabled:opacity-50"
              >
                {paidLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                상세 보기(유료)
              </button>
            </div>
          </div>

          {result.cta.type && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <div className="font-semibold">권장: {result.cta.type}</div>
              {result.cta.message ? <div className="mt-1 text-xs">{result.cta.message}</div> : null}
            </div>
          )}

          {result.reasonsPaid && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-700">이유</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                {result.reasonsPaid.slice(0, 6).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {result.tipsPaid?.length ? (
                <>
                  <div className="mt-4 text-xs font-semibold text-slate-700">팁</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
                    {result.tipsPaid.slice(0, 6).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {candidateModal}
    </section>
  );
}

