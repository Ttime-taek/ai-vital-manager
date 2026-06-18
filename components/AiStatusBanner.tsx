"use client";

import { AlertTriangle, X } from "lucide-react";

interface Props {
  message: string | null;
  onDismiss: () => void;
}

export function AiStatusBanner({ message, onDismiss }: Props) {
  if (!message) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="touch-target shrink-0 rounded-lg text-amber-700 transition hover:bg-amber-100 focus-ring"
        aria-label="알림 닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
