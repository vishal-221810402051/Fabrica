import { describe, expect, it } from "vitest";
import { createComponentFromDefinition } from "microfluidic-components";
import { parseProject, type Project } from "project-model";

import {
  deriveComponentFootprint,
  deriveFullRoutePolyline,
  deriveLayerZRanges,
  deriveRouteGeometry,
  compactSerpentineRouteDraft,
  displayToMm,
  getPhysicalPortFrame,
  getPhysicalPortPosition,
  isComponentInsideChip,
  isSerpentinePitchFeasible,
  minimumSerpentineBendRadius,
  minimumSerpentinePitch,
  mmToDisplay,
  projectToSceneGeometry,
  recommendedSerpentineBendRadius,
  recommendedSerpentinePitch,
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

  it("projects complete rectangular route segments and joint fills", () => {
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
    expect(route.segments).toHaveLength(2);
    expect(route.jointBoxes).toHaveLength(1);
    expect(route.segments[0]).toMatchObject({
      width: 0.2,
      depth: 0.1,
      zTop: 1,
      zBottom: 0.9,
      center: { z: 0.95 },
    });
    expect(route.points.map((point) => point.z)).toEqual([1, 1, 1]);
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
