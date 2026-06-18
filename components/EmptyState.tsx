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
        위쪽 검색창에 약·영양제 이름을 입력하고 <strong className="font-semibold text-slate-700">추가</strong>
        를 누르세요. 복용 중인 약을 <strong className="font-semibold text-slate-700">여러 개</strong>{" "}
        등록하면 복약 스케줄·음식 상호작용·약물 간 상호작용을 한 번에 확인할 수 있습니다.
      </p>
    </div>
  );
}
