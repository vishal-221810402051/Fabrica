import { describe, expect, it } from "vitest";
import { createComponentFromDefinition } from "microfluidic-components";
import { parseProject, type Project } from "project-model";

import {
  deriveComponentFootprint,
  deriveFullRoutePolyline,
  deriveLayerZRanges,
  displayToMm,
  getPhysicalPortPosition,
  isComponentInsideChip,
  mmToDisplay,
  snapPhysicalPoint,
  toCadPoint,
  validatePhysicalGeometry,
} from "./index";

function baseProject(): Project {
  return parseProject({
    schemaVersion: "0.2.0",
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
          waypoints: [
            {
              x: { value: 4, unit: "mm", provenance: { source: "user-entered" } },
              y: { value: 3, unit: "mm", provenance: { source: "user-entered" } },
            },
          ],
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
});
