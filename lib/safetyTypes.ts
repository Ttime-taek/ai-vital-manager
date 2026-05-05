export type Persona = "B" | "D";

export type YesNoUnknown = "yes" | "no" | "unknown";

export type ItemKind = "drug" | "supplement" | "unknown";

export type SafetyVerdict = "ban" | "caution" | "ok" | "insufficient_info";

export type EvidenceStrength = "high" | "medium" | "low";

export interface SafetyContext {
  persona: Persona;
  pregnantOrLactating: YesNoUnknown;
  hasPrescriptionMeds: YesNoUnknown;
}

export interface SafetyItemInput {
  rawName: string;
  kind: ItemKind;
}

export interface NormalizedCandidate {
  id: string;
  name: string;
  kind: ItemKind;
  confidence: number; // 0..1
}

export interface NormalizationResult {
  rawName: string;
  candidates: NormalizedCandidate[];
  selected?: NormalizedCandidate;
}

export interface SafetyCta {
  type: "consult_pharmacist" | "consult_doctor" | "emergency" | null;
  message?: string;
}

export interface SafetyResult {
  normalized: NormalizationResult[];
  verdict: SafetyVerdict;
  reasonOneLineFree: string;
  evidenceStrength: EvidenceStrength;
  reasonsPaid?: string[];
  tipsPaid?: string[];
  cta: SafetyCta;
}

