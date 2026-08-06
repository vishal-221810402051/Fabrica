import type { PortId } from "project-model";

export type HandleMode = "source" | "target";

const prefix = "fg-port";

export function createHandleId(portId: PortId | string, mode: HandleMode): string {
  return `${prefix}:${mode}:${portId}`;
}

export function parseHandleId(
  handleId: string | null | undefined,
): { mode: HandleMode; portId: PortId } | null {
  if (!handleId) {
    return null;
  }
  const parts = handleId.split(":");
  if (parts.length !== 3 || parts[0] !== prefix) {
    return null;
  }
  if (parts[1] !== "source" && parts[1] !== "target") {
    return null;
  }
  if (!/^port_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(parts[2] ?? "")) {
    return null;
  }
  return { mode: parts[1], portId: parts[2] as PortId };
}
