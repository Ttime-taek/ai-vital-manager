export interface WebSearchSnippet {
  source: string;
  title: string;
  text: string;
  url?: string;
}

export interface MedicationWebContext {
  query: string;
  snippets: WebSearchSnippet[];
  /** AI 프롬프트에 넣을 요약 텍스트 */
  promptBlock: string;
}

const WEB_TIMEOUT_MS = 5_000;

function isWebSearchDisabled(): boolean {
  return process.env.MEDICATION_WEB_SEARCH === "0";
}

function trimText(s: string, max = 600): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function formatPromptBlock(snippets: WebSearchSnippet[]): string {
  if (snippets.length === 0) {
    return "웹 검색에서 신뢰할 만한 추가 스니펫을 찾지 못했습니다.";
  }
  return snippets
    .slice(0, 8)
    .map(
      (s, i) =>
        `[${i + 1}] (${s.source}) ${s.title}\n${s.text}${s.url ? `\nURL: ${s.url}` : ""}`,
    )
    .join("\n\n");
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = WEB_TIMEOUT_MS,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchSerper(query: string): Promise<WebSearchSnippet[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];

  const res = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({
      q: `${query} 약 복용 음식 상호작용 식이`,
      gl: "kr",
      hl: "ko",
      num: 6,
    }),
  });
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; snippet?: string; link?: string }>;
    answerBox?: { title?: string; snippet?: string; link?: string };
  };

  const out: WebSearchSnippet[] = [];
  if (data.answerBox?.snippet) {
    out.push({
      source: "Google(Serper)",
      title: data.answerBox.title ?? "요약",
      text: trimText(data.answerBox.snippet),
      url: data.answerBox.link,
    });
  }
  for (const row of data.organic ?? []) {
    if (!row.snippet) continue;
    out.push({
      source: "Google(Serper)",
      title: row.title ?? query,
      text: trimText(row.snippet),
      url: row.link,
    });
  }
  return out;
}

async function searchTavily(query: string): Promise<WebSearchSnippet[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];

  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query: `${query} medication food interactions dosing Korean`,
      search_depth: "basic",
      max_results: 6,
      include_answer: true,
    }),
  });
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; content?: string; url?: string }>;
  };

  const out: WebSearchSnippet[] = [];
  if (data.answer) {
    out.push({
      source: "Tavily",
      title: "검색 요약",
      text: trimText(data.answer, 800),
    });
  }
  for (const row of data.results ?? []) {
    if (!row.content) continue;
    out.push({
      source: "Tavily",
      title: row.title ?? query,
      text: trimText(row.content),
      url: row.url,
    });
  }
  return out;
}

async function searchDuckDuckGo(query: string): Promise<WebSearchSnippet[]> {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", `${query} drug food interaction`);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");

  const res = await fetchWithTimeout(url.toString(), { method: "GET" });
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    AbstractText?: string;
    Heading?: string;
    AbstractURL?: string;
    RelatedTopics?: Array<
      | { Text?: string; FirstURL?: string }
      | { Name?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }
    >;
  };

  const out: WebSearchSnippet[] = [];
  if (data.AbstractText) {
    out.push({
      source: "DuckDuckGo",
      title: data.Heading ?? query,
      text: trimText(data.AbstractText, 800),
      url: data.AbstractURL,
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if ("Topics" in topic && topic.Topics) {
      for (const sub of topic.Topics) {
        if (!sub.Text) continue;
        out.push({
          source: "DuckDuckGo",
          title: sub.Text.split(" - ")[0] ?? query,
          text: trimText(sub.Text),
          url: sub.FirstURL,
        });
      }
    } else if ("Text" in topic && topic.Text) {
      out.push({
        source: "DuckDuckGo",
        title: topic.Text.split(" - ")[0] ?? query,
        text: trimText(topic.Text),
        url: topic.FirstURL,
      });
    }
  }
  return out.slice(0, 5);
}

async function searchOpenFdaLabel(query: string): Promise<WebSearchSnippet[]> {
  const escaped = query.replace(/"/g, '\\"');
  const search = `(openfda.brand_name:"${escaped}" OR openfda.generic_name:"${escaped}")`;
  const url = new URL("https://api.fda.gov/drug/label.json");
  url.searchParams.set("search", search);
  url.searchParams.set("sort", "effective_time:desc");
  url.searchParams.set("limit", "1");

  const res = await fetchWithTimeout(url.toString(), { method: "GET" });
  if (!res?.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      effective_time?: string;
      drug_interactions?: string[];
      warnings?: string[];
      warnings_and_cautions?: string[];
      dosage_and_administration?: string[];
      patient_medicine_information?: string[];
      openfda?: { brand_name?: string[]; generic_name?: string[] };
    }>;
  };

  const label = data.results?.[0];
  if (!label) return [];

  const brand = label.openfda?.brand_name?.[0];
  const generic = label.openfda?.generic_name?.[0];
  const title = brand ?? generic ?? query;
  const out: WebSearchSnippet[] = [];

  const pushSection = (section: string, parts?: string[]) => {
    for (const p of parts ?? []) {
      const text = trimText(p, 900);
      if (text.length < 40) continue;
      out.push({ source: "openFDA(미국)", title: `${title} · ${section}`, text });
    }
  };

  pushSection("drug_interactions", label.drug_interactions);
  pushSection("warnings", label.warnings);
  pushSection("warnings_and_cautions", label.warnings_and_cautions);
  pushSection("dosage_and_administration", label.dosage_and_administration);
  pushSection("patient_info", label.patient_medicine_information);

  if (label.effective_time) {
    out.unshift({
      source: "openFDA(미국)",
      title: `${title} · 라벨 개정`,
      text: `effective_time: ${label.effective_time}`,
    });
  }

  return out.slice(0, 6);
}

function dedupeSnippets(snippets: WebSearchSnippet[]): WebSearchSnippet[] {
  const seen = new Set<string>();
  const out: WebSearchSnippet[] = [];
  for (const s of snippets) {
    const key = `${s.source}:${s.text.slice(0, 80).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** 약물명으로 공개 웹·라벨 정보를 수집합니다. */
export async function searchMedicationWebContext(
  query: string,
): Promise<MedicationWebContext | null> {
  if (isWebSearchDisabled()) return null;

  const results = await Promise.all([
    searchSerper(query),
    searchTavily(query),
    searchOpenFdaLabel(query),
    searchDuckDuckGo(query),
  ]);

  const snippets = dedupeSnippets(results.flat());
  return {
    query,
    snippets,
    promptBlock: formatPromptBlock(snippets),
  };
}

export function isMedicationWebSearchEnabled(): boolean {
  return !isWebSearchDisabled();
}
