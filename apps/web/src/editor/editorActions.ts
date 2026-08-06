import {
  ComponentSchema,
  ConnectionSchema,
  createStableId,
  parseProject,
  type Component,
  type ComponentId,
  type Connection,
  type ConnectionId,
  type LayerId,
  type PortId,
  type Project,
} from "project-model";
import {
  DEFINITION_IDENTITY_EXTENSION,
  checkPortCompatibility,
  createComponentFromDefinition,
  duplicateComponentInstance,
  getComponentDefinition,
  updateComponentParameters,
  type DefinitionIdentity,
} from "microfluidic-components";

import { editorError } from "./editorErrors";
import { snapPoint } from "./grid";
import type {
  ConnectionMutationResult,
  DeleteSelectionOptions,
  InsertComponentOptions,
  InsertComponentResult,
  MoveComponentsResult,
  ParameterEditOptions,
  Point,
} from "./editor.types";

export function insertComponentFromDefinition(
  project: Project,
  options: InsertComponentOptions,
  now = new Date().toISOString(),
): InsertComponentResult {
  const layerId = requireLayer(project, options.layerId);
  const definition = getComponentDefinition(options.definitionKey);
  const laneId = resolveLane(project, options.laneId ?? null);
  if (definition.lanePolicy === "required" && !laneId) {
    throw editorError("EDITOR_REQUIRED_LANE_MISSING", "This component requires a lane");
  }
  if (definition.lanePolicy === "forbidden" && laneId) {
    throw editorError(
      "EDITOR_INVALID_LANE",
      "This component cannot be assigned to a lane",
    );
  }
  const result = createComponentFromDefinition({
    definitionKey: options.definitionKey,
    layerId,
    ...(laneId ? { laneId } : {}),
    position: snapPoint(options.position),
    ...(options.name ? { name: options.name } : {}),
  });
  assertNoIdCollisions(project, [
    result.component.id,
    ...result.ports.map((port) => port.id),
  ]);

  const nextProject = parseProject(
    touchProject(
      {
        ...project,
        components: [...project.components, result.component],
        ports: [...project.ports, ...result.ports],
        lanes: laneId
          ? project.lanes.map((lane) =>
              lane.id === laneId
                ? {
                    ...lane,
                    componentIds: Array.from(
                      new Set([...lane.componentIds, result.component.id]),
                    ),
                  }
                : lane,
            )
          : project.lanes,
      },
      now,
    ),
  );

  return {
    project: nextProject,
    insertedComponentId: result.component.id,
    insertedPortIds: result.ports.map((port) => port.id),
    warnings: result.warnings,
  };
}

export function moveComponents(
  project: Project,
  positions: Record<string, Point>,
  now = new Date().toISOString(),
): MoveComponentsResult {
  const snapped = Object.fromEntries(
    Object.entries(positions).map(([id, point]) => [id, snapPoint(point)]),
  );
  const movedIds = Object.keys(snapped);
  const componentIds = new Set(project.components.map((component) => component.id));
  for (const id of movedIds) {
    if (!componentIds.has(id as ComponentId)) {
      throw editorError("EDITOR_PROJECT_INVALID", `Unknown component ${id}`);
    }
  }
  let changed = false;
  const components = project.components.map((component) => {
    const point = snapped[component.id];
    if (!point) {
      return component;
    }
    if (
      component.position.x.value === point.x &&
      component.position.y.value === point.y
    ) {
      return component;
    }
    changed = true;
    return {
      ...component,
      position: {
        x: { ...component.position.x, value: point.x },
        y: { ...component.position.y, value: point.y },
      },
    };
  });
  if (!changed) {
    return { project, movedComponentIds: [], changed: false };
  }
  return {
    project: parseProject(touchProject({ ...project, components }, now)),
    movedComponentIds: movedIds as ComponentId[],
    changed: true,
  };
}

export function createProjectConnection(
  project: Project,
  sourcePortId: PortId,
  targetPortId: PortId,
  now = new Date().toISOString(),
): ConnectionMutationResult {
  const compatibility = checkPortCompatibility({
    sourcePortId,
    targetPortId,
    context: project,
  });
  if (!compatibility.compatible) {
    return { project, issues: compatibility.issues };
  }
  const connection = ConnectionSchema.parse({
    id: createStableId("connection"),
    sourcePortId,
    targetPortId,
    metadata: {},
  }) as Connection;
  assertNoIdCollisions(project, [connection.id]);
  const nextProject = parseProject(
    touchProject(
      { ...project, connections: [...project.connections, connection] },
      now,
    ),
  );
  return { project: nextProject, connection, issues: [] };
}

export function deleteConnections(
  project: Project,
  connectionIds: readonly ConnectionId[],
  now = new Date().toISOString(),
): Project {
  const deleteIds = new Set(connectionIds);
  if (deleteIds.size === 0) {
    return project;
  }
  const nextConnections = project.connections.filter(
    (connection) => !deleteIds.has(connection.id),
  );
  if (nextConnections.length === project.connections.length) {
    return project;
  }
  return parseProject(touchProject({ ...project, connections: nextConnections }, now));
}

