import {
  assertUnitDimension,
  convertUnitValue,
  getUnitDefinition,
  unitRegistry,
  type Dimension,
  type Unit,
} from "units";

export interface QuantityDraft {
  text: string;
  displayUnit: Unit;
}

export interface ParsedQuantityDraft {
  value: number;
  unit: Unit;
  provenance: { source: "user-entered" };
}

export function quantityDraftFromCanonical(
  value: { value: number; unit: Unit },
  displayUnit: Unit = value.unit,
  dimension: Dimension,
): QuantityDraft {
  assertUnitDimension(displayUnit, dimension);
  return {
    text: formatDisplayNumber(
      convertUnitValue(value.value, value.unit, displayUnit, dimension),
    ),
    displayUnit,
  };
}

export function parseQuantityDraft(
  draft: QuantityDraft,
  dimension: Dimension,
  options: { required: boolean; positive?: boolean },
): ParsedQuantityDraft | null {
  const text = draft.text.trim();
  if (!text) {
    if (options.required) {
      throw new Error("Value is required");
    }
    return null;
  }
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    throw new Error("Value must be finite");
  }
  if (options.positive && numeric <= 0) {
    throw new Error("Value must be greater than zero");
  }
  const definition = assertUnitDimension(draft.displayUnit, dimension);
  return {
    value: definition.toCanonical(numeric),
    unit: definition.canonicalUnit,
    provenance: { source: "user-entered" },
  } as ParsedQuantityDraft;
}

export function compatibleUnits(dimension: Dimension): Unit[] {
  return (Object.keys(unitRegistry) as Unit[]).filter(
    (unit) => getUnitDefinition(unit).dimension === dimension,
  );
}

export function parseFiniteNumber(text: string, label: string): number {
  const value = Number(text.trim());
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
  return value;
}

export function parseNonEmptyText(text: string, label: string): string {
  const value = text.trim();
  if (!value) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function formatDisplayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
