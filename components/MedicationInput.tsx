"use client";

import { useState } from "react";
import { Loader2, Plus, RotateCcw, Search } from "lucide-react";

interface MedicationInputProps {
  onAdd: (query: string) => Promise<void>;
  loading: boolean;
  onReset?: () => void;
  canReset?: boolean;
}

const SUGGESTIONS = [
  "타이레놀",
  "메트포르민",
  "삭센다",
  "위고비",
  "마운자로",
  "와파린",
  "오메프라졸",
  "오메가3",
  "비타민 D",
];

export function MedicationInput({
  onAdd,
  loading,
  onReset,
  canReset = false,
}: MedicationInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const v = value.trim();
    if (!v || loading) return;
    await onAdd(v);
    setValue("");
  };

  return (
    <section className="rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-slate-200/70">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">약물·영양제 추가</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            처방약·영양제 이름을 검색해 등록합니다 (한/영).
          </p>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            disabled={loading || !canReset}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            초기화
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="약·영양제 이름 (예: 위고비, vitamin d)"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            disabled={loading}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={loading || !value.trim()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {loading ? "분석 중" : "추가"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAdd(s)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-ring disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
