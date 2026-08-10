import type {
  Component,
  Connection,
  Layer,
  PhysicalRoute,
  Port,
  Project,
} from "project-model";
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

export interface PhysicalPortFrame {
  position: PhysicalPortPosition;
  outward: Point2D;
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

export interface CenterlineLine {
  kind: "line";
  start: Point2D;
  end: Point2D;
  length: number;
}

export interface CenterlineArc {
  kind: "arc";
  center: Point2D;
  radius: number;
  startAngle: number;
  sweepAngle: number;
  clockwise: boolean;
  start: Point2D;
  end: Point2D;
  length: number;
}

export type CenterlinePrimitive = CenterlineLine | CenterlineArc;

export interface RouteEnvelope {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RouteGeometryIssue {
  code: string;
  message: string;
  entityId?: string;
  path?: string;
}

export interface GeneratedRouteGeometry {
  routeId: string;
  connectionId: string;
  layerId: string;
  patternKind: PhysicalRoute["pattern"]["kind"];
  entryTailPrimitives: CenterlinePrimitive[];
  corePrimitives: CenterlinePrimitive[];
  exitTailPrimitives: CenterlinePrimitive[];
  primitives: CenterlinePrimitive[];
  points: Point2D[];
  entryTailLength: number;
  coreLength: number;
  exitTailLength: number;
  actualLength: number;
  generatedTurnCount?: number;
  coreCenter?: Point2D;
  coreEnvelope: RouteEnvelope | null;
  envelope: RouteEnvelope | null;
  physicalReady: boolean;
  issues: RouteGeometryIssue[];
  width?: number;
  depth?: number;
  bendRadius?: number;
  solvedAmplitude?: number;
  targetLength?: number;
  targetDifference?: number;
}

export interface RouteBodyIssue {
  code: string;
  message: string;
}

export interface RouteBodyBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RouteBody2D {
  boundary: Point2D[];
  leftBoundary: Point2D[];
  rightBoundary: Point2D[];
  sampledCenterline: Point2D[];
  bounds: RouteBodyBounds | null;
  area: number;
  width: number;
  issues: RouteBodyIssue[];
}

export interface RouteInterfaceExtension {
  endpoint: "source" | "target";
  componentId: string;
  portId: string;
  portPosition: Point2D;
  insidePosition: Point2D;
  outward: Point2D;
  inward: Point2D;
  penetration: number;
  footprint: Point2D[];
}

export interface RouteInterfaceExtensions {
  source?: RouteInterfaceExtension;
  target?: RouteInterfaceExtension;
  issues: RouteBodyIssue[];
}

export interface SceneWarning {
  code: string;
  message: string;
  entityId?: string;
  entityType?: "chip" | "component" | "port" | "physical-route";
  connectionId?: string;
  sourceLabel?: string;
  targetLabel?: string;
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

export interface SceneRouteBodyGeometry {
  routeId: string;
  connectionId: string;
  layerId: string;
  boundary: Point2D[];
  bounds: RouteBodyBounds;
  area: number;
  width: number;
  depth: number;
  zTop: number;
  zBottom: number;
}

export interface SceneRouteGeometry {
  id: string;
  connectionId: string;
  layerId: string;
  physicalReady: boolean;
  points: Point3D[];
  centerline: CenterlinePrimitive[];
  actualLength: number;
  envelope: RouteEnvelope | null;
  issues: RouteGeometryIssue[];
  segments: SceneRouteSegmentGeometry[];
  jointBoxes: SceneRouteSegmentGeometry[];
  body?: SceneRouteBodyGeometry;
  width?: number;
  depth?: number;
  solvedAmplitude?: number;
  targetLength?: number;
  targetDifference?: number;
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

export function minimumSerpentineBendRadius(width: number): number {
  assertFinite(width, "Route width");
  return width / 2 + serpentineTolerance(width);
}

export function minimumSerpentinePitch(
  widthOrBendRadius: number,
  bendRadius?: number,
): number {
  if (bendRadius === undefined) {
    assertFinite(widthOrBendRadius, "Bend radius");
    return widthOrBendRadius * 2;
  }
  assertFinite(widthOrBendRadius, "Route width");
  assertFinite(bendRadius, "Bend radius");
  return Math.max(
    bendRadius * 2,
    widthOrBendRadius + serpentineTolerance(widthOrBendRadius),
  );
}

export function isSerpentinePitchFeasible(
  pitch: number,
  bendRadius: number,
  width?: number,
): boolean {
  assertFinite(pitch, "Pitch");
  return (
    pitch >=
    minimumSerpentinePitch(width ?? 0, bendRadius) - serpentineTolerance(bendRadius)
  );
}

export function recommendedSerpentineBendRadius(width?: number): number {
  return Math.max(
    0.3,
    width && Number.isFinite(width) && width > 0 ? width * 0.6 : 0.3,
  );
}

export function recommendedSerpentinePitch(
  width: number | undefined,
  bendRadius: number,
): number {
  return Math.max(
    0.75,
    minimumSerpentinePitch(width ?? 0, bendRadius),
    (width ?? 0) + 0.2,
  );
}

export interface CompactSerpentineDraftResult {
  status: "fit" | "infeasible" | "not-serpentine" | "requires-explicit-amplitude";
  bendRadius?: number;
  pitch?: number;
  message?: string;
}

export function compactSerpentineRouteDraft(
  project: Project,
  route: PhysicalRoute,
): CompactSerpentineDraftResult {
  if (route.pattern.kind !== "serpentine") {
    return { status: "not-serpentine" };
  }
  if (route.pattern.sizing.mode !== "explicit") {
    return {
      status: "requires-explicit-amplitude",
      message: "Compact to fit requires explicit amplitude in this phase.",
    };
  }
  const width = route.width?.value;
  const currentRadius = route.bendRadius?.value;
  if (!width || !currentRadius) {
    return {
      status: "infeasible",
      message: "Route width and bend radius are required before compact fitting.",
    };
  }
  const endpoints = deriveRouteEndpoints(project, route, []);
  if (!endpoints) {
    return { status: "infeasible", message: "Route endpoints could not be derived." };
  }
  const axis = resolveSerpentineAxis(
    route.pattern.axis,
    endpoints.source.position,
    endpoints.target.position,
  );
  const axisDelta =
    axis === "horizontal"
      ? endpoints.target.position.x - endpoints.source.position.x
      : endpoints.target.position.y - endpoints.source.position.y;
  const axisSign = Math.sign(axisDelta) || 1;
  const u = axis === "horizontal" ? { x: axisSign, y: 0 } : { x: 0, y: axisSign };
  const v = { x: -u.y, y: u.x };
  const minimumRadius = minimumSerpentineBendRadius(width);
  const currentPitch = route.pattern.pitch.value;
  const minimumPitchFor = (radius: number) => minimumSerpentinePitch(width, radius);
  const currentCore = deriveSerpentineCoreShape({
    turnCount: route.pattern.turnCount,
    pitch: currentPitch,
    bendRadius: currentRadius,
    amplitude: route.pattern.sizing.amplitude.value,
    routeWidth: width,
    u,
    v,
    laneSide: 1,
  });
  const currentFits =
    currentCore.issues.length === 0 &&
    (route.pattern.placement.mode === "auto"
      ? coreFitsInsideChip(project, currentCore, width)
      : manualCoreInsideChip(
          project,
          currentCore,
          toPoint(route.pattern.placement.coreCenter),
        ));
  const radiusValues = descendingCandidates(currentRadius, minimumRadius, 36).filter(
    (value) =>
      currentFits || value < currentRadius - serpentineTolerance(currentRadius),
  );
  for (const radius of radiusValues) {
    const pitchValues = descendingCandidates(
      currentPitch,
      minimumPitchFor(radius),
      36,
    ).filter(
      (value) =>
        currentFits || value < currentPitch - serpentineTolerance(currentPitch),
    );
    for (const pitch of pitchValues) {
      const core = deriveSerpentineCoreShape({
        turnCount: route.pattern.turnCount,
        pitch,
        bendRadius: radius,
        amplitude: route.pattern.sizing.amplitude.value,
        routeWidth: width,
        u,
        v,
        laneSide: 1,
      });
      if (core.issues.length > 0) {
        continue;
      }
      const manualCore =
        route.pattern.placement.mode === "manual"
          ? translateSerpentineCoreToCenter(
              core,
              toPoint(route.pattern.placement.coreCenter),
            )
          : null;
      const fits =
        manualCore?.envelope !== undefined && manualCore?.envelope !== null
          ? envelopeInsideChip(project, manualCore.envelope)
          : route.pattern.placement.mode === "auto" &&
            coreFitsInsideChip(project, core, width);
      if (fits) {
        return {
          status: "fit",
          bendRadius: roundMm(radius),
          pitch: roundMm(Math.max(pitch, minimumPitchFor(radius))),
        };
      }
    }
  }
  return {
    status: "infeasible",
    message:
      "Configured number of turns cannot fit in available space. Move the core/components, reduce amplitude, or reduce turn count.",
  };
}

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

export const ROUTE_BODY_CHORD_ERROR_MM = 0.01;
const ROUTE_BODY_MAX_ARC_SEGMENTS = 512;

export function deriveRouteBody2D(
  primitives: readonly CenterlinePrimitive[],
  width: number,
  options?: { chordError?: number },
): RouteBody2D {
  const issues: RouteBodyIssue[] = [];
  const chordError = options?.chordError ?? ROUTE_BODY_CHORD_ERROR_MM;
  if (!Number.isFinite(width) || width <= 0) {
    issues.push(routeBodyIssue("invalid-width", "Route body width must be positive"));
  }
  if (!Number.isFinite(chordError) || chordError <= 0) {
    issues.push(
      routeBodyIssue("invalid-chord-error", "Route body chord error must be positive"),
    );
  }
  if (primitives.length === 0) {
    issues.push(routeBodyIssue("missing-primitives", "Route body requires primitives"));
  }
  if (!bodyPrimitivesFinite(primitives)) {
    issues.push(
      routeBodyIssue("non-finite-primitives", "Route body primitives must be finite"),
    );
  }
  if (!pointsContinuous(primitives)) {
    issues.push(
      routeBodyIssue(
        "body-continuity-invalid",
        "Route body primitives are not continuous",
      ),
    );
  }
  for (const primitive of primitives) {
    if (primitive.kind === "arc" && width > 0 && primitive.radius <= width / 2) {
      issues.push(
        routeBodyIssue(
          "arc-radius-too-small",
          "Route body width cannot be represented around a bend",
        ),
      );
    }
  }
  const samples =
    issues.length === 0
      ? sampleRouteBodyCenterline(primitives, chordError)
      : ([] as RouteBodySample[]);
  if (samples.length < 2 && primitives.length > 0) {
    issues.push(routeBodyIssue("insufficient-samples", "Route body needs two samples"));
  }

  const halfWidth = width / 2;
  const leftBoundary = samples.map((sample) =>
    addPoint(sample.point, scalePoint(leftNormal(sample.tangent), halfWidth)),
  );
  const rightBoundary = samples.map((sample) =>
    addPoint(sample.point, scalePoint(leftNormal(sample.tangent), -halfWidth)),
  );
  let boundary = removeConsecutiveDuplicatePoints([
    ...leftBoundary,
    ...[...rightBoundary].reverse(),
  ]);
  if (boundary.length > 0 && signedPolygonArea(boundary) < 0) {
    boundary = [...boundary].reverse();
  }
  const area = Math.abs(signedPolygonArea(boundary));
  if (boundary.length > 0 && area <= 1e-9) {
    issues.push(
      routeBodyIssue("non-positive-area", "Route body area must be positive"),
    );
  }
  if (centerlineSamplesSelfIntersect(samples)) {
    issues.push(
      routeBodyIssue("self-intersecting-body", "Route body boundary intersects itself"),
    );
  }
  return {
    boundary,
    leftBoundary,
    rightBoundary,
    sampledCenterline: samples.map((sample) => sample.point),
    bounds: boundaryBounds(boundary),
    area,
    width,
    issues,
  };
}

export function deriveRouteInterfaceExtensions(
  project: Project,
  route: PhysicalRoute,
  routeWidth: number,
  tolerance = 1e-6,
): RouteInterfaceExtensions {
  const issues: RouteBodyIssue[] = [];
  if (!Number.isFinite(routeWidth) || routeWidth <= 0) {
    return {
      issues: [
        routeBodyIssue(
          "invalid-interface-route-width",
          "Route interface penetration requires a positive route width",
        ),
      ],
    };
  }
  const connection = project.connections.find(
    (candidate) => candidate.id === route.connectionId,
  );
  if (!connection) {
    return {
      issues: [
        routeBodyIssue(
          "route-interface-reference-missing",
          "Route interface references a missing connection",
        ),
      ],
    };
  }
  const portsById = new Map(project.ports.map((port) => [port.id, port]));
  const componentsById = new Map(
    project.components.map((component) => [component.id, component]),
  );
  const source = deriveEndpointInterfaceExtension({
    project,
    endpoint: "source",
    component: componentsById.get(
      portsById.get(connection.sourcePortId)?.componentId ?? "",
    ),
    port: portsById.get(connection.sourcePortId),
    routeWidth,
    tolerance,
    issues,
  });
  const target = deriveEndpointInterfaceExtension({
    project,
    endpoint: "target",
    component: componentsById.get(
      portsById.get(connection.targetPortId)?.componentId ?? "",
    ),
    port: portsById.get(connection.targetPortId),
    routeWidth,
    tolerance,
    issues,
  });
  return {
    ...(source ? { source } : {}),
    ...(target ? { target } : {}),
    issues,
  };
}

export function deriveRouteBodyPrimitivesWithInterfaces(
  project: Project,
  route: PhysicalRoute,
  primitives: readonly CenterlinePrimitive[],
  routeWidth: number,
  tolerance = 1e-6,
): { primitives: CenterlinePrimitive[]; interfaces: RouteInterfaceExtensions } {
  const interfaces = deriveRouteInterfaceExtensions(
    project,
    route,
    routeWidth,
    tolerance,
  );
  const nextPrimitives = [...primitives];
  if (interfaces.source && nextPrimitives[0]) {
    const first = nextPrimitives[0];
    if (
      distance(interfaces.source.insidePosition, interfaces.source.portPosition) >
        tolerance &&
      distance(first.start, interfaces.source.portPosition) <= 1e-6
    ) {
      nextPrimitives.unshift(
        linePrimitive(interfaces.source.insidePosition, interfaces.source.portPosition),
      );
    }
  }
  if (interfaces.target && nextPrimitives.at(-1)) {
    const last = nextPrimitives.at(-1)!;
    if (
      distance(interfaces.target.portPosition, interfaces.target.insidePosition) >
        tolerance &&
      distance(last.end, interfaces.target.portPosition) <= 1e-6
    ) {
      nextPrimitives.push(
        linePrimitive(interfaces.target.portPosition, interfaces.target.insidePosition),
      );
    }
  }
  return { primitives: nextPrimitives, interfaces };
}

export function polygonIntersectionArea(
  subject: readonly Point2D[],
  clipPolygon: readonly Point2D[],
): number {
  if (subject.length < 3 || clipPolygon.length < 3) {
    return 0;
  }
  const orientation = signedPolygonArea(clipPolygon) >= 0 ? 1 : -1;
  let output = [...subject];
  for (let index = 0; index < clipPolygon.length; index += 1) {
    const clipStart = clipPolygon[index]!;
    const clipEnd = clipPolygon[(index + 1) % clipPolygon.length]!;
    const input = output;
    output = [];
    if (input.length === 0) {
      break;
    }
    let previous = input[input.length - 1]!;
    for (const current of input) {
      const currentInside = isInsideClipEdge(current, clipStart, clipEnd, orientation);
      const previousInside = isInsideClipEdge(
        previous,
        clipStart,
        clipEnd,
        orientation,
      );
      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, clipStart, clipEnd));
        }
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }
      previous = current;
    }
  }
  return Math.abs(signedPolygonArea(removeConsecutiveDuplicatePoints(output)));
}

