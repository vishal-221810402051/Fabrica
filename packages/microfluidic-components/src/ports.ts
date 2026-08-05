import {
  portMedia,
  portRoles,
  type PortMedium,
  type PortRole,
  type PortTemplate,
} from "./types";

export function fluidPort(
  key: string,
  name: string,
  direction: PortTemplate["direction"],
  role: PortRole = "generic",
  anchor = direction === "input" ? { x: 0, y: 0.5 } : { x: 1, y: 0.5 },
): PortTemplate {
  return {
    key,
    name,
    direction,
    medium: "liquid",
    role,
    required: true,
    minConnections: 0,
    maxConnections: 1,
    anchor,
    orientation: direction === "input" ? "west" : "east",
    sameComponentConnectionAllowed: false,
    metadata: {},
  };
}

export function interfacePort(
  key: string,
  name: string,
  direction: PortTemplate["direction"],
  medium: PortMedium,
  role: PortRole,
): PortTemplate {
  return {
    key,
    name,
    direction,
    medium,
    role,
    required: false,
    minConnections: 0,
    maxConnections: 1,
    anchor: { x: 0.5, y: 0.5 },
    orientation: "east",
    sameComponentConnectionAllowed: false,
    metadata: {},
  };
}

export function validatePortTemplate(template: PortTemplate): string[] {
  const issues: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(template.key)) {
    issues.push(`Invalid port template key ${template.key}`);
  }
  if (!["input", "output", "bidirectional"].includes(template.direction)) {
    issues.push(`Invalid port direction ${template.direction}`);
  }
  if (!portMedia.includes(template.medium)) {
    issues.push(`Invalid port medium ${template.medium}`);
  }
  if (!portRoles.includes(template.role)) {
    issues.push(`Invalid port role ${template.role}`);
  }
  if (!Number.isInteger(template.minConnections) || template.minConnections < 0) {
    issues.push(`Invalid minConnections for ${template.key}`);
  }
  if (
    template.maxConnections !== null &&
    (!Number.isInteger(template.maxConnections) || template.maxConnections <= 0)
  ) {
    issues.push(`Invalid maxConnections for ${template.key}`);
  }
  if (
    template.maxConnections !== null &&
    template.minConnections > template.maxConnections
  ) {
    issues.push(`minConnections exceeds maxConnections for ${template.key}`);
  }
  if (
    !Number.isFinite(template.anchor.x) ||
    !Number.isFinite(template.anchor.y) ||
    template.anchor.x < 0 ||
    template.anchor.x > 1 ||
    template.anchor.y < 0 ||
    template.anchor.y > 1
  ) {
    issues.push(`Invalid anchor for ${template.key}`);
  }
  if (
    typeof template.orientation === "number" &&
    !Number.isFinite(template.orientation)
  ) {
    issues.push(`Invalid orientation for ${template.key}`);
  }
  return issues;
}
