import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { checkSupplementStacking } from "@/lib/checkSupplementStacking";
import { resolveOpenFoodFactsByBarcode } from "@/lib/openFoodFactsProduct";
import { validateSupplementProfile } from "@/lib/supplementSchema";
import { createIpMinuteLimiter, getClientIp } from "@/lib/serverRateLimit";
import {
  resolveUsdaFdcByFdcId,
  resolveUsdaFdcByQuery,
} from "@/lib/usdaFdcProduct";

export const runtime = "nodejs";

const LIMITS = {
  queryMaxLen: 120,
  barcodeMaxLen: 32,
  profilesMax: 12,
  requestsPerMinutePerIp: 25,
};

type Body = {
  mode?: "usda_search" | "usda_fdc_id" | "off_barcode";
  query?: string;
  fdcId?: string | number;
  barcode?: string;
  /** Optional: already-known profiles to stack-check together */
  profiles?: unknown[];
};

const isRateLimited = createIpMinuteLimiter(LIMITS.requestsPerMinutePerIp);

function parseExtraProfiles(raw?: unknown[]) {
  if (!raw || raw.length === 0) return [];
  if (raw.length > LIMITS.profilesMax) {
    throw new Error(`profiles는 최대 ${LIMITS.profilesMax}개까지 보낼 수 있습니다.`);
  }
  try {
    return raw.map((p) => validateSupplementProfile(p));
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error("profiles 형식이 올바르지 않습니다.");
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = isRateLimited(ip);
  if (rl.limited) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const mode = body.mode ?? "usda_search";
  try {
    const extra = parseExtraProfiles(body.profiles);

    if (mode === "off_barcode") {
      const barcode = String(body.barcode ?? "").trim();
      if (!barcode) return NextResponse.json({ error: "barcode를 입력해주세요." }, { status: 400 });
      if (barcode.length > LIMITS.barcodeMaxLen) {
        return NextResponse.json({ error: `barcode는 ${LIMITS.barcodeMaxLen}자 이내로 입력해주세요.` }, { status: 400 });
      }

      const resolved = await resolveOpenFoodFactsByBarcode(barcode);
      const report = checkSupplementStacking([...extra, resolved.profile]);

      return NextResponse.json({
        resolved,
        stacking: report,
        disclaimer:
          "이 결과는 공개 DB의 라벨/영양 DB를 자동 매핑한 참고용 정보이며 의학적 조언이 아닙니다. 복용/치료 결정은 전문가와 상담하세요.",
      });
    }

    if (mode === "usda_fdc_id") {
      if (body.fdcId === undefined || body.fdcId === null || String(body.fdcId).trim() === "") {
        return NextResponse.json({ error: "fdcId를 입력해주세요." }, { status: 400 });
      }
      const resolved = await resolveUsdaFdcByFdcId(body.fdcId);
      const report = checkSupplementStacking([...extra, resolved.profile]);
      return NextResponse.json({
        resolved,
        stacking: report,
        disclaimer:
          "이 결과는 USDA FoodData Central의 영양소 항목을 자동 매핑한 참고용 정보이며 의학적 조언이 아닙니다. 복용/치료 결정은 전문가와 상담하세요.",
      });
    }

    // usda_search (default)
    const query = String(body.query ?? "").trim();
    if (!query) return NextResponse.json({ error: "검색어(query)를 입력해주세요." }, { status: 400 });
    if (query.length > LIMITS.queryMaxLen) {
      return NextResponse.json({ error: `검색어는 ${LIMITS.queryMaxLen}자 이내로 입력해주세요.` }, { status: 400 });
    }

    const resolved = await resolveUsdaFdcByQuery(query);
    const report = checkSupplementStacking([...extra, resolved.profile]);

    return NextResponse.json({
      resolved,
      stacking: report,
      disclaimer:
        "이 결과는 USDA FoodData Central의 영양소 항목을 자동 매핑한 참고용 정보이며 의학적 조언이 아닙니다. 복용/치료 결정은 전문가와 상담하세요.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
