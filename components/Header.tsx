import { HeartPulse } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 pt-safe backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-page py-3 sm:py-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft sm:h-10 sm:w-10">
            <HeartPulse className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              AI 바이탈 매니저
            </h1>
            <p className="hidden text-xs text-slate-500 min-[400px]:block">
              스마트 복약 스케줄 · 음식 상호작용 분석
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100 sm:flex">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          베타 v0.1
        </div>
        <div className="flex items-center gap-2 rounded-full bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700 ring-1 ring-brand-100 sm:hidden">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          베타
        </div>
      </div>
    </header>
  );
}
