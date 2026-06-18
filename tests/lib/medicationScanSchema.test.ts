import { describe, expect, it } from "vitest";
import { coerceScanResultFromUnknown } from "@/lib/medicationScanSchema";

describe("coerceScanResultFromUnknown", () => {
  it("parses valid scan payload", () => {
    const result = coerceScanResultFromUnknown({
      products: [
        {
          name: "타이레놀",
          kind: "medication",
          confidence: "high",
        },
      ],
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.name).toBe("타이레놀");
  });

  it("returns empty with warning on invalid payload", () => {
    const result = coerceScanResultFromUnknown({ foo: "bar" });
    expect(result.products).toHaveLength(0);
    expect(result.warnings?.[0]).toBeTruthy();
  });
});
