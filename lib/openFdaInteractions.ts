import type { InteractionCheckResult, InteractionRuleHit, InteractionTier } from "@/lib/interactionTypes";
import { findMedication } from "@/lib/medications";

type RxNavApproximateResponse = {
  approximateGroup?: {
    candidate?: Array<{
      rxcui?: string;
      score?: string;
      rank?: string;
      name?: string;
      source?: string;
    }>;
  };
};

type OpenFdaLabelResponse = {
  results?: Array<{
    effective_time?: string;
    drug_interactions?: string[];
    contraindications?: string[];
    warnings?: string[];
    boxed_warning?: string[];
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      rxcui?: string[];
      spl_set_id?: string[];
    };
  }>;
};

const MIN_RXNAV_SCORE = 8;

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasLatinLetters(s: string) {
  return /[a-z]/i.test(s);
}

function uniqNonEmpty(items: Array<string | undefined | null>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const v = (it ?? "").trim();
    if (!v) continue;
    const k = normalize(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function tierWorse(a: InteractionTier, b: InteractionTier): InteractionTier {
  const rank: Record<InteractionTier, number> = { very_safe: 0, caution: 1, contraindicated: 2 };
  return rank[a] >= rank[b] ? a : b;
}

async function resolveRxcuiApprox(term: string): Promise<{ rxcui: string; name?: string } | null> {
  const url = new URL("https://rxnav.nlm.nih.gov/REST/Prescribe/approximateTerm.json");
  url.searchParams.set("term", term);
  url.searchParams.set("maxEntries", "8");
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json()) as RxNavApproximateResponse;
  const cands = data.approximateGroup?.candidate ?? [];
  const top = cands[0];
  const rxcui = top?.rxcui;
  const score = Number(top?.score ?? "0");
  if (!rxcui || !Number.isFinite(score) || score < MIN_RXNAV_SCORE) return null;
  return { rxcui, name: top?.name };
}

function getRxNormSearchTerms(input: string) {
  const raw = input.trim();
  const med = findMedication(raw);
  const terms: string[] = [];

  const push = (value?: string | null) => {
    const term = (value ?? "").trim();
    if (!term || !hasLatinLetters(term) || terms.includes(term)) return;
    terms.push(term);
  };

  if (med) {
    for (const alias of med.aliases) push(alias);
  }
  push(raw);

  return terms;
}

async function resolveRxcuiApproxForInput(input: string): Promise<{ rxcui: string; name?: string } | null> {
  const searchTerms = getRxNormSearchTerms(input);
  for (const term of searchTerms) {
    const resolved = await resolveRxcuiApprox(term);
    if (resolved) return resolved;
  }
  return null;
}

async function fetchLatestLabelByRxcui(rxcui: string) {
  const url = new URL("https://api.fda.gov/drug/label.json");
  url.searchParams.set("search", `openfda.rxcui:${rxcui}`);
  url.searchParams.set("sort", "effective_time:desc");
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) return null;
  const data = (await res.json()) as OpenFdaLabelResponse;
  return data.results?.[0] ?? null;
}

function extractTextBlocks(label: NonNullable<Awaited<ReturnType<typeof fetchLatestLabelByRxcui>>>) {
  const blocks: Array<{ section: string; text: string }> = [];
  const push = (section: string, arr?: string[]) => {
    for (const t of arr ?? []) {
      const v = t?.trim();
      if (v) blocks.push({ section, text: v });
    }
  };
  push("contraindications", label.contraindications);
  push("boxed_warning", label.boxed_warning);
  push("warnings", label.warnings);
  push("drug_interactions", label.drug_interactions);
  return blocks;
}

function hasNeedle(textNorm: string, needle: string) {
  const n = normalize(needle);
  if (n.length < 3) return false;
  // ASCII-ish words: prefer word boundary to reduce false positives
  if (/^[a-z0-9][a-z0-9 .\-+/()]*$/i.test(needle)) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    return re.test(textNorm);
  }
  return textNorm.includes(n);
}

