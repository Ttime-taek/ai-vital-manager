type ListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

let _cachedModel: { model: string; expiresAtMs: number } | null = null;
let _inFlight: Promise<string> | null = null;

function nowMs() {
  return Date.now();
}

function normalizeModelName(model: string) {
  // Accept either "gemini-*" or "models/gemini-*"
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

export async function resolveGeminiModel(opts: {
  apiKey: string;
  preferred: string;
  timeoutMs?: number;
}): Promise<string> {
  const preferred = normalizeModelName(opts.preferred);
  const timeoutMs = opts.timeoutMs ?? 4000;

  if (_cachedModel && _cachedModel.expiresAtMs > nowMs()) return _cachedModel.model;
  if (_inFlight) return _inFlight;

  _inFlight = (async () => {
    // Known common model IDs. We still prefer listModels to avoid hardcoding.
    const candidates = Array.from(
      new Set([
        preferred,
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
      ]),
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${opts.apiKey}`,
        { signal: controller.signal },
      );
      if (!r.ok) {
        // If listModels fails, fall back to the preferred model.
        return preferred;
      }

      const data = (await r.json()) as ListModelsResponse;
      const available = (data.models ?? [])
        .map((m) => ({
          name: m.name?.startsWith("models/") ? m.name.slice("models/".length) : m.name,
          methods: m.supportedGenerationMethods ?? [],
        }))
        .filter((m) => Boolean(m.name) && m.methods.includes("generateContent"))
        .map((m) => m.name!) as string[];

      const chosen =
        candidates.find((c) => available.includes(c)) ??
        available.find((m) => m.includes("flash")) ??
        available[0] ??
        preferred;

      // Cache for 15 minutes to avoid spamming listModels.
      _cachedModel = { model: chosen, expiresAtMs: nowMs() + 15 * 60 * 1000 };
      return chosen;
    } catch {
      return preferred;
    } finally {
      clearTimeout(timer);
      _inFlight = null;
    }
  })();

  return _inFlight;
}

