import { describe, expect, it } from "vitest";

import {
  approximatelyEqual,
  convertUnitValue,
  createAngleQuantity,
  createLengthQuantity,
  createPressureQuantity,
  createProvenance,
  createTimeQuantity,
  createVolumeQuantity,
  createFlowRateQuantity,
  InvalidQuantityError,
  DimensionMismatchError,
  UnknownUnitError,
} from "./index";

const provenance = createProvenance("user-entered");

describe("unit normalization", () => {
  it("normalizes length units to millimetres", () => {
    expect(createLengthQuantity({ value: 2500, unit: "um", provenance })).toMatchObject(
      {
        value: 2.5,
        unit: "mm",
        dimension: "length",
      },
    );
    expect(createLengthQuantity({ value: 2.5, unit: "mm", provenance }).value).toBe(
      2.5,
    );
  });

  it("preserves the exact microlitre to cubic millimetre identity", () => {
    expect(createVolumeQuantity({ value: 1, unit: "uL", provenance })).toMatchObject({
      value: 1,
      unit: "mm3",
    });
  });

  it("normalizes millilitres to cubic millimetres", () => {
    expect(createVolumeQuantity({ value: 2, unit: "mL", provenance }).value).toBe(2000);
  });

  it("normalizes minutes to seconds and kPa to Pa", () => {
    expect(createTimeQuantity({ value: 2, unit: "min", provenance }).value).toBe(120);
    expect(createPressureQuantity({ value: 2.5, unit: "kPa", provenance }).value).toBe(
      2500,
    );
  });

  it("normalizes microlitres per minute to cubic millimetres per second", () => {
    expect(
      approximatelyEqual(
        createFlowRateQuantity({ value: 60, unit: "uL/min", provenance }).value,
        1,
      ),
    ).toBe(true);
  });

  it("normalizes degrees to radians", () => {
    expect(
      approximatelyEqual(
        createAngleQuantity({ value: 180, unit: "deg", provenance }).value,
        Math.PI,
      ),
    ).toBe(true);
  });

  it("converts canonical values back to display units", () => {
    expect(convertUnitValue(1, "mm", "um", "length")).toBe(1000);
    expect(convertUnitValue(1, "mm3/s", "uL/min", "flow-rate")).toBe(60);
  });
});

describe("unit validation", () => {
  it("rejects unknown units and dimension mismatches", () => {
    expect(() =>
      createLengthQuantity({ value: 1, unit: "mL" as never, provenance }),
    ).toThrow(DimensionMismatchError);
    expect(() =>
      createLengthQuantity({ value: 1, unit: "furlong" as never, provenance }),
    ).toThrow(UnknownUnitError);
  });

  it("rejects non-finite and non-numeric values", () => {
    expect(() =>
      createLengthQuantity({ value: Number.NaN, unit: "mm", provenance }),
    ).toThrow(InvalidQuantityError);
    expect(() =>
      createLengthQuantity({ value: Infinity, unit: "mm", provenance }),
    ).toThrow(InvalidQuantityError);
    expect(() =>
      createLengthQuantity({ value: "12" as never, unit: "mm", provenance }),
    ).toThrow(InvalidQuantityError);
  });

  it("allows negative and zero values generically", () => {
    expect(createLengthQuantity({ value: -1, unit: "mm", provenance }).value).toBe(-1);
    expect(createLengthQuantity({ value: 0, unit: "mm", provenance }).value).toBe(0);
  });

  it("preserves provenance", () => {
    const quantity = createLengthQuantity({
      value: 1,
      unit: "mm",
      provenance: { source: "ai-assumed", note: "explicit assumption" },
    });

    expect(quantity.provenance).toEqual({
      source: "ai-assumed",
      note: "explicit assumption",
    });
  });
});
