import type { IconDescriptor } from "./types";

export const icons = {
  channel: {
    key: "channel",
    viewBox: [0, 0, 24, 24],
    primitives: [{ type: "line", x1: 3, y1: 12, x2: 21, y2: 12 }],
  },
  junction: {
    key: "junction",
    viewBox: [0, 0, 24, 24],
    primitives: [
      { type: "line", x1: 12, y1: 12, x2: 3, y2: 5 },
      { type: "line", x1: 12, y1: 12, x2: 3, y2: 19 },
      { type: "line", x1: 12, y1: 12, x2: 21, y2: 12 },
    ],
  },
  chamber: {
    key: "chamber",
    viewBox: [0, 0, 24, 24],
    primitives: [{ type: "rectangle", x: 5, y: 6, width: 14, height: 12 }],
  },
  reservoir: {
    key: "reservoir",
    viewBox: [0, 0, 24, 24],
    primitives: [{ type: "circle", cx: 12, cy: 12, r: 7 }],
  },
  valve: {
    key: "valve",
    viewBox: [0, 0, 24, 24],
    primitives: [
      { type: "line", x1: 3, y1: 12, x2: 21, y2: 12 },
      { type: "path", d: "M8 7 L16 17 M16 7 L8 17" },
    ],
  },
  interface: {
    key: "interface",
    viewBox: [0, 0, 24, 24],
    primitives: [
      { type: "rectangle", x: 6, y: 6, width: 12, height: 12 },
      { type: "line", x1: 12, y1: 3, x2: 12, y2: 21 },
    ],
  },
  generic: {
    key: "generic",
    viewBox: [0, 0, 24, 24],
    primitives: [{ type: "rectangle", x: 5, y: 5, width: 14, height: 14 }],
  },
} as const satisfies Record<string, IconDescriptor>;
