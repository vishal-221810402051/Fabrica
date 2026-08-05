export const provenanceSources = [
  "user-entered",
  "deterministically-calculated",
  "ai-assumed",
  "imported",
  "simulated",
  "system-default",
  "experimentally-calibrated",
  "manufacturer-supplied",
] as const;

export type ProvenanceSource = (typeof provenanceSources)[number];

export interface ValueProvenance {
  source: ProvenanceSource;
  note?: string;
  reference?: string;
  timestamp?: string;
  actor?: string;
}

export function createProvenance(source: ProvenanceSource): ValueProvenance {
  return { source };
}
