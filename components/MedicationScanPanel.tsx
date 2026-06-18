"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, ScanLine, X } from "lucide-react";
import { compressImageForUpload, readFileAsPreviewUrl } from "@/lib/compressImageForUpload";
import type { ScannedProduct } from "@/lib/medicationScanSchema";

interface MedicationScanPanelProps {
  onAdd: (query: string) => Promise<void>;
  loading: boolean;
}

interface ScanResponse {
  products?: ScannedProduct[];
  warnings?: string[];
  error?: string;
}

export function MedicationScanPanel({ onAdd, loading }: MedicationScanPanelProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [products, setProducts] = useState<ScannedProduct[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scanError, setScanError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const busy = loading || scanning || adding;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetScan = useCallback(() => {
    setProducts([]);
    setWarnings([]);
    setSelected(new Set());
    setScanError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }, [previewUrl]);

  const runScan = useCallback(async (file: File) => {
    setScanning(true);
    setScanError(null);
    setProducts([]);
    setWarnings([]);
    setSelected(new Set());

    try {
      const compressed = await compressImageForUpload(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(readFileAsPreviewUrl(compressed));

      const form = new FormData();
      form.append("image", compressed, compressed.name);

      const res = await fetch("/api/scan", { method: "POST", body: form });
      const data = (await res.json()) as ScanResponse;

      if (res.status === 429) {
        const retry = res.headers.get("Retry-After");
        setScanError(
          retry
            ? `요청이 너무 많습니다. ${retry}초 후 다시 시도해 주세요.`
            : "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      if (!res.ok) {
        setScanError(data.error ?? "라벨 스캔에 실패했습니다.");
        return;
      }

      const found = data.products ?? [];
      setProducts(found);
      setWarnings(data.warnings ?? []);
      if (found.length === 0) {
        setScanError(
          data.warnings?.[0] ??
            "라벨에서 약물명을 찾지 못했습니다. 더 가까이·밝게 찍거나 이름을 직접 입력해 주세요.",
        );
        return;
      }
      setSelected(new Set(found.map((_, i) => i)));
    } catch (err) {
      console.error(err);
      setScanError("네트워크 오류가 발생했습니다.");
    } finally {
      setScanning(false);
    }
  }, [previewUrl]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void runScan(file);
  };

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const addSelected = async () => {
    const names = products
      .filter((_, i) => selected.has(i))
      .map((p) => p.name.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    setAdding(true);
    try {
      for (const name of names) {
        await onAdd(name);
      }
      resetScan();
    } finally {
      setAdding(false);
    }
  };

  const confidenceLabel = (c: ScannedProduct["confidence"]) => {
    if (c === "high") return "높음";
    if (c === "medium") return "보통";
    return "낮음";
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-brand-600" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900">사진으로 추가</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        약병·영양제병 라벨을 촬영하거나 업로드하면 AI가 이름을 읽어 분석합니다.
      </p>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
        disabled={busy}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={onFileChange}
        disabled={busy}
      />

      {!previewUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-100 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {scanning ? "스캔 중…" : "카메라로 촬영"}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            사진 선택
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="업로드한 약병 라벨 미리보기"
              className="max-h-48 w-full object-contain"
            />
            {!scanning && (
              <button
                type="button"
                onClick={resetScan}
                disabled={busy}
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-white focus-ring"
                aria-label="사진 제거"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {scanning ? (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              라벨을 읽는 중…
            </p>
          ) : null}

          {scanError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-100">
              {scanError}
            </p>
          ) : null}

          {warnings.length > 0 && !scanError ? (
            <ul className="space-y-1 text-xs text-amber-800">
              {warnings.map((w) => (
                <li key={w} className="rounded-lg bg-amber-50 px-3 py-1.5 ring-1 ring-amber-100">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          {products.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">인식된 항목 — 추가할 것을 선택하세요</p>
              <ul className="space-y-2">
                {products.map((p, i) => (
                  <li key={`${p.name}-${i}`}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/50">
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                        disabled={busy}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{p.name}</span>
                        {p.genericName ? (
                          <span className="mt-0.5 block text-xs text-slate-500">{p.genericName}</span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {p.kind === "supplement" ? "영양제" : p.kind === "medication" ? "의약품" : "미확인"} ·
                          인식 {confidenceLabel(p.confidence)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void addSelected()}
                disabled={busy || selected.size === 0}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-700 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding || loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4" />
                )}
                {adding || loading ? "분석·추가 중…" : `선택 항목 분석·추가 (${selected.size})`}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
