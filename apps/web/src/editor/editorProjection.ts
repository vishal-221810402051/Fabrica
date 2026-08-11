import type { Edge, Node } from "@xyflow/react";
import {
  deriveComponentFootprint,
  deriveFullRoutePolyline,
  deriveJunctionTopology,
  deriveRoutePointAtFraction,
  deriveRouteGeometry,
  getPhysicalPortFrame,
  mmToDisplay,
  pointMmToDisplay,
  type CenterlinePrimitive,
} from "geometry-core";
import type { Component, Connection, Port, PortId, Project } from "project-model";
import {
  DEFINITION_IDENTITY_EXTENSION,
  PORT_TEMPLATE_METADATA,
  getComponentDefinition,
  type DefinitionIdentity,
  type PortTemplateMetadata,
} from "microfluidic-components";

import { createHandleId } from "./handleIds";
import { resolveConnectionRouteContext } from "./connectionRouteSelectors";
import type {
  EditorEdgeData,
  EditorChannelEditPoint,
  EditorNodeData,
  EditorTransientState,
} from "./editor.types";
import { editorError } from "./editorErrors";

export interface EditorProjection {
  nodes: Node<EditorNodeData>[];
  edges: Edge<EditorEdgeData>[];
  channelEditPoints: EditorChannelEditPoint[];
  componentsById: Map<string, Component>;
  portsById: Map<string, Port>;
  connectionsById: Map<string, Connection>;
  connectionCountsByPortId: Map<string, number>;
}

const CHANNEL_EDIT_POINT_MIN_DIAMETER_PX = 12;
const CHANNEL_EDIT_POINT_MAX_DIAMETER_PX = 24;
const CHANNEL_EDIT_POINT_VISUAL_PADDING_PX = 6;
const CHANNEL_EDIT_POINT_HIT_DIAMETER_PX = 30;

