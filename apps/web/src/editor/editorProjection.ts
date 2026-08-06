import type { Edge, Node } from "@xyflow/react";
import type { Component, Connection, Port, Project } from "project-model";
import {
  DEFINITION_IDENTITY_EXTENSION,
  PORT_TEMPLATE_METADATA,
  getComponentDefinition,
  type DefinitionIdentity,
  type PortTemplateMetadata,
} from "microfluidic-components";

import { createHandleId } from "./handleIds";
import type {
  EditorEdgeData,
  EditorNodeData,
  EditorTransientState,
} from "./editor.types";
import { editorError } from "./editorErrors";

export interface EditorProjection {
  nodes: Node<EditorNodeData>[];
  edges: Edge<EditorEdgeData>[];
  componentsById: Map<string, Component>;
  portsById: Map<string, Port>;
  connectionsById: Map<string, Connection>;
  connectionCountsByPortId: Map<string, number>;
}

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
    const data: EditorNodeData = {
      componentId: component.id,
      definitionKey: definition.key,
      label: component.name,
      definitionLabel: definition.displayName,
      persistedKind: component.kind,
      category: definition.category,
      icon: definition.icon,
      ports,
      layerName: layer?.name ?? component.layerId,
      laneName: lane?.name ?? null,
      selected: transient.selectedComponentIds.includes(component.id),
    };
    return {
      id: component.id,
      type: "microfluidic",
      position: {
        x: component.position.x.value,
        y: component.position.y.value,
      },
      data,
    };
  });

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
    return {
      id: connection.id,
      source: sourcePort.componentId,
      target: targetPort.componentId,
      sourceHandle: createHandleId(connection.sourcePortId, "source"),
      targetHandle: createHandleId(connection.targetPortId, "target"),
      data: {
        connectionId: connection.id,
        selected: transient.selectedConnectionIds.includes(connection.id),
      },
    };
  });

  return {
    nodes,
    edges,
    componentsById,
    portsById,
    connectionsById,
    connectionCountsByPortId,
  };
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
