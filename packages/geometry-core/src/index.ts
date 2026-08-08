import type { Component, Layer, PhysicalRoute, Port, Project } from "project-model";
import {
  DEFINITION_IDENTITY_EXTENSION,
  PORT_TEMPLATE_METADATA,
  getComponentDefinition,
  type DefinitionIdentity,
  type PortTemplate,
  type PortTemplateMetadata,
} from "microfluidic-components";

export interface Point2D {
  x: number;
  y: number;
}

export interface PhysicalFootprint {
  width: number;
  height: number;
  depth?: number;
  source: "project-dimensions" | "registry-physical-metadata";
}

export interface PhysicalPortPosition extends Point2D {
  layerId: string;
}

export interface LayerZRange {
  layerId: string;
  zMin: number;
  zMax: number;
}

export interface GeometryIssue {
  code: string;
  message: string;
  path: string;
  entityId?: string;
}

export const PHYSICAL_SNAP_MM = 0.1;
export const MAJOR_GRID_MM = 1;
export const DISPLAY_PIXELS_PER_MM = 24;

export function mmToDisplay(valueMm: number): number {
  assertFinite(valueMm, "Millimeter value");
  return valueMm * DISPLAY_PIXELS_PER_MM;
}

export function displayToMm(valuePx: number): number {
  assertFinite(valuePx, "Display value");
  return valuePx / DISPLAY_PIXELS_PER_MM;
}

export function pointMmToDisplay(point: Point2D): Point2D {
  return { x: mmToDisplay(point.x), y: mmToDisplay(point.y) };
}

export function pointDisplayToMm(point: Point2D): Point2D {
  return { x: displayToMm(point.x), y: displayToMm(point.y) };
}

export function snapPhysical(valueMm: number): number {
  assertFinite(valueMm, "Millimeter value");
  return Number((Math.round(valueMm / PHYSICAL_SNAP_MM) * PHYSICAL_SNAP_MM).toFixed(6));
}

export function snapPhysicalPoint(point: Point2D): Point2D {
  return { x: snapPhysical(point.x), y: snapPhysical(point.y) };
}

export function deriveComponentFootprint(
  component: Component,
): PhysicalFootprint | null {
  if (component.kind === "channel") {
    if (component.channel.crossSection === "circular") {
      return {
        width: component.channel.length.value,
        height: component.channel.diameter.value,
        depth: component.channel.diameter.value,
        source: "project-dimensions",
      };
    }
    return {
      width: component.channel.length.value,
      height: component.channel.width.value,
      depth: component.channel.depth.value,
      source: "project-dimensions",
    };
  }
  if (component.kind === "reservoir") {
    return fromBox(component.reservoir.dimensions, "project-dimensions");
  }
  if (component.kind === "chamber") {
    return fromBox(component.chamber.dimensions, "project-dimensions");
  }
  if (component.kind === "generic" && component.dimensions) {
    return {
      width: component.dimensions.width.value,
      height: component.dimensions.height.value,
      ...("depth" in component.dimensions
        ? { depth: component.dimensions.depth.value }
        : {}),
      source: "project-dimensions",
    };
  }
  const definition = readDefinition(component);
  if (definition.physicalGeometry) {
    return {
      width: definition.physicalGeometry.footprint.width.value,
      height: definition.physicalGeometry.footprint.height.value,
      ...(definition.physicalGeometry.footprint.depth
        ? { depth: definition.physicalGeometry.footprint.depth.value }
        : {}),
      source: "registry-physical-metadata",
    };
  }
  return null;
}

export function getRotatedFootprintCorners(
  component: Component,
  footprint: PhysicalFootprint,
): Point2D[] {
  const left = component.position.x.value;
  const top = component.position.y.value;
  const center = {
    x: left + footprint.width / 2,
    y: top + footprint.height / 2,
  };
  return [
    { x: left, y: top },
    { x: left + footprint.width, y: top },
    { x: left + footprint.width, y: top + footprint.height },
    { x: left, y: top + footprint.height },
  ].map((corner) => rotatePoint(corner, center, component.rotation.value));
}

