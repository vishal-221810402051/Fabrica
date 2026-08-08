import type { Component, Connection, Port } from "project-model";

import { getComponentDefinition } from "./registry";
import {
  DEFINITION_IDENTITY_EXTENSION,
  PORT_TEMPLATE_METADATA,
  type CompatibilityContext,
  type CompatibilityIssue,
  type CompatibilityResult,
  type ComponentDefinition,
  type DefinitionIdentity,
  type PortRole,
  type PortTemplate,
  type PortTemplateMetadata,
} from "./types";
import { isLaneCompatible, isLayerCompatible } from "./policies";

export function checkPortCompatibility(input: {
  sourcePortId: string;
  targetPortId: string;
  context: CompatibilityContext;
}): CompatibilityResult {
  const issues: CompatibilityIssue[] = [];
  const sourcePort = input.context.ports.find((port) => port.id === input.sourcePortId);
  const targetPort = input.context.ports.find((port) => port.id === input.targetPortId);

  if (!sourcePort) {
    issues.push(issue("PORT_NOT_FOUND", input.sourcePortId, input.targetPortId));
  }
  if (!targetPort) {
    issues.push(issue("PORT_NOT_FOUND", input.sourcePortId, input.targetPortId));
  }
  if (!sourcePort || !targetPort) {
    return result(input.sourcePortId, input.targetPortId, issues);
  }

  const sourceComponent = findComponent(
    input.context.components,
    sourcePort.componentId,
  );
  const targetComponent = findComponent(
    input.context.components,
    targetPort.componentId,
  );
  if (!sourceComponent || !targetComponent) {
    issues.push(issue("PROJECT_OWNERSHIP_MISMATCH", sourcePort.id, targetPort.id));
    return result(sourcePort.id, targetPort.id, issues);
  }

  const sourceDefinition = resolveDefinition(
    sourceComponent,
    sourcePort,
    targetPort,
    issues,
  );
  const targetDefinition = resolveDefinition(
    targetComponent,
    sourcePort,
    targetPort,
    issues,
  );
  const sourceTemplate = sourceDefinition
    ? resolveTemplate(sourceDefinition, sourcePort, sourcePort, targetPort, issues)
    : null;
  const targetTemplate = targetDefinition
    ? resolveTemplate(targetDefinition, targetPort, sourcePort, targetPort, issues)
    : null;

  if (sourcePort.id === targetPort.id) {
    issues.push(issue("SAME_PORT", sourcePort.id, targetPort.id));
  }
  if (
    sourceComponent.id === targetComponent.id &&
    !(
      sourceTemplate?.sameComponentConnectionAllowed &&
      targetTemplate?.sameComponentConnectionAllowed
    )
  ) {
    issues.push(issue("SAME_COMPONENT_FORBIDDEN", sourcePort.id, targetPort.id));
  }
  if (hasDuplicateConnection(input.context.connections, sourcePort.id, targetPort.id)) {
    issues.push(issue("DUPLICATE_CONNECTION", sourcePort.id, targetPort.id));
  }
  if (sourceDefinition && targetDefinition && sourceTemplate && targetTemplate) {
    issues.push(
      ...directionIssues(sourcePort, targetPort),
      ...mediumIssues(
        sourceDefinition,
        targetDefinition,
        sourceTemplate,
        targetTemplate,
        sourcePort,
        targetPort,
      ),
      ...roleIssues(sourceTemplate.role, targetTemplate.role, sourcePort, targetPort),
    );
    if (
      !isLayerCompatible(
        sourceDefinition.layerPolicy,
        sourceComponent.layerId,
        targetComponent.layerId,
      ) ||
      !isLayerCompatible(
        targetDefinition.layerPolicy,
        sourceComponent.layerId,
        targetComponent.layerId,
      )
    ) {
      issues.push(issue("LAYER_INCOMPATIBLE", sourcePort.id, targetPort.id));
    }
    if (
      !isLaneCompatible({
        sourceLanePolicy: sourceDefinition.lanePolicy,
        targetLanePolicy: targetDefinition.lanePolicy,
        sourceLaneId: sourceComponent.laneId,
        targetLaneId: targetComponent.laneId,
      })
    ) {
      issues.push(issue("LANE_INCOMPATIBLE", sourcePort.id, targetPort.id));
    }
    const sourceCount = countConnections(input.context.connections, sourcePort.id);
    const targetCount = countConnections(input.context.connections, targetPort.id);
    const sourceMaxConnections = effectiveMaxConnections(
      sourceDefinition,
      sourceTemplate,
    );
    const targetMaxConnections = effectiveMaxConnections(
      targetDefinition,
      targetTemplate,
    );
    if (sourceMaxConnections !== null && sourceCount >= sourceMaxConnections.maximum) {
      issues.push(
        sourceMaxConnections.legacy
          ? issueWithMessage(
              "LEGACY_MANIFOLD_CAPACITY_EXCEEDED",
              sourcePort.id,
              targetPort.id,
              "Legacy manifold is deprecated; use splitter or merger for new branching.",
            )
          : issue("SOURCE_CAPACITY_EXCEEDED", sourcePort.id, targetPort.id),
      );
    }
    if (targetMaxConnections !== null && targetCount >= targetMaxConnections.maximum) {
      issues.push(
        targetMaxConnections.legacy
          ? issueWithMessage(
              "LEGACY_MANIFOLD_CAPACITY_EXCEEDED",
              sourcePort.id,
              targetPort.id,
              "Legacy manifold is deprecated; use splitter or merger for new branching.",
            )
          : issue("TARGET_CAPACITY_EXCEEDED", sourcePort.id, targetPort.id),
      );
    }
  }

  return result(sourcePort.id, targetPort.id, issues);
}

