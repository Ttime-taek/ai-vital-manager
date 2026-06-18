/** Reject common mis-entries like "Gemini" / "CEREBRAS" in Vercel env vars. */
export function looksLikePlaceholderApiKey(value: string): boolean {
  return /^(gemini(\s*api\s*키?)?|cerebras|auto)$/i.test(value.trim());
}

export function getGeminiApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || looksLikePlaceholderApiKey(key)) return undefined;
  return key;
}

export function getCerebrasApiKey(): string | undefined {
  const key = process.env.CEREBRAS_API_KEY?.trim();
  if (!key || looksLikePlaceholderApiKey(key)) return undefined;
  return key;
}

export function hasGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function hasCerebrasConfigured(): boolean {
  return Boolean(getCerebrasApiKey());
}

export function hasPlaceholderApiKeys(): boolean {
  const g = process.env.GEMINI_API_KEY?.trim();
  const c = process.env.CEREBRAS_API_KEY?.trim();
  return Boolean(
    (g && looksLikePlaceholderApiKey(g)) || (c && looksLikePlaceholderApiKey(c)),
  );
}
