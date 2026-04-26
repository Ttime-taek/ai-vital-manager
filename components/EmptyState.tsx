import { Pill } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700">
        <Pill className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        아직 등록된 약물이 없어요
      </h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        위쪽 검색창에 처방받은 약 이름을 입력하시면, 복약 스케줄과 음식 상호작용을
        자동으로 분석해 드립니다.
      </p>
    </div>
  );
}
