"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Shield } from "lucide-react";
import { AiStatusBanner } from "@/components/AiStatusBanner";
import { Header } from "@/components/Header";
import { MedicationInput } from "@/components/MedicationInput";
import { MedicationCard } from "@/components/MedicationCard";
import { ScheduleTimeline } from "@/components/ScheduleTimeline";
import { WarningPanel } from "@/components/WarningPanel";
import { StatsBar } from "@/components/StatsBar";
import { EmptyState } from "@/components/EmptyState";
import { DrugInteractionChecker, type DrugInteractionCheckerHandle } from "@/components/DrugInteractionChecker";
import { SafetyChecker } from "@/components/SafetyChecker";
import { buildSchedule, getSlotsForFrequency } from "@/lib/scheduleEngine";
import type { InteractionTier } from "@/lib/interactionTypes";
import type { MedicationEntry, MedicationInfo } from "@/lib/types";

interface AnalyzeResponse {
  info: MedicationInfo;
  source: "database" | "database_enriched" | "ai" | "ai_web" | "fallback" | "uncertain";
  notice?: string;
  error?: string;
}

export default function HomePage() {
  const [meds, setMeds] = useState<MedicationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [interactionTier, setInteractionTier] = useState<InteractionTier | null>(null);
  const [interactionLabelKo, setInteractionLabelKo] = useState<string | undefined>();
  const [interactionLoading, setInteractionLoading] = useState(false);
  const interactionRef = useRef<DrugInteractionCheckerHandle>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

  useEffect(() => {
    window.localStorage.removeItem("vp:meds:v1");
    setMeds([]);
  }, []);

  const showToast = (
    message: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      const duplicate = meds.find(
        (m) =>
          m.info.name === trimmed ||
          m.info.aliases.some(
            (a) => a.toLowerCase() === trimmed.toLowerCase(),
          ),
      );
      if (duplicate) {
        showToast(`이미 등록된 약물입니다: ${duplicate.info.name}`, "info");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const data = (await res.json()) as AnalyzeResponse;

        if (res.status === 429) {
          const retry = res.headers.get("Retry-After");
          showToast(
            retry
              ? `요청이 너무 많습니다. ${retry}초 후 다시 시도해 주세요.`
              : "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            "error",
          );
          return;
        }

        if (!res.ok || data.error) {
          showToast(data.error ?? "분석에 실패했습니다.", "error");
          return;
        }

        const entry: MedicationEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          info: data.info,
          source: data.source,
          addedAt: Date.now(),
        };
        setMeds((prev) => [entry, ...prev]);

        if (data.notice) {
          setAiNotice(data.notice);
          showToast(data.notice, "info");
        } else if (data.source === "uncertain" || data.source === "fallback") {
          showToast(
            `${data.info.name}을(를) 추가했습니다. 약사·의사 확인을 권장합니다.`,
            "info",
          );
        } else if (data.source === "ai" || data.source === "ai_web") {
          showToast(
            data.source === "ai_web"
              ? `웹 검색·AI로 ${data.info.name} 정보를 분석해 추가했습니다.`
              : `AI가 분석한 정보로 ${data.info.name}을(를) 추가했습니다.`,
            "success",
          );
        } else if (data.source === "database_enriched") {
          showToast(
            `${data.info.name}: 웹·AI로 DB 정보를 보강해 추가했습니다.`,
            "success",
          );
        } else {
          showToast(`${data.info.name}을(를) 추가했습니다.`, "success");
        }
      } catch (err) {
        console.error(err);
        showToast("네트워크 오류가 발생했습니다.", "error");
      } finally {
        setLoading(false);
      }
    },
    [meds],
  );

  const handleRemove = useCallback((id: string) => {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleReset = useCallback(() => {
    if (meds.length === 0) return;
    const ok = window.confirm("등록된 약물을 모두 초기화할까요?");
    if (!ok) return;
    setMeds([]);
    setInteractionTier(null);
    setInteractionLabelKo(undefined);
    setAiNotice(null);
    showToast("초기화되었습니다.", "success");
  }, [meds.length]);

  const handleInteractionNotice = useCallback((message: string | null) => {
    if (message) setAiNotice(message);
  }, []);

  const handleInteractionResult = useCallback(
    (tier: InteractionTier | null, labelKo?: string) => {
      setInteractionTier(tier);
      setInteractionLabelKo(labelKo);
    },
    [],
  );

  const schedule = useMemo(() => buildSchedule(meds), [meds]);

  const stats = useMemo(() => {
    const doseCount = meds.reduce((sum, m) => {
      const freq = m.customFrequency ?? m.info.defaultFrequency;
      return sum + getSlotsForFrequency(freq).length;
    }, 0);
    const warningCount = new Set(
      meds.flatMap((m) =>
        m.info.avoidFoods.map((f) => f.food.trim().toLowerCase()),
      ),
    ).size;
    const recommendCount = new Set(
      meds.flatMap((m) =>
        (m.info.recommendedFoods ?? []).map((f) => f.food.trim().toLowerCase()),
      ),
    ).size;
    return {
      medCount: meds.length,
      doseCount,
      warningCount,
      recommendCount,
    };
  }, [meds]);

  const showMobileSticky = meds.length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <Header />

      <main
        className={`mx-auto max-w-6xl space-y-5 px-page py-5 sm:space-y-6 sm:py-8 ${
          showMobileSticky
            ? "pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8"
            : "pb-safe"
        }`}
      >
        <AiStatusBanner message={aiNotice} onDismiss={() => setAiNotice(null)} />

        <section className="overflow-hidden rounded-[28px] border border-brand-100 bg-white/85 p-section shadow-soft ring-1 ring-brand-50">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">
                복약 운영판
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                약을 넣는 순간 일정, 주의 음식, 함께 먹는 습관이 같이 정리됩니다.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                복잡한 약 이름보다 하루의 흐름이 먼저 보이도록 만든 건강 관리 화면입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["복용 시간", "음식 주의", "상호작용", "한글 검색"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-3">
              <MedicationInput
                onAdd={handleAdd}
                loading={loading}
                onReset={handleReset}
                canReset={meds.length > 0}
              />
              <DrugInteractionChecker
                ref={interactionRef}
                medications={meds}
                onNotice={handleInteractionNotice}
                onResultChange={handleInteractionResult}
                onLoadingChange={setInteractionLoading}
              />
            </div>
          </div>
          <div className="lg:col-span-1">
            <StatsBar
              medCount={stats.medCount}
              doseCount={stats.doseCount}
              warningCount={stats.warningCount}
              recommendCount={stats.recommendCount}
              interactionTier={interactionTier}
              interactionLabelKo={interactionLabelKo}
            />
          </div>
        </div>

        <ScheduleTimeline
          slots={schedule}
          interactionTier={interactionTier}
          interactionLabelKo={interactionLabelKo}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <h2 className="scroll-mt-20 px-1 text-base font-semibold text-slate-900">
              등록된 약물 ({meds.length})
            </h2>
            {meds.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {meds.map((entry) => (
                  <MedicationCard
                    key={entry.id}
                    entry={entry}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <WarningPanel meds={meds} />
          </div>
        </div>

        <section className="rounded-2xl bg-white p-section shadow-card ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">30초 안전 판정 (선택)</h2>
              <p className="mt-1 text-xs text-slate-500">
                필요할 때만 열어서 빠르게 안전 체크를 진행하세요. 예: 와파린, 오메가3
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSafety((v) => !v)}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-card transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-ring sm:w-auto sm:text-xs"
              aria-expanded={showSafety}
            >
              {showSafety ? (
                <>
                  접기 <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  열기 <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {showSafety ? (
            <div className="mt-4">
              <SafetyChecker embedded />
            </div>
          ) : null}
        </section>

        <footer className="pt-6 text-center text-xs text-slate-500 sm:text-sm">
          AI 바이탈 매니저 · 본 서비스의 정보는 의료 진단을 대체하지 않습니다.
        </footer>
      </main>

      {showMobileSticky ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 shadow-soft backdrop-blur pb-safe md:hidden">
          <button
            type="button"
            disabled={interactionLoading}
            onClick={() => interactionRef.current?.scrollIntoView()}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {interactionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            상호작용 결과 ({meds.length}개)
          </button>
        </div>
      ) : null}

      {toast && (
        <div
          className={`fixed left-1/2 z-50 w-[min(100%,calc(100vw-2rem))] max-w-md -translate-x-1/2 animate-fade-in-up ${
            showMobileSticky
              ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
              : "bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
          }`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium shadow-soft ring-1 ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : toast.type === "error"
                  ? "bg-rose-50 text-rose-800 ring-rose-200"
                  : "bg-slate-900 text-white ring-slate-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
