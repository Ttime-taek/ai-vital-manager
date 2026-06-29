import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkInteractionsWithOpenFda } from "@/lib/openFdaInteractions";

describe("checkInteractionsWithOpenFda", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      if (url.hostname === "rxnav.nlm.nih.gov") {
        const term = url.searchParams.get("term");
        if (term === "warfarin") {
          return new Response(
            JSON.stringify({
              approximateGroup: {
                candidate: [{ rxcui: "11289", score: "12.68", rank: "1", name: "warfarin", source: "RXNORM" }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (term === "tylenol") {
          return new Response(
            JSON.stringify({
              approximateGroup: {
                candidate: [{ rxcui: "202433", score: "12.73", rank: "1", name: "Tylenol", source: "RXNORM" }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            approximateGroup: {
              candidate: [{ rxcui: "1000086", score: "2.40", rank: "1", name: "Lastacaft", source: "RXNORM" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.hostname === "api.fda.gov") {
        if (url.searchParams.get("search") === "openfda.rxcui:11289") {
          return new Response(
            JSON.stringify({
              results: [
                {
                  openfda: {
                    generic_name: ["warfarin"],
                    brand_name: ["Coumadin"],
                    rxcui: ["11289"],
                  },
                  drug_interactions: [],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.searchParams.get("search") === "openfda.rxcui:202433") {
          return new Response(
            JSON.stringify({
              results: [
                {
                  openfda: {
                    generic_name: ["acetaminophen"],
                    brand_name: ["Tylenol"],
                    rxcui: ["202433"],
                  },
                  drug_interactions: [],
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      }

      return new Response("{}", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("prefers English aliases from the medication database over low-score Korean RxNav matches", async () => {
    const result = await checkInteractionsWithOpenFda(["와파린", "타이레놀"]);

    expect(result.unresolvedInputs).toEqual([]);
    expect(result.resolvedDrugs).toEqual(["warfarin", "acetaminophen"]);
    expect(result.tier).toBe("very_safe");
  });
});