export function isPointInsidePolygon(
  point: Point2D,
  polygon: readonly Point2D[],
  tolerance = 1e-9,
): boolean {
  if (polygon.length < 3) {
    return false;
  }
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    if (pointSegmentDistance(point, linePrimitive(start, end)) <= tolerance) {
      return true;
    }
  }
  let inside = false;
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]!;
    const previous = polygon[previousIndex]!;
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) +
          current.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function deriveEndpointInterfaceExtension(input: {
  project: Project;
  endpoint: "source" | "target";
  component: Component | undefined;
  port: Port | undefined;
  routeWidth: number;
  tolerance: number;
  issues: RouteBodyIssue[];
}): RouteInterfaceExtension | undefined {
  if (!input.port || !input.component) {
    input.issues.push(
      routeBodyIssue(
        `${input.endpoint}-interface-reference-missing`,
        `${input.endpoint} interface endpoint could not be resolved`,
      ),
    );
    return undefined;
  }
  const footprint = deriveComponentFootprint(input.component);
  if (!footprint) {
    input.issues.push(
      routeBodyIssue(
        `${input.endpoint}-interface-cavity-unsupported`,
        `${input.endpoint} component does not expose supported physical cavity geometry`,
      ),
    );
    return undefined;
  }
  const frame = getPhysicalPortFrame(input.project, input.component, input.port);
  const inward = scalePoint(frame.outward, -1);
  const footprintPolygon = getRotatedFootprintCorners(input.component, footprint);
  const penetration = derivePortInterfacePenetration(
    footprintPolygon,
    frame.position,
    inward,
    input.routeWidth,
    input.tolerance,
  );
  if (penetration <= input.tolerance) {
    input.issues.push(
      routeBodyIssue(
        `${input.endpoint}-interface-overlap-missing`,
        `${input.endpoint} channel interface cannot penetrate the connected physical cavity`,
      ),
    );
    return undefined;
  }
  return {
    endpoint: input.endpoint,
    componentId: input.component.id,
    portId: input.port.id,
    portPosition: frame.position,
    insidePosition: addPoint(frame.position, scalePoint(inward, penetration)),
    outward: frame.outward,
    inward,
    penetration,
    footprint: footprintPolygon,
  };
}

export function derivePortInterfacePenetration(
  footprintPolygon: readonly Point2D[],
  portPosition: Point2D,
  inward: Point2D,
  routeWidth: number,
  tolerance = 1e-6,
): number {
  const direction = normalize(inward);
  if (!direction || !Number.isFinite(routeWidth) || routeWidth <= 0) {
    return 0;
  }
  const available = rayPolygonExitDistance(
    portPosition,
    direction,
    footprintPolygon,
    tolerance,
  );
  if (available <= tolerance) {
    return 0;
  }
  return Math.min(routeWidth, Math.max(0, available - tolerance));
}

function rayPolygonExitDistance(
  origin: Point2D,
  direction: Point2D,
  polygon: readonly Point2D[],
  tolerance: number,
): number {
  const distances: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) <= tolerance) {
      continue;
    }
    const relative = { x: start.x - origin.x, y: start.y - origin.y };
    const rayDistance = cross(relative, edge) / denominator;
    const edgeDistance = cross(relative, direction) / denominator;
    if (
      rayDistance > tolerance &&
      edgeDistance >= -tolerance &&
      edgeDistance <= 1 + tolerance
    ) {
      distances.push(rayDistance);
    }
  }
  return distances.length > 0 ? Math.min(...distances) : 0;
}

function validateRouteBodyInterfaces(
  project: Project,
  route: PhysicalRoute,
  body: RouteBody2D,
  placement: CavityPlacement | null,
  portsById: Map<string, Port>,
  componentsById: Map<string, Component>,
  layersById: Map<string, SceneLayerGeometry>,
): RouteBodyIssue[] {
  const issues: RouteBodyIssue[] = [];
  const connection = project.connections.find(
    (candidate) => candidate.id === route.connectionId,
  );
  if (!connection || !placement) {
    return issues;
  }
  for (const endpoint of [
    { kind: "source" as const, portId: connection.sourcePortId },
    { kind: "target" as const, portId: connection.targetPortId },
  ]) {
    const port = portsById.get(endpoint.portId);
    const component = port ? componentsById.get(port.componentId) : undefined;
    const footprint = component ? deriveComponentFootprint(component) : null;
    const layer = component ? layersById.get(component.layerId) : null;
    if (!component || !footprint || !layer || footprint.depth === undefined) {
      issues.push(
        routeBodyIssue(
          `${endpoint.kind}-interface-cavity-unsupported`,
          `${endpoint.kind} component does not expose supported physical cavity geometry`,
        ),
      );
      continue;
    }
    const footprintCad = getRotatedFootprintCorners(component, footprint).map(
      (point) => {
        const cad = toCadPoint(project, point, component.layerId);
        return { x: cad.x, y: cad.y };
      },
    );
    const planarOverlap = polygonIntersectionArea(body.boundary, footprintCad);
    if (planarOverlap <= 1e-9) {
      issues.push(
        routeBodyIssue(
          `${endpoint.kind}-interface-overlap-missing`,
          `${endpoint.kind} channel body does not overlap the connected physical cavity`,
        ),
      );
    }
    const componentPlacement = cavityPlacement(layer, footprint.depth, [], {
      entityId: component.id,
      path: component.id,
    });
    const zOverlap =
      componentPlacement === null
        ? 0
        : Math.min(placement.zTop, componentPlacement.zTop) -
          Math.max(placement.zBottom, componentPlacement.zBottom);
    if (zOverlap <= 1e-9) {
      issues.push(
        routeBodyIssue(
          `${endpoint.kind}-interface-z-overlap-missing`,
          `${endpoint.kind} channel body does not overlap the connected cavity depth`,
        ),
      );
    }
  }
  return issues;
}

function isInsideClipEdge(
  point: Point2D,
  start: Point2D,
  end: Point2D,
  orientation: number,
): boolean {
  return (
    orientation *
      cross(
        { x: end.x - start.x, y: end.y - start.y },
        {
          x: point.x - start.x,
          y: point.y - start.y,
        },
      ) >=
    -1e-9
  );
}

function lineIntersection(
  start: Point2D,
  end: Point2D,
  clipStart: Point2D,
  clipEnd: Point2D,
): Point2D {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const clip = { x: clipEnd.x - clipStart.x, y: clipEnd.y - clipStart.y };
  const denominator = cross(segment, clip);
  if (Math.abs(denominator) <= 1e-12) {
    return end;
  }
  const relative = { x: clipStart.x - start.x, y: clipStart.y - start.y };
  const distanceAlongSegment = cross(relative, clip) / denominator;
  return addPoint(start, scalePoint(segment, distanceAlongSegment));
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
  return getPhysicalPortFrame(project, component, port).position;
}

export function getPhysicalPortFrame(
  project: Project,
  component: Component,
  port: Port,
): PhysicalPortFrame {
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
  const outward = rotateVector(anchorOutwardNormal(anchor), component.rotation.value);
  return {
    position: {
      ...rotatePoint(localPoint, center, component.rotation.value),
      layerId: component.layerId,
    },
    outward,
  };
}

export function deriveFullRoutePolyline(
  project: Project,
  route: PhysicalRoute,
): Point2D[] {
  return deriveRouteGeometry(project, route).points;
}

export interface RoutePointSample {
  point: Point2D;
  tangent: Point2D;
  distance: number;
  totalLength: number;
  primitiveIndex: number;
}

export function deriveRoutePointAtFraction(
  primitives: readonly CenterlinePrimitive[],
  fraction: number,
): RoutePointSample | null {
  const lengths = primitives.map(primitiveLength);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return null;
  }
  const targetDistance = clamp(fraction, 0, 1) * totalLength;
  let walked = 0;
  for (let index = 0; index < primitives.length; index += 1) {
    const primitive = primitives[index]!;
    const length = lengths[index]!;
    if (length <= 0) {
      continue;
    }
    if (walked + length >= targetDistance || index === primitives.length - 1) {
      return samplePrimitiveAtDistance(
        primitive,
        clamp(targetDistance - walked, 0, length),
        length,
        targetDistance,
        totalLength,
        index,
      );
    }
    walked += length;
  }
  return null;
}

