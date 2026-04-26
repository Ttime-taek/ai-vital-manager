import { HeartPulse } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              AI 바이탈 매니저
            </h1>
            <p className="text-xs text-slate-500">
              스마트 복약 스케줄 · 음식 상호작용 분석
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100 sm:flex">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          베타 v0.1
        </div>
      </div>
    </header>
  );
}