export function deriveEditorProjection(
  project: Project,
  transient: Pick<
    EditorTransientState,
    "selectedComponentIds" | "selectedConnectionIds"
  >,
): EditorProjection {
  assertUniqueIds(project.components, "component");
  assertUniqueIds(project.ports, "port");
  assertUniqueIds(project.connections, "connection");
  const componentsById = new Map(project.components.map((item) => [item.id, item]));
  const portsById = new Map(project.ports.map((item) => [item.id, item]));
  const connectionsById = new Map(project.connections.map((item) => [item.id, item]));
  const layersById = new Map(project.layers.map((item) => [item.id, item]));
  const lanesById = new Map(project.lanes.map((item) => [item.id, item]));
  const connectionCountsByPortId = indexConnectionCounts(project.connections);

  const nodes = project.components.map((component) => {
    const identity = readDefinitionIdentity(component);
    const definition = getComponentDefinition(identity.definitionKey);
    const layer = layersById.get(component.layerId);
    const lane = component.laneId ? lanesById.get(component.laneId) : null;
    const ports = component.portIds.map((portId) => {
      const port = portsById.get(portId);
      if (!port || port.componentId !== component.id) {
        throw editorError("EDITOR_PROJECT_INVALID", `Missing port ${portId}`);
      }
      const metadata = readPortTemplateMetadata(port);
      const template = definition.ports.find(
        (candidate) => candidate.key === metadata.templateKey,
      );
      if (!template) {
        throw editorError(
          "EDITOR_PROJECT_INVALID",
          `Missing template ${metadata.templateKey}`,
        );
      }
      const connectedCount = connectionCountsByPortId.get(port.id) ?? 0;
      const full =
        metadata.maxConnections !== null && connectedCount >= metadata.maxConnections;
      return {
        portId: port.id,
        componentId: component.id,
        name: port.name,
        direction: port.direction,
        medium: metadata.medium,
        role: metadata.role,
        templateKey: metadata.templateKey,
        anchor: template.anchor,
        sourceHandleId:
          port.direction === "output" || port.direction === "bidirectional"
            ? createHandleId(port.id, "source")
            : undefined,
        targetHandleId:
          port.direction === "input" || port.direction === "bidirectional"
            ? createHandleId(port.id, "target")
            : undefined,
        connectedCount,
        maxConnections: metadata.maxConnections,
        full,
      };
    });
    const laidOutPorts = layoutPortHandles(ports);
    const footprint = deriveComponentFootprint(component);
    const junctionTopology = deriveJunctionTopology(project, component);
    const data: EditorNodeData = {
      componentId: component.id,
      definitionKey: definition.key,
      label: component.name,
      definitionLabel: definition.displayName,
      persistedKind: component.kind,
      category: definition.category,
      icon: definition.icon,
      ports: laidOutPorts,
      layerName: layer?.name ?? component.layerId,
      laneName: lane?.name ?? null,
      selected: transient.selectedComponentIds.includes(component.id),
      physicalSize: footprint
        ? { x: mmToDisplay(footprint.width), y: mmToDisplay(footprint.height) }
        : { x: mmToDisplay(2), y: mmToDisplay(1) },
      rotation: component.rotation.value,
      physicalReady: Boolean(footprint),
      ...(junctionTopology
        ? {
            junctionBody: {
              boundary: junctionTopology.body.boundary.map((point) =>
                pointMmToDisplay({
                  x: point.x - component.position.x.value,
                  y: point.y - component.position.y.value,
                }),
              ),
              portInterfaces: junctionTopology.body.portInterfaces.map(
                (portInterface) => ({
                  portId: portInterface.portId as PortId,
                  portPosition: pointMmToDisplay({
                    x: portInterface.portPosition.x - component.position.x.value,
                    y: portInterface.portPosition.y - component.position.y.value,
                  }),
                  width: mmToDisplay(portInterface.width),
                  semanticRole: portInterface.semanticRole,
                }),
              ),
            },
          }
        : {}),
    };
    return {
      id: component.id,
      type: "microfluidic",
      position: {
        x: mmToDisplay(component.position.x.value),
        y: mmToDisplay(component.position.y.value),
      },
      data,
    };
  });

  const channelEditPoints: EditorChannelEditPoint[] = [];
  const edges = project.connections.map((connection) => {
    const sourcePort = portsById.get(connection.sourcePortId);
    const targetPort = portsById.get(connection.targetPortId);
    if (!sourcePort || !targetPort) {
      throw editorError(
        "EDITOR_PROJECT_INVALID",
        `Missing connection port ${connection.id}`,
      );
    }
    if (
      !componentsById.has(sourcePort.componentId) ||
      !componentsById.has(targetPort.componentId)
    ) {
      throw editorError(
        "EDITOR_PROJECT_INVALID",
        `Missing connection component ${connection.id}`,
      );
    }
    const routeContext = resolveConnectionRouteContext(project, connection.id);
    const route =
      routeContext.physicalRoute.status === "unique"
        ? routeContext.physicalRoute.route
        : null;
    let routePoints: { x: number; y: number }[] = [];
    let routePath = "";
    if (route) {
      try {
        const routeGeometry =
          routeContext.geometry ?? deriveRouteGeometry(project, route);
        routePoints = deriveFullRoutePolyline(project, route).map(pointMmToDisplay);
        routePath = primitivesToSvgPath(routeGeometry.primitives);
      } catch {
        routePoints = [];
      }
    }
    const editPoint = deriveChannelEditPoint({
      project,
      connection,
      route,
      routeGeometry: routeContext.geometry,
      componentsById,
      portsById,
      selected: transient.selectedConnectionIds.includes(connection.id),
    });
    if (editPoint) {
      channelEditPoints.push(editPoint);
    }
    return {
      id: connection.id,
      type: "physicalRoute",
      source: sourcePort.componentId,
      target: targetPort.componentId,
      selected: transient.selectedConnectionIds.includes(connection.id),
      interactionWidth: 24,
      ariaLabel: `Connection ${connection.id}`,
      sourceHandle: createHandleId(connection.sourcePortId, "source"),
      targetHandle: createHandleId(connection.targetPortId, "target"),
      data: {
        connectionId: connection.id,
        selected: transient.selectedConnectionIds.includes(connection.id),
        routePoints,
        routePath,
        routeWidthPx: route?.width ? Math.max(2, mmToDisplay(route.width.value)) : 2,
        physicalReady: Boolean(route?.width && route.depth),
      },
    };
  });

  return {
    nodes,
    edges,
    channelEditPoints,
    componentsById,
    portsById,
    connectionsById,
    connectionCountsByPortId,
  };
}