export function deriveRouteGeometry(
  project: Project,
  route: PhysicalRoute,
): GeneratedRouteGeometry {
  const issues: RouteGeometryIssue[] = [];
  const endpoints = deriveRouteEndpoints(project, route, issues);
  const width = route.width?.value;
  const depth = route.depth?.value;
  const bendRadius = route.bendRadius?.value;
  if (width !== undefined && width <= 0) {
    issues.push(routeIssue("route-width-not-positive", "Route width must be positive"));
  }
  if (depth !== undefined && depth <= 0) {
    issues.push(routeIssue("route-depth-not-positive", "Route depth must be positive"));
  }
  if (bendRadius !== undefined) {
    if (bendRadius <= 0) {
      issues.push(
        routeIssue("bend-radius-not-positive", "Bend radius must be positive"),
      );
    }
    if (width !== undefined && bendRadius < minimumSerpentineBendRadius(width)) {
      issues.push(
        routeIssue(
          "bend-radius-too-small",
          `Bend radius must be greater than half the route width; minimum geometric radius is ${formatMm(
            minimumSerpentineBendRadius(width),
          )}.`,
        ),
      );
    }
  }

  const generated = endpoints
    ? generatePatternCenterline(project, route, endpoints, issues)
    : emptyGeneratedPattern();
  const envelope = envelopeForPrimitives(generated.primitives);
  const coreEnvelope = envelopeForPrimitives(generated.corePrimitives);
  if (envelope && !envelopeInsideChip(project, envelope)) {
    issues.push(
      routeIssue(
        "route-envelope-outside-chip",
        "Generated route envelope is outside chip",
      ),
    );
  }
  if (
    route.pattern.kind !== "serpentine" &&
    hasObviousSelfOverlap(generated.primitives, width ?? 0)
  ) {
    issues.push(
      routeIssue("route-self-overlap", "Generated route has obvious self-overlap"),
    );
  }
  if (!pointsContinuous(generated.primitives)) {
    issues.push(
      routeIssue(
        "route-continuity-invalid",
        "Generated route primitives are not continuous",
      ),
    );
  }
  const actualLength = sumPrimitiveLengths(generated.primitives);
  const entryTailLength = sumPrimitiveLengths(generated.entryTailPrimitives);
  const coreLength = sumPrimitiveLengths(generated.corePrimitives);
  const exitTailLength = sumPrimitiveLengths(generated.exitTailPrimitives);
  const physicalReady =
    Boolean(width && depth && generated.primitives.length > 0) && issues.length === 0;
  return {
    routeId: route.id,
    connectionId: route.connectionId,
    layerId: route.layerId,
    patternKind: route.pattern.kind,
    entryTailPrimitives: generated.entryTailPrimitives,
    corePrimitives: generated.corePrimitives,
    exitTailPrimitives: generated.exitTailPrimitives,
    primitives: generated.primitives,
    points: generated.points,
    entryTailLength,
    coreLength,
    exitTailLength,
    actualLength,
    ...("generatedTurnCount" in generated && generated.generatedTurnCount !== undefined
      ? { generatedTurnCount: generated.generatedTurnCount }
      : {}),
    ...("coreCenter" in generated && generated.coreCenter !== undefined
      ? { coreCenter: generated.coreCenter }
      : {}),
    coreEnvelope,
    envelope,
    physicalReady,
    issues,
    ...(width !== undefined ? { width } : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(bendRadius !== undefined ? { bendRadius } : {}),
    ...("solvedAmplitude" in generated && generated.solvedAmplitude !== undefined
      ? { solvedAmplitude: generated.solvedAmplitude }
      : {}),
    ...("targetLength" in generated && generated.targetLength !== undefined
      ? { targetLength: generated.targetLength }
      : {}),
    ...("targetDifference" in generated && generated.targetDifference !== undefined
      ? { targetDifference: generated.targetDifference }
      : {}),
  };
}

function deriveRouteEndpoints(
  project: Project,
  route: PhysicalRoute,
  issues: RouteGeometryIssue[],
): { source: PhysicalPortFrame; target: PhysicalPortFrame } | null {
  const connection = project.connections.find((item) => item.id === route.connectionId);
  if (!connection) {
    issues.push(
      routeIssue("invalid-route-reference", "Route references a missing connection"),
    );
    return null;
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
    issues.push(
      routeIssue("invalid-route-reference", "Route endpoints could not be derived"),
    );
    return null;
  }
  const sourceFrame = safePhysicalPortFrame(
    project,
    sourceComponent,
    sourcePort,
    issues,
    "source",
  );
  const targetFrame = safePhysicalPortFrame(
    project,
    targetComponent,
    targetPort,
    issues,
    "target",
  );
  return sourceFrame && targetFrame
    ? {
        source: sourceFrame,
        target: targetFrame,
      }
    : null;
}

function safePhysicalPortFrame(
  project: Project,
  component: Component,
  port: Port,
  issues: RouteGeometryIssue[],
  endpoint: "source" | "target",
): PhysicalPortFrame | null {
  try {
    return getPhysicalPortFrame(project, component, port);
  } catch (error) {
    issues.push(
      routeIssue(
        "route-endpoint-geometry-unavailable",
        `${endpoint} endpoint physical geometry is unavailable: ${
          error instanceof Error ? error.message : "unknown endpoint error"
        }`,
      ),
    );
    return null;
  }
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
    if (route.depth && route.depth.value > layer.thickness.value) {
      issues.push({
        code: "route-depth-exceeds-layer",
        message: "Route depth must not exceed its layer thickness",
        path: `physicalRoutes.${index}.depth`,
        entityId: route.id,
      });
    }
    const generated = deriveRouteGeometry(project, route);
    for (const issue of generated.issues) {
      issues.push({
        code: issue.code,
        message: issue.message,
        path: issue.path ?? `physicalRoutes.${index}.pattern`,
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
  const warningContext = routeWarningContext(project, route, portsById, componentsById);
  let generated: GeneratedRouteGeometry;
  try {
    generated = deriveRouteGeometry(project, route);
  } catch (error) {
    generated = {
      routeId: route.id,
      connectionId: route.connectionId,
      layerId: route.layerId,
      patternKind: route.pattern.kind,
      entryTailPrimitives: [],
      corePrimitives: [],
      exitTailPrimitives: [],
      primitives: [],
      points: [],
      entryTailLength: 0,
      coreLength: 0,
      exitTailLength: 0,
      actualLength: 0,
      coreEnvelope: null,
      envelope: null,
      physicalReady: false,
      issues: [
        {
          code: "route-geometry-unavailable",
          message:
            error instanceof Error
              ? error.message
              : "Route geometry could not be derived",
        },
      ],
    };
  }
  const points2d = generated.points;
  const points = points2d.map((point) => {
    const cad = layer
      ? toCadPoint(project, point, route.layerId)
      : { x: point.x, y: point.y, z: 0 };
    return { ...cad, z: layer?.zMax ?? 0 };
  });

  if (!project.connections.some((connection) => connection.id === route.connectionId)) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        "invalid-route-reference",
        "Route references a missing connection",
        `${routePath}.connectionId`,
      ),
    );
  }
  if (!layer) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        "invalid-route-reference",
        "Route references a missing layer",
        `${routePath}.layerId`,
      ),
    );
  }
  if (!route.width) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        "missing-route-width",
        "Route width is missing; rendering an incomplete guide",
        `${routePath}.width`,
      ),
    );
  }
  if (!route.depth) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        "missing-route-depth",
        "Route depth is missing; rendering an incomplete guide",
        `${routePath}.depth`,
      ),
    );
  }
  if (!route.width || !route.depth) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        "incomplete-route",
        "Route is not CAD-ready and is shown as a guide only",
        routePath,
      ),
    );
  }
  for (const issue of generated.issues) {
    warnings.push(
      routeSceneWarning(
        route,
        warningContext,
        issue.code,
        issue.message,
        issue.path ?? routePath,
      ),
    );
  }

  const placement =
    layer && route.depth
      ? cavityPlacement(layer, route.depth.value, warnings, {
          entityId: route.id,
          path: `${routePath}.depth`,
        })
      : null;
  const basePhysicalReady = Boolean(
    route.width && route.depth && layer && placement && generated.physicalReady,
  );
  const bodyCandidate =
    basePhysicalReady && route.width && route.depth && layer && placement
      ? deriveRouteBody2D(
          deriveRouteBodyPrimitivesWithInterfaces(
            project,
            route,
            generated.primitives,
            route.width.value,
          ).primitives.map((primitive) =>
            primitiveToCadPrimitive(project, primitive, route.layerId),
          ),
          route.width.value,
        )
      : null;
  const interfaceExtensions =
    basePhysicalReady && route.width
      ? deriveRouteInterfaceExtensions(project, route, route.width.value)
      : null;
  if (interfaceExtensions) {
    for (const issue of interfaceExtensions.issues) {
      warnings.push(
        routeSceneWarning(route, warningContext, issue.code, issue.message, routePath),
      );
    }
  }
  if (bodyCandidate) {
    for (const issue of bodyCandidate.issues) {
      warnings.push(
        routeSceneWarning(route, warningContext, issue.code, issue.message, routePath),
      );
    }
  }
  const interfaceIssues =
    bodyCandidate && bodyCandidate.issues.length === 0 && bodyCandidate.bounds
      ? validateRouteBodyInterfaces(
          project,
          route,
          bodyCandidate,
          placement,
          portsById,
          componentsById,
          layersById,
        )
      : [];
  for (const issue of interfaceIssues) {
    warnings.push(
      routeSceneWarning(route, warningContext, issue.code, issue.message, routePath),
    );
  }
  const body =
    bodyCandidate &&
    bodyCandidate.issues.length === 0 &&
    interfaceIssues.length === 0 &&
    bodyCandidate.bounds &&
    route.width &&
    route.depth &&
    placement
      ? {
          routeId: route.id,
          connectionId: route.connectionId,
          layerId: route.layerId,
          boundary: bodyCandidate.boundary,
          bounds: bodyCandidate.bounds,
          area: bodyCandidate.area,
          width: route.width.value,
          depth: route.depth.value,
          zTop: placement.zTop,
          zBottom: placement.zBottom,
        }
      : undefined;
  const physicalReady = Boolean(basePhysicalReady && body);

  return {
    id: route.id,
    connectionId: route.connectionId,
    layerId: route.layerId,
    physicalReady,
    points,
    centerline: generated.primitives,
    actualLength: generated.actualLength,
    envelope: generated.envelope,
    issues: generated.issues,
    segments: [],
    jointBoxes: [],
    ...(body ? { body } : {}),
    ...(route.width ? { width: route.width.value } : {}),
    ...(route.depth ? { depth: route.depth.value } : {}),
    ...(generated.solvedAmplitude !== undefined
      ? { solvedAmplitude: generated.solvedAmplitude }
      : {}),
    ...(generated.targetLength !== undefined
      ? { targetLength: generated.targetLength }
      : {}),
    ...(generated.targetDifference !== undefined
      ? { targetDifference: generated.targetDifference }
      : {}),
  };
}

interface RouteWarningContext {
  connection: Connection | null;
  sourceLabel?: string;
  targetLabel?: string;
}

function routeWarningContext(
  project: Project,
  route: PhysicalRoute,
  portsById: Map<string, Port>,
  componentsById: Map<string, Component>,
): RouteWarningContext {
  const projectConnection =
    project.connections.find((connection) => connection.id === route.connectionId) ??
    null;
  if (!projectConnection) {
    return { connection: null };
  }
  return {
    connection: projectConnection,
    sourceLabel: portEndpointLabel(
      projectConnection.sourcePortId,
      portsById,
      componentsById,
    ),
    targetLabel: portEndpointLabel(
      projectConnection.targetPortId,
      portsById,
      componentsById,
    ),
  };
}