export function duplicateSelectedComponent(
  project: Project,
  componentId: ComponentId,
  now = new Date().toISOString(),
): { project: Project; duplicatedComponentId: ComponentId } {
  const component = requireComponent(project, componentId);
  const ports = project.ports.filter((port) => port.componentId === componentId);
  const duplicated = duplicateComponentInstance({
    sourceComponent: component,
    sourcePorts: ports,
    positionOffset: { x: 1, y: 1 },
  });
  assertNoIdCollisions(project, [
    duplicated.duplicatedComponent.id,
    ...duplicated.duplicatedPorts.map((port) => port.id),
  ]);
  const laneId = duplicated.duplicatedComponent.laneId;
  const nextProject = parseProject(
    touchProject(
      {
        ...project,
        components: [...project.components, duplicated.duplicatedComponent],
        ports: [...project.ports, ...duplicated.duplicatedPorts],
        lanes: laneId
          ? project.lanes.map((lane) =>
              lane.id === laneId
                ? {
                    ...lane,
                    componentIds: Array.from(
                      new Set([
                        ...lane.componentIds,
                        duplicated.duplicatedComponent.id,
                      ]),
                    ),
                  }
                : lane,
            )
          : project.lanes,
      },
      now,
    ),
  );
  return {
    project: nextProject,
    duplicatedComponentId: duplicated.duplicatedComponent.id,
  };
}

export function deleteSelection(
  project: Project,
  options: DeleteSelectionOptions,
  now = new Date().toISOString(),
): Project {
  const componentIds = new Set(options.componentIds);
  const connectionIds = new Set(options.connectionIds);
  if (componentIds.size === 0 && connectionIds.size === 0) {
    return project;
  }
  const ownedPortIds = new Set(
    project.ports
      .filter((port) => componentIds.has(port.componentId))
      .map((port) => port.id),
  );
  return parseProject(
    touchProject(
      {
        ...project,
        components: project.components.filter(
          (component) => !componentIds.has(component.id),
        ),
        ports: project.ports.filter((port) => !ownedPortIds.has(port.id)),
        connections: project.connections.filter(
          (connection) =>
            !connectionIds.has(connection.id) &&
            !ownedPortIds.has(connection.sourcePortId) &&
            !ownedPortIds.has(connection.targetPortId),
        ),
        lanes: project.lanes.map((lane) => ({
          ...lane,
          componentIds: lane.componentIds.filter((id) => !componentIds.has(id)),
        })),
      },
      now,
    ),
  );
}

export function renameComponent(
  project: Project,
  componentId: ComponentId,
  name: string,
  now = new Date().toISOString(),
): Project {
  const trimmed = name.trim();
  if (!trimmed) {
    throw editorError("EDITOR_PARAMETER_INVALID", "Component name is required");
  }
  return updateComponent(
    project,
    componentId,
    (component) => ({
      ...component,
      name: trimmed,
    }),
    now,
  );
}

export function updateComponentPositionAndRotation(
  project: Project,
  componentId: ComponentId,
  input: { x?: number; y?: number; rotation?: number },
  now = new Date().toISOString(),
): Project {
  return updateComponent(
    project,
    componentId,
    (component) => ({
      ...component,
      position: {
        x: {
          ...component.position.x,
          value:
            input.x === undefined
              ? component.position.x.value
              : snapPoint({ x: input.x, y: 0 }).x,
        },
        y: {
          ...component.position.y,
          value:
            input.y === undefined
              ? component.position.y.value
              : snapPoint({ x: 0, y: input.y }).y,
        },
      },
      rotation: {
        ...component.rotation,
        value:
          input.rotation === undefined
            ? component.rotation.value
            : finite(input.rotation, "Rotation must be finite"),
      },
    }),
    now,
  );
}

export function updateComponentParameterValues(
  project: Project,
  options: ParameterEditOptions,
  now = new Date().toISOString(),
): Project {
  const component = requireComponent(project, options.componentId);
  const updated = updateComponentParameters({
    component,
    updates: options.updates,
  }).component;
  return replaceComponent(project, updated, now);
}