function primitivesToSvgPath(primitives: readonly CenterlinePrimitive[]): string {
  if (primitives.length === 0) {
    return "";
  }
  const commands = [
    `M ${mmToDisplay(primitives[0]!.start.x)} ${mmToDisplay(primitives[0]!.start.y)}`,
  ];
  for (const primitive of primitives) {
    if (primitive.kind === "line") {
      commands.push(
        `L ${mmToDisplay(primitive.end.x)} ${mmToDisplay(primitive.end.y)}`,
      );
      continue;
    }
    commands.push(
      [
        "A",
        mmToDisplay(primitive.radius),
        mmToDisplay(primitive.radius),
        0,
        Math.abs(primitive.sweepAngle) > Math.PI ? 1 : 0,
        primitive.clockwise ? 1 : 0,
        mmToDisplay(primitive.end.x),
        mmToDisplay(primitive.end.y),
      ].join(" "),
    );
  }
  return commands.join(" ");
}

function deriveChannelEditPoint(input: {
  project: Project;
  connection: Connection;
  route: Project["physicalRoutes"][number] | null;
  routeGeometry: ReturnType<typeof deriveRouteGeometry> | null | undefined;
  componentsById: Map<string, Component>;
  portsById: Map<string, Port>;
  selected: boolean;
}): EditorChannelEditPoint | null {
  const routeWidthPx = input.route?.width
    ? mmToDisplay(input.route.width.value)
    : undefined;
  const visibleDiameterPx =
    routeWidthPx === undefined
      ? CHANNEL_EDIT_POINT_MIN_DIAMETER_PX
      : clamp(
          routeWidthPx + CHANNEL_EDIT_POINT_VISUAL_PADDING_PX,
          CHANNEL_EDIT_POINT_MIN_DIAMETER_PX,
          CHANNEL_EDIT_POINT_MAX_DIAMETER_PX,
        );
  let point = input.route
    ? deriveRouteEditPoint(input.project, input.route, input.routeGeometry)
    : null;
  point ??= deriveConnectionGuideMidpoint(
    input.project,
    input.connection,
    input.componentsById,
    input.portsById,
  );
  if (!point) {
    return null;
  }
  const sourcePort = input.portsById.get(input.connection.sourcePortId);
  const targetPort = input.portsById.get(input.connection.targetPortId);
  const sourceComponent = sourcePort
    ? input.componentsById.get(sourcePort.componentId)
    : null;
  const targetComponent = targetPort
    ? input.componentsById.get(targetPort.componentId)
    : null;
  return {
    connectionId: input.connection.id,
    position: pointMmToDisplay(point),
    visibleDiameterPx,
    hitDiameterPx: CHANNEL_EDIT_POINT_HIT_DIAMETER_PX,
    selected: input.selected,
    physicalReady: Boolean(input.route?.width && input.route.depth),
    label: `Edit channel from ${sourceComponent?.name ?? "source"} to ${
      targetComponent?.name ?? "target"
    }`,
  };
}

function deriveRouteEditPoint(
  project: Project,
  route: Project["physicalRoutes"][number],
  cachedGeometry: ReturnType<typeof deriveRouteGeometry> | null | undefined,
) {
  try {
    const geometry = cachedGeometry ?? deriveRouteGeometry(project, route);
    const sample = deriveRoutePointAtFraction(geometry.primitives, 0.5);
    return sample?.point ?? null;
  } catch {
    return null;
  }
}