export function isComponentInsideChip(project: Project, component: Component): boolean {
  const footprint = deriveComponentFootprint(component);
  if (!footprint) {
    return false;
  }
  const width = project.chip.overallDimensions.width.value;
  const height = project.chip.overallDimensions.height.value;
  return getRotatedFootprintCorners(component, footprint).every(
    (corner) =>
      corner.x >= 0 && corner.y >= 0 && corner.x <= width && corner.y <= height,
  );
}

export function getPhysicalPortPosition(
  project: Project,
  component: Component,
  port: Port,
): PhysicalPortPosition {
  void project;
  if (port.componentId !== component.id) {
    throw new Error(`Port ${port.id} is not owned by component ${component.id}`);
  }
  const footprint = deriveComponentFootprint(component);
  if (!footprint) {
    throw new Error(`Component ${component.id} is not physical-layout-ready`);
  }
  const definition = readDefinition(component);
  const templateMetadata = readPortTemplateMetadata(port);
  const template = definition.ports.find(
    (candidate) => candidate.key === templateMetadata.templateKey,
  );
  if (!template) {
    throw new Error(`Port ${port.id} has no registry template`);
  }
  const anchor =
    readPhysicalAnchor(template) ?? fallbackAnchor(definition.ports, template);
  const localPoint = {
    x: component.position.x.value + anchor.x * footprint.width,
    y: component.position.y.value + anchor.y * footprint.height,
  };
  const center = {
    x: component.position.x.value + footprint.width / 2,
    y: component.position.y.value + footprint.height / 2,
  };
  return {
    ...rotatePoint(localPoint, center, component.rotation.value),
    layerId: component.layerId,
  };
}

export function deriveFullRoutePolyline(
  project: Project,
  route: PhysicalRoute,
): Point2D[] {
  const connection = project.connections.find((item) => item.id === route.connectionId);
  if (!connection) {
    return route.waypoints.map(toPoint);
  }
  const portsById = new Map(project.ports.map((port) => [port.id, port]));
  const componentsById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const sourcePort = portsById.get(connection.sourcePortId);
  const targetPort = portsById.get(connection.targetPortId);
  const sourceComponent = sourcePort
    ? componentsById.get(sourcePort.componentId)
    : null;
  const targetComponent = targetPort
    ? componentsById.get(targetPort.componentId)
    : null;
  if (!sourcePort || !targetPort || !sourceComponent || !targetComponent) {
    return route.waypoints.map(toPoint);
  }
  return [
    getPhysicalPortPosition(project, sourceComponent, sourcePort),
    ...route.waypoints.map(toPoint),
    getPhysicalPortPosition(project, targetComponent, targetPort),
  ];
}

export function deriveLayerZRanges(layers: readonly Layer[]): LayerZRange[] {
  let cursor = 0;
  return [...layers]
    .sort((left, right) => left.order - right.order)
    .map((layer) => {
      const range = {
        layerId: layer.id,
        zMin: cursor,
        zMax: cursor + layer.thickness.value,
      };
      cursor = range.zMax;
      return range;
    });
}

export function toCadPoint(
  project: Project,
  point: Point2D,
  layerId: string,
): { x: number; y: number; z: number } {
  const range = deriveLayerZRanges(project.layers).find(
    (candidate) => candidate.layerId === layerId,
  );
  if (!range) {
    throw new Error(`Missing layer ${layerId}`);
  }
  return {
    x: point.x,
    y: project.chip.overallDimensions.height.value - point.y,
    z: range.zMin,
  };
}

