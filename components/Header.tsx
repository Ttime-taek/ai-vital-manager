import { HeartPulse } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 pt-safe backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-page py-3 sm:py-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f766e_0%,#14b8a6_55%,#34d399_100%)] text-white shadow-soft ring-1 ring-white/60 sm:h-10 sm:w-10">
            <HeartPulse className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                AI 바이탈 매니저
              </h1>
              <span className="hidden shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-100 min-[400px]:inline-flex">
                복약 운영판
              </span>
            </div>
            <p className="hidden text-xs text-slate-500 min-[400px]:block">
              복약 리듬 · 음식 주의 · 상호작용을 한 화면에
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100 sm:flex">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          복약 중심 · 베타 v0.1
        </div>
        <div className="flex items-center gap-2 rounded-full bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700 ring-1 ring-brand-100 sm:hidden">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          베타
        </div>
      </div>
    </header>
  );
}
