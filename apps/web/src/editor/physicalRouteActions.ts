import {
  PhysicalRouteSchema,
  createStableId,
  parseProject,
  type ConnectionId,
  type LengthQuantity,
  type PhysicalRoute,
  type Project,
} from "project-model";

import { editorError } from "./editorErrors";

export function updatePhysicalRouteProperties(
  project: Project,
  connectionId: ConnectionId,
  input: {
    width?: LengthQuantity | null;
    depth?: LengthQuantity | null;
    bendRadius?: LengthQuantity | null;
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
  const nextRoute = PhysicalRouteSchema.parse({
    ...(current ?? {
      id: createStableId("route"),
      connectionId,
      layerId: sharedConnectionLayer(
        project,
        connection.sourcePortId,
        connection.targetPortId,
      ),
      waypoints: [],
      metadata: {},
    }),
    ...(input.width === null ? { width: undefined } : { width: input.width }),
    ...(input.depth === null ? { depth: undefined } : { depth: input.depth }),
    ...(input.bendRadius === null
      ? { bendRadius: undefined }
      : { bendRadius: input.bendRadius }),
  }) as PhysicalRoute;

  return parseProject({
    ...project,
    updatedAt: now,
    physicalRoutes: current
      ? project.physicalRoutes.map((route) =>
          route.id === current.id ? nextRoute : route,
        )
      : [...project.physicalRoutes, nextRoute],
  });
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