function deriveConnectionGuideMidpoint(
  project: Project,
  connection: Connection,
  componentsById: Map<string, Component>,
  portsById: Map<string, Port>,
) {
  try {
    const sourcePort = portsById.get(connection.sourcePortId);
    const targetPort = portsById.get(connection.targetPortId);
    const sourceComponent = sourcePort
      ? componentsById.get(sourcePort.componentId)
      : null;
    const targetComponent = targetPort
      ? componentsById.get(targetPort.componentId)
      : null;
    if (!sourcePort || !targetPort || !sourceComponent || !targetComponent) {
      return null;
    }
    const source = getPhysicalPortFrame(project, sourceComponent, sourcePort).position;
    const target = getPhysicalPortFrame(project, targetComponent, targetPort).position;
    return {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2,
    };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function layoutPortHandles(ports: EditorNodeData["ports"]): EditorNodeData["ports"] {
  const inputPorts = ports.filter(
    (port) => port.direction === "input" || port.direction === "bidirectional",
  );
  const outputPorts = ports.filter(
    (port) => port.direction === "output" || port.direction === "bidirectional",
  );
  const inputAnchors = sideAnchors(inputPorts, "input");
  const outputAnchors = sideAnchors(outputPorts, "output");

  return ports.map((port) => {
    const inputAnchor = inputAnchors.get(port.portId);
    const outputAnchor = outputAnchors.get(port.portId);
    return {
      ...port,
      anchor: inputAnchor ?? outputAnchor ?? port.anchor,
      ...(inputAnchor ? { inputAnchor } : {}),
      ...(outputAnchor ? { outputAnchor } : {}),
    };
  });
}

function sideAnchors(
  ports: EditorNodeData["ports"],
  side: "input" | "output",
): Map<string, { x: number; y: number }> {
  const x = side === "input" ? 0 : 1;
  if (safeExplicitAnchors(ports, x)) {
    return new Map(ports.map((port) => [port.portId, { x, y: port.anchor.y }]));
  }
  return new Map(
    ports.map((port, index) => [
      port.portId,
      { x, y: (index + 1) / (ports.length + 1) },
    ]),
  );
}

function safeExplicitAnchors(ports: EditorNodeData["ports"], x: number): boolean {
  if (ports.length === 0) {
    return true;
  }
  const yValues = ports
    .map((port) => port.anchor.y)
    .sort((left, right) => left - right);
  return (
    ports.every(
      (port) =>
        port.anchor.x === x &&
        Number.isFinite(port.anchor.y) &&
        port.anchor.y >= 0.08 &&
        port.anchor.y <= 0.92,
    ) &&
    yValues.every((value, index) => index === 0 || value - yValues[index - 1]! >= 0.12)
  );
}

function assertUniqueIds(items: readonly { id: string }[], entityName: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw editorError(
        "EDITOR_PROJECT_INVALID",
        `Duplicate ${entityName} id ${item.id}`,
      );
    }
    seen.add(item.id);
  }
}

export function indexConnectionCounts(
  connections: readonly Connection[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const connection of connections) {
    counts.set(connection.sourcePortId, (counts.get(connection.sourcePortId) ?? 0) + 1);
    counts.set(connection.targetPortId, (counts.get(connection.targetPortId) ?? 0) + 1);
  }
  return counts;
}

function readDefinitionIdentity(component: Component): DefinitionIdentity {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown as
    DefinitionIdentity | undefined;
  if (!identity?.definitionKey) {
    throw editorError(
      "EDITOR_PROJECT_INVALID",
      `Component ${component.id} has no definition`,
    );
  }
  return identity;
}

function readPortTemplateMetadata(port: Port): PortTemplateMetadata {
  const metadata = port.metadata[PORT_TEMPLATE_METADATA] as unknown as
    PortTemplateMetadata | undefined;
  if (!metadata?.templateKey) {
    throw editorError("EDITOR_PROJECT_INVALID", `Port ${port.id} has no template`);
  }
  return metadata;
}
