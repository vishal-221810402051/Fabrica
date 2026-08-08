import { z } from "zod";

export const idPrefixes = [
  "project",
  "chip",
  "layer",
  "lane",
  "component",
  "port",
  "connection",
  "route",
  "fluid",
  "material",
  "process",
  "result",
] as const;

export type IdPrefix = (typeof idPrefixes)[number];

export type StableId<TPrefix extends IdPrefix> = `${TPrefix}_${string}` & {
  readonly __prefix: TPrefix;
};

export function stableIdSchema<TPrefix extends IdPrefix>(prefix: TPrefix) {
  return z
    .string()
    .min(1)
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]*$`));
}

export const ProjectIdSchema = stableIdSchema("project");
export const ChipIdSchema = stableIdSchema("chip");
export const LayerIdSchema = stableIdSchema("layer");
export const LaneIdSchema = stableIdSchema("lane");
export const ComponentIdSchema = stableIdSchema("component");
export const PortIdSchema = stableIdSchema("port");
export const ConnectionIdSchema = stableIdSchema("connection");
export const RouteIdSchema = stableIdSchema("route");
export const FluidIdSchema = stableIdSchema("fluid");
export const MaterialIdSchema = stableIdSchema("material");
export const ProcessIdSchema = stableIdSchema("process");
export const ResultIdSchema = stableIdSchema("result");

export type ProjectId = z.infer<typeof ProjectIdSchema>;
export type ChipId = z.infer<typeof ChipIdSchema>;
export type LayerId = z.infer<typeof LayerIdSchema>;
export type LaneId = z.infer<typeof LaneIdSchema>;
export type ComponentId = z.infer<typeof ComponentIdSchema>;
export type PortId = z.infer<typeof PortIdSchema>;
export type ConnectionId = z.infer<typeof ConnectionIdSchema>;
export type RouteId = z.infer<typeof RouteIdSchema>;
export type FluidId = z.infer<typeof FluidIdSchema>;
export type MaterialId = z.infer<typeof MaterialIdSchema>;
export type ProcessId = z.infer<typeof ProcessIdSchema>;
export type ResultId = z.infer<typeof ResultIdSchema>;

export function createStableId<TPrefix extends IdPrefix>(
  prefix: TPrefix,
): StableId<TPrefix> {
  const randomId = globalThis.crypto?.randomUUID?.() ?? fallbackRandomId();
  return `${prefix}_${randomId}` as StableId<TPrefix>;
}

function fallbackRandomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
