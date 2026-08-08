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

export interface Point3D extends Point2D {
  z: number;
}

export interface SceneWarning {
  code: string;
  message: string;
  entityId?: string;
  path?: string;
}

export interface SceneChipGeometry {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
}

export interface SceneLayerGeometry extends LayerZRange {
  name: string;
  thickness: number;
}

export interface SceneComponentGeometry {
  id: string;
  name: string;
  definitionKey: string;
  kind: Component["kind"];
  layerId: string;
  footprint: PhysicalFootprint;
  center: Point3D;
  size: { width: number; height: number; depth: number };
  rotation: number;
  zTop: number;
  zBottom: number;
  physicalReady: boolean;
}

export interface SceneRouteSegmentGeometry {
  id: string;
  routeId: string;
  connectionId: string;
  layerId: string;
  center: Point3D;
  length: number;
  width: number;
  depth: number;
  angle: number;
  zTop: number;
  zBottom: number;
}

export interface SceneRouteGeometry {
  id: string;
  connectionId: string;
  layerId: string;
  physicalReady: boolean;
  points: Point3D[];
  segments: SceneRouteSegmentGeometry[];
  jointBoxes: SceneRouteSegmentGeometry[];
  width?: number;
  depth?: number;
}

export interface ScenePortGeometry {
  id: string;
  componentId: string;
  layerId: string;
  direction: Port["direction"];
  position: Point3D;
}