function routeSceneWarning(
  route: PhysicalRoute,
  context: RouteWarningContext,
  code: string,
  message: string,
  path: string,
): SceneWarning {
  const prefix =
    context.sourceLabel && context.targetLabel
      ? `${context.sourceLabel} -> ${context.targetLabel}: `
      : "";
  return {
    code,
    message: `${prefix}${message}`,
    entityId: route.id,
    entityType: "physical-route",
    connectionId: route.connectionId,
    ...(context.sourceLabel ? { sourceLabel: context.sourceLabel } : {}),
    ...(context.targetLabel ? { targetLabel: context.targetLabel } : {}),
    path,
  };
}

function primitiveToCadPrimitive(
  project: Project,
  primitive: CenterlinePrimitive,
  layerId: string,
): CenterlinePrimitive {
  const cadPoint = (point: Point2D): Point2D => {
    const cad = toCadPoint(project, point, layerId);
    return { x: cad.x, y: cad.y };
  };
  if (primitive.kind === "line") {
    return linePrimitive(cadPoint(primitive.start), cadPoint(primitive.end));
  }
  return arcPrimitive(
    cadPoint(primitive.center),
    primitive.radius,
    cadPoint(primitive.start),
    cadPoint(primitive.end),
    !primitive.clockwise,
  );
}

function portEndpointLabel(
  portId: string,
  portsById: Map<string, Port>,
  componentsById: Map<string, Component>,
): string | undefined {
  const port = portsById.get(portId);
  const component = port ? componentsById.get(port.componentId) : null;
  if (!port || !component) {
    return undefined;
  }
  return `${component.name} / ${port.name}`;
}

function generatePatternCenterline(
  project: Project,
  route: PhysicalRoute,
  endpoints: { source: PhysicalPortFrame; target: PhysicalPortFrame },
  issues: RouteGeometryIssue[],
): GeneratedPatternCenterline {
  if (route.pattern.kind === "straight") {
    const points = [endpoints.source.position, endpoints.target.position];
    return completeGeneratedPattern(
      points,
      primitivesFromPolyline(points, undefined, issues),
    );
  }
  if (route.pattern.kind === "manual") {
    const points = [
      endpoints.source.position,
      ...route.pattern.waypoints.map(toPoint),
      endpoints.target.position,
    ];
    return completeGeneratedPattern(
      points,
      primitivesFromPolyline(points, route.bendRadius?.value, issues),
    );
  }
  return generateSerpentine(project, route, endpoints, issues);
}

interface GeneratedPatternCenterline {
  entryTailPrimitives: CenterlinePrimitive[];
  corePrimitives: CenterlinePrimitive[];
  exitTailPrimitives: CenterlinePrimitive[];
  primitives: CenterlinePrimitive[];
  points: Point2D[];
  generatedTurnCount?: number;
  coreCenter?: Point2D;
  solvedAmplitude?: number;
  targetLength?: number;
  targetDifference?: number;
}

function emptyGeneratedPattern(): GeneratedPatternCenterline {
  return {
    entryTailPrimitives: [],
    corePrimitives: [],
    exitTailPrimitives: [],
    primitives: [],
    points: [],
  };
}

function completeGeneratedPattern(
  fallbackPoints: readonly Point2D[],
  generated: { primitives: CenterlinePrimitive[]; points: Point2D[] },
): GeneratedPatternCenterline {
  return {
    entryTailPrimitives: [],
    corePrimitives: generated.primitives,
    exitTailPrimitives: [],
    primitives: generated.primitives,
    points:
      generated.points.length > 0
        ? generated.points
        : removeDuplicatePoints([...fallbackPoints]),
  };
}

function primitivePoints(primitives: readonly CenterlinePrimitive[]): Point2D[] {
  if (primitives.length === 0) {
    return [];
  }
  return removeDuplicatePoints([
    primitives[0]!.start,
    ...primitives.map((primitive) => primitive.end),
  ]);
}

function combinedPrimitivePoints(
  primitives: readonly CenterlinePrimitive[],
  fallback: readonly Point2D[],
): Point2D[] {
  const points = primitivePoints(primitives);
  return points.length > 0 ? points : removeDuplicatePoints([...fallback]);
}

function generateSerpentine(
  project: Project,
  route: PhysicalRoute,
  endpoints: { source: PhysicalPortFrame; target: PhysicalPortFrame },
  issues: RouteGeometryIssue[],
): GeneratedPatternCenterline {
  if (route.pattern.kind !== "serpentine") {
    return emptyGeneratedPattern();
  }
  const pattern = route.pattern;
  const pitch = pattern.pitch.value;
  const bendRadius = route.bendRadius?.value;
  const width = route.width?.value;
  if (!Number.isInteger(pattern.turnCount) || pattern.turnCount <= 0) {
    issues.push(
      routeIssue("turn-count-invalid", "Turn count must be a positive integer"),
    );
  }
  if (pitch <= 0) {
    issues.push(routeIssue("pitch-not-positive", "Serpentine pitch must be positive"));
  }
  if (!bendRadius) {
    issues.push(
      routeIssue("bend-radius-required", "Serpentine routes require bend radius"),
    );
  } else if (!isSerpentinePitchFeasible(pitch, bendRadius, width)) {
    issues.push(
      routeIssue(
        "serpentine-u-turn-infeasible",
        `U-turn infeasible: Pitch ${formatMm(pitch)} is smaller than required ${formatMm(
          minimumSerpentinePitch(width ?? 0, bendRadius),
        )} for a ${formatMm(bendRadius)} bend radius${
          width !== undefined ? ` and ${formatMm(width)} route width` : ""
        }.`,
      ),
    );
  }
  if (width !== undefined && pitch <= width + serpentineTolerance(width)) {
    issues.push(
      routeIssue(
        "serpentine-channel-overlap",
        "Serpentine pitch must be greater than route width to avoid adjacent channel overlap",
      ),
    );
  }
  const axis = resolveSerpentineAxis(
    pattern.axis,
    endpoints.source.position,
    endpoints.target.position,
  );
  let amplitude =
    pattern.sizing.mode === "explicit" ? pattern.sizing.amplitude.value : undefined;
  const targetLength =
    pattern.sizing.mode === "target-length"
      ? pattern.sizing.targetLength.value
      : undefined;
  if (amplitude !== undefined && amplitude <= 0) {
    issues.push(
      routeIssue("amplitude-not-positive", "Serpentine amplitude must be positive"),
    );
  }
  if (targetLength !== undefined && targetLength <= 0) {
    issues.push(
      routeIssue("target-length-not-positive", "Target length must be positive"),
    );
  }
  if (issues.length > 0 || !bendRadius || pitch <= 0) {
    return {
      ...emptyGeneratedPattern(),
      ...(targetLength !== undefined ? { targetLength } : {}),
    };
  }
  if (targetLength !== undefined) {
    const solved = solveSerpentineAmplitude(
      project,
      route,
      endpoints,
      axis,
      pattern.turnCount,
      pitch,
      bendRadius,
      pattern.entranceLength?.value ?? 0,
      pattern.exitLength?.value ?? 0,
      targetLength,
      issues,
    );
    if (solved === null) {
      return { ...emptyGeneratedPattern(), targetLength };
    }
    amplitude = solved;
  }
  if (amplitude === undefined) {
    return {
      ...emptyGeneratedPattern(),
      ...(targetLength !== undefined ? { targetLength } : {}),
    };
  }
  const generated = adaptiveSerpentinePrimitives(
    project,
    route,
    endpoints,
    axis,
    pattern.turnCount,
    pitch,
    bendRadius,
    amplitude,
    pattern.entranceLength?.value ?? 0,
    pattern.exitLength?.value ?? 0,
    issues,
  );
  const actualLength = sumPrimitiveLengths(generated.primitives);
  const targetDifference =
    targetLength === undefined ? undefined : actualLength - targetLength;
  if (
    generated.generatedTurnCount !== undefined &&
    generated.generatedTurnCount !== pattern.turnCount
  ) {
    issues.push(
      routeIssue(
        "serpentine-turn-count-mismatch",
        `Generated ${generated.generatedTurnCount} serpentine turns but ${pattern.turnCount} were requested.`,
      ),
    );
  }
  if (
    targetLength !== undefined &&
    Math.abs(targetDifference ?? 0) > Math.max(0.001, targetLength * 0.0001)
  ) {
    issues.push(
      routeIssue(
        "target-length-tolerance-exceeded",
        "Solved serpentine length does not match target tolerance",
      ),
    );
  }
  return {
    ...generated,
    ...(targetLength !== undefined ? { targetLength } : {}),
    ...(targetDifference !== undefined ? { targetDifference } : {}),
    ...(pattern.sizing.mode === "target-length" ? { solvedAmplitude: amplitude } : {}),
  };
}

