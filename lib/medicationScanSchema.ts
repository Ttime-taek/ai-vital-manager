import { z } from "zod";

export const scannedProductSchema = z.object({
  name: z.string().min(1).max(80),
  genericName: z.string().max(80).optional(),
  kind: z.enum(["medication", "supplement", "unknown"]),
  confidence: z.enum(["high", "medium", "low"]),
  visibleText: z.string().max(200).optional(),
});

export const scanResultSchema = z.object({
  products: z.array(scannedProductSchema).max(5),
  warnings: z.array(z.string().max(200)).max(3).optional(),
});

export type ScannedProduct = z.infer<typeof scannedProductSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;

export function coerceScanResultFromUnknown(
  input: unknown,
): ScanResult {
  const parsed = scanResultSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  if (input && typeof input === "object" && "products" in input) {
    const raw = (input as { products: unknown }).products;
    if (Array.isArray(raw)) {
      const products = raw
        .map((p) => scannedProductSchema.safeParse(p))
        .filter((r) => r.success)
        .map((r) => r.data!)
        .slice(0, 5);
      if (products.length > 0) return { products };
    }
  }

  return { products: [], warnings: ["라벨에서 약물명을 찾지 못했습니다."] };
}