export interface SceneGeometry {
  chip: SceneChipGeometry;
  layers: SceneLayerGeometry[];
  components: SceneComponentGeometry[];
  routes: SceneRouteGeometry[];
  ports: ScenePortGeometry[];
  warnings: SceneWarning[];
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

export function projectToSceneGeometry(project: Project): SceneGeometry {
  const warnings: SceneWarning[] = [];
  const layers = deriveSceneLayers(project);
  const layersById = new Map(layers.map((layer) => [layer.layerId, layer]));
  const componentsById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const portsById = new Map(project.ports.map((port) => [port.id, port]));

  const stackDepth = layers.reduce((max, layer) => Math.max(max, layer.zMax), 0);
  if (stackDepth !== project.chip.overallDimensions.depth.value) {
    warnings.push({
      code: "chip-layer-depth-mismatch",
      message: "Chip depth and layer stack thickness differ",
      entityId: project.chip.id,
      path: "chip.overallDimensions.depth",
    });
  }

  const components = project.components.flatMap((component, index) => {
    const layer = layersById.get(component.layerId);
    const footprint = deriveComponentFootprint(component);
    const definitionKey = readDefinition(component).key;
    if (!layer) {
      warnings.push({
        code: "missing-component-layer",
        message: "Component layer is missing",
        entityId: component.id,
        path: `components.${index}.layerId`,
      });
      return [];
    }
    if (!footprint) {
      warnings.push({
        code: "missing-footprint",
        message: "Component has no authoritative physical footprint",
        entityId: component.id,
        path: `components.${index}`,
      });
      warnings.push({
        code: "unsupported-physical-component",
        message: "Component is not physical-layout-ready for 3D preview",
        entityId: component.id,
        path: `components.${index}`,
      });
      return [];
    }
    if (!footprint.depth) {
      warnings.push({
        code: "missing-component-depth",
        message: "Component footprint has no physical depth",
        entityId: component.id,
        path: `components.${index}`,
      });
      return [];
    }
    if (!isComponentInsideChip(project, component)) {
      warnings.push({
        code: "outside-chip-geometry",
        message: "Component footprint is outside chip bounds",
        entityId: component.id,
        path: `components.${index}.position`,
      });
    }
    const placement = cavityPlacement(layer, footprint.depth, warnings, {
      entityId: component.id,
      path: `components.${index}`,
    });
    if (!placement) {
      return [];
    }
    const cadCenter = toCadPoint(
      project,
      {
        x: component.position.x.value + footprint.width / 2,
        y: component.position.y.value + footprint.height / 2,
      },
      component.layerId,
    );
    return [
      {
        id: component.id,
        name: component.name,
        definitionKey,
        kind: component.kind,
        layerId: component.layerId,
        footprint,
        center: { ...cadCenter, z: placement.zCenter },
        size: {
          width: footprint.width,
          height: footprint.height,
          depth: footprint.depth,
        },
        rotation: -component.rotation.value,
        zTop: placement.zTop,
        zBottom: placement.zBottom,
        physicalReady: true,
      },
    ];
  });

  const ports = project.ports.flatMap((port, index) => {
    const component = componentsById.get(port.componentId);
    if (!component) {
      warnings.push({
        code: "missing-port-component",
        message: "Port component is missing",
        entityId: port.id,
        path: `ports.${index}.componentId`,
      });
      return [];
    }
    const layer = layersById.get(component.layerId);
    if (!layer) {
      return [];
    }
    try {
      const physical = getPhysicalPortPosition(project, component, port);
      const cad = toCadPoint(project, physical, physical.layerId);
      return [
        {
          id: port.id,
          componentId: port.componentId,
          layerId: physical.layerId,
          direction: port.direction,
          position: { ...cad, z: layer.zMax },
        },
      ];
    } catch {
      warnings.push({
        code: "missing-footprint",
        message: "Port position could not be derived from physical footprint",
        entityId: port.id,
        path: `ports.${index}`,
      });
      return [];
    }
  });

  const routes = project.physicalRoutes.map((route, index) =>
    routeToSceneGeometry(
      project,
      route,
      index,
      portsById,
      componentsById,
      layersById,
      warnings,
    ),
  );

  return {
    chip: {
      id: project.chip.id,
      name: project.chip.name,
      width: project.chip.overallDimensions.width.value,
      height: project.chip.overallDimensions.height.value,
      depth: project.chip.overallDimensions.depth.value,
    },
    layers,
    components,
    routes,
    ports,
    warnings,
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

function deriveSceneLayers(project: Project): SceneLayerGeometry[] {
  const layersById = new Map(project.layers.map((layer) => [layer.id, layer]));
  return deriveLayerZRanges(project.layers).map((range) => {
    const layer = layersById.get(range.layerId);
    if (!layer) {
      throw new Error(`Missing layer ${range.layerId}`);
    }
    return {
      ...range,
      name: layer.name,
      thickness: layer.thickness.value,
    };
  });
}

function routeToSceneGeometry(
  project: Project,
  route: PhysicalRoute,
  index: number,
  portsById: Map<string, Port>,
  componentsById: Map<string, Component>,
  layersById: Map<string, SceneLayerGeometry>,
  warnings: SceneWarning[],
): SceneRouteGeometry {
  const layer = layersById.get(route.layerId);
  const routePath = `physicalRoutes.${index}`;
  const points2d = safeRoutePolyline(project, route, warnings, routePath);
  const points = points2d.map((point) => {
    const cad = layer
      ? toCadPoint(project, point, route.layerId)
      : { x: point.x, y: point.y, z: 0 };
    return { ...cad, z: layer?.zMax ?? 0 };
  });

  if (!project.connections.some((connection) => connection.id === route.connectionId)) {
    warnings.push({
      code: "invalid-route-reference",
      message: "Route references a missing connection",
      entityId: route.id,
      path: `${routePath}.connectionId`,
    });
  }
  if (!layer) {
    warnings.push({
      code: "invalid-route-reference",
      message: "Route references a missing layer",
      entityId: route.id,
      path: `${routePath}.layerId`,
    });
  }
  if (!route.width) {
    warnings.push({
      code: "missing-route-width",
      message: "Route width is missing; rendering an incomplete guide",
      entityId: route.id,
      path: `${routePath}.width`,
    });
  }
  if (!route.depth) {
    warnings.push({
      code: "missing-route-depth",
      message: "Route depth is missing; rendering an incomplete guide",
      entityId: route.id,
      path: `${routePath}.depth`,
    });
  }
  if (!route.width || !route.depth) {
    warnings.push({
      code: "incomplete-route",
      message: "Route is not CAD-ready and is shown as a guide only",
      entityId: route.id,
      path: routePath,
    });
  }
  if (route.bendRadius) {
    warnings.push({
      code: "bend-radius-preview-approximation",
      message: "Bend radius is not represented geometrically in Phase 9A",
      entityId: route.id,
      path: `${routePath}.bendRadius`,
    });
  }

  const placement =
    layer && route.depth
      ? cavityPlacement(layer, route.depth.value, warnings, {
          entityId: route.id,
          path: `${routePath}.depth`,
        })
      : null;
  const physicalReady = Boolean(route.width && route.depth && layer && placement);
  const segments =
    physicalReady && route.width && route.depth && placement
      ? rectangularRouteSegments(
          route,
          points,
          route.width.value,
          route.depth.value,
          placement,
        )
      : [];
  const jointBoxes =
    physicalReady && route.width && route.depth && placement
      ? rectangularRouteJoints(
          route,
          points,
          route.width.value,
          route.depth.value,
          placement,
        )
      : [];

  void portsById;
  void componentsById;
  return {
    id: route.id,
    connectionId: route.connectionId,
    layerId: route.layerId,
    physicalReady,
    points,
    segments,
    jointBoxes,
    ...(route.width ? { width: route.width.value } : {}),
    ...(route.depth ? { depth: route.depth.value } : {}),
  };
}

function safeRoutePolyline(
  project: Project,
  route: PhysicalRoute,
  warnings: SceneWarning[],
  path: string,
): Point2D[] {
  try {
    return deriveFullRoutePolyline(project, route);
  } catch {
    warnings.push({
      code: "invalid-route-reference",
      message: "Route endpoints could not be derived",
      entityId: route.id,
      path,
    });
    return route.waypoints.map(toPoint);
  }
}

function rectangularRouteSegments(
  route: PhysicalRoute,
  points: readonly Point3D[],
  width: number,
  depth: number,
  placement: CavityPlacement,
): SceneRouteSegmentGeometry[] {
  const segments: SceneRouteSegmentGeometry[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length === 0) {
      continue;
    }
    segments.push({
      id: `${route.id}:segment:${index}`,
      routeId: route.id,
      connectionId: route.connectionId,
      layerId: route.layerId,
      center: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        z: placement.zCenter,
      },
      length,
      width,
      depth,
      angle: Math.atan2(deltaY, deltaX),
      zTop: placement.zTop,
      zBottom: placement.zBottom,
    });
  }
  return segments;
}

function rectangularRouteJoints(
  route: PhysicalRoute,
  points: readonly Point3D[],
  width: number,
  depth: number,
  placement: CavityPlacement,
): SceneRouteSegmentGeometry[] {
  return points.slice(1, -1).map((point, index) => ({
    id: `${route.id}:joint:${index}`,
    routeId: route.id,
    connectionId: route.connectionId,
    layerId: route.layerId,
    center: { x: point.x, y: point.y, z: placement.zCenter },
    length: width,
    width,
    depth,
    angle: 0,
    zTop: placement.zTop,
    zBottom: placement.zBottom,
  }));
}

interface CavityPlacement {
  zTop: number;
  zBottom: number;
  zCenter: number;
}

function cavityPlacement(
  layer: SceneLayerGeometry,
  depth: number,
  warnings: SceneWarning[],
  context: { entityId: string; path: string },
): CavityPlacement | null {
  if (depth <= 0) {
    warnings.push({
      code: "depth-not-positive",
      message: "Cavity depth must be positive",
      entityId: context.entityId,
      path: context.path,
    });
    return null;
  }
  if (depth > layer.thickness) {
    warnings.push({
      code: "depth-exceeds-layer-thickness",
      message: "Cavity depth exceeds owning layer thickness",
      entityId: context.entityId,
      path: context.path,
    });
    return null;
  }
  const zTop = layer.zMax;
  const zBottom = layer.zMax - depth;
  return {
    zTop,
    zBottom,
    zCenter: zTop - depth / 2,
  };
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