function classifyPairFromBlocks(
  aBlocks: Array<{ section: string; text: string }>,
  bNeedles: string[],
): InteractionTier {
  const needles = uniqNonEmpty(bNeedles);
  let foundMention = false;
  let contra = false;

  for (const b of aBlocks) {
    const text = normalize(b.text);
    const matched = needles.some((n) => hasNeedle(text, n));
    if (!matched) continue;
    foundMention = true;
    if (b.section === "contraindications") contra = true;
    if (text.includes("contraindicat")) contra = true;
    if (text.includes("do not") && text.includes("use")) contra = true;
    if (text.includes("avoid")) return "caution";
  }

  if (contra) return "contraindicated";
  if (foundMention) return "caution";
  return "very_safe";
}

export async function checkInteractionsWithOpenFda(drugNames: string[]): Promise<InteractionCheckResult> {
  const unique = Array.from(new Set(drugNames.map((d) => d.trim()).filter(Boolean)));
  if (unique.length < 2) {
    return {
      resolvedDrugs: [],
      unresolvedInputs: [],
      tier: "very_safe",
      hits: [],
      oneLineKo: "상호작용을 확인하려면 약물을 2개 이상 선택하세요.",
    };
  }

  const resolved: Array<{ input: string; rxcui: string; nameGuess: string; needles: string[] }> = [];
  const unresolved: string[] = [];

  for (const input of unique) {
    const rx = await resolveRxcuiApproxForInput(input);
    if (!rx) {
      unresolved.push(input);
      continue;
    }
    const label = await fetchLatestLabelByRxcui(rx.rxcui);
    const generic = label?.openfda?.generic_name?.[0];
    const brand = label?.openfda?.brand_name?.[0];
    const nameGuess =
      label?.openfda?.generic_name?.[0] ??
      label?.openfda?.brand_name?.[0] ??
      rx.name ??
      input;
    const needles = uniqNonEmpty([
      input,
      nameGuess,
      generic,
      brand,
      rx.name,
      ...(label?.openfda?.generic_name ?? []),
      ...(label?.openfda?.brand_name ?? []),
    ]);
    resolved.push({ input, rxcui: rx.rxcui, nameGuess, needles });
  }

  const labelsByRxcui = new Map<string, Array<{ section: string; text: string }>>();
  for (const r of resolved) {
    const label = await fetchLatestLabelByRxcui(r.rxcui);
    if (!label) continue;
    labelsByRxcui.set(r.rxcui, extractTextBlocks(label));
  }

  let tier: InteractionTier = "very_safe";
  const hits: InteractionRuleHit[] = [];

  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      const a = resolved[i]!;
      const b = resolved[j]!;
      const aBlocks = labelsByRxcui.get(a.rxcui) ?? [];
      const bBlocks = labelsByRxcui.get(b.rxcui) ?? [];

      const t1 = classifyPairFromBlocks(aBlocks, b.needles);
      const t2 = classifyPairFromBlocks(bBlocks, a.needles);
      const pairTier = tierWorse(t1, t2);
      tier = tierWorse(tier, pairTier);

      if (pairTier !== "very_safe") {
        hits.push({
          drugA: a.nameGuess,
          drugB: b.nameGuess,
          tier: pairTier,
          ruleId: `openfda:${a.rxcui}+${b.rxcui}`,
          summaryKo: "openFDA(미국 FDA 라벨) 내 상호작용/경고/금기 섹션에 상대 약물 언급이 있어 신호로 분류했습니다.",
        });
      }
    }
  }

  const worstHits = hits.filter((h) => h.tier === tier);
  const oneLineKo =
    tier === "very_safe"
      ? "현재 범위(openFDA 라벨)에서는 함께 복용 시 뚜렷한 위험 신호가 확인되지 않았습니다. 라벨에 모든 위험이 항상 적히는 것은 아니며 개인 상태·용량·기간에 따라 달라질 수 있어요."
      : tier === "caution"
        ? "주의가 필요한 조합 신호가 있습니다(openFDA 라벨 기반)."
        : "병용 금기 가능성이 있는 조합 신호가 있습니다(openFDA 라벨 기반).";

  return {
    resolvedDrugs: resolved.map((r) => r.nameGuess),
    unresolvedInputs: unresolved,
    tier,
    hits: worstHits,
    oneLineKo,
  };
}
