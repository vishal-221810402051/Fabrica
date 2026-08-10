import { deriveRouteGeometry, getPhysicalPortFrame, type Point2D } from "geometry-core";
import {
  PhysicalRouteSchema,
  createStableId,
  parseProject,
  stringifyProject,
  type ConnectionId,
  type LengthQuantity,
  type PhysicalRoute,
  type Project,
  type RoutePattern,
} from "project-model";

import { editorError } from "./editorErrors";
import { snapPoint } from "./grid";

export function updatePhysicalRouteProperties(
  project: Project,
  connectionId: ConnectionId,
  input: {
    width?: LengthQuantity | null;
    depth?: LengthQuantity | null;
    bendRadius?: LengthQuantity | null;
    pattern?: RoutePattern;
  },
  now = new Date().toISOString(),
): Project {
  const connection = project.connections.find((item) => item.id === connectionId);
  if (!connection) {
    throw editorError("EDITOR_PROJECT_INVALID", "Unknown connection");
  }
  const current = project.physicalRoutes.find(
    (route) => route.connectionId === connectionId,
  );
  const patch: Partial<PhysicalRoute> = {};
  if (input.pattern) {
    patch.pattern = input.pattern;
  }
  if ("width" in input) {
    if (input.width !== null) {
      patch.width = input.width;
    } else if (current?.width) {
      patch.width = undefined;
    }
  }
  if ("depth" in input) {
    if (input.depth !== null) {
      patch.depth = input.depth;
    } else if (current?.depth) {
      patch.depth = undefined;
    }
  }
  if ("bendRadius" in input) {
    if (input.bendRadius !== null) {
      patch.bendRadius = input.bendRadius;
    } else if (current?.bendRadius) {
      patch.bendRadius = undefined;
    }
  }
  const nextRoute = normalizeSerpentineRoute(
    project,
    PhysicalRouteSchema.parse({
      ...(current ?? {
        id: createStableId("route"),
        connectionId,
        layerId: sharedConnectionLayer(
          project,
          connection.sourcePortId,
          connection.targetPortId,
        ),
        pattern: { kind: "straight" },
        metadata: {},
      }),
      ...patch,
    }) as PhysicalRoute,
  );
  if (current && JSON.stringify(current) === JSON.stringify(nextRoute)) {
    return project;
  }

  const candidateProject = parseProject({
    ...project,
    physicalRoutes: current
      ? project.physicalRoutes.map((route) =>
          route.id === current.id ? nextRoute : route,
        )
      : [...project.physicalRoutes, nextRoute],
  });
  if (stringifyProject(project) === stringifyProject(candidateProject)) {
    return project;
  }
  return parseProject({
    ...project,
    updatedAt: now,
    physicalRoutes: candidateProject.physicalRoutes,
  });
}

export function updateSerpentineCoreCenter(
  project: Project,
  connectionId: ConnectionId,
  center: Point2D,
  now = new Date().toISOString(),
): Project {
  const snappedCenter = snapPoint(center);
  const route = project.physicalRoutes.find(
    (item) => item.connectionId === connectionId,
  );
  if (!route || route.pattern.kind !== "serpentine") {
    throw editorError(
      "EDITOR_ROUTE_NOT_SERPENTINE",
      "Selected route is not serpentine",
    );
  }
  const nextRoute = PhysicalRouteSchema.parse({
    ...route,
    pattern: {
      ...route.pattern,
      placement: {
        mode: "manual",
        coreCenter: {
          x: lengthQuantity(snappedCenter.x),
          y: lengthQuantity(snappedCenter.y),
        },
      },
    },
  }) as PhysicalRoute;
  if (JSON.stringify(route) === JSON.stringify(nextRoute)) {
    return project;
  }
  return parseProject({
    ...project,
    updatedAt: now,
    physicalRoutes: project.physicalRoutes.map((item) =>
      item.id === route.id ? nextRoute : item,
    ),
  });
}

function normalizeSerpentineRoute(
  project: Project,
  route: PhysicalRoute,
): PhysicalRoute {
  if (route.pattern.kind !== "serpentine") {
    return route;
  }
  const resolvedAxis =
    route.pattern.axis === "auto"
      ? (resolveRouteAxis(project, route) ?? route.pattern.axis)
      : route.pattern.axis;
  let normalized: PhysicalRoute = {
    ...route,
    pattern: {
      ...route.pattern,
      axis: resolvedAxis,
      placement: route.pattern.placement ?? { mode: "auto" },
    },
  };
  if (
    normalized.pattern.kind === "serpentine" &&
    normalized.pattern.sizing.mode === "target-length"
  ) {
    const generated = deriveRouteGeometry(project, normalized);
    if (generated.solvedAmplitude !== undefined) {
      normalized = {
        ...normalized,
        pattern: {
          ...normalized.pattern,
          sizing: {
            mode: "explicit",
            amplitude: {
              value: generated.solvedAmplitude,
              unit: normalized.pattern.sizing.targetLength.unit,
              provenance: normalized.pattern.sizing.targetLength.provenance,
            },
          },
        },
      };
    }
  }
  return normalized;
}

function lengthQuantity(value: number): LengthQuantity {
  return {
    value,
    unit: "mm",
    provenance: { source: "user-entered" },
  };
}

function resolveRouteAxis(
  project: Project,
  route: PhysicalRoute,
): "horizontal" | "vertical" | null {
  const endpoints = resolveRouteEndpointPositions(project, route);
  if (!endpoints) {
    return null;
  }
  return Math.abs(endpoints.target.x - endpoints.source.x) >=
    Math.abs(endpoints.target.y - endpoints.source.y)
    ? "horizontal"
    : "vertical";
}

function resolveRouteEndpointPositions(
  project: Project,
  route: PhysicalRoute,
): { source: Point2D; target: Point2D } | null {
  const connection = project.connections.find((item) => item.id === route.connectionId);
  const sourcePort = project.ports.find((port) => port.id === connection?.sourcePortId);
  const targetPort = project.ports.find((port) => port.id === connection?.targetPortId);
  const sourceComponent = project.components.find(
    (component) => component.id === sourcePort?.componentId,
  );
  const targetComponent = project.components.find(
    (component) => component.id === targetPort?.componentId,
  );
  if (!sourcePort || !targetPort || !sourceComponent || !targetComponent) {
    return null;
  }
  try {
    return {
      source: getPhysicalPortFrame(project, sourceComponent, sourcePort).position,
      target: getPhysicalPortFrame(project, targetComponent, targetPort).position,
    };
  } catch {
    return null;
  }
}

function sharedConnectionLayer(
  project: Project,
  sourcePortId: string,
  targetPortId: string,
): string {
  const sourcePort = project.ports.find((port) => port.id === sourcePortId);
  const targetPort = project.ports.find((port) => port.id === targetPortId);
  const sourceComponent = project.components.find(
    (component) => component.id === sourcePort?.componentId,
  );
  const targetComponent = project.components.find(
    (component) => component.id === targetPort?.componentId,
  );
  if (!sourceComponent || !targetComponent) {
    throw editorError("EDITOR_PROJECT_INVALID", "Connection ports are not owned");
  }
  if (sourceComponent.layerId !== targetComponent.layerId) {
    throw editorError(
      "EDITOR_ROUTE_LAYER_UNRESOLVED",
      "Phase 8A routes require same-layer endpoints",
    );
  }
  return sourceComponent.layerId;
}