function solveSerpentineAmplitude(
  project: Project,
  route: PhysicalRoute,
  endpoints: { source: PhysicalPortFrame; target: PhysicalPortFrame },
  axis: "horizontal" | "vertical",
  turnCount: number,
  pitch: number,
  bendRadius: number,
  minimumEntryLength: number,
  minimumExitLength: number,
  targetLength: number,
  issues: RouteGeometryIssue[],
): number | null {
  const straight = distance(endpoints.source.position, endpoints.target.position);
  if (targetLength < straight) {
    issues.push(
      routeIssue("target-length-infeasible", "Target length is shorter than endpoints"),
    );
    return null;
  }
  const axisDelta =
    axis === "horizontal"
      ? endpoints.target.position.x - endpoints.source.position.x
      : endpoints.target.position.y - endpoints.source.position.y;
  const axisSign = Math.sign(axisDelta) || 1;
  const u = axis === "horizontal" ? { x: axisSign, y: 0 } : { x: 0, y: axisSign };
  const longitudinal = dot(
    {
      x: endpoints.target.position.x - endpoints.source.position.x,
      y: endpoints.target.position.y - endpoints.source.position.y,
    },
    u,
  );
  const highBound = longitudinal - minimumEntryLength - minimumExitLength;
  if (highBound <= 0) {
    issues.push(
      routeIssue(
        "serpentine-corridor-too-short",
        "Serpentine corridor is too short for target-length solving",
      ),
    );
    return null;
  }
  let low = 0.001;
  let high = highBound;
  const lengthFor = (amplitude: number): number => {
    const localIssues: RouteGeometryIssue[] = [];
    return sumPrimitiveLengths(
      adaptiveSerpentinePrimitives(
        project,
        route,
        endpoints,
        axis,
        turnCount,
        pitch,
        bendRadius,
        amplitude,
        minimumEntryLength,
        minimumExitLength,
        localIssues,
      ).primitives,
    );
  };
  for (let index = 0; index < 32 && lengthFor(high) <= 0; index += 1) {
    high *= 0.9;
  }
  if (lengthFor(high) < targetLength) {
    issues.push(
      routeIssue("target-length-infeasible", "Target length cannot be reached"),
    );
    return null;
  }
  for (let index = 0; index < 64; index += 1) {
    const middle = (low + high) / 2;
    const middleLength = lengthFor(middle);
    if (middleLength <= 0) {
      high = middle;
    } else if (middleLength < targetLength) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

function adaptiveSerpentinePrimitives(
  project: Project,
  route: PhysicalRoute,
  endpoints: { source: PhysicalPortFrame; target: PhysicalPortFrame },
  axis: "horizontal" | "vertical",
  turnCount: number,
  pitch: number,
  bendRadius: number,
  amplitude: number,
  minimumEntryLength: number,
  minimumExitLength: number,
  issues: RouteGeometryIssue[],
): GeneratedPatternCenterline {
  const source = endpoints.source.position;
  const target = endpoints.target.position;
  const axisDelta = axis === "horizontal" ? target.x - source.x : target.y - source.y;
  const axisSign = Math.sign(axisDelta) || 1;
  const u = axis === "horizontal" ? { x: axisSign, y: 0 } : { x: 0, y: axisSign };
  const v = { x: -u.y, y: u.x };
  const laneSide = 1 as const;
  const core = deriveSerpentineCoreShape({
    turnCount,
    pitch,
    bendRadius,
    amplitude,
    routeWidth: route.width?.value,
    u,
    v,
    laneSide,
  });
  if (core.issues.length > 0) {
    issues.push(...core.issues);
    return emptyGeneratedPattern();
  }
  const solution = solveAdaptiveSerpentineRoute({
    project,
    endpoints,
    core,
    bendRadius,
    routeWidth: route.width?.value ?? 0,
    minimumEntryLength,
    minimumExitLength,
    manualCoreCenter:
      route.pattern.kind === "serpentine" && route.pattern.placement.mode === "manual"
        ? toPoint(route.pattern.placement.coreCenter)
        : undefined,
    manualPlacement:
      route.pattern.kind === "serpentine" && route.pattern.placement.mode === "manual",
  });
  if (!solution) {
    if (
      route.pattern.kind === "serpentine" &&
      route.pattern.placement.mode === "manual"
    ) {
      const manualCore = translateSerpentineCoreToCenter(
        core,
        toPoint(route.pattern.placement.coreCenter),
      );
      issues.push(
        routeIssue(
          manualCore.envelope && envelopeInsideChip(project, manualCore.envelope)
            ? "serpentine-manual-core-infeasible"
            : "serpentine-core-outside-chip",
          manualCore.envelope && envelopeInsideChip(project, manualCore.envelope)
            ? "Manual serpentine core placement cannot connect to the current source and target ports without moving the core."
            : "Manual serpentine core placement is outside the chip.",
        ),
      );
      return emptyGeneratedPattern();
    }
    if (!coreFitsInsideChip(project, core, route.width?.value ?? 0)) {
      issues.push(
        routeIssue(
          "serpentine-core-does-not-fit",
          "Configured serpentine core does not fit inside the chip at the available geometric limits.",
        ),
      );
      return emptyGeneratedPattern();
    }
    issues.push(
      routeIssue(
        "serpentine-entry-tail-infeasible",
        "Entry tail infeasible: no exact-radius oriented route could connect the source port to the serpentine core across the deterministic core-placement candidates.",
      ),
      routeIssue(
        "serpentine-exit-tail-infeasible",
        "Exit tail infeasible: no exact-radius oriented route could connect the serpentine core to the target port across the deterministic core-placement candidates.",
      ),
    );
    return emptyGeneratedPattern();
  }
  return solution;
}

export interface SerpentineCoreInput {
  turnCount: number;
  pitch: number;
  bendRadius: number;
  amplitude: number;
  routeWidth?: number;
  u: Point2D;
  v: Point2D;
  laneSide: 1 | -1;
}

export interface SerpentineCore {
  primitives: CenterlinePrimitive[];
  entry: Point2D;
  entryTangent: Point2D;
  exit: Point2D;
  exitTangent: Point2D;
  envelope: RouteEnvelope | null;
  coreLength: number;
  generatedTurnCount: number;
  issues: RouteGeometryIssue[];
}

export function deriveSerpentineCoreShape(input: SerpentineCoreInput): SerpentineCore {
  const issues: RouteGeometryIssue[] = [];
  if (input.amplitude <= 0) {
    issues.push(
      routeIssue("amplitude-not-positive", "Serpentine amplitude must be positive"),
    );
  }
  if (!isSerpentinePitchFeasible(input.pitch, input.bendRadius, input.routeWidth)) {
    issues.push(
      routeIssue(
        "serpentine-u-turn-infeasible",
        `U-turn infeasible: Pitch ${formatMm(
          input.pitch,
        )} is smaller than required ${formatMm(
          minimumSerpentinePitch(input.routeWidth ?? 0, input.bendRadius),
        )} for a ${formatMm(input.bendRadius)} bend radius.`,
      ),
    );
  }
  if (issues.length > 0) {
    return {
      primitives: [],
      entry: { x: 0, y: 0 },
      entryTangent: input.u,
      exit: { x: 0, y: 0 },
      exitTangent: input.u,
      envelope: null,
      coreLength: 0,
      generatedTurnCount: 0,
      issues,
    };
  }
  const primitives: CenterlinePrimitive[] = [];
  let current = { x: 0, y: 0 };
  let currentY = 0;
  let direction: 1 | -1 = 1;
  for (let run = 0; run <= input.turnCount; run += 1) {
    const runEnd = {
      x: direction > 0 ? input.amplitude : 0,
      y: currentY,
    };
    pushLine(primitives, current, runEnd);
    current = runEnd;
    if (run === input.turnCount) {
      break;
    }
    const nextY = currentY + input.laneSide * input.pitch;
    const uTurn = localCompositeUTurn(current, nextY, direction, input.bendRadius);
    primitives.push(...uTurn);
    current = uTurn[uTurn.length - 1]!.end;
    currentY = nextY;
    direction = direction > 0 ? -1 : 1;
  }
  const worldPrimitives = orientPrimitives(primitives, input.u, input.v);
  return {
    primitives: worldPrimitives,
    entry: worldPoint({ x: 0, y: 0 }, input.u, input.v),
    entryTangent: input.u,
    exit: worldPrimitives.at(-1)?.end ?? worldPoint(current, input.u, input.v),
    exitTangent: direction > 0 ? input.u : { x: -input.u.x, y: -input.u.y },
    envelope: envelopeForPrimitives(worldPrimitives),
    coreLength: sumPrimitiveLengths(worldPrimitives),
    generatedTurnCount: input.turnCount,
    issues,
  };
}

interface AdaptiveSerpentineRouteInput {
  project: Project;
  endpoints: { source: PhysicalPortFrame; target: PhysicalPortFrame };
  core: SerpentineCore;
  bendRadius: number;
  routeWidth: number;
  minimumEntryLength: number;
  minimumExitLength: number;
  manualCoreCenter?: Point2D;
  manualPlacement?: boolean;
}

interface AdaptiveSerpentineSolution extends GeneratedPatternCenterline {
  coreCenter: Point2D;
  tailBends: number;
}

function solveAdaptiveSerpentineRoute(
  input: AdaptiveSerpentineRouteInput,
): GeneratedPatternCenterline | null {
  const region = deriveCorePlacementRegion(input.project, input.core, input.routeWidth);
  if (!region && !input.manualCoreCenter) {
    return null;
  }
  const preferredCenter = midpoint(
    input.endpoints.source.position,
    input.endpoints.target.position,
  );
  const candidates = input.manualCoreCenter
    ? [input.manualCoreCenter]
    : deriveCorePlacementCandidates(region!, preferredCenter);
  const solutions: AdaptiveSerpentineSolution[] = [];
  for (const coreCenter of candidates) {
    if (
      !input.manualPlacement &&
      region &&
      (coreCenter.x < region.minX ||
        coreCenter.x > region.maxX ||
        coreCenter.y < region.minY ||
        coreCenter.y > region.maxY)
    ) {
      continue;
    }
    const translated = translateSerpentineCore(input.core, {
      x: coreCenter.x - coreEnvelopeCenter(input.core).x,
      y: coreCenter.y - coreEnvelopeCenter(input.core).y,
    });
    const entryTail = solveOrientedTail({
      start: input.endpoints.source.position,
      startTangent: input.endpoints.source.outward,
      end: translated.entry,
      endTangent: translated.entryTangent,
      minimumLength: input.minimumEntryLength,
      bendRadius: input.bendRadius,
    });
    if (!entryTail) {
      continue;
    }
    const exitTail = solveOrientedTail({
      start: translated.exit,
      startTangent: translated.exitTangent,
      end: input.endpoints.target.position,
      endTangent: {
        x: -input.endpoints.target.outward.x,
        y: -input.endpoints.target.outward.y,
      },
      minimumLength: input.minimumExitLength,
      bendRadius: input.bendRadius,
    });
    if (!exitTail) {
      continue;
    }
    const primitives = [
      ...entryTail.primitives,
      ...translated.primitives,
      ...exitTail.primitives,
    ].filter((primitive) => primitive.length > 0);
    if (
      !validateCombinedSerpentineRoute({
        project: input.project,
        primitives,
        entryTailPrimitives: entryTail.primitives,
        corePrimitives: translated.primitives,
        exitTailPrimitives: exitTail.primitives,
        source: input.endpoints.source.position,
        target: input.endpoints.target.position,
        bendRadius: input.bendRadius,
        routeWidth: input.routeWidth,
      })
    ) {
      continue;
    }
    solutions.push({
      entryTailPrimitives: entryTail.primitives,
      corePrimitives: translated.primitives,
      exitTailPrimitives: exitTail.primitives,
      primitives,
      points: combinedPrimitivePoints(primitives, [
        input.endpoints.source.position,
        input.endpoints.target.position,
      ]),
      generatedTurnCount: translated.generatedTurnCount,
      coreCenter,
      tailBends: entryTail.bends + exitTail.bends,
    });
  }
  return (
    solutions.sort((left, right) =>
      compareSerpentineSolutions(left, right, preferredCenter),
    )[0] ?? null
  );
}

function deriveCorePlacementRegion(
  project: Project,
  core: SerpentineCore,
  routeWidth: number,
): (RouteEnvelope & { coreCenter: Point2D }) | null {
  if (!core.envelope) {
    return null;
  }
  const clearance = Math.max(routeWidth / 2, 0) + 1e-6;
  const chipWidth = project.chip.overallDimensions.width.value;
  const chipHeight = project.chip.overallDimensions.height.value;
  const coreCenter = {
    x: (core.envelope.minX + core.envelope.maxX) / 2,
    y: (core.envelope.minY + core.envelope.maxY) / 2,
  };
  const minX = clearance + (core.envelope.maxX - core.envelope.minX) / 2;
  const maxX = chipWidth - clearance - (core.envelope.maxX - core.envelope.minX) / 2;
  const minY = clearance + (core.envelope.maxY - core.envelope.minY) / 2;
  const maxY = chipHeight - clearance - (core.envelope.maxY - core.envelope.minY) / 2;
  return minX <= maxX && minY <= maxY ? { minX, maxX, minY, maxY, coreCenter } : null;
}

function coreFitsInsideChip(
  project: Project,
  core: SerpentineCore,
  routeWidth: number,
): boolean {
  return Boolean(deriveCorePlacementRegion(project, core, routeWidth));
}

function coreEnvelopeCenter(core: SerpentineCore): Point2D {
  if (!core.envelope) {
    return { x: 0, y: 0 };
  }
  return {
    x: (core.envelope.minX + core.envelope.maxX) / 2,
    y: (core.envelope.minY + core.envelope.maxY) / 2,
  };
}

function translateSerpentineCoreToCenter(
  core: SerpentineCore,
  coreCenter: Point2D,
): SerpentineCore {
  const currentCenter = coreEnvelopeCenter(core);
  return translateSerpentineCore(core, {
    x: coreCenter.x - currentCenter.x,
    y: coreCenter.y - currentCenter.y,
  });
}

function manualCoreInsideChip(
  project: Project,
  core: SerpentineCore,
  coreCenter: Point2D,
): boolean {
  const translated = translateSerpentineCoreToCenter(core, coreCenter);
  return translated.envelope ? envelopeInsideChip(project, translated.envelope) : false;
}

function deriveCorePlacementCandidates(
  region: RouteEnvelope,
  preferredCenter: Point2D,
): Point2D[] {
  const xValues = uniqueNumbers([
    clamp(preferredCenter.x, region.minX, region.maxX),
    (region.minX + region.maxX) / 2,
    region.minX,
    region.maxX,
    region.minX + (region.maxX - region.minX) * 0.25,
    region.minX + (region.maxX - region.minX) * 0.75,
  ]);
  const yValues = uniqueNumbers([
    clamp(preferredCenter.y, region.minY, region.maxY),
    (region.minY + region.maxY) / 2,
    region.minY,
    region.maxY,
    region.minY + (region.maxY - region.minY) * 0.25,
    region.minY + (region.maxY - region.minY) * 0.75,
  ]);
  const candidates = xValues.flatMap((x) => yValues.map((y) => ({ x, y })));
  return uniquePoints(candidates).sort((left, right) => {
    const preferredDelta =
      distance(left, preferredCenter) - distance(right, preferredCenter);
    return Math.abs(preferredDelta) > 1e-9
      ? preferredDelta
      : left.x - right.x || left.y - right.y;
  });
}

function translateSerpentineCore(
  core: SerpentineCore,
  translation: Point2D,
): SerpentineCore {
  const primitives = translatePrimitives(core.primitives, translation);
  return {
    ...core,
    primitives,
    entry: addPoint(core.entry, translation),
    exit: addPoint(core.exit, translation),
    envelope: envelopeForPrimitives(primitives),
  };
}

interface OrientedTailSolution {
  primitives: CenterlinePrimitive[];
  bends: number;
  topology: string;
}

function solveOrientedTail(input: TailCandidateInput): OrientedTailSolution | null {
  return (
    tailCandidates(input)
      .map((candidate) => {
        const primitives = roundedTailCandidate(candidate.points, input.bendRadius);
        return primitives
          ? {
              primitives,
              bends: countPolylineTurns(candidate.points),
              topology: candidate.topology,
            }
          : null;
      })
      .filter((candidate): candidate is OrientedTailSolution => Boolean(candidate))
      .sort(
        (left, right) =>
          left.bends - right.bends ||
          sumPrimitiveLengths(left.primitives) -
            sumPrimitiveLengths(right.primitives) ||
          left.topology.localeCompare(right.topology),
      )[0] ?? null
  );
}

function validateCombinedSerpentineRoute(input: {
  project: Project;
  primitives: CenterlinePrimitive[];
  entryTailPrimitives: CenterlinePrimitive[];
  corePrimitives: CenterlinePrimitive[];
  exitTailPrimitives: CenterlinePrimitive[];
  source: Point2D;
  target: Point2D;
  bendRadius: number;
  routeWidth: number;
}): boolean {
  const envelope = envelopeForPrimitives(input.primitives);
  return Boolean(
    input.entryTailPrimitives.length > 0 &&
    input.corePrimitives.length > 0 &&
    input.exitTailPrimitives.length > 0 &&
    endpointsAnchored(input.primitives, input.source, input.target) &&
    pointsContinuous(input.primitives) &&
    primitivesTangentContinuous(input.primitives) &&
    input.primitives.every(
      (primitive) =>
        primitive.kind !== "arc" ||
        Math.abs(primitive.radius - input.bendRadius) <=
          serpentineTolerance(input.bendRadius),
    ) &&
    envelope &&
    envelopeInsideChip(input.project, envelope),
  );
}

function compareSerpentineSolutions(
  left: AdaptiveSerpentineSolution,
  right: AdaptiveSerpentineSolution,
  preferredCenter: Point2D,
): number {
  return (
    left.tailBends - right.tailBends ||
    sumPrimitiveLengths(left.entryTailPrimitives) +
      sumPrimitiveLengths(left.exitTailPrimitives) -
      (sumPrimitiveLengths(right.entryTailPrimitives) +
        sumPrimitiveLengths(right.exitTailPrimitives)) ||
    distance(left.coreCenter, preferredCenter) -
      distance(right.coreCenter, preferredCenter) ||
    sumPrimitiveLengths(left.primitives) - sumPrimitiveLengths(right.primitives) ||
    left.coreCenter.x - right.coreCenter.x ||
    left.coreCenter.y - right.coreCenter.y
  );
}

function localCompositeUTurn(
  start: Point2D,
  endY: number,
  direction: 1 | -1,
  radius: number,
): CenterlinePrimitive[] {
  const side = Math.sign(endY - start.y) as 1 | -1;
  const firstCenter = { x: start.x, y: start.y + side * radius };
  const firstEnd = {
    x: start.x + direction * radius,
    y: start.y + side * radius,
  };
  const middleEnd = {
    x: start.x + direction * radius,
    y: endY - side * radius,
  };
  const secondCenter = { x: start.x, y: endY - side * radius };
  const end = { x: start.x, y: endY };
  const clockwise = direction !== side;
  const firstArc = arcPrimitive(firstCenter, radius, start, firstEnd, clockwise);
  const secondArc = arcPrimitive(secondCenter, radius, middleEnd, end, clockwise);
  return [firstArc, linePrimitive(firstEnd, middleEnd), secondArc].filter(
    (primitive) => primitive.length > 0,
  );
}

interface TailCandidateInput {
  start: Point2D;
  startTangent: Point2D;
  end: Point2D;
  endTangent: Point2D;
  minimumLength: number;
  bendRadius: number;
}

function tailCandidates(
  input: TailCandidateInput,
): { points: Point2D[]; topology: string }[] {
  const startTangent = normalize(input.startTangent);
  const endTangent = normalize(input.endTangent);
  if (!startTangent || !endTangent) {
    return [];
  }
  const stubLength = Math.max(input.bendRadius + 1e-6, 1e-6);
  const stubStart = addPoint(input.start, scalePoint(startTangent, stubLength));
  const stubEnd = addPoint(input.end, scalePoint(endTangent, -stubLength));
  const connectorCandidates = rectilinearConnectorCandidates({
    start: stubStart,
    end: stubEnd,
    bendRadius: input.bendRadius,
  });
  return [
    straightTailCandidate(input),
    lTailCandidate(input),
    zTailCandidate(input),
    ...connectorCandidates.map((candidate) => ({
      topology: candidate.topology,
      points: removeDuplicatePoints([
        input.start,
        stubStart,
        ...candidate.points.slice(1, -1),
        stubEnd,
        input.end,
      ]),
    })),
  ].filter((candidate): candidate is { points: Point2D[]; topology: string } =>
    Boolean(candidate),
  );
}

function straightTailCandidate(input: TailCandidateInput): {
  points: Point2D[];
  topology: string;
} | null {
  const delta = { x: input.end.x - input.start.x, y: input.end.y - input.start.y };
  const length = Math.hypot(delta.x, delta.y);
  const direction = normalize(delta);
  if (
    !direction ||
    length + 1e-9 < input.minimumLength ||
    dot(direction, input.startTangent) < 1 - 1e-6 ||
    dot(direction, input.endTangent) < 1 - 1e-6
  ) {
    return null;
  }
  return { points: [input.start, input.end], topology: "straight" };
}

function lTailCandidate(input: TailCandidateInput): {
  points: Point2D[];
  topology: string;
} | null {
  if (Math.abs(dot(input.startTangent, input.endTangent)) > 1e-6) {
    return null;
  }
  const intersection = rayIntersection(input.start, input.startTangent, input.end, {
    x: -input.endTangent.x,
    y: -input.endTangent.y,
  });
  if (
    !intersection ||
    intersection.left < input.bendRadius - 1e-9 ||
    intersection.right < input.bendRadius - 1e-9
  ) {
    return null;
  }
  const points = removeDuplicatePoints([input.start, intersection.point, input.end]);
  return pathLength(points) + 1e-9 >= input.minimumLength
    ? { points, topology: "L" }
    : null;
}

function zTailCandidate(input: TailCandidateInput): {
  points: Point2D[];
  topology: string;
} | null {
  if (Math.abs(Math.abs(dot(input.startTangent, input.endTangent)) - 1) > 1e-6) {
    return null;
  }
  if (Math.abs(input.startTangent.x) >= Math.abs(input.startTangent.y)) {
    const range = feasibleSharedCoordinateRange(
      input.start.x,
      input.startTangent.x,
      input.end.x,
      input.endTangent.x,
      input.bendRadius,
    );
    if (!range) {
      return null;
    }
    const x = clamp((input.start.x + input.end.x) / 2, range.min, range.max);
    const points = removeDuplicatePoints([
      input.start,
      { x, y: input.start.y },
      { x, y: input.end.y },
      input.end,
    ]);
    return pathLength(points) + 1e-9 >= input.minimumLength
      ? { points, topology: "Z" }
      : null;
  }
  const range = feasibleSharedCoordinateRange(
    input.start.y,
    input.startTangent.y,
    input.end.y,
    input.endTangent.y,
    input.bendRadius,
  );
  if (!range) {
    return null;
  }
  const y = clamp((input.start.y + input.end.y) / 2, range.min, range.max);
  const points = removeDuplicatePoints([
    input.start,
    { x: input.start.x, y },
    { x: input.end.x, y },
    input.end,
  ]);
  return pathLength(points) + 1e-9 >= input.minimumLength
    ? { points, topology: "Z" }
    : null;
}

function rectilinearConnectorCandidates(input: {
  start: Point2D;
  end: Point2D;
  bendRadius: number;
}): { points: Point2D[]; topology: string }[] {
  const midX = (input.start.x + input.end.x) / 2;
  const midY = (input.start.y + input.end.y) / 2;
  const xRails = uniqueNumbers([
    midX,
    input.start.x + input.bendRadius * 2,
    input.start.x - input.bendRadius * 2,
    input.end.x + input.bendRadius * 2,
    input.end.x - input.bendRadius * 2,
  ]);
  const yRails = uniqueNumbers([
    midY,
    input.start.y + input.bendRadius * 2,
    input.start.y - input.bendRadius * 2,
    input.end.y + input.bendRadius * 2,
    input.end.y - input.bendRadius * 2,
  ]);
  const candidates: { points: Point2D[]; topology: string }[] = [];
  candidates.push({
    topology: "direct",
    points: removeDuplicatePoints([input.start, input.end]),
  });
  candidates.push(
    {
      topology: "L-x",
      points: removeDuplicatePoints([
        input.start,
        { x: input.end.x, y: input.start.y },
        input.end,
      ]),
    },
    {
      topology: "L-y",
      points: removeDuplicatePoints([
        input.start,
        { x: input.start.x, y: input.end.y },
        input.end,
      ]),
    },
  );
  for (const x of xRails) {
    candidates.push({
      topology: "Z-x",
      points: removeDuplicatePoints([
        input.start,
        { x, y: input.start.y },
        { x, y: input.end.y },
        input.end,
      ]),
    });
  }
  for (const y of yRails) {
    candidates.push({
      topology: "Z-y",
      points: removeDuplicatePoints([
        input.start,
        { x: input.start.x, y },
        { x: input.end.x, y },
        input.end,
      ]),
    });
  }
  for (const x of xRails) {
    for (const y of yRails) {
      candidates.push(
        {
          topology: "dogleg-x",
          points: removeDuplicatePoints([
            input.start,
            { x, y: input.start.y },
            { x, y },
            { x: input.end.x, y },
            input.end,
          ]),
        },
        {
          topology: "dogleg-y",
          points: removeDuplicatePoints([
            input.start,
            { x: input.start.x, y },
            { x, y },
            { x, y: input.end.y },
            input.end,
          ]),
        },
      );
    }
  }
  return candidates.filter((candidate) => candidate.points.length >= 2);
}

function roundedTailCandidate(
  points: readonly Point2D[],
  bendRadius: number,
): CenterlinePrimitive[] | null {
  const localIssues: RouteGeometryIssue[] = [];
  const generated = primitivesFromPolyline(points, bendRadius, localIssues);
  if (
    generated.primitives.length === 0 ||
    localIssues.length > 0 ||
    !pointsContinuous(generated.primitives) ||
    !primitivesTangentContinuous(generated.primitives) ||
    generated.primitives.some(
      (primitive) =>
        primitive.kind === "arc" &&
        Math.abs(primitive.radius - bendRadius) > serpentineTolerance(bendRadius),
    )
  ) {
    return null;
  }
  const turnCount = countPolylineTurns(points);
  const arcCount = generated.primitives.filter(
    (primitive) => primitive.kind === "arc",
  ).length;
  return arcCount === turnCount ? generated.primitives : null;
}

function feasibleSharedCoordinateRange(
  start: number,
  startDirection: number,
  end: number,
  endDirection: number,
  minimumTrim: number,
): { min: number; max: number } | null {
  let min = Number.NEGATIVE_INFINITY;
  let max = Number.POSITIVE_INFINITY;
  if (startDirection > 0) {
    min = Math.max(min, start + minimumTrim);
  } else {
    max = Math.min(max, start - minimumTrim);
  }
  if (endDirection > 0) {
    max = Math.min(max, end - minimumTrim);
  } else {
    min = Math.max(min, end + minimumTrim);
  }
  if (!Number.isFinite(min)) {
    min = Math.min(start, end) - minimumTrim * 2;
  }
  if (!Number.isFinite(max)) {
    max = Math.max(start, end) + minimumTrim * 2;
  }
  return min <= max + 1e-9 ? { min, max } : null;
}

function rayIntersection(
  leftOrigin: Point2D,
  leftDirection: Point2D,
  rightOrigin: Point2D,
  rightDirection: Point2D,
): { point: Point2D; left: number; right: number } | null {
  const denominator = cross(leftDirection, rightDirection);
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }
  const delta = {
    x: rightOrigin.x - leftOrigin.x,
    y: rightOrigin.y - leftOrigin.y,
  };
  const left = cross(delta, rightDirection) / denominator;
  const right = cross(delta, leftDirection) / denominator;
  if (left < -1e-9 || right < -1e-9) {
    return null;
  }
  return {
    point: {
      x: leftOrigin.x + leftDirection.x * left,
      y: leftOrigin.y + leftDirection.y * left,
    },
    left,
    right,
  };
}

function countPolylineTurns(points: readonly Point2D[]): number {
  let turns = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const incoming = normalize({
      x: points[index]!.x - points[index - 1]!.x,
      y: points[index]!.y - points[index - 1]!.y,
    });
    const outgoing = normalize({
      x: points[index + 1]!.x - points[index]!.x,
      y: points[index + 1]!.y - points[index]!.y,
    });
    if (incoming && outgoing && Math.abs(cross(incoming, outgoing)) > 1e-6) {
      turns += 1;
    }
  }
  return turns;
}

