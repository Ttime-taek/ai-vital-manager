import { z } from "zod";
import type { SupplementProfile } from "@/lib/supplementTypes";

const SeveritySchema = z.enum(["high", "medium", "low"]);

export const SupplementConflictSchema = z.object({
  target: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(200),
  severity: SeveritySchema.optional(),
  source: z.string().trim().min(1).max(200).optional(),
});

export const SupplementProfileSchema = z.object({
  supplement: z.string().trim().min(1).max(80),
  ingredients: z.record(z.string().trim().min(1).max(60), z.number().finite().nonnegative()),
  conflicts: z.array(SupplementConflictSchema).default([]),
});

export function validateSupplementProfile(raw: unknown): SupplementProfile {
  const parsed = SupplementProfileSchema.parse(raw);
  return parsed as SupplementProfile;
}

