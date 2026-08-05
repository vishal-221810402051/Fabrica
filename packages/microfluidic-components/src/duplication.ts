import { ComponentSchema, PortSchema, createStableId } from "project-model";
import type { Component, Port } from "project-model";

import { ComponentDuplicationError } from "./errors";
import type { DuplicateComponentOptions, DuplicateComponentResult } from "./types";

export function duplicateComponentInstance(
  options: DuplicateComponentOptions,
): DuplicateComponentResult {
  const sourceComponent = ComponentSchema.parse(
    structuredClone(options.sourceComponent),
  ) as Component;
  const sourcePorts = options.sourcePorts.map(
    (port) => PortSchema.parse(structuredClone(port)) as Port,
  );
  const sourcePortIds = new Set(sourcePorts.map((port) => port.id));

  if (sourcePortIds.size !== sourcePorts.length) {
    throw new ComponentDuplicationError("Source ports contain duplicate IDs");
  }
  for (const portId of sourceComponent.portIds) {
    if (!sourcePortIds.has(portId)) {
      throw new ComponentDuplicationError(`Missing source port ${portId}`);
    }
  }
  for (const port of sourcePorts) {
    if (port.componentId !== sourceComponent.id) {
      throw new ComponentDuplicationError(`Port ${port.id} is not owned by source`);
    }
  }

  const duplicatedComponentId = createStableId("component");
  const portIdMapping = Object.fromEntries(
    sourcePorts.map((port) => [port.id, createStableId("port")]),
  ) as DuplicateComponentResult["portIdMapping"];
  const duplicatedPorts = sourcePorts.map((port) =>
    PortSchema.parse({
      ...structuredClone(port),
      id: portIdMapping[port.id],
      componentId: duplicatedComponentId,
    }),
  ) as Port[];
  const offset = options.positionOffset ?? { x: 2, y: 2 };
  const duplicatedComponent = ComponentSchema.parse({
    ...structuredClone(sourceComponent),
    id: duplicatedComponentId,
    name: options.name ?? `Copy of ${sourceComponent.name}`,
    position: {
      x: {
        ...sourceComponent.position.x,
        value: sourceComponent.position.x.value + offset.x,
      },
      y: {
        ...sourceComponent.position.y,
        value: sourceComponent.position.y.value + offset.y,
      },
    },
    portIds: sourceComponent.portIds.map((portId) => portIdMapping[portId]),
  }) as Component;

  return {
    duplicatedComponent,
    duplicatedPorts,
    componentIdMapping: { [sourceComponent.id]: duplicatedComponentId },
    portIdMapping,
  };
}
