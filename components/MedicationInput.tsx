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
            복용 중인 약·영양제를 여러 개 차례로 추가할 수 있습니다 (한/영).
            {canReset
              ? " 아래 검색창에 이름을 입력해 계속 등록하세요."
              : " 하나 추가한 뒤에도 같은 방법으로 계속 추가하세요."}
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
            placeholder="약·영양제 이름 입력 후 추가 (여러 개 가능)"
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

      <p className="mt-2.5 rounded-lg border border-brand-100 bg-brand-50/80 px-3 py-2 text-[11px] leading-relaxed text-brand-900">
        <span className="font-semibold">Tip</span> 추가 버튼이나 Enter로 등록한 뒤, 검색창이
        비워지면 다음 약을 이어서 추가할 수 있습니다. 2개 이상이면 상호작용도 자동으로
        확인합니다.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="w-full text-[10px] font-medium uppercase tracking-wide text-slate-400">
          빠른 추가
        </span>
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