export function reassignComponentLayerLane(
  project: Project,
  componentId: ComponentId,
  assignment: { layerId?: LayerId; laneId?: string | null },
  now = new Date().toISOString(),
): Project {
  const component = requireComponent(project, componentId);
  const definition = getComponentDefinition(
    readDefinitionIdentity(component).definitionKey,
  );
  const layerId = assignment.layerId ?? component.layerId;
  requireLayer(project, layerId);
  const laneId =
    assignment.laneId === undefined ? (component.laneId ?? null) : assignment.laneId;
  const resolvedLaneId = resolveLane(project, laneId);
  if (definition.lanePolicy === "required" && !resolvedLaneId) {
    throw editorError("EDITOR_REQUIRED_LANE_MISSING", "This component requires a lane");
  }
  if (definition.lanePolicy === "forbidden" && resolvedLaneId) {
    throw editorError("EDITOR_INVALID_LANE", "This component cannot use a lane");
  }
  if (component.layerId === layerId && (component.laneId ?? null) === resolvedLaneId) {
    return project;
  }
  const candidate = ComponentSchema.parse({
    ...component,
    layerId,
    ...(resolvedLaneId ? { laneId: resolvedLaneId } : { laneId: undefined }),
  }) as Component;
  const candidateProject = parseProject(
    touchProject(
      {
        ...project,
        components: project.components.map((item) =>
          item.id === componentId ? candidate : item,
        ),
        lanes: project.lanes.map((lane) => ({
          ...lane,
          componentIds:
            lane.id === resolvedLaneId
              ? Array.from(new Set([...lane.componentIds, componentId]))
              : lane.componentIds.filter((id) => id !== componentId),
        })),
      },
      now,
    ),
  );
  const incidentConnections = candidateProject.connections.filter((connection) => {
    const source = candidateProject.ports.find(
      (port) => port.id === connection.sourcePortId,
    );
    const target = candidateProject.ports.find(
      (port) => port.id === connection.targetPortId,
    );
    return source?.componentId === componentId || target?.componentId === componentId;
  });
  for (const connection of incidentConnections) {
    const compatibility = checkPortCompatibility({
      sourcePortId: connection.sourcePortId,
      targetPortId: connection.targetPortId,
      context: candidateProject,
    });
    if (!compatibility.compatible) {
      throw editorError(
        "EDITOR_REASSIGNMENT_INCOMPATIBLE",
        "Existing connections would become incompatible",
      );
    }
  }
  return candidateProject;
}

function updateComponent(
  project: Project,
  componentId: ComponentId,
  updater: (component: Component) => Component,
  now: string,
): Project {
  const component = requireComponent(project, componentId);
  return replaceComponent(project, updater(component), now);
}

function replaceComponent(
  project: Project,
  component: Component,
  now: string,
): Project {
  const current = requireComponent(project, component.id);
  if (JSON.stringify(current) === JSON.stringify(component)) {
    return project;
  }
  return parseProject(
    touchProject(
      {
        ...project,
        components: project.components.map((item) =>
          item.id === component.id ? component : item,
        ),
      },
      now,
    ),
  );
}

function requireComponent(project: Project, componentId: ComponentId): Component {
  const component = project.components.find((item) => item.id === componentId);
  if (!component) {
    throw editorError("EDITOR_PROJECT_INVALID", `Unknown component ${componentId}`);
  }
  return component;
}

function requireLayer(project: Project, layerId: LayerId | null): LayerId {
  if (!layerId) {
    throw editorError("EDITOR_NO_ACTIVE_LAYER", "No active layer is selected");
  }
  if (!project.layers.some((layer) => layer.id === layerId)) {
    throw editorError("EDITOR_INVALID_LAYER", "Active layer does not exist");
  }
  return layerId;
}

function resolveLane(project: Project, laneId: string | null): string | null {
  if (!laneId) {
    return null;
  }
  if (!project.lanes.some((lane) => lane.id === laneId)) {
    throw editorError("EDITOR_INVALID_LANE", "Active lane does not exist");
  }
  return laneId;
}

function assertNoIdCollisions(project: Project, candidateIds: readonly string[]): void {
  const existing = new Set<string>([
    project.id,
    project.chip.id,
    ...project.layers.map((item) => item.id),
    ...project.lanes.map((item) => item.id),
    ...project.components.map((item) => item.id),
    ...project.ports.map((item) => item.id),
    ...project.connections.map((item) => item.id),
    ...project.fluids.map((item) => item.id),
    ...project.materials.map((item) => item.id),
    ...project.manufacturingProcesses.map((item) => item.id),
    ...project.validationResults.map((item) => item.id),
  ]);
  for (const id of candidateIds) {
    if (existing.has(id)) {
      throw editorError("EDITOR_ID_COLLISION", `Generated ID already exists: ${id}`);
    }
    existing.add(id);
  }
}

function touchProject(project: Project, updatedAt: string): Project {
  return { ...project, updatedAt };
}

function finite(value: number, message: string): number {
  if (!Number.isFinite(value)) {
    throw editorError("EDITOR_NONFINITE_POSITION", message);
  }
  return value;
}

function readDefinitionIdentity(component: Component): DefinitionIdentity {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown as
    DefinitionIdentity | undefined;
  if (!identity?.definitionKey) {
    throw editorError(
      "EDITOR_PROJECT_INVALID",
      "Component definition identity is invalid",
    );
  }
  return identity;
}
