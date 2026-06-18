"use client";

import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";

interface MedicationInputProps {
  onAdd: (query: string) => Promise<void>;
  loading: boolean;
}

const SUGGESTIONS = [
  "타이레놀",
  "이부프로펜",
  "아스피린",
  "와파린",
  "암로디핀",
  "심바스타틴",
  "메트포르민",
  "삭센다",
  "위고비",
  "마운자로",
  "오메프라졸",
  "레보티록신",
  "시프로플록사신",
];

export function MedicationInput({ onAdd, loading }: MedicationInputProps) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const v = value.trim();
    if (!v || loading) return;
    await onAdd(v);
    setValue("");
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">약물 추가</h2>
          <p className="text-xs text-slate-500">
            처방받은 약 이름을 입력하면 자동으로 분석합니다 (한/영 가능).
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="예: 타이레놀, ibuprofen, 와파린…"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            disabled={loading}
          />
        </div>
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {loading ? "분석 중" : "추가"}
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-slate-500">
          빠른 선택
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onAdd(s)}
              disabled={loading}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-ring disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