function resolveDefinition(
  component: Component,
  sourcePort: Port,
  targetPort: Port,
  issues: CompatibilityIssue[],
): ComponentDefinition | null {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown as
    DefinitionIdentity | undefined;
  if (!identity?.definitionKey) {
    issues.push(issue("UNKNOWN_DEFINITION", sourcePort.id, targetPort.id));
    return null;
  }
  try {
    return getComponentDefinition(identity.definitionKey);
  } catch {
    issues.push(issue("UNKNOWN_DEFINITION", sourcePort.id, targetPort.id));
    return null;
  }
}

function resolveTemplate(
  definition: ComponentDefinition,
  port: Port,
  sourcePort: Port,
  targetPort: Port,
  issues: CompatibilityIssue[],
): PortTemplate | null {
  const metadata = port.metadata[PORT_TEMPLATE_METADATA] as unknown as
    PortTemplateMetadata | undefined;
  if (!metadata || !hasExactTemplateMetadataKeys(metadata)) {
    issues.push(issue("UNKNOWN_PORT_TEMPLATE", sourcePort.id, targetPort.id));
    return null;
  }
  const template = definition.ports.find(
    (candidate) => candidate.key === metadata.templateKey,
  );
  if (!template) {
    issues.push(issue("UNKNOWN_PORT_TEMPLATE", sourcePort.id, targetPort.id));
    return null;
  }
  if (
    port.direction !== template.direction ||
    metadata.medium !== template.medium ||
    metadata.role !== template.role ||
    metadata.minConnections !== template.minConnections ||
    metadata.maxConnections !== template.maxConnections
  ) {
    issues.push(issue("PORT_TEMPLATE_MISMATCH", sourcePort.id, targetPort.id));
    return null;
  }
  return template;
}

function hasExactTemplateMetadataKeys(
  metadata: PortTemplateMetadata,
): metadata is PortTemplateMetadata {
  const keys = Object.keys(metadata).sort();
  return (
    keys.length === 5 &&
    keys[0] === "maxConnections" &&
    keys[1] === "medium" &&
    keys[2] === "minConnections" &&
    keys[3] === "role" &&
    keys[4] === "templateKey"
  );
}

function directionIssues(source: Port, target: Port): CompatibilityIssue[] {
  if (source.direction === "input" && target.direction === "output") {
    return [issue("REVERSE_DIRECTION_REQUIRED", source.id, target.id)];
  }
  const legal =
    (source.direction === "output" &&
      (target.direction === "input" || target.direction === "bidirectional")) ||
    (source.direction === "bidirectional" &&
      (target.direction === "input" || target.direction === "bidirectional"));
  return legal ? [] : [issue("DIRECTION_INCOMPATIBLE", source.id, target.id)];
}

function mediumIssues(
  sourceDefinition: ComponentDefinition,
  targetDefinition: ComponentDefinition,
  sourceTemplate: PortTemplate,
  targetTemplate: PortTemplate,
  sourcePort: Port,
  targetPort: Port,
): CompatibilityIssue[] {
  if (sourceTemplate.medium === targetTemplate.medium) {
    if (
      sourceTemplate.medium !== "generic" ||
      (sourceDefinition.allowsGenericCompatibility &&
        targetDefinition.allowsGenericCompatibility)
    ) {
      return [];
    }
  }
  return [issue("MEDIUM_INCOMPATIBLE", sourcePort.id, targetPort.id)];
}

function roleIssues(
  sourceRole: PortRole,
  targetRole: PortRole,
  sourcePort: Port,
  targetPort: Port,
): CompatibilityIssue[] {
  const allowed = new Set([
    "sample->generic",
    "reagent->generic",
    "buffer->generic",
    "generic->generic",
    "generic->waste",
    "waste->waste",
    "control->control",
    "detection->detection",
    "vent->vent",
  ]);
  return allowed.has(`${sourceRole}->${targetRole}`)
    ? []
    : [issue("ROLE_INCOMPATIBLE", sourcePort.id, targetPort.id)];
}

function findComponent(components: readonly Component[], id: string) {
  return components.find((component) => component.id === id);
}

function hasDuplicateConnection(
  connections: readonly Connection[],
  sourcePortId: string,
  targetPortId: string,
): boolean {
  return connections.some(
    (connection) =>
      (connection.sourcePortId === sourcePortId &&
        connection.targetPortId === targetPortId) ||
      (connection.sourcePortId === targetPortId &&
        connection.targetPortId === sourcePortId),
  );
}

function countConnections(connections: readonly Connection[], portId: string): number {
  return connections.filter(
    (connection) =>
      connection.sourcePortId === portId || connection.targetPortId === portId,
  ).length;
}

function effectiveMaxConnections(
  definition: ComponentDefinition,
  template: PortTemplate,
): { maximum: number; legacy: boolean } | null {
  if (definition.key === "junction.manifold" && template.key === "shared") {
    return { maximum: 1, legacy: true };
  }
  return template.maxConnections === null
    ? null
    : { maximum: template.maxConnections, legacy: false };
}

function issue(code: string, sourcePortId: string, targetPortId: string) {
  return issueWithMessage(
    code,
    sourcePortId,
    targetPortId,
    code.replace(/_/g, " ").toLowerCase(),
  );
}

function issueWithMessage(
  code: string,
  sourcePortId: string,
  targetPortId: string,
  message: string,
) {
  return {
    code,
    severity: "error" as const,
    message,
    sourcePortId,
    targetPortId,
  };
}

function result(
  sourcePortId: string,
  targetPortId: string,
  issues: CompatibilityIssue[],
): CompatibilityResult {
  return {
    compatible: !issues.some((candidate) => candidate.severity === "error"),
    normalizedSourcePortId: sourcePortId,
    normalizedTargetPortId: targetPortId,
    issues,
  };
}
