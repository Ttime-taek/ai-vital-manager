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
import { loadStoredMeds, saveStoredMeds } from "@/lib/medsStorage";
import type { InteractionTier } from "@/lib/interactionTypes";
import type { MedicationEntry, MedicationInfo } from "@/lib/types";

interface AnalyzeResponse {
  info: MedicationInfo;
  source: "database" | "ai" | "fallback" | "uncertain";
  notice?: string;
  error?: string;
}

export default function HomePage() {
  const [meds, setMeds] = useState<MedicationEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
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
    setMeds(loadStoredMeds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveStoredMeds(meds);
  }, [meds, hydrated]);

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
        } else if (data.source === "ai") {
          showToast(`AI가 분석한 정보로 ${data.info.name}을(를) 추가했습니다.`, "success");
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
        className={`mx-auto max-w-6xl space-y-6 px-6 py-8 ${showMobileSticky ? "pb-28 md:pb-8" : ""}`}
      >
        <AiStatusBanner message={aiNotice} onDismiss={() => setAiNotice(null)} />

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
            <h2 className="px-1 text-base font-semibold text-slate-900">
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

        <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">30초 안전 판정 (선택)</h2>
              <p className="mt-1 text-xs text-slate-500">
                필요할 때만 열어서 빠르게 안전 체크를 진행하세요. 예: 와파린, 오메가3
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSafety((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-card transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 focus-ring"
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

        <footer className="pt-6 text-center text-xs text-slate-400">
          AI 바이탈 매니저 · 본 서비스의 정보는 의료 진단을 대체하지 않습니다.
        </footer>
      </main>

      {showMobileSticky ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-soft backdrop-blur md:hidden">
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
          className={`fixed left-1/2 z-50 -translate-x-1/2 animate-fade-in-up ${
            showMobileSticky ? "bottom-24 md:bottom-6" : "bottom-6"
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