function primitivesTangentContinuous(
  primitives: readonly CenterlinePrimitive[],
): boolean {
  for (let index = 1; index < primitives.length; index += 1) {
    if (
      dot(
        primitiveEndTangent(primitives[index - 1]!),
        primitiveStartTangent(primitives[index]!),
      ) <
      1 - 1e-6
    ) {
      return false;
    }
  }
  return true;
}

function primitiveStartTangent(primitive: CenterlinePrimitive): Point2D {
  if (primitive.kind === "line") {
    return normalize({
      x: primitive.end.x - primitive.start.x,
      y: primitive.end.y - primitive.start.y,
    })!;
  }
  const radial = {
    x: Math.cos(primitive.startAngle),
    y: Math.sin(primitive.startAngle),
  };
  return primitive.clockwise
    ? { x: radial.y, y: -radial.x }
    : { x: -radial.y, y: radial.x };
}

function primitiveEndTangent(primitive: CenterlinePrimitive): Point2D {
  if (primitive.kind === "line") {
    return normalize({
      x: primitive.end.x - primitive.start.x,
      y: primitive.end.y - primitive.start.y,
    })!;
  }
  const endAngle = primitive.startAngle + primitive.sweepAngle;
  const radial = {
    x: Math.cos(endAngle),
    y: Math.sin(endAngle),
  };
  return primitive.clockwise
    ? { x: radial.y, y: -radial.x }
    : { x: -radial.y, y: radial.x };
}

