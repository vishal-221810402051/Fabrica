import { describe, expect, it } from "vitest";
import { createComponentFromDefinition } from "microfluidic-components";
import { parseProject, type Project } from "project-model";

import {
  deriveComponentFootprint,
  deriveFullRoutePolyline,
  deriveLayerZRanges,
  deriveRoutePointAtFraction,
  deriveRouteBody2D,
  deriveRouteBodyPrimitivesWithInterfaces,
  deriveRouteGeometry,
  deriveRouteInterfaceExtensions,
  compactSerpentineRouteDraft,
  displayToMm,
  getPhysicalPortFrame,
  getPhysicalPortPosition,
  getRotatedFootprintCorners,
  isPointInsidePolygon,
  isComponentInsideChip,
  isSerpentinePitchFeasible,
  minimumSerpentineBendRadius,
  minimumSerpentinePitch,
  mmToDisplay,
  polygonIntersectionArea,
  projectToSceneGeometry,
  recommendedSerpentineBendRadius,
  recommendedSerpentinePitch,
  ROUTE_BODY_CHORD_ERROR_MM,
  snapPhysicalPoint,
  toCadPoint,
  validatePhysicalGeometry,
} from "./index";

function baseProject(): Project {
  return parseProject({
    schemaVersion: "0.4.0",
    id: "project_geometry",
    name: "Geometry test",
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
    chip: {
      id: "chip_geometry",
      name: "Chip",
      overallDimensions: {
        width: { value: 25, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 10, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 1.5, unit: "mm", provenance: { source: "user-entered" } },
      },
      layerIds: ["layer_flow", "layer_control"],
      metadata: {},
    },
    layers: [
      {
        id: "layer_flow",
        name: "Flow",
        order: 0,
        thickness: {
          value: 1,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        metadata: {},
      },
      {
        id: "layer_control",
        name: "Control",
        order: 1,
        thickness: {
          value: 0.5,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        metadata: {},
      },
    ],
    lanes: [],
    components: [],
    ports: [],
    connections: [],
    physicalRoutes: [],
    fluids: [],
    materials: [],
    manufacturingProcesses: [],
    validationResults: [],
    exportConfiguration: {
      requestedFormats: ["json"],
      includeValidationResults: true,
      metadata: {},
    },
    metadata: {},
    extensions: {},
  });
}

function withComponent(project: Project, definitionKey: string, x: number, y: number) {
  const created = createComponentFromDefinition({
    definitionKey,
    layerId: "layer_flow",
    position: { x, y },
  });
  return parseProject({
    ...project,
    components: [...project.components, created.component],
    ports: [...project.ports, ...created.ports],
  });
}

function asymmetricRoutedProject(input: { completeRoutes: boolean }): Project {
  let project = parseProject({
    ...baseProject(),
    chip: {
      ...baseProject().chip,
      overallDimensions: {
        width: { value: 100, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 60, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 1.5, unit: "mm", provenance: { source: "user-entered" } },
      },
      layerIds: ["layer_flow", "layer_control"],
    },
  });
  project = withComponent(project, "reservoir.sample-inlet", 10, 10);
  project = withComponent(project, "reservoir.reagent-inlet", 10, 45);
  project = withComponent(project, "junction.merger", 40, 30);
  project = withComponent(project, "chamber.reaction", 75, 20);
  const sampleA = project.components.find((component) =>
    component.name.includes("Sample inlet"),
  )!;
  const sampleB = project.components.find((component) =>
    component.name.includes("Reagent inlet"),
  )!;
  const merger = project.components.find((component) =>
    component.name.includes("Merger"),
  )!;
  const reaction = project.components.find((component) =>
    component.name.includes("Reaction chamber"),
  )!;
  const connections = [
    {
      id: "connection_sample_a_merger",
      sourcePortId: project.ports.find(
        (port) => port.componentId === sampleA.id && port.direction === "output",
      )!.id,
      targetPortId: project.ports.find(
        (port) => port.componentId === merger.id && port.name === "Input A",
      )!.id,
      metadata: {},
    },
    {
      id: "connection_sample_b_merger",
      sourcePortId: project.ports.find(
        (port) => port.componentId === sampleB.id && port.direction === "output",
      )!.id,
      targetPortId: project.ports.find(
        (port) => port.componentId === merger.id && port.name === "Input B",
      )!.id,
      metadata: {},
    },
    {
      id: "connection_merger_reaction",
      sourcePortId: project.ports.find(
        (port) => port.componentId === merger.id && port.direction === "output",
      )!.id,
      targetPortId: project.ports.find(
        (port) => port.componentId === reaction.id && port.direction === "input",
      )!.id,
      metadata: {},
    },
  ];
  return parseProject({
    ...project,
    connections,
    physicalRoutes: connections.map((connection, index) => ({
      id: `route_asymmetric_${index}`,
      connectionId: connection.id,
      layerId: "layer_flow",
      pattern: { kind: "straight" as const },
      ...(input.completeRoutes
        ? {
            width: {
              value: 0.2,
              unit: "mm" as const,
              provenance: { source: "user-entered" as const },
            },
            depth: {
              value: 0.1,
              unit: "mm" as const,
              provenance: { source: "user-entered" as const },
            },
          }
        : {}),
      metadata: {},
    })),
  });
}

function expectPoint3D(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
) {
  expect(actual.x).toBeCloseTo(expected.x);
  expect(actual.y).toBeCloseTo(expected.y);
  expect(actual.z).toBeCloseTo(expected.z);
}

function testLine(start: { x: number; y: number }, end: { x: number; y: number }) {
  return {
    kind: "line" as const,
    start,
    end,
    length: distance(start, end),
  };
}

function distance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function signedAreaForTest(points: readonly { x: number; y: number }[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function sortedBoundary(points: readonly { x: number; y: number }[]): string[] {
  return points.map((point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`).sort();
}

function roomyProject(): Project {
  return parseProject({
    ...baseProject(),
    chip: {
      ...baseProject().chip,
      overallDimensions: {
        width: { value: 120, unit: "mm", provenance: { source: "user-entered" } },
        height: { value: 60, unit: "mm", provenance: { source: "user-entered" } },
        depth: { value: 1.5, unit: "mm", provenance: { source: "user-entered" } },
      },
    },
  });
}

function withSerpentineRoute(input: {
  pitch: number;
  bendRadius: number;
  amplitude: number;
  turnCount?: number;
  width?: number;
  depth?: number;
  source?: { x: number; y: number; rotation?: number };
  target?: { x: number; y: number; rotation?: number };
  axis?: "auto" | "horizontal" | "vertical";
  placement?: Extract<
    Project["physicalRoutes"][number]["pattern"],
    { kind: "serpentine" }
  >["placement"];
}): Project {
  let project = withComponent(
    roomyProject(),
    "channel.rectangular",
    input.source?.x ?? 10,
    input.source?.y ?? 10,
  );
  project = withComponent(
    project,
    "filter.debris",
    input.target?.x ?? 70,
    input.target?.y ?? 10,
  );
  project = parseProject({
    ...project,
    components: project.components.map((component, index) => ({
      ...component,
      rotation: {
        value:
          index === 0
            ? (input.source?.rotation ?? component.rotation.value)
            : (input.target?.rotation ?? component.rotation.value),
        unit: "rad",
        provenance: { source: "user-entered" },
      },
    })),
  });
  const connection = {
    id: "connection_serpentine_fixture",
    sourcePortId: project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!.id,
    targetPortId: project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "input",
    )!.id,
    metadata: {},
  };
  return parseProject({
    ...project,
    connections: [connection],
    physicalRoutes: [
      {
        id: "route_serpentine_fixture",
        connectionId: connection.id,
        layerId: "layer_flow",
        pattern: {
          kind: "serpentine",
          turnCount: input.turnCount ?? 4,
          pitch: {
            value: input.pitch,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          axis: input.axis ?? "horizontal",
          entranceLength: {
            value: 3,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          exitLength: {
            value: 3,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          sizing: {
            mode: "explicit",
            amplitude: {
              value: input.amplitude,
              unit: "mm",
              provenance: { source: "user-entered" },
            },
          },
          placement: input.placement ?? { mode: "auto" },
        },
        width: {
          value: input.width ?? 0.2,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        depth: {
          value: input.depth ?? 0.1,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        bendRadius: {
          value: input.bendRadius,
          unit: "mm",
          provenance: { source: "user-entered" },
        },
        metadata: {},
      },
    ],
  });
}

function translatedSignature(
  primitives: ReturnType<typeof deriveRouteGeometry>["corePrimitives"],
) {
  const origin = primitives[0]?.start ?? { x: 0, y: 0 };
  return primitives.map((primitive) => ({
    kind: primitive.kind,
    start: {
      x: Number((primitive.start.x - origin.x).toFixed(6)),
      y: Number((primitive.start.y - origin.y).toFixed(6)),
    },
    end: {
      x: Number((primitive.end.x - origin.x).toFixed(6)),
      y: Number((primitive.end.y - origin.y).toFixed(6)),
    },
    length: Number(primitive.length.toFixed(6)),
    ...(primitive.kind === "arc"
      ? {
          radius: primitive.radius,
          sweep: Number(primitive.sweepAngle.toFixed(6)),
          clockwise: primitive.clockwise,
        }
      : {}),
  }));
}

function routeArcRadii(
  primitives: ReturnType<typeof deriveRouteGeometry>["primitives"],
): number[] {
  return primitives
    .filter((primitive) => primitive.kind === "arc")
    .map((primitive) => primitive.radius);
}

function expectTangentContinuous(
  primitives: ReturnType<typeof deriveRouteGeometry>["primitives"],
) {
  for (let index = 1; index < primitives.length; index += 1) {
    expect(
      distanceForTest(primitives[index - 1]!.end, primitives[index]!.start),
    ).toBeLessThan(1e-6);
    expect(
      dotForTest(
        primitiveEndTangentForTest(primitives[index - 1]!),
        primitiveStartTangentForTest(primitives[index]!),
      ),
    ).toBeGreaterThan(1 - 1e-6);
  }
}

function longCoreLegs(
  primitives: ReturnType<typeof deriveRouteGeometry>["corePrimitives"],
  minimumLength: number,
) {
  return primitives.filter(
    (primitive) => primitive.kind === "line" && primitive.length >= minimumLength,
  );
}

function lineDirectionForTest(
  primitive: ReturnType<typeof deriveRouteGeometry>["corePrimitives"][number],
) {
  return normalizeForTest({
    x: primitive.end.x - primitive.start.x,
    y: primitive.end.y - primitive.start.y,
  });
}

function distancePointToLineForTest(
  point: { x: number; y: number },
  primitive: ReturnType<typeof deriveRouteGeometry>["corePrimitives"][number],
) {
  const direction = lineDirectionForTest(primitive);
  return Math.abs(
    (point.x - primitive.start.x) * direction.y -
      (point.y - primitive.start.y) * direction.x,
  );
}

function adjacentLegPitches(
  primitives: ReturnType<typeof deriveRouteGeometry>["corePrimitives"],
  amplitude: number,
) {
  const legs = longCoreLegs(primitives, amplitude * 0.9);
  return legs.slice(1).map((leg, index) => {
    const previous = legs[index]!;
    expect(
      Math.abs(dotForTest(lineDirectionForTest(previous), lineDirectionForTest(leg))),
    ).toBeCloseTo(1, 6);
    return distancePointToLineForTest(leg.start, previous);
  });
}

function primitiveStartTangentForTest(
  primitive: ReturnType<typeof deriveRouteGeometry>["primitives"][number],
) {
  if (primitive.kind === "line") {
    return normalizeForTest({
      x: primitive.end.x - primitive.start.x,
      y: primitive.end.y - primitive.start.y,
    });
  }
  const radial = {
    x: Math.cos(primitive.startAngle),
    y: Math.sin(primitive.startAngle),
  };
  return primitive.clockwise
    ? { x: radial.y, y: -radial.x }
    : { x: -radial.y, y: radial.x };
}

function primitiveEndTangentForTest(
  primitive: ReturnType<typeof deriveRouteGeometry>["primitives"][number],
) {
  if (primitive.kind === "line") {
    return normalizeForTest({
      x: primitive.end.x - primitive.start.x,
      y: primitive.end.y - primitive.start.y,
    });
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

function normalizeForTest(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);
  return { x: vector.x / length, y: vector.y / length };
}

function dotForTest(left: { x: number; y: number }, right: { x: number; y: number }) {
  return left.x * right.x + left.y * right.y;
}

function distanceForTest(
  left: { x: number; y: number },
  right: { x: number; y: number },
) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

describe("geometry-core", () => {
  it("converts display units and snaps physical millimeters", () => {
    expect(mmToDisplay(2)).toBe(48);
    expect(displayToMm(48)).toBe(2);
    expect(snapPhysicalPoint({ x: 1.24, y: 2.26 })).toEqual({ x: 1.2, y: 2.3 });
  });

  it("samples route points at fractions along straight primitives", () => {
    expect(
      deriveRoutePointAtFraction(
        [{ kind: "line", start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, length: 10 }],
        0.5,
      )?.point,
    ).toEqual({ x: 5, y: 0 });
    expect(
      deriveRoutePointAtFraction(
        [{ kind: "line", start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, length: 10 }],
        0.5,
      )?.point,
    ).toEqual({ x: 0, y: 5 });
    expect(
      deriveRoutePointAtFraction(
        [
          {
            kind: "line",
            start: { x: 0, y: 0 },
            end: { x: 10, y: 10 },
            length: Math.sqrt(200),
          },
        ],
        0.5,
      )?.point,
    ).toEqual({ x: 5, y: 5 });
  });

  it("samples route points exactly on arc length", () => {
    const sample = deriveRoutePointAtFraction(
      [
        {
          kind: "arc",
          center: { x: 0, y: 0 },
          radius: 10,
          startAngle: 0,
          sweepAngle: Math.PI / 2,
          clockwise: false,
          start: { x: 10, y: 0 },
          end: { x: 0, y: 10 },
          length: (Math.PI * 10) / 2,
        },
      ],
      0.5,
    );

    expect(sample?.point.x).toBeCloseTo(Math.sqrt(50), 6);
    expect(sample?.point.y).toBeCloseTo(Math.sqrt(50), 6);
    expect(sample?.primitiveIndex).toBe(0);
  });

  it("walks composite route primitives by cumulative length", () => {
    const sample = deriveRoutePointAtFraction(
      [
        { kind: "line", start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, length: 2 },
        {
          kind: "arc",
          center: { x: 2, y: 2 },
          radius: 2,
          startAngle: -Math.PI / 2,
          sweepAngle: Math.PI / 2,
          clockwise: false,
          start: { x: 2, y: 0 },
          end: { x: 4, y: 2 },
          length: Math.PI,
        },
        { kind: "line", start: { x: 4, y: 2 }, end: { x: 12, y: 2 }, length: 8 },
      ],
      0.5,
    );

    expect(sample?.primitiveIndex).toBe(2);
    expect(sample?.point.x).toBeCloseTo(4 + (10 + Math.PI) / 2 - 2 - Math.PI, 6);
    expect(sample?.point.y).toBeCloseTo(2, 6);
  });

  it("keeps the half-length point stable for reversed equivalent routes", () => {
    const forward = deriveRoutePointAtFraction(
      [
        {
          kind: "line",
          start: { x: 0, y: 2 },
          end: { x: 10, y: 8 },
          length: Math.hypot(10, 6),
        },
      ],
      0.5,
    );
    const reversed = deriveRoutePointAtFraction(
      [
        {
          kind: "line",
          start: { x: 10, y: 8 },
          end: { x: 0, y: 2 },
          length: Math.hypot(10, 6),
        },
      ],
      0.5,
    );

    expect(forward?.point.x).toBeCloseTo(reversed!.point.x, 6);
    expect(forward?.point.y).toBeCloseTo(reversed!.point.y, 6);
  });

  it("samples a stable serpentine midpoint inside the authoritative envelope", () => {
    const project = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.75,
      bendRadius: 0.3,
      amplitude: 8,
      turnCount: 4,
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const first = deriveRoutePointAtFraction(generated.primitives, 0.5);
    const second = deriveRoutePointAtFraction(
      deriveRouteGeometry(project, project.physicalRoutes[0]!).primitives,
      0.5,
    );

    expect(first).not.toBeNull();
    expect(first!.point.x).toBeCloseTo(second!.point.x, 6);
    expect(first!.point.y).toBeCloseTo(second!.point.y, 6);
    expect(Number.isFinite(first!.point.x)).toBe(true);
    expect(Number.isFinite(first!.point.y)).toBe(true);
    expect(first!.point.x).toBeGreaterThanOrEqual(generated.envelope!.minX);
    expect(first!.point.x).toBeLessThanOrEqual(generated.envelope!.maxX);
    expect(first!.point.y).toBeGreaterThanOrEqual(generated.envelope!.minY);
    expect(first!.point.y).toBeLessThanOrEqual(generated.envelope!.maxY);
  });

  it("derives authoritative footprints and physical port positions", () => {
    const project = withComponent(baseProject(), "junction.splitter", 4, 2);
    const component = project.components[0]!;
    const input = project.ports.find((port) => port.name === "Input")!;
    const output = project.ports.find((port) => port.name === "Output A")!;

    expect(deriveComponentFootprint(component)).toMatchObject({
      width: 2,
      height: 1,
      depth: 0.2,
      source: "registry-physical-metadata",
    });
    expect(getPhysicalPortPosition(project, component, input)).toMatchObject({
      x: 4,
      y: 2.5,
      layerId: "layer_flow",
    });
    expect(getPhysicalPortPosition(project, component, output)).toMatchObject({
      x: 6,
      y: 2.25,
      layerId: "layer_flow",
    });
  });

  it("checks rotated footprints against chip bounds", () => {
    const project = withComponent(baseProject(), "chamber.generic", 23.5, 8.5);
    expect(isComponentInsideChip(project, project.components[0]!)).toBe(false);
  });

  it("derives route polylines from ports plus intermediate waypoints", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 6, 1);
    const connection = {
      id: "connection_route",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_one",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: {
            kind: "manual",
            waypoints: [
              {
                x: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
                y: { value: 3, unit: "mm", provenance: { source: "user-entered" } },
              },
            ],
          },
          width: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
      ],
    });

    expect(deriveFullRoutePolyline(project, project.physicalRoutes[0]!)).toEqual([
      { x: 3, y: 1.25, layerId: "layer_flow" },
      { x: 4, y: 3 },
      { x: 6, y: 1.25, layerId: "layer_flow" },
    ]);
    expect(validatePhysicalGeometry(project)).toEqual([]);
  });

  it("derives bottom-up layer z ranges and CAD-space y inversion", () => {
    const project = baseProject();

    expect(deriveLayerZRanges(project.layers)).toEqual([
      { layerId: "layer_flow", zMin: 0, zMax: 1 },
      { layerId: "layer_control", zMin: 1, zMax: 1.5 },
    ]);
    expect(toCadPoint(project, { x: 2, y: 3 }, "layer_control")).toEqual({
      x: 2,
      y: 7,
      z: 1,
    });
  });

  it("derives horizontal, vertical, and diagonal rectangular route bodies", () => {
    const horizontal = deriveRouteBody2D(
      [testLine({ x: 10, y: 10 }, { x: 50, y: 10 })],
      0.5,
    );
    const vertical = deriveRouteBody2D(
      [testLine({ x: 10, y: 10 }, { x: 10, y: 50 })],
      0.5,
    );
    const diagonal = deriveRouteBody2D(
      [testLine({ x: 10, y: 10 }, { x: 50, y: 30 })],
      0.5,
    );

    expect(horizontal.issues).toEqual([]);
    expect(horizontal.bounds).toEqual({
      minX: 10,
      minY: 9.75,
      maxX: 50,
      maxY: 10.25,
    });
    expect(horizontal.area).toBeCloseTo(20, 6);
    expect(signedAreaForTest(horizontal.boundary)).toBeGreaterThan(0);

    expect(vertical.issues).toEqual([]);
    expect(vertical.bounds).toEqual({
      minX: 9.75,
      minY: 10,
      maxX: 10.25,
      maxY: 50,
    });
    expect(vertical.area).toBeCloseTo(20, 6);

    expect(diagonal.issues).toEqual([]);
    expect(distance(diagonal.leftBoundary[0]!, diagonal.rightBoundary[0]!)).toBeCloseTo(
      0.5,
      6,
    );
    expect(diagonal.area).toBeCloseTo(Math.hypot(40, 20) * 0.5, 6);
  });

  it("keeps reversed straight route bodies in the same physical region", () => {
    const forward = deriveRouteBody2D(
      [testLine({ x: 10, y: 10 }, { x: 50, y: 10 })],
      0.5,
    );
    const reversed = deriveRouteBody2D(
      [testLine({ x: 50, y: 10 }, { x: 10, y: 10 })],
      0.5,
    );
    const vertical = deriveRouteBody2D(
      [testLine({ x: 10, y: 10 }, { x: 10, y: 50 })],
      0.5,
    );
    const reversedVertical = deriveRouteBody2D(
      [testLine({ x: 10, y: 50 }, { x: 10, y: 10 })],
      0.5,
    );

    expect(forward.issues).toEqual([]);
    expect(reversed.issues).toEqual([]);
    expect(vertical.issues).toEqual([]);
    expect(reversedVertical.issues).toEqual([]);
    expect(sortedBoundary(forward.boundary)).toEqual(sortedBoundary(reversed.boundary));
    expect(sortedBoundary(vertical.boundary)).toEqual(
      sortedBoundary(reversedVertical.boundary),
    );
    expect(forward.area).toBeCloseTo(reversed.area, 6);
    expect(vertical.area).toBeCloseTo(reversedVertical.area, 6);
  });

  it("samples 90-degree arcs with constant inner and outer body radius", () => {
    const radius = 2;
    const width = 0.5;
    const body = deriveRouteBody2D(
      [
        {
          kind: "arc",
          center: { x: 0, y: 0 },
          radius,
          startAngle: 0,
          sweepAngle: Math.PI / 2,
          clockwise: false,
          start: { x: radius, y: 0 },
          end: { x: 0, y: radius },
          length: (Math.PI / 2) * radius,
        },
      ],
      width,
    );
    const radii = body.boundary.map((point) => Math.hypot(point.x, point.y));

    expect(body.issues).toEqual([]);
    expect(body.sampledCenterline.length).toBeGreaterThan(2);
    expect(body.sampledCenterline.length).toBeLessThanOrEqual(
      Math.ceil(Math.PI / 2 / (2 * Math.acos(1 - ROUTE_BODY_CHORD_ERROR_MM / radius))) +
        1,
    );
    expect(Math.min(...radii)).toBeCloseTo(radius - width / 2, 5);
    expect(Math.max(...radii)).toBeCloseTo(radius + width / 2, 5);
    expect(body.area).toBeCloseTo((Math.PI / 2) * radius * width, 1);
  });

  it("rejects obviously self-intersecting route bodies without throwing", () => {
    const body = deriveRouteBody2D(
      [
        testLine({ x: 0, y: 0 }, { x: 2, y: 2 }),
        testLine({ x: 2, y: 2 }, { x: 0, y: 2 }),
        testLine({ x: 0, y: 2 }, { x: 2, y: 0 }),
      ],
      0.2,
    );

    expect(body.issues.map((issue) => issue.code)).toContain("self-intersecting-body");
  });

  it("projects chip, layers, components, ports, and top-down cavity placement", () => {
    const project = withComponent(baseProject(), "junction.splitter", 4, 2);
    const scene = projectToSceneGeometry(project);

    expect(scene.chip).toMatchObject({ width: 25, height: 10, depth: 1.5 });
    expect(
      scene.layers.map((layer) => [layer.layerId, layer.zMin, layer.zMax]),
    ).toEqual([
      ["layer_flow", 0, 1],
      ["layer_control", 1, 1.5],
    ]);
    expect(scene.components[0]).toMatchObject({
      definitionKey: "junction.splitter",
      center: { x: 5, y: 7.5, z: 0.9 },
      size: { width: 2, height: 1, depth: 0.2 },
      zTop: 1,
      zBottom: 0.8,
    });
    expect(
      scene.ports.filter((port) => port.componentId === project.components[0]!.id),
    ).toHaveLength(3);
  });

  it("keeps asymmetric scene routes aligned to directed source and target ports", () => {
    const project = asymmetricRoutedProject({ completeRoutes: true });
    const scene = projectToSceneGeometry(project);
    const flowLayer = scene.layers.find((layer) => layer.layerId === "layer_flow")!;

    for (const connection of project.connections) {
      const route = scene.routes.find(
        (candidate) => candidate.connectionId === connection.id,
      )!;
      const sourcePort = project.ports.find(
        (port) => port.id === connection.sourcePortId,
      )!;
      const targetPort = project.ports.find(
        (port) => port.id === connection.targetPortId,
      )!;
      const sourceComponent = project.components.find(
        (component) => component.id === sourcePort.componentId,
      )!;
      const targetComponent = project.components.find(
        (component) => component.id === targetPort.componentId,
      )!;
      const sourceCad = {
        ...toCadPoint(
          project,
          getPhysicalPortPosition(project, sourceComponent, sourcePort),
          "layer_flow",
        ),
        z: flowLayer.zMax,
      };
      const targetCad = {
        ...toCadPoint(
          project,
          getPhysicalPortPosition(project, targetComponent, targetPort),
          "layer_flow",
        ),
        z: flowLayer.zMax,
      };

      expectPoint3D(route.points[0]!, sourceCad);
      expectPoint3D(route.points.at(-1)!, targetCad);
    }

    const sampleA = project.components.find((component) =>
      component.name.includes("Sample inlet"),
    )!;
    const sampleAScene = scene.components.find(
      (component) => component.id === sampleA.id,
    )!;
    const sampleAFootprint = deriveComponentFootprint(sampleA)!;
    const expectedCenter = toCadPoint(
      project,
      {
        x: sampleA.position.x.value + sampleAFootprint.width / 2,
        y: sampleA.position.y.value + sampleAFootprint.height / 2,
      },
      sampleA.layerId,
    );
    expect(sampleAScene.center.x).toBeCloseTo(expectedCenter.x);
    expect(sampleAScene.center.y).toBeCloseTo(expectedCenter.y);
  });

  it("attributes incomplete 3D route warnings to source and target labels", () => {
    const project = asymmetricRoutedProject({ completeRoutes: false });
    const scene = projectToSceneGeometry(project);
    const warning = scene.warnings.find(
      (candidate) => candidate.code === "missing-route-width",
    )!;

    expect(warning.entityType).toBe("physical-route");
    expect(warning.connectionId).toBe("connection_sample_a_merger");
    expect(warning.sourceLabel).toBe("Sample inlet / Fluid port");
    expect(warning.targetLabel).toBe("Merger / Input A");
    expect(warning.message).toContain("Sample inlet / Fluid port -> Merger / Input A");
  });

  it("projects complete rectangular route bodies without legacy segment boxes", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 6, 1);
    const connection = {
      id: "connection_scene_route",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_scene",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: {
            kind: "manual",
            waypoints: [
              {
                x: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
                y: { value: 3, unit: "mm", provenance: { source: "user-entered" } },
              },
            ],
          },
          width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
      ],
    });

    const scene = projectToSceneGeometry(project);
    const route = scene.routes[0]!;

    expect(route.physicalReady).toBe(true);
    expect(route.segments).toEqual([]);
    expect(route.jointBoxes).toEqual([]);
    expect(route.body).toMatchObject({
      routeId: "route_scene",
      connectionId: "connection_scene_route",
      width: 0.2,
      depth: 0.1,
      zTop: 1,
      zBottom: 0.9,
    });
    expect(route.body!.area).toBeGreaterThan(0);
    expect(route.body!.boundary.length).toBeGreaterThan(4);
    expect(route.points.map((point) => point.z)).toEqual([1, 1, 1]);
  });

  it("derives source and target route body penetration without moving logical endpoints", () => {
    let project = withComponent(baseProject(), "reservoir.sample-inlet", 1, 1);
    project = withComponent(project, "chamber.metering", 8, 1);
    const source = project.components[0]!;
    const target = project.components[1]!;
    const sourcePort = project.ports.find(
      (port) => port.componentId === source.id && port.direction === "output",
    )!;
    const targetPort = project.ports.find(
      (port) => port.componentId === target.id && port.direction === "input",
    )!;
    const connection = {
      id: "connection_penetrated",
      sourcePortId: sourcePort.id,
      targetPortId: targetPort.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_penetrated",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          width: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
      ],
    });
    const route = project.physicalRoutes[0]!;
    const generated = deriveRouteGeometry(project, route);
    const interfaces = deriveRouteInterfaceExtensions(project, route, 0.5);
    const extended = deriveRouteBodyPrimitivesWithInterfaces(
      project,
      route,
      generated.primitives,
      0.5,
    );
    const body = deriveRouteBody2D(extended.primitives, 0.5);
    const sourceFootprint = deriveComponentFootprint(source)!;
    const targetFootprint = deriveComponentFootprint(target)!;

    expect(interfaces.issues).toEqual([]);
    expect(interfaces.source?.portId).toBe(sourcePort.id);
    expect(interfaces.target?.portId).toBe(targetPort.id);
    expect(
      isPointInsidePolygon(
        interfaces.source!.insidePosition,
        interfaces.source!.footprint,
      ),
    ).toBe(true);
    expect(
      isPointInsidePolygon(
        interfaces.target!.insidePosition,
        interfaces.target!.footprint,
      ),
    ).toBe(true);
    expect(body.issues).toEqual([]);
    expect(
      polygonIntersectionArea(
        body.boundary,
        getRotatedFootprintCorners(source, sourceFootprint),
      ),
    ).toBeGreaterThan(0);
    expect(
      polygonIntersectionArea(
        body.boundary,
        getRotatedFootprintCorners(target, targetFootprint),
      ),
    ).toBeGreaterThan(0);
    expect(generated.primitives[0]!.start).toMatchObject(
      getPhysicalPortFrame(project, source, sourcePort).position,
    );
    expect(generated.primitives.at(-1)!.end).toMatchObject(
      getPhysicalPortFrame(project, target, targetPort).position,
    );
    expect(deriveRouteGeometry(project, route).actualLength).toBeCloseTo(
      generated.actualLength,
    );
  });

  it("uses each merger physical port frame for interface penetration", () => {
    const project = asymmetricRoutedProject({ completeRoutes: true });
    const scene = projectToSceneGeometry(project);

    for (const connection of project.connections) {
      const route = project.physicalRoutes.find(
        (candidate) => candidate.connectionId === connection.id,
      )!;
      const interfaces = deriveRouteInterfaceExtensions(project, route, 0.2);
      const sceneRoute = scene.routes.find(
        (candidate) => candidate.connectionId === connection.id,
      )!;

      expect(interfaces.issues).toEqual([]);
      expect(interfaces.source?.portId).toBe(connection.sourcePortId);
      expect(interfaces.target?.portId).toBe(connection.targetPortId);
      expect(sceneRoute.physicalReady).toBe(true);
      expect(sceneRoute.body).toBeDefined();
    }
  });

  it("rotates interface penetration with the target port frame", () => {
    let project = withComponent(baseProject(), "reservoir.sample-inlet", 1, 1);
    project = withComponent(project, "chamber.metering", 8, 1);
    const targetId = project.components[1]!.id;
    project = parseProject({
      ...project,
      components: project.components.map((component) =>
        component.id === targetId
          ? {
              ...component,
              rotation: {
                value: Math.PI / 2,
                unit: "rad",
                provenance: { source: "user-entered" },
              },
            }
          : component,
      ),
    });
    const sourcePort = project.ports.find(
      (port) =>
        port.componentId === project.components[0]!.id && port.direction === "output",
    )!;
    const targetPort = project.ports.find(
      (port) =>
        port.componentId === project.components[1]!.id && port.direction === "input",
    )!;
    const connection = {
      id: "connection_rotated_interface",
      sourcePortId: sourcePort.id,
      targetPortId: targetPort.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_rotated_interface",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          width: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
      ],
    });
    const target = project.components[1]!;
    const frame = getPhysicalPortFrame(project, target, targetPort);
    const interfaces = deriveRouteInterfaceExtensions(
      project,
      project.physicalRoutes[0]!,
      0.5,
    );

    expect(interfaces.target?.inward.x).toBeCloseTo(-frame.outward.x);
    expect(interfaces.target?.inward.y).toBeCloseTo(-frame.outward.y);
    expect(
      Math.abs(interfaces.target!.insidePosition.y - interfaces.target!.portPosition.y),
    ).toBeGreaterThan(0.1);
  });

  it("uses penetrated bodies in 3D while preserving topology and actual length", () => {
    const project = asymmetricRoutedProject({ completeRoutes: true });
    const route = project.physicalRoutes[0]!;
    const connection = project.connections.find(
      (candidate) => candidate.id === route.connectionId,
    )!;
    const generated = deriveRouteGeometry(project, route);
    const scene = projectToSceneGeometry(project);
    const sceneRoute = scene.routes.find(
      (candidate) => candidate.connectionId === connection.id,
    )!;
    const sourceComponent = project.components.find(
      (component) =>
        component.id ===
        project.ports.find((port) => port.id === connection.sourcePortId)!.componentId,
    )!;
    const sourceFootprint = deriveComponentFootprint(sourceComponent)!;
    const sourceCadFootprint = getRotatedFootprintCorners(
      sourceComponent,
      sourceFootprint,
    ).map((point) => {
      const cad = toCadPoint(project, point, sourceComponent.layerId);
      return { x: cad.x, y: cad.y };
    });

    expect(sceneRoute.physicalReady).toBe(true);
    expect(sceneRoute.body).toBeDefined();
    expect(
      polygonIntersectionArea(sceneRoute.body!.boundary, sourceCadFootprint),
    ).toBeGreaterThan(0);
    expect(connection.sourcePortId).toBe(project.connections[0]!.sourcePortId);
    expect(connection.targetPortId).toBe(project.connections[0]!.targetPortId);
    expect(sceneRoute.actualLength).toBeCloseTo(generated.actualLength);
    expect(sceneRoute.points[0]).toMatchObject({
      x: toCadPoint(
        project,
        getPhysicalPortPosition(
          project,
          sourceComponent,
          project.ports.find((port) => port.id === connection.sourcePortId)!,
        ),
        sourceComponent.layerId,
      ).x,
    });
  });

  it("classifies incomplete routes as warnings", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 6, 1);
    const connection = {
      id: "connection_incomplete",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_incomplete",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          bendRadius: {
            value: 0.5,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          metadata: {},
        },
      ],
    });

    const scene = projectToSceneGeometry(project);

    expect(scene.routes[0]!.physicalReady).toBe(false);
    expect(scene.routes[0]!.segments).toEqual([]);
    expect(scene.routes[0]!.body).toBeUndefined();
    expect(scene.routes[0]!.points.length).toBeGreaterThanOrEqual(2);
    expect(scene.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "missing-route-width",
        "missing-route-depth",
        "incomplete-route",
      ]),
    );
  });

  it("derives straight centerline primitives and actual length", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 6, 1);
    const connection = {
      id: "connection_straight",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_straight",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
      ],
    });

    const route = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(route.primitives).toHaveLength(1);
    expect(route.primitives[0]).toMatchObject({ kind: "line" });
    expect(route.actualLength).toBeGreaterThan(0);
    expect(route.physicalReady).toBe(true);
  });

  it("inserts tangent arc primitives for manual bends and rejects impossible bends", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 8, 1);
    const connection = {
      id: "connection_manual_arc",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    const route = {
      id: "route_manual_arc",
      connectionId: connection.id,
      layerId: "layer_flow",
      pattern: {
        kind: "manual" as const,
        waypoints: [
          {
            x: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
            y: { value: 3, unit: "mm", provenance: { source: "user-entered" } },
          },
        ],
      },
      width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
      depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
      bendRadius: { value: 0.25, unit: "mm", provenance: { source: "user-entered" } },
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [route],
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const impossible = deriveRouteGeometry(project, {
      ...project.physicalRoutes[0]!,
      bendRadius: {
        value: 20,
        unit: "mm",
        provenance: { source: "user-entered" },
      },
    });

    expect(generated.primitives.some((primitive) => primitive.kind === "arc")).toBe(
      true,
    );
    expect(impossible.issues.map((issue) => issue.code)).toContain(
      "bend-radius-infeasible",
    );
  });

  it("fits serpentine geometry to exact ports and solves amplitude for target length", () => {
    let project = withComponent(roomyProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 100, 4);
    const connection = {
      id: "connection_serpentine",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_serpentine",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: {
            kind: "serpentine",
            turnCount: 1,
            pitch: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
            axis: "horizontal",
            sizing: {
              mode: "target-length",
              targetLength: {
                value: 120,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
            placement: { mode: "auto" },
          },
          width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          bendRadius: {
            value: 0.25,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          metadata: {},
        },
      ],
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const sourcePort = project.ports.find(
      (port) => port.id === connection.sourcePortId,
    )!;
    const targetPort = project.ports.find(
      (port) => port.id === connection.targetPortId,
    )!;
    const sourceComponent = project.components.find(
      (component) => component.id === sourcePort.componentId,
    )!;
    const targetComponent = project.components.find(
      (component) => component.id === targetPort.componentId,
    )!;
    const sourceFrame = getPhysicalPortFrame(project, sourceComponent, sourcePort);
    const targetFrame = getPhysicalPortFrame(project, targetComponent, targetPort);

    expect(generated.issues).toEqual([]);
    expect(
      generated.corePrimitives.filter((primitive) => primitive.kind === "arc"),
    ).toHaveLength(2);
    expect(generated.primitives[0]!.start).toMatchObject({
      x: sourceFrame.position.x,
      y: sourceFrame.position.y,
    });
    expect(generated.primitives[generated.primitives.length - 1]!.end).toMatchObject({
      x: targetFrame.position.x,
      y: targetFrame.position.y,
    });
    expect(generated.primitives.at(-1)).toMatchObject({ kind: "line" });
    expect(generated.solvedAmplitude).toBeGreaterThan(0);
    expect(generated.actualLength).toBeCloseTo(120, 3);
  });

  it("solves the screenshot-like merger to reaction serpentine route", () => {
    let project = withComponent(roomyProject(), "reservoir.sample-inlet", 4, 8);
    project = withComponent(project, "reservoir.sample-inlet", 4, 16);
    project = withComponent(project, "junction.merger", 28, 12);
    project = withComponent(project, "chamber.reaction", 64, 12);
    const sampleA = project.components[0]!;
    const sampleB = project.components[1]!;
    const merger = project.components[2]!;
    const reaction = project.components[3]!;
    const sampleAOut = project.ports.find(
      (port) => port.componentId === sampleA.id && port.direction === "output",
    )!;
    const sampleBOut = project.ports.find(
      (port) => port.componentId === sampleB.id && port.direction === "output",
    )!;
    const mergerInputA = project.ports.find(
      (port) => port.componentId === merger.id && port.name === "Input A",
    )!;
    const mergerInputB = project.ports.find(
      (port) => port.componentId === merger.id && port.name === "Input B",
    )!;
    const mergerOutput = project.ports.find(
      (port) => port.componentId === merger.id && port.name === "Output",
    )!;
    const reactionInput = project.ports.find(
      (port) => port.componentId === reaction.id && port.name === "Inlet",
    )!;
    const serpentineConnection = {
      id: "connection_merger_to_reaction",
      sourcePortId: mergerOutput.id,
      targetPortId: reactionInput.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [
        {
          id: "connection_sample_a_to_merger",
          sourcePortId: sampleAOut.id,
          targetPortId: mergerInputA.id,
          metadata: {},
        },
        {
          id: "connection_sample_b_to_merger",
          sourcePortId: sampleBOut.id,
          targetPortId: mergerInputB.id,
          metadata: {},
        },
        serpentineConnection,
      ],
      physicalRoutes: [
        {
          id: "route_sample_a_to_merger",
          connectionId: "connection_sample_a_to_merger",
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          width: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.3, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
        {
          id: "route_sample_b_to_merger",
          connectionId: "connection_sample_b_to_merger",
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          width: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.3, unit: "mm", provenance: { source: "user-entered" } },
          metadata: {},
        },
        {
          id: "route_merger_to_reaction",
          connectionId: serpentineConnection.id,
          layerId: "layer_flow",
          pattern: {
            kind: "serpentine",
            turnCount: 4,
            pitch: { value: 2, unit: "mm", provenance: { source: "user-entered" } },
            axis: "horizontal",
            sizing: {
              mode: "explicit",
              amplitude: {
                value: 8,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
            placement: { mode: "auto" },
          },
          width: { value: 0.5, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.3, unit: "mm", provenance: { source: "user-entered" } },
          bendRadius: {
            value: 0.75,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          metadata: {},
        },
      ],
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[2]!);
    const issueCodes = generated.issues.map((issue) => issue.code);
    const coreEnvelope = generated.coreEnvelope!;
    const mergerFrame = getPhysicalPortFrame(project, merger, mergerOutput);
    const reactionFrame = getPhysicalPortFrame(project, reaction, reactionInput);

    expect(generated.physicalReady).toBe(true);
    expect(generated.entryTailLength).toBeGreaterThan(0);
    expect(generated.coreLength).toBeGreaterThan(0);
    expect(generated.exitTailLength).toBeGreaterThan(0);
    expect(generated.actualLength).toBeGreaterThan(0);
    expect(issueCodes).not.toContain("serpentine-entry-tail-infeasible");
    expect(issueCodes).not.toContain("serpentine-exit-tail-infeasible");
    expect(issueCodes).not.toContain("serpentine-u-turn-infeasible");
    expect(coreEnvelope.minX).toBeGreaterThan(mergerFrame.position.x);
    expect(coreEnvelope.maxX).toBeLessThan(reactionFrame.position.x);
    expect(routeArcRadii(generated.primitives).every((radius) => radius === 0.75)).toBe(
      true,
    );
    expectTangentContinuous(generated.primitives);
  });

  it("exposes the shared serpentine pitch and bend-radius feasibility rule", () => {
    expect(minimumSerpentineBendRadius(0.5)).toBeGreaterThan(0.25);
    expect(minimumSerpentinePitch(0.5, 0.3)).toBe(0.6);
    expect(isSerpentinePitchFeasible(0.55, 0.3, 0.5)).toBe(false);
    expect(isSerpentinePitchFeasible(0.6, 0.3, 0.5)).toBe(true);
    expect(isSerpentinePitchFeasible(0.75, 0.3, 0.5)).toBe(true);
    expect(recommendedSerpentineBendRadius(0.5)).toBe(0.3);
    expect(recommendedSerpentinePitch(0.5, 0.3)).toBe(0.75);
  });

  it("keeps every serpentine core leg at the requested centerline pitch", () => {
    const cases = [
      { pitch: 0.6, bendRadius: 0.3, axis: "horizontal" as const },
      { pitch: 0.75, bendRadius: 0.3, axis: "horizontal" as const },
      { pitch: 0.75, bendRadius: 0.3, axis: "vertical" as const },
    ];

    for (const testCase of cases) {
      const amplitude = 8;
      const project = withSerpentineRoute({
        width: 0.5,
        depth: 0.2,
        pitch: testCase.pitch,
        bendRadius: testCase.bendRadius,
        amplitude,
        turnCount: 4,
        axis: testCase.axis,
      });
      const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

      expect(generated.issues).toEqual([]);
      expect(adjacentLegPitches(generated.corePrimitives, amplitude)).toEqual([
        expect.closeTo(testCase.pitch, 6),
        expect.closeTo(testCase.pitch, 6),
        expect.closeTo(testCase.pitch, 6),
        expect.closeTo(testCase.pitch, 6),
      ]);
    }
  });

  it("uses the same composite U-turn rule for the first and interior turns", () => {
    const pitch = 0.75;
    const bendRadius = 0.3;
    const project = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch,
      bendRadius,
      amplitude: 8,
      turnCount: 4,
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const signature = translatedSignature(generated.corePrimitives);
    const turnSignatures = [0, 1, 2, 3].map((turnIndex) => {
      const start = 1 + turnIndex * 4;
      return signature.slice(start, start + 3).map((primitive) => ({
        kind: primitive.kind,
        length: primitive.length,
        radius: "radius" in primitive ? primitive.radius : undefined,
      }));
    });

    for (const turn of turnSignatures) {
      expect(turn).toEqual([
        {
          kind: "arc",
          length: expect.closeTo((Math.PI * bendRadius) / 2, 6),
          radius: bendRadius,
        },
        {
          kind: "line",
          length: expect.closeTo(pitch - 2 * bendRadius, 6),
          radius: undefined,
        },
        {
          kind: "arc",
          length: expect.closeTo((Math.PI * bendRadius) / 2, 6),
          radius: bendRadius,
        },
      ]);
    }
  });

  it("keeps the body clear gap uniform between adjacent serpentine legs", () => {
    const width = 0.5;
    const pitch = 0.75;
    const amplitude = 8;
    const project = withSerpentineRoute({
      width,
      depth: 0.2,
      pitch,
      bendRadius: 0.3,
      amplitude,
      turnCount: 4,
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const body = deriveRouteBody2D(generated.corePrimitives, width);
    const clearGaps = adjacentLegPitches(generated.corePrimitives, amplitude).map(
      (measuredPitch) => measuredPitch - body.width,
    );

    expect(body.issues).toEqual([]);
    expect(clearGaps).toEqual([
      expect.closeTo(pitch - width, 6),
      expect.closeTo(pitch - width, 6),
      expect.closeTo(pitch - width, 6),
      expect.closeTo(pitch - width, 6),
    ]);
  });

  it("generates compact default serpentine geometry without partial turns", () => {
    const project = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.75,
      bendRadius: 0.3,
      amplitude: 8,
      turnCount: 4,
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(true);
    expect(generated.generatedTurnCount).toBe(4);
    expect(generated.coreEnvelope).not.toBeNull();
    expect(generated.issues).toEqual([]);
  });

  it("allows values near the hard geometric minimum and rejects values below it", () => {
    const legalProject = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.53,
      bendRadius: 0.26,
      amplitude: 8,
      turnCount: 2,
    });
    const illegalProject = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.51,
      bendRadius: 0.26,
      amplitude: 8,
      turnCount: 2,
    });
    const legal = deriveRouteGeometry(legalProject, legalProject.physicalRoutes[0]!);
    const illegal = deriveRouteGeometry(
      illegalProject,
      illegalProject.physicalRoutes[0]!,
    );

    expect(legal.issues.map((issue) => issue.code)).not.toContain(
      "serpentine-u-turn-infeasible",
    );
    expect(illegal.physicalReady).toBe(false);
    expect(illegal.issues.map((issue) => issue.code)).toContain(
      "serpentine-u-turn-infeasible",
    );
  });

  it("rejects a full configured core that cannot fit instead of generating partial turns", () => {
    const project = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 20,
      turnCount: 8,
    });
    const tinyChip = parseProject({
      ...project,
      chip: {
        ...project.chip,
        overallDimensions: {
          ...project.chip.overallDimensions,
          width: { value: 12, unit: "mm", provenance: { source: "user-entered" } },
          height: { value: 8, unit: "mm", provenance: { source: "user-entered" } },
        },
      },
    });

    const generated = deriveRouteGeometry(tinyChip, tinyChip.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(false);
    expect(generated.generatedTurnCount).toBeUndefined();
    expect(generated.corePrimitives).toEqual([]);
    expect(generated.issues.map((issue) => issue.code)).toContain(
      "serpentine-core-does-not-fit",
    );
  });

  it("compacts only draft pitch and radius while preserving turn count and amplitude", () => {
    const roomy = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 4,
      bendRadius: 1.5,
      amplitude: 8,
      turnCount: 4,
    });
    const project = parseProject({
      ...roomy,
      chip: {
        ...roomy.chip,
        overallDimensions: {
          ...roomy.chip.overallDimensions,
          height: { value: 15, unit: "mm", provenance: { source: "user-entered" } },
        },
      },
    });
    const before = JSON.stringify(project);
    const compacted = compactSerpentineRouteDraft(project, project.physicalRoutes[0]!);

    expect(compacted.status).toBe("fit");
    expect(compacted.bendRadius).toBeLessThan(1.5);
    expect(compacted.pitch).toBeLessThan(4);
    expect(compacted.bendRadius).toBeGreaterThan(minimumSerpentineBendRadius(0.5));
    expect(compacted.pitch).toBeGreaterThanOrEqual(
      minimumSerpentinePitch(0.5, compacted.bendRadius!),
    );
    expect(JSON.stringify(project)).toBe(before);

    const route = project.physicalRoutes[0]!;
    const fitted = parseProject({
      ...project,
      physicalRoutes: [
        {
          ...route,
          pattern:
            route.pattern.kind === "serpentine"
              ? {
                  ...route.pattern,
                  pitch: {
                    value: compacted.pitch,
                    unit: "mm",
                    provenance: { source: "user-entered" },
                  },
                }
              : route.pattern,
          bendRadius: {
            value: compacted.bendRadius,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
        },
      ],
    });
    const generated = deriveRouteGeometry(fitted, fitted.physicalRoutes[0]!);
    expect(generated.generatedTurnCount).toBe(4);
    expect(generated.physicalReady).toBe(true);
  });

  it("rejects serpentine pitch and bend-radius combinations that cannot form U-turns", () => {
    let project = withComponent(baseProject(), "junction.splitter", 1, 1);
    project = withComponent(project, "junction.merger", 12, 1.5);
    const connection = {
      id: "connection_serpentine_invalid",
      sourcePortId: project.ports.find((port) => port.name === "Output A")!.id,
      targetPortId: project.ports.find((port) => port.name === "Input A")!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_serpentine_invalid",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: {
            kind: "serpentine",
            turnCount: 1,
            pitch: { value: 0.4, unit: "mm", provenance: { source: "user-entered" } },
            axis: "horizontal",
            sizing: {
              mode: "explicit",
              amplitude: {
                value: 4,
                unit: "mm",
                provenance: { source: "user-entered" },
              },
            },
            placement: { mode: "auto" },
          },
          width: { value: 0.2, unit: "mm", provenance: { source: "user-entered" } },
          depth: { value: 0.1, unit: "mm", provenance: { source: "user-entered" } },
          bendRadius: {
            value: 0.25,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
          metadata: {},
        },
      ],
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(false);
    expect(generated.primitives).toEqual([]);
    expect(generated.issues.map((issue) => issue.code)).toContain(
      "serpentine-u-turn-infeasible",
    );
  });

  it("generates corrected composite U-turns for pitch greater than or equal to two radii", () => {
    const composite = deriveRouteGeometry(
      withSerpentineRoute({
        pitch: 2,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }),
      withSerpentineRoute({
        pitch: 2,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }).physicalRoutes[0]!,
    );
    const exact = deriveRouteGeometry(
      withSerpentineRoute({
        pitch: 1.5,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }),
      withSerpentineRoute({
        pitch: 1.5,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }).physicalRoutes[0]!,
    );
    const impossible = deriveRouteGeometry(
      withSerpentineRoute({
        pitch: 1.4,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }),
      withSerpentineRoute({
        pitch: 1.4,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }).physicalRoutes[0]!,
    );

    expect(composite.issues).toEqual([]);
    expect(composite.physicalReady).toBe(true);
    expect(
      composite.corePrimitives.filter((primitive) => primitive.kind === "arc"),
    ).toHaveLength(2);
    expect(
      composite.corePrimitives.find(
        (primitive) => primitive.kind === "line" && primitive.length < 1,
      )?.length,
    ).toBeCloseTo(0.5, 6);
    expect(exact.physicalReady).toBe(true);
    expect(
      exact.corePrimitives.filter(
        (primitive) => primitive.kind === "line" && primitive.length < 1e-6,
      ),
    ).toHaveLength(0);
    expect(impossible.physicalReady).toBe(false);
    expect(impossible.issues.map((issue) => issue.code)).toContain(
      "serpentine-u-turn-infeasible",
    );
    expect(impossible.issues[0]!.message).toContain("Pitch 1.4 mm");
  });

  it("keeps serpentine core geometry stable while movement changes adaptive tails", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 4,
    });
    const routeBefore = project.physicalRoutes[0]!;
    const generatedBefore = deriveRouteGeometry(project, routeBefore);
    const moved = parseProject({
      ...project,
      components: project.components.map((component, index) =>
        index === 1
          ? {
              ...component,
              position: {
                x: {
                  value: 90,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
                y: component.position.y,
              },
            }
          : component,
      ),
    });
    const generatedAfter = deriveRouteGeometry(moved, moved.physicalRoutes[0]!);

    expect(moved.physicalRoutes[0]).toEqual(routeBefore);
    expect(translatedSignature(generatedAfter.corePrimitives)).toEqual(
      translatedSignature(generatedBefore.corePrimitives),
    );
    expect(
      generatedAfter.entryTailLength + generatedAfter.exitTailLength,
    ).not.toBeCloseTo(generatedBefore.entryTailLength + generatedBefore.exitTailLength);
    expect(generatedAfter.coreLength).toBeCloseTo(generatedBefore.coreLength, 6);
  });

  it("seeds manual core placement from auto and moves only the persisted core center", () => {
    const autoProject = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.75,
      bendRadius: 0.3,
      amplitude: 8,
      turnCount: 4,
    });
    const autoGenerated = deriveRouteGeometry(
      autoProject,
      autoProject.physicalRoutes[0]!,
    );
    const autoCenter = autoGenerated.coreCenter!;
    const manualProject = parseProject({
      ...autoProject,
      physicalRoutes: [
        {
          ...autoProject.physicalRoutes[0]!,
          pattern: {
            ...autoProject.physicalRoutes[0]!.pattern,
            placement: {
              mode: "manual",
              coreCenter: {
                x: {
                  value: autoCenter.x,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
                y: {
                  value: autoCenter.y,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
              },
            },
          },
        },
      ],
    });
    const manualGenerated = deriveRouteGeometry(
      manualProject,
      manualProject.physicalRoutes[0]!,
    );
    const movedProject = parseProject({
      ...manualProject,
      physicalRoutes: [
        {
          ...manualProject.physicalRoutes[0]!,
          pattern: {
            ...manualProject.physicalRoutes[0]!.pattern,
            placement: {
              mode: "manual",
              coreCenter: {
                x: {
                  value: autoCenter.x + 5,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
                y: {
                  value: autoCenter.y,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
              },
            },
          },
        },
      ],
    });
    const movedGenerated = deriveRouteGeometry(
      movedProject,
      movedProject.physicalRoutes[0]!,
    );

    expect(manualGenerated.physicalReady).toBe(true);
    expect(manualGenerated.coreCenter).toMatchObject(autoCenter);
    expect(translatedSignature(manualGenerated.corePrimitives)).toEqual(
      translatedSignature(autoGenerated.corePrimitives),
    );
    expect(movedGenerated.physicalReady).toBe(true);
    expect(movedGenerated.coreCenter?.x).toBeCloseTo(autoCenter.x + 5, 6);
    expect(translatedSignature(movedGenerated.corePrimitives)).toEqual(
      translatedSignature(manualGenerated.corePrimitives),
    );
    expect(movedGenerated.primitives[0]!.start).toMatchObject(
      autoGenerated.primitives[0]!.start,
    );
    expect(movedGenerated.primitives.at(-1)!.end).toMatchObject(
      autoGenerated.primitives.at(-1)!.end,
    );
    expect(projectToSceneGeometry(movedProject).routes[0]!.centerline).toEqual(
      movedGenerated.primitives,
    );
    expect(projectToSceneGeometry(manualProject).routes[0]!.body?.boundary).not.toEqual(
      projectToSceneGeometry(movedProject).routes[0]!.body?.boundary,
    );
    expect(JSON.stringify(movedProject)).not.toContain("boundary");
  });

  it("preserves invalid manual core placement instead of choosing an auto fallback", () => {
    const autoProject = withSerpentineRoute({
      width: 0.5,
      depth: 0.2,
      pitch: 0.75,
      bendRadius: 0.3,
      amplitude: 8,
      turnCount: 4,
      placement: {
        mode: "manual",
        coreCenter: {
          x: { value: 200, unit: "mm", provenance: { source: "user-entered" } },
          y: { value: 200, unit: "mm", provenance: { source: "user-entered" } },
        },
      },
    });

    const generated = deriveRouteGeometry(autoProject, autoProject.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(false);
    expect(generated.primitives).toEqual([]);
    expect(generated.issues.map((issue) => issue.code)).toContain(
      "serpentine-core-outside-chip",
    );
    expect(autoProject.physicalRoutes[0]!.pattern).toMatchObject({
      placement: { mode: "manual" },
    });
  });

  it("preserves explicit horizontal core orientation during vertical target movement", () => {
    const moved = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 4,
      target: { x: 70, y: 30 },
      axis: "horizontal",
    });
    const generated = deriveRouteGeometry(moved, moved.physicalRoutes[0]!);
    const signature = translatedSignature(generated.corePrimitives);

    expect(generated.issues).toEqual([]);
    expect(signature[0]!.start.y).toBe(0);
    expect(signature[0]!.end.y).toBe(0);
    expect(Math.abs(signature[0]!.end.x - signature[0]!.start.x)).toBeCloseTo(8, 6);
  });

  it("exposes generated serpentine buckets and length breakdown", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 4,
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(generated.entryTailPrimitives.length).toBeGreaterThan(0);
    expect(generated.corePrimitives.length).toBeGreaterThan(0);
    expect(generated.exitTailPrimitives.length).toBeGreaterThan(0);
    expect(generated.primitives).toEqual([
      ...generated.entryTailPrimitives,
      ...generated.corePrimitives,
      ...generated.exitTailPrimitives,
    ]);
    expect(generated.actualLength).toBeCloseTo(
      generated.entryTailLength + generated.coreLength + generated.exitTailLength,
      6,
    );
    expect(generated.coreEnvelope).not.toBeNull();
    expect(
      projectToSceneGeometry(project).routes[0]!.body?.boundary.length,
    ).toBeGreaterThan(generated.primitives.length);
  });

  it("generates exact-radius L-tail bends when adjacent segments fit", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 1,
      amplitude: 8,
      turnCount: 1,
      source: { x: 10, y: 4, rotation: Math.PI / 2 },
      target: { x: 70, y: 18 },
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const entryArcs = generated.entryTailPrimitives.filter(
      (primitive) => primitive.kind === "arc",
    );

    expect(generated.issues).toEqual([]);
    expect(entryArcs).toHaveLength(1);
    expect(entryArcs[0]!.radius).toBe(1);
    expectTangentContinuous(generated.entryTailPrimitives);
  });

  it("rejects an infeasible L-tail candidate and selects exact-radius Z-tail bends", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 1,
      target: { x: 70, y: 16 },
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const entryArcs = generated.entryTailPrimitives.filter(
      (primitive) => primitive.kind === "arc",
    );

    expect(generated.issues).toEqual([]);
    expect(entryArcs).toHaveLength(2);
    expect(routeArcRadii(generated.entryTailPrimitives)).toEqual([0.75, 0.75]);
    expectTangentContinuous(generated.entryTailPrimitives);
  });

  it("keeps the route ready when shifted placement succeeds after centered L/Z failure", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 1,
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(true);
    expect(generated.entryTailLength).toBeGreaterThan(0);
    expect(generated.coreLength).toBeGreaterThan(0);
    expect(generated.exitTailLength).toBeGreaterThan(0);
    expect(routeArcRadii(generated.primitives)).toContain(0.75);
  });

  it("does not mutate route parameters when movement requires a shifted core placement", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 1,
      target: { x: 70, y: 16 },
    });
    const valid = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const moved = parseProject({
      ...project,
      components: project.components.map((component, index) =>
        index === 1
          ? {
              ...component,
              position: {
                x: component.position.x,
                y: {
                  value: 10,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
              },
            }
          : component,
      ),
    });
    const invalid = deriveRouteGeometry(moved, moved.physicalRoutes[0]!);
    const recovered = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(valid.physicalReady).toBe(true);
    expect(invalid.physicalReady).toBe(true);
    expect(invalid.actualLength).toBeGreaterThan(0);
    expect(moved.physicalRoutes[0]).toEqual(project.physicalRoutes[0]);
    expect(routeArcRadii(invalid.primitives)).toContain(0.75);
    expect(routeArcRadii(recovered.entryTailPrimitives)).toEqual([0.75, 0.75]);
  });

  it("keeps missing bend radius distinct from configured-radius tail infeasibility", () => {
    const project = parseProject({
      ...withSerpentineRoute({
        pitch: 2,
        bendRadius: 0.75,
        amplitude: 8,
        turnCount: 1,
        target: { x: 70, y: 16 },
      }),
      physicalRoutes: [
        {
          ...withSerpentineRoute({
            pitch: 2,
            bendRadius: 0.75,
            amplitude: 8,
            turnCount: 1,
            target: { x: 70, y: 16 },
          }).physicalRoutes[0]!,
          bendRadius: undefined,
        },
      ],
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(generated.physicalReady).toBe(false);
    expect(generated.primitives).toEqual([]);
    expect(generated.issues.map((issue) => issue.code)).toContain(
      "bend-radius-required",
    );
    expect(generated.issues.map((issue) => issue.code)).not.toContain(
      "serpentine-entry-tail-infeasible",
    );
  });

  it("keeps 3D scene route primitives aligned with generated exact-radius tail arcs", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 1,
      target: { x: 70, y: 16 },
    });
    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const scene = projectToSceneGeometry(project);

    expect(generated.physicalReady).toBe(true);
    expect(routeArcRadii(scene.routes[0]!.centerline)).toEqual(
      routeArcRadii(generated.primitives),
    );
    expect(routeArcRadii(scene.routes[0]!.centerline)).toContain(0.75);
  });

  it("recovers automatically when a moved serpentine target returns to feasible space", () => {
    const project = withSerpentineRoute({
      pitch: 2,
      bendRadius: 0.75,
      amplitude: 8,
      turnCount: 4,
    });
    const impossible = parseProject({
      ...project,
      components: project.components.map((component, index) =>
        index === 1
          ? {
              ...component,
              position: {
                x: {
                  value: 12,
                  unit: "mm",
                  provenance: { source: "user-entered" },
                },
                y: component.position.y,
              },
            }
          : component,
      ),
    });
    const invalid = deriveRouteGeometry(impossible, impossible.physicalRoutes[0]!);
    const recovered = deriveRouteGeometry(project, project.physicalRoutes[0]!);

    expect(invalid.physicalReady).toBe(true);
    expect(invalid.primitives.length).toBeGreaterThan(0);
    expect(impossible.physicalRoutes[0]!.pattern).toEqual(
      project.physicalRoutes[0]!.pattern,
    );
    expect(recovered.physicalReady).toBe(true);
  });

  it("returns route issues instead of throwing for unsupported endpoint geometry", () => {
    let project = withComponent(baseProject(), "reservoir.sample-inlet", 1, 1);
    project = withComponent(project, "valve.normally-open", 6, 1);
    const connection = {
      id: "connection_unsupported_endpoint",
      sourcePortId: project.ports.find((port) => port.direction === "output")!.id,
      targetPortId: project.ports.find(
        (port) =>
          port.componentId === project.components[1]!.id && port.name === "Flow input",
      )!.id,
      metadata: {},
    };
    project = parseProject({
      ...project,
      connections: [connection],
      physicalRoutes: [
        {
          id: "route_unsupported_endpoint",
          connectionId: connection.id,
          layerId: "layer_flow",
          pattern: { kind: "straight" },
          metadata: {},
        },
      ],
    });

    const generated = deriveRouteGeometry(project, project.physicalRoutes[0]!);
    const scene = projectToSceneGeometry(project);

    expect(generated.primitives).toEqual([]);
    expect(generated.physicalReady).toBe(false);
    expect(generated.issues.map((issue) => issue.code)).toContain(
      "route-endpoint-geometry-unavailable",
    );
    expect(scene.routes[0]!.physicalReady).toBe(false);
  });

  it("warns for unsupported components and chip/layer depth mismatch", () => {
    const mismatched = parseProject({
      ...baseProject(),
      chip: {
        ...baseProject().chip,
        overallDimensions: {
          ...baseProject().chip.overallDimensions,
          depth: {
            value: 2,
            unit: "mm",
            provenance: { source: "user-entered" },
          },
        },
      },
    });
    const project = withComponent(mismatched, "valve.normally-open", 2, 2);
    const scene = projectToSceneGeometry(project);

    expect(scene.components).toEqual([]);
    expect(scene.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "chip-layer-depth-mismatch",
        "missing-footprint",
        "unsupported-physical-component",
      ]),
    );
  });
});