export function validatePhysicalGeometry(project: Project): GeometryIssue[] {
  const issues: GeometryIssue[] = [];
  const layerIds = new Set(project.layers.map((layer) => layer.id));
  const connectionIds = new Set(project.connections.map((connection) => connection.id));

  project.components.forEach((component, index) => {
    const footprint = deriveComponentFootprint(component);
    if (!footprint) {
      issues.push({
        code: "component-not-physical-layout-ready",
        message: "Component has no authoritative physical footprint",
        path: `components.${index}`,
        entityId: component.id,
      });
      return;
    }
    if (footprint.width <= 0 || footprint.height <= 0) {
      issues.push({
        code: "invalid-footprint",
        message: "Component footprint width and height must be positive",
        path: `components.${index}`,
        entityId: component.id,
      });
    }
    if (!isComponentInsideChip(project, component)) {
      issues.push({
        code: "component-outside-chip",
        message: "Rotated component footprint must remain inside the chip boundary",
        path: `components.${index}.position`,
        entityId: component.id,
      });
    }
  });

  project.physicalRoutes.forEach((route, index) => {
    if (!connectionIds.has(route.connectionId)) {
      issues.push({
        code: "missing-route-connection-reference",
        message: "Physical route references a missing connection",
        path: `physicalRoutes.${index}.connectionId`,
        entityId: route.id,
      });
    }
    const layer = project.layers.find((candidate) => candidate.id === route.layerId);
    if (!layerIds.has(route.layerId) || !layer) {
      issues.push({
        code: "missing-route-layer-reference",
        message: "Physical route references a missing layer",
        path: `physicalRoutes.${index}.layerId`,
        entityId: route.id,
      });
      return;
    }
    route.waypoints.forEach((waypoint, waypointIndex) => {
      const point = toPoint(waypoint);
      if (!pointInsideChip(project, point)) {
        issues.push({
          code: "route-waypoint-outside-chip",
          message: "Route waypoint must be finite and inside chip bounds",
          path: `physicalRoutes.${index}.waypoints.${waypointIndex}`,
          entityId: route.id,
        });
      }
    });
    if (route.depth && route.depth.value > layer.thickness.value) {
      issues.push({
        code: "route-depth-exceeds-layer",
        message: "Route depth must not exceed its layer thickness",
        path: `physicalRoutes.${index}.depth`,
        entityId: route.id,
      });
    }
  });

  return issues;
}

function fromBox(
  dimensions: {
    width: { value: number };
    height: { value: number };
    depth: { value: number };
  },
  source: PhysicalFootprint["source"],
): PhysicalFootprint {
  return {
    width: dimensions.width.value,
    height: dimensions.height.value,
    depth: dimensions.depth.value,
    source,
  };
}

function toPoint(point: { x: { value: number }; y: { value: number } }): Point2D {
  return { x: point.x.value, y: point.y.value };
}

function rotatePoint(point: Point2D, center: Point2D, radians: number): Point2D {
  assertFinite(point.x, "X");
  assertFinite(point.y, "Y");
  assertFinite(radians, "Rotation");
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const translatedX = point.x - center.x;
  const translatedY = point.y - center.y;
  return {
    x: center.x + translatedX * cos - translatedY * sin,
    y: center.y + translatedX * sin + translatedY * cos,
  };
}

function pointInsideChip(project: Project, point: Point2D): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x <= project.chip.overallDimensions.width.value &&
    point.y <= project.chip.overallDimensions.height.value
  );
}

function readDefinition(component: Component) {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown as
    DefinitionIdentity | undefined;
  if (!identity?.definitionKey) {
    throw new Error(`Component ${component.id} has no registry identity`);
  }
  return getComponentDefinition(identity.definitionKey);
}

function readPortTemplateMetadata(port: Port): PortTemplateMetadata {
  const metadata = port.metadata[PORT_TEMPLATE_METADATA] as unknown as
    PortTemplateMetadata | undefined;
  if (!metadata?.templateKey) {
    throw new Error(`Port ${port.id} has no template metadata`);
  }
  return metadata;
}

function readPhysicalAnchor(template: PortTemplate): Point2D | null {
  const anchor = template.metadata.physicalAnchor;
  if (
    anchor &&
    typeof anchor === "object" &&
    !Array.isArray(anchor) &&
    "x" in anchor &&
    "y" in anchor &&
    typeof anchor.x === "number" &&
    typeof anchor.y === "number" &&
    anchor.x >= 0 &&
    anchor.x <= 1 &&
    anchor.y >= 0 &&
    anchor.y <= 1
  ) {
    return { x: anchor.x, y: anchor.y };
  }
  return null;
}

function fallbackAnchor(
  templates: readonly PortTemplate[],
  template: PortTemplate,
): Point2D {
  const sameSide = templates.filter(
    (candidate) => candidate.direction === template.direction,
  );
  const index = sameSide.findIndex((candidate) => candidate.key === template.key);
  if (template.direction === "input") {
    return { x: 0, y: (index + 1) / (sameSide.length + 1) };
  }
  if (template.direction === "output") {
    return { x: 1, y: (index + 1) / (sameSide.length + 1) };
  }
  return template.anchor;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }
}