function pathLength(points: readonly Point2D[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1]!, points[index]!);
  }
  return length;
}

function orientPrimitives(
  primitives: readonly CenterlinePrimitive[],
  u: Point2D,
  v: Point2D,
): CenterlinePrimitive[] {
  return primitives.map((primitive) => {
    if (primitive.kind === "line") {
      return linePrimitive(
        worldPoint(primitive.start, u, v),
        worldPoint(primitive.end, u, v),
      );
    }
    const center = worldPoint(primitive.center, u, v);
    const start = worldPoint(primitive.start, u, v);
    const end = worldPoint(primitive.end, u, v);
    return arcPrimitive(center, primitive.radius, start, end, primitive.clockwise);
  });
}

function translatePrimitives(
  primitives: readonly CenterlinePrimitive[],
  delta: Point2D,
): CenterlinePrimitive[] {
  return primitives.map((primitive) => {
    if (primitive.kind === "line") {
      return linePrimitive(
        addPoint(primitive.start, delta),
        addPoint(primitive.end, delta),
      );
    }
    return arcPrimitive(
      addPoint(primitive.center, delta),
      primitive.radius,
      addPoint(primitive.start, delta),
      addPoint(primitive.end, delta),
      primitive.clockwise,
    );
  });
}

function arcPrimitive(
  center: Point2D,
  radius: number,
  start: Point2D,
  end: Point2D,
  clockwise: boolean,
): CenterlineArc {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const sweepAngle = normalizeSweep(endAngle - startAngle, clockwise);
  return {
    kind: "arc",
    center,
    radius,
    startAngle,
    sweepAngle,
    clockwise,
    start,
    end,
    length: Math.abs(sweepAngle) * radius,
  };
}

function worldPoint(local: Point2D, u: Point2D, v: Point2D): Point2D {
  return {
    x: u.x * local.x + v.x * local.y,
    y: u.y * local.x + v.y * local.y,
  };
}

function addPoint(left: Point2D, right: Point2D): Point2D {
  return { x: left.x + right.x, y: left.y + right.y };
}

function scalePoint(point: Point2D, scale: number): Point2D {
  return { x: point.x * scale, y: point.y * scale };
}

function midpoint(left: Point2D, right: Point2D): Point2D {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function uniqueNumbers(values: readonly number[]): number[] {
  const output: number[] = [];
  for (const value of values) {
    if (
      Number.isFinite(value) &&
      !output.some((item) => Math.abs(item - value) < 1e-6)
    ) {
      output.push(value);
    }
  }
  return output;
}

function uniquePoints(points: readonly Point2D[]): Point2D[] {
  const output: Point2D[] = [];
  for (const point of points) {
    if (
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      !output.some((item) => distance(item, point) < 1e-6)
    ) {
      output.push(point);
    }
  }
  return output;
}

function pushLine(
  primitives: CenterlinePrimitive[],
  start: Point2D,
  end: Point2D,
): void {
  const line = linePrimitive(start, end);
  if (line.length > 0) {
    primitives.push(line);
  }
}

function endpointsAnchored(
  primitives: readonly CenterlinePrimitive[],
  source: Point2D,
  target: Point2D,
): boolean {
  if (primitives.length === 0) {
    return false;
  }
  return (
    distance(primitives[0]!.start, source) < 1e-6 &&
    distance(primitives[primitives.length - 1]!.end, target) < 1e-6
  );
}

function resolveSerpentineAxis(
  axis: "auto" | "horizontal" | "vertical",
  source: Point2D,
  target: Point2D,
): "horizontal" | "vertical" {
  if (axis !== "auto") {
    return axis;
  }
  return Math.abs(target.x - source.x) >= Math.abs(target.y - source.y)
    ? "horizontal"
    : "vertical";
}

function primitivesFromPolyline(
  rawPoints: readonly Point2D[],
  bendRadius: number | undefined,
  issues: RouteGeometryIssue[],
): { primitives: CenterlinePrimitive[]; points: Point2D[] } {
  const points = removeDuplicatePoints(rawPoints);
  if (!bendRadius) {
    return { points, primitives: linePrimitives(points) };
  }
  if (points.length < 3) {
    return { points, primitives: linePrimitives(points) };
  }
  const primitives: CenterlinePrimitive[] = [];
  let cursor = points[0]!;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const corner = points[index]!;
    const next = points[index + 1]!;
    const rounded = roundedCorner(previous, corner, next, bendRadius, issues);
    if (!rounded) {
      primitives.push(linePrimitive(cursor, corner));
      cursor = corner;
      continue;
    }
    primitives.push(linePrimitive(cursor, rounded.start));
    primitives.push(rounded);
    cursor = rounded.end;
  }
  primitives.push(linePrimitive(cursor, points[points.length - 1]!));
  return {
    points,
    primitives: primitives.filter((primitive) => primitive.length > 0),
  };
}

function roundedCorner(
  previous: Point2D,
  corner: Point2D,
  next: Point2D,
  radius: number,
  issues: RouteGeometryIssue[],
): CenterlineArc | null {
  const incoming = normalize({ x: corner.x - previous.x, y: corner.y - previous.y });
  const outgoing = normalize({ x: next.x - corner.x, y: next.y - corner.y });
  if (!incoming || !outgoing) {
    return null;
  }
  const turn = Math.acos(clamp(dot(incoming, outgoing), -1, 1));
  if (turn < 1e-6 || Math.abs(Math.PI - turn) < 1e-6) {
    return null;
  }
  const trim = radius * Math.tan(turn / 2);
  if (
    trim > distance(previous, corner) + 1e-9 ||
    trim > distance(corner, next) + 1e-9
  ) {
    issues.push(
      routeIssue(
        "bend-radius-infeasible",
        "Bend radius is too large for a route corner",
      ),
    );
    return null;
  }
  const start = {
    x: corner.x - incoming.x * trim,
    y: corner.y - incoming.y * trim,
  };
  const end = {
    x: corner.x + outgoing.x * trim,
    y: corner.y + outgoing.y * trim,
  };
  const bisector = normalize({
    x: -incoming.x + outgoing.x,
    y: -incoming.y + outgoing.y,
  });
  if (!bisector) {
    return null;
  }
  const centerDistance = radius / Math.sin(turn / 2);
  const center = {
    x: corner.x + bisector.x * centerDistance,
    y: corner.y + bisector.y * centerDistance,
  };
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const clockwise = cross(incoming, outgoing) < 0;
  const sweepAngle = normalizeSweep(endAngle - startAngle, clockwise);
  return {
    kind: "arc",
    center,
    radius,
    startAngle,
    sweepAngle,
    clockwise,
    start,
    end,
    length: Math.abs(sweepAngle) * radius,
  };
}

