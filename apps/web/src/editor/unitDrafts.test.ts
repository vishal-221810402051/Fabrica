import { describe, expect, it } from "vitest";

import {
  compatibleUnits,
  parseFiniteNumber,
  parseQuantityDraft,
  quantityDraftFromCanonical,
} from "./unitDrafts";

describe("unit draft helpers", () => {
  it("converts display units into canonical project quantities", () => {
    const parsed = parseQuantityDraft({ text: "1000", displayUnit: "um" }, "length", {
      required: true,
      positive: true,
    });

    expect(parsed).toEqual({
      value: 1,
      unit: "mm",
      provenance: { source: "user-entered" },
    });
  });

  it("preserves canonical precision while switching display units", () => {
    const draft = quantityDraftFromCanonical(
      { value: Math.PI, unit: "rad" },
      "deg",
      "angle",
    );
    const parsed = parseQuantityDraft(draft, "angle", {
      required: true,
      positive: false,
    });

    expect(parsed?.unit).toBe("rad");
    expect(parsed?.value).toBeCloseTo(Math.PI, 12);
  });

  it("rejects invalid numeric drafts without producing project values", () => {
    expect(() =>
      parseQuantityDraft({ text: "Infinity", displayUnit: "mm" }, "length", {
        required: true,
      }),
    ).toThrow("finite");
    expect(() => parseFiniteNumber("NaN", "Position")).toThrow("finite");
  });

  it("offers only unit-system-supported compatible units", () => {
    expect(compatibleUnits("length")).toEqual(["um", "mm"]);
    expect(compatibleUnits("volume")).toEqual(["mm3", "uL", "mL"]);
  });
});
