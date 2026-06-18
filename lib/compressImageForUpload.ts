/** Client-side image resize before upload (keeps labels readable, reduces payload). */

const DEFAULT_MAX_DIM = 1600;
const DEFAULT_QUALITY = 0.88;

export async function compressImageForUpload(
  file: File,
  maxDim = DEFAULT_MAX_DIM,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 800_000 && !file.type.includes("heic")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

export function readFileAsPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