function linePrimitives(points: readonly Point2D[]): CenterlineLine[] {
  const lines: CenterlineLine[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const line = linePrimitive(points[index]!, points[index + 1]!);
    if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

function linePrimitive(start: Point2D, end: Point2D): CenterlineLine {
  return { kind: "line", start, end, length: distance(start, end) };
}

interface RouteBodySample {
  point: Point2D;
  tangent: Point2D;
}

function sampleRouteBodyCenterline(
  primitives: readonly CenterlinePrimitive[],
  chordError: number,
): RouteBodySample[] {
  const samples: RouteBodySample[] = [];
  for (const primitive of primitives) {
    const primitiveSamples =
      primitive.kind === "line"
        ? sampleLineForBody(primitive)
        : sampleArcForBody(primitive, chordError);
    for (const sample of primitiveSamples) {
      const previous = samples.at(-1);
      if (
        previous &&
        distance(previous.point, sample.point) < 1e-9 &&
        dot(previous.tangent, sample.tangent) > 1 - 1e-9
      ) {
        continue;
      }
      samples.push(sample);
    }
  }
  return samples;
}

function sampleLineForBody(line: CenterlineLine): RouteBodySample[] {
  const tangent = normalize({
    x: line.end.x - line.start.x,
    y: line.end.y - line.start.y,
  });
  if (!tangent) {
    return [];
  }
  return [
    { point: line.start, tangent },
    { point: line.end, tangent },
  ];
}

function sampleArcForBody(arc: CenterlineArc, chordError: number): RouteBodySample[] {
  const maxAngle = Math.max(
    1e-6,
    2 * Math.acos(clamp(1 - chordError / arc.radius, -1, 1)),
  );
  const steps = Math.min(
    ROUTE_BODY_MAX_ARC_SEGMENTS,
    Math.max(1, Math.ceil(Math.abs(arc.sweepAngle) / maxAngle)),
  );
  const samples: RouteBodySample[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = arc.startAngle + (arc.sweepAngle * index) / steps;
    const radial = { x: Math.cos(angle), y: Math.sin(angle) };
    samples.push({
      point: {
        x: arc.center.x + radial.x * arc.radius,
        y: arc.center.y + radial.y * arc.radius,
      },
      tangent: arc.clockwise
        ? { x: radial.y, y: -radial.x }
        : { x: -radial.y, y: radial.x },
    });
  }
  return samples;
}

function leftNormal(tangent: Point2D): Point2D {
  return { x: -tangent.y, y: tangent.x };
}

function routeBodyIssue(code: string, message: string): RouteBodyIssue {
  return { code, message };
}

function bodyPrimitivesFinite(primitives: readonly CenterlinePrimitive[]): boolean {
  return primitives.every((primitive) => {
    const common =
      pointFinite(primitive.start) &&
      pointFinite(primitive.end) &&
      Number.isFinite(primitive.length);
    if (primitive.kind === "line") {
      return common;
    }
    return (
      common &&
      pointFinite(primitive.center) &&
      Number.isFinite(primitive.radius) &&
      primitive.radius > 0 &&
      Number.isFinite(primitive.startAngle) &&
      Number.isFinite(primitive.sweepAngle)
    );
  });
}

function pointFinite(point: Point2D): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function removeConsecutiveDuplicatePoints(points: readonly Point2D[]): Point2D[] {
  const output: Point2D[] = [];
  for (const point of points) {
    if (output.length === 0 || distance(output[output.length - 1]!, point) > 1e-9) {
      output.push(point);
    }
  }
  if (output.length > 1 && distance(output[0]!, output[output.length - 1]!) < 1e-9) {
    output.pop();
  }
  return output;
}

function signedPolygonArea(points: readonly Point2D[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function boundaryBounds(points: readonly Point2D[]): RouteBodyBounds | null {
  if (points.length === 0) {
    return null;
  }
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: points[0]!.x,
      minY: points[0]!.y,
      maxX: points[0]!.x,
      maxY: points[0]!.y,
    },
  );
}

function centerlineSamplesSelfIntersect(samples: readonly RouteBodySample[]): boolean {
  if (samples.length < 4) {
    return false;
  }
  for (let left = 0; left < samples.length - 1; left += 1) {
    const leftLine = linePrimitive(samples[left]!.point, samples[left + 1]!.point);
    for (let right = left + 2; right < samples.length - 1; right += 1) {
      if (right === left + 1) {
        continue;
      }
      if (
        distance(leftLine.start, samples[right]!.point) < 1e-9 ||
        distance(leftLine.start, samples[right + 1]!.point) < 1e-9 ||
        distance(leftLine.end, samples[right]!.point) < 1e-9 ||
        distance(leftLine.end, samples[right + 1]!.point) < 1e-9
      ) {
        continue;
      }
      const rightLine = linePrimitive(samples[right]!.point, samples[right + 1]!.point);
      if (segmentsIntersect(leftLine, rightLine, 1e-9)) {
        return true;
      }
    }
  }
  return false;
}

function sumPrimitiveLengths(primitives: readonly CenterlinePrimitive[]): number {
  return primitives.reduce((sum, primitive) => sum + primitive.length, 0);
}

function primitiveLength(primitive: CenterlinePrimitive): number {
  if (Number.isFinite(primitive.length) && primitive.length > 0) {
    return primitive.length;
  }
  if (primitive.kind === "line") {
    return distance(primitive.start, primitive.end);
  }
  return Math.abs(primitive.sweepAngle) * primitive.radius;
}

function samplePrimitiveAtDistance(
  primitive: CenterlinePrimitive,
  localDistance: number,
  primitiveLengthValue: number,
  distanceAlongRoute: number,
  totalLength: number,
  primitiveIndex: number,
): RoutePointSample {
  if (primitive.kind === "line") {
    const ratio = primitiveLengthValue > 0 ? localDistance / primitiveLengthValue : 0;
    const vector = {
      x: primitive.end.x - primitive.start.x,
      y: primitive.end.y - primitive.start.y,
    };
    return {
      point: {
        x: primitive.start.x + vector.x * ratio,
        y: primitive.start.y + vector.y * ratio,
      },
      tangent: normalize(vector) ?? { x: 0, y: 0 },
      distance: distanceAlongRoute,
      totalLength,
      primitiveIndex,
    };
  }

  const ratio = primitiveLengthValue > 0 ? localDistance / primitiveLengthValue : 0;
  const angle = primitive.startAngle + primitive.sweepAngle * ratio;
  const sweepSign = primitive.sweepAngle < 0 ? -1 : 1;
  return {
    point: {
      x: primitive.center.x + Math.cos(angle) * primitive.radius,
      y: primitive.center.y + Math.sin(angle) * primitive.radius,
    },
    tangent: normalize({
      x: -Math.sin(angle) * sweepSign,
      y: Math.cos(angle) * sweepSign,
    }) ?? { x: 0, y: 0 },
    distance: distanceAlongRoute,
    totalLength,
    primitiveIndex,
  };
}

function removeDuplicatePoints(points: readonly Point2D[]): Point2D[] {
  return points.filter(
    (point, index) =>
      index === 0 || distance(point, points[index - 1]!) > Number.EPSILON,
  );
}

function envelopeForPrimitives(
  primitives: readonly CenterlinePrimitive[],
): RouteEnvelope | null {
  const points = primitives.flatMap((primitive) => primitiveSamplePoints(primitive));
  if (points.length === 0) {
    return null;
  }
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function primitiveSamplePoints(primitive: CenterlinePrimitive): Point2D[] {
  if (primitive.kind === "line") {
    return [primitive.start, primitive.end];
  }
  const points = [primitive.start, primitive.end];
  for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    if (angleOnArc(angle, primitive)) {
      points.push({
        x: primitive.center.x + Math.cos(angle) * primitive.radius,
        y: primitive.center.y + Math.sin(angle) * primitive.radius,
      });
    }
  }
  return points;
}

function envelopeInsideChip(project: Project, envelope: RouteEnvelope): boolean {
  return (
    envelope.minX >= 0 &&
    envelope.minY >= 0 &&
    envelope.maxX <= project.chip.overallDimensions.width.value &&
    envelope.maxY <= project.chip.overallDimensions.height.value
  );
}

function hasObviousSelfOverlap(
  primitives: readonly CenterlinePrimitive[],
  width: number,
): boolean {
  const lines = primitives.flatMap((primitive, primitiveIndex) =>
    sampledPrimitiveLines(primitive).map((line) => ({ ...line, primitiveIndex })),
  );
  const tolerance = Math.max(width, 1e-6);
  for (let left = 0; left < lines.length; left += 1) {
    for (let right = left + 2; right < lines.length; right += 1) {
      if (
        lines[left]!.primitiveIndex === lines[right]!.primitiveIndex ||
        Math.abs(lines[left]!.primitiveIndex - lines[right]!.primitiveIndex) <= 1 ||
        sharePrimitiveJoin(lines[left]!, lines[right]!)
      ) {
        continue;
      }
      if (
        segmentsIntersect(lines[left]!, lines[right]!, 1e-9) ||
        segmentDistance(lines[left]!, lines[right]!) < tolerance
      ) {
        return true;
      }
    }
  }
  return false;
}

function sampledPrimitiveLines(primitive: CenterlinePrimitive): CenterlineLine[] {
  if (primitive.kind === "line") {
    return [primitive];
  }
  const segmentCount = Math.max(
    8,
    Math.ceil(Math.abs(primitive.sweepAngle) / (Math.PI / 16)),
  );
  const points: Point2D[] = [];
  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = primitive.startAngle + (primitive.sweepAngle * index) / segmentCount;
    points.push({
      x: primitive.center.x + Math.cos(angle) * primitive.radius,
      y: primitive.center.y + Math.sin(angle) * primitive.radius,
    });
  }
  return linePrimitives(points);
}

function sharePrimitiveJoin(left: CenterlineLine, right: CenterlineLine): boolean {
  return (
    distance(left.start, right.start) < 1e-6 ||
    distance(left.start, right.end) < 1e-6 ||
    distance(left.end, right.start) < 1e-6 ||
    distance(left.end, right.end) < 1e-6
  );
}

function segmentsIntersect(
  left: CenterlineLine,
  right: CenterlineLine,
  tolerance: number,
): boolean {
  const denominator =
    (left.end.x - left.start.x) * (right.end.y - right.start.y) -
    (left.end.y - left.start.y) * (right.end.x - right.start.x);
  if (Math.abs(denominator) <= tolerance) {
    return false;
  }
  const ua =
    ((right.end.x - right.start.x) * (left.start.y - right.start.y) -
      (right.end.y - right.start.y) * (left.start.x - right.start.x)) /
    denominator;
  const ub =
    ((left.end.x - left.start.x) * (left.start.y - right.start.y) -
      (left.end.y - left.start.y) * (left.start.x - right.start.x)) /
    denominator;
  return ua > 0 && ua < 1 && ub > 0 && ub < 1;
}

function segmentDistance(left: CenterlineLine, right: CenterlineLine): number {
  return Math.min(
    pointSegmentDistance(left.start, right),
    pointSegmentDistance(left.end, right),
    pointSegmentDistance(right.start, left),
    pointSegmentDistance(right.end, left),
  );
}

function pointSegmentDistance(point: Point2D, segment: CenterlineLine): number {
  const segmentVector = {
    x: segment.end.x - segment.start.x,
    y: segment.end.y - segment.start.y,
  };
  const segmentLengthSquared = dot(segmentVector, segmentVector);
  if (segmentLengthSquared === 0) {
    return distance(point, segment.start);
  }
  const projection = clamp(
    dot({ x: point.x - segment.start.x, y: point.y - segment.start.y }, segmentVector) /
      segmentLengthSquared,
    0,
    1,
  );
  return distance(point, {
    x: segment.start.x + segmentVector.x * projection,
    y: segment.start.y + segmentVector.y * projection,
  });
}

function pointsContinuous(primitives: readonly CenterlinePrimitive[]): boolean {
  return primitives.every(
    (primitive, index) =>
      index === 0 || distance(primitive.start, primitives[index - 1]!.end) < 1e-6,
  );
}

function normalizeSweep(delta: number, clockwise: boolean): number {
  if (clockwise) {
    while (delta > 0) {
      delta -= Math.PI * 2;
    }
    return delta;
  }
  while (delta < 0) {
    delta += Math.PI * 2;
  }
  return delta;
}

function angleOnArc(angle: number, arc: CenterlineArc): boolean {
  const normalized = normalizeSweep(angle - arc.startAngle, arc.clockwise);
  return arc.clockwise
    ? normalized <= 0 && normalized >= arc.sweepAngle
    : normalized >= 0 && normalized <= arc.sweepAngle;
}

function routeIssue(code: string, message: string): RouteGeometryIssue {
  return { code, message };
}

function formatMm(value: number): string {
  return `${Number(value.toFixed(6))} mm`;
}

function roundMm(value: number): number {
  return Number(value.toFixed(6));
}

function descendingCandidates(start: number, minimum: number, count: number): number[] {
  if (start < minimum) {
    return [];
  }
  if (count <= 1 || Math.abs(start - minimum) < 1e-9) {
    return [roundMm(start)];
  }
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1);
    values.push(roundMm(start - (start - minimum) * ratio));
  }
  return uniqueNumbers(values);
}

function distance(left: Point2D, right: Point2D): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function dot(left: Point2D, right: Point2D): number {
  return left.x * right.x + left.y * right.y;
}

function cross(left: Point2D, right: Point2D): number {
  return left.x * right.y - left.y * right.x;
}

function normalize(vector: Point2D): Point2D | null {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? null : { x: vector.x / length, y: vector.y / length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function rotateVector(vector: Point2D, radians: number): Point2D {
  assertFinite(vector.x, "X");
  assertFinite(vector.y, "Y");
  assertFinite(radians, "Rotation");
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
}

function anchorOutwardNormal(anchor: Point2D): Point2D {
  const distances = [
    { distance: anchor.x, normal: { x: -1, y: 0 } },
    { distance: 1 - anchor.x, normal: { x: 1, y: 0 } },
    { distance: anchor.y, normal: { x: 0, y: -1 } },
    { distance: 1 - anchor.y, normal: { x: 0, y: 1 } },
  ];
  return distances.sort((left, right) => left.distance - right.distance)[0]!.normal;
}

function serpentineTolerance(scale: number): number {
  return Math.max(1e-6, Math.abs(scale) * 1e-6);
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
