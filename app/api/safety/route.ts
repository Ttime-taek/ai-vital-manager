import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findMedication } from "@/lib/medications";
import { SAFETY_RULES_V0, combineMatches } from "@/lib/safetyRules";
import type {
  EvidenceStrength,
  ItemKind,
  NormalizedCandidate,
  Persona,
  SafetyContext,
  SafetyItemInput,
  SafetyResult,
  SafetyVerdict,
  YesNoUnknown,
} from "@/lib/safetyTypes";

export const runtime = "nodejs";

const LIMITS = {
  itemsMax: 8,
  nameMaxLen: 80,
  candidatesMax: 3,
  timeoutMs: 5_000,
};

const YesNoUnknownSchema = z.enum(["yes", "no", "unknown"]);
const PersonaSchema = z.enum(["B", "D"]);
const ItemKindSchema = z.enum(["drug", "supplement", "unknown"]);

const SafetyBodySchema = z.object({
  context: z.object({
    persona: PersonaSchema,
    pregnantOrLactating: YesNoUnknownSchema,
    hasPrescriptionMeds: YesNoUnknownSchema,
  }),
  items: z
    .array(
      z.object({
        rawName: z.string().trim().min(1).max(LIMITS.nameMaxLen),
        kind: ItemKindSchema,
      }),
    )
    .min(1)
    .max(LIMITS.itemsMax),
  selected: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        name: z.string(),
        kind: ItemKindSchema,
      }),
    )
    .optional(),
  paid: z.boolean().optional(),
});

function safeId(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function localCandidates(rawName: string, kind: ItemKind): NormalizedCandidate[] {
  const med = findMedication(rawName);
  if (!med) return [];
  return [
    {
      id: `med:${safeId(med.name)}`,
      name: med.name,
      kind: kind === "unknown" ? "drug" : kind,
      confidence: 0.85,
    },
  ];
}

function finalizeItems(
  original: Array<{ rawName: string; kind: ItemKind }>,
  selected: Record<string, { id: string; name: string; kind: ItemKind }> | undefined,
): SafetyItemInput[] {
  return original.map((it) => {
    const chosen = selected?.[it.rawName];
    if (chosen?.name) return { rawName: chosen.name, kind: chosen.kind };
    return { rawName: it.rawName, kind: it.kind };
  });
}

function computeVerdict(matches: ReturnType<typeof combineMatches>): {
  verdict: SafetyVerdict;
  evidenceStrength: EvidenceStrength;
  reasonOneLineFree: string;
} {
  return {
    verdict: matches.verdict,
    evidenceStrength: matches.strength,
    reasonOneLineFree: matches.reasonOneLineFree,
  };
}

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMITS.timeoutMs);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = SafetyBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const context: SafetyContext = {
      persona: parsed.data.context.persona as Persona,
      pregnantOrLactating: parsed.data.context.pregnantOrLactating as YesNoUnknown,
      hasPrescriptionMeds: parsed.data.context.hasPrescriptionMeds as YesNoUnknown,
    };

    const items = parsed.data.items.map((i) => ({
      rawName: i.rawName,
      kind: i.kind as ItemKind,
    }));

    // 1) Normalization candidates (local DB only for now)
    const normalized = items.map((it) => {
      const candidates = localCandidates(it.rawName, it.kind).slice(0, LIMITS.candidatesMax);
      const picked = parsed.data.selected?.[it.rawName];
      const selected: NormalizedCandidate | undefined = picked
        ? {
            ...picked,
            confidence: candidates.find((c) => c.id === picked.id)?.confidence ?? 0.75,
          }
        : undefined;
      return {
        rawName: it.rawName,
        candidates,
        selected,
      };
    });

    // 2) Rule engine runs on selected names if present.
    const finalItems = finalizeItems(items, parsed.data.selected);
    const matches = SAFETY_RULES_V0.filter((r) => r.applies(context, finalItems)).map((r) => r.match);
    const combined = combineMatches(matches);
    const core = computeVerdict(combined);

    const paid = Boolean(parsed.data.paid);

    const result: SafetyResult = {
      normalized,
      verdict: core.verdict,
      reasonOneLineFree: core.reasonOneLineFree,
      evidenceStrength: core.evidenceStrength,
      cta: combined.cta,
      ...(paid ? { reasonsPaid: combined.reasonsPaid, tipsPaid: combined.tipsPaid } : {}),
    };

    return NextResponse.json(result);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const result: SafetyResult = {
      normalized: [],
      verdict: "insufficient_info",
      reasonOneLineFree: aborted
        ? "처리가 지연되어 안전 여부를 판단할 수 없습니다."
        : "오류로 인해 안전 여부를 판단할 수 없습니다.",
      evidenceStrength: "low",
      cta: { type: "consult_pharmacist", message: "약사와 상담해 확인하세요." },
    };
    return NextResponse.json(result, { status: 200 });
  } finally {
    clearTimeout(timer);
    controller.abort(); // ensure no hanging work
  }
}

