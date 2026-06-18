import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey, hasGeminiConfigured, hasPlaceholderApiKeys } from "@/lib/aiEnv";
import {
  checkIpRateLimit,
  createIpMinuteLimiter,
  getClientIp,
} from "@/lib/serverRateLimit";
import { scanMedicationLabelWithGemini } from "@/lib/medicationScan";
import {
  clientStatusForUpstreamAi,
  getUpstreamErrorStatus,
  userMessageForScanFailure,
} from "@/lib/upstreamAiErrors";
import {
  SCAN_LIMITS,
  validateImageBuffer,
} from "@/lib/scanImageValidation";

export const runtime = "nodejs";
export const maxDuration = 60;

const isRateLimited = createIpMinuteLimiter(SCAN_LIMITS.requestsPerMinutePerIp);

async function readImageFromRequest(
  req: NextRequest,
): Promise<
  | { ok: true; buffer: Buffer; mimeType: string }
  | { ok: false; error: string; status: number }
> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return { ok: false, error: "폼 데이터를 읽을 수 없습니다.", status: 400 };
    }
    const entry = form.get("image");
    if (!entry || !(entry instanceof Blob)) {
      return { ok: false, error: "image 필드가 필요합니다.", status: 400 };
    }
    const mimeType = entry.type || "image/jpeg";
    const arrayBuffer = await entry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validated = validateImageBuffer(buffer, mimeType);
    if (!validated.ok) return { ok: false, error: validated.error, status: 400 };
    return { ok: true, buffer, mimeType: validated.mimeType };
  }

  if (contentType.includes("application/json")) {
    let body: { imageBase64?: string; mimeType?: string };
    try {
      body = (await req.json()) as { imageBase64?: string; mimeType?: string };
    } catch {
      return { ok: false, error: "Invalid JSON body", status: 400 };
    }
    const raw = (body.imageBase64 ?? "").trim();
    if (!raw) {
      return { ok: false, error: "imageBase64가 필요합니다.", status: 400 };
    }
    const base64 = raw.includes(",") ? raw.split(",").pop()! : raw;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      return { ok: false, error: "이미지 데이터 형식이 올바르지 않습니다.", status: 400 };
    }
    const validated = validateImageBuffer(buffer, body.mimeType ?? "image/jpeg");
    if (!validated.ok) return { ok: false, error: validated.error, status: 400 };
    return { ok: true, buffer, mimeType: validated.mimeType };
  }

  return {
    ok: false,
    error: "multipart/form-data 또는 JSON(imageBase64)로 요청해 주세요.",
    status: 415,
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkIpRateLimit(isRateLimited, ip);
  if (rl.limited) {
    return new NextResponse(
      JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfterSec),
        },
      },
    );
  }

  const imageResult = await readImageFromRequest(req);
  if (!imageResult.ok) {
    return NextResponse.json({ error: imageResult.error }, { status: imageResult.status });
  }

  if (!hasGeminiConfigured()) {
    let notice: string;
    if (hasPlaceholderApiKeys()) {
      notice =
        "GEMINI_API_KEY가 올바르지 않습니다. Vercel Environment Variables에 실제 키를 설정해 주세요.";
    } else {
      notice =
        "사진 스캔에는 GEMINI_API_KEY가 필요합니다. 텍스트로 약물명을 입력해 주세요.";
    }
    return NextResponse.json({ error: notice, products: [] }, { status: 503 });
  }

  const apiKey = getGeminiApiKey()!;

  try {
    const result = await scanMedicationLabelWithGemini({
      apiKey,
      imageBase64: imageResult.buffer.toString("base64"),
      mimeType: imageResult.mimeType,
    });

    return NextResponse.json({
      products: result.products,
      warnings: result.warnings,
    });
  } catch (err) {
    console.error("[scan] gemini vision error:", err);
    const upstreamStatus = getUpstreamErrorStatus(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: userMessageForScanFailure({ upstreamStatus, message }),
        products: [],
      },
      { status: clientStatusForUpstreamAi(upstreamStatus) },
    );
  }
}
