import { resolveGeminiModel } from "@/lib/geminiModel";
import { getGeminiModelPreference } from "@/lib/aiModels";
import {
  buildMedicationScanUserPrompt,
  MEDICATION_SCAN_SYSTEM_PROMPT,
} from "@/lib/medicationScanPrompts";
import {
  coerceScanResultFromUnknown,
  type ScanResult,
} from "@/lib/medicationScanSchema";

const SCAN_TIMEOUT_MS = 25_000;

export async function scanMedicationLabelWithGemini(opts: {
  apiKey: string;
  imageBase64: string;
  mimeType: string;
}): Promise<ScanResult> {
  const preferred = getGeminiModelPreference();
  const model = await resolveGeminiModel({
    apiKey: opts.apiKey,
    preferred,
    timeoutMs: 5000,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: MEDICATION_SCAN_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: buildMedicationScanUserPrompt() },
            {
              inline_data: {
                mime_type: opts.mimeType,
                data: opts.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });
  clearTimeout(timer);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const err = new Error(`Gemini vision ${response.status}: ${bodyText}`);
    (err as Error & { status?: number }).status = response.status;
    throw err;
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini vision empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini vision returned invalid JSON");
  }

  return coerceScanResultFromUnknown(parsed);
}
