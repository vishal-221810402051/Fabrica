export const dimensions = [
  "length",
  "area",
  "volume",
  "time",
  "pressure",
  "flow-rate",
  "temperature",
  "angle",
] as const;

export type Dimension = (typeof dimensions)[number];

export const canonicalUnitsByDimension = {
  length: "mm",
  area: "mm2",
  volume: "mm3",
  time: "s",
  pressure: "Pa",
  "flow-rate": "mm3/s",
  temperature: "degC",
  angle: "rad",
} as const satisfies Record<Dimension, string>;

export type CanonicalUnit = (typeof canonicalUnitsByDimension)[Dimension];
