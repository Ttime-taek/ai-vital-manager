"use client";

import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { MedicationInput } from "@/components/MedicationInput";
import { MedicationCard } from "@/components/MedicationCard";
import { ScheduleTimeline } from "@/components/ScheduleTimeline";
import { WarningPanel } from "@/components/WarningPanel";
import { StatsBar } from "@/components/StatsBar";
import { EmptyState } from "@/components/EmptyState";
import { buildSchedule, getSlotsForFrequency } from "@/lib/scheduleEngine";
import type { MedicationEntry, MedicationInfo } from "@/lib/types";

interface AnalyzeResponse {
  info: MedicationInfo;
  source: "database" | "ai" | "fallback";
  notice?: string;
  error?: string;
}

export default function HomePage() {
  const [meds, setMeds] = useState<MedicationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);

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
          showToast(data.notice, "info");
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
    return {
      medCount: meds.length,
      doseCount,
      warningCount,
    };
  }, [meds]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <Header />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MedicationInput onAdd={handleAdd} loading={loading} />
          </div>
          <div className="lg:col-span-1">
            <StatsBar
              medCount={stats.medCount}
              doseCount={stats.doseCount}
              warningCount={stats.warningCount}
            />
          </div>
        </div>

        <ScheduleTimeline slots={schedule} />

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

        <footer className="pt-6 text-center text-xs text-slate-400">
          AI 바이탈 매니저 · 본 서비스의 정보는 의료 진단을 대체하지 않습니다.
        </footer>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up">
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
