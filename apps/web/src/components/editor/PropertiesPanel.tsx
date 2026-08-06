import { useMemo, useState } from "react";
import {
  DEFINITION_IDENTITY_EXTENSION,
  getComponentDefinition,
  getComponentParameterValues,
  type DefinitionIdentity,
  type ParameterDefinition,
  type ParameterValue,
} from "microfluidic-components";
import type { Component, ComponentId } from "project-model";

import {
  reassignComponentLayerLane,
  renameComponent,
  updateComponentParameterValues,
  updateComponentPositionAndRotation,
} from "../../editor/editorActions";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";

export function PropertiesPanel() {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const component =
    selectedComponentIds.length === 1
      ? project?.components.find((item) => item.id === selectedComponentIds[0])
      : undefined;

  if (!project) {
    return null;
  }
  if (selectedConnectionIds.length === 1 && !component) {
    const connection = project.connections.find(
      (item) => item.id === selectedConnectionIds[0],
    );
    return (
      <aside
        className="editor-panel properties-panel"
        aria-label="Connection properties"
      >
        <h2>Connection</h2>
        <p>{connection?.id}</p>
        <p className="muted">
          {connection?.sourcePortId} to {connection?.targetPortId}
        </p>
      </aside>
    );
  }
  if (!component) {
    return (
      <aside className="editor-panel properties-panel" aria-label="Properties">
        <h2>Properties</h2>
        <p className="muted">Select one component to edit its properties.</p>
      </aside>
    );
  }
  return <ComponentProperties component={component} key={component.id} />;
}

function ComponentProperties(props: { component: Component }) {
  const project = useProjectStore((state) => state.project);
  const identity = props.component.extensions[
    DEFINITION_IDENTITY_EXTENSION
  ] as unknown as DefinitionIdentity;
  const definition = useMemo(
    () => getComponentDefinition(identity.definitionKey),
    [identity.definitionKey],
  );
  const [draft, setDraft] = useState(() => draftFromComponent(props.component));
  const [parameterDraft, setParameterDraft] = useState<Record<string, string>>({});

  if (!project) {
    return null;
  }

  function commit(_label: string, updater: () => void) {
    try {
      updater();
      projectStore.getState().setEditorError(null);
    } catch (error) {
      projectStore.getState().setEditorError({
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "EDITOR_PARAMETER_INVALID",
        message: error instanceof Error ? error.message : "Property update failed",
      });
    }
  }

  function applyBasics() {
    if (!project) {
      return;
    }
    let next = renameComponent(project, props.component.id as ComponentId, draft.name);
    next = updateComponentPositionAndRotation(next, props.component.id as ComponentId, {
      x: Number(draft.x),
      y: Number(draft.y),
      rotation: Number(draft.rotation),
    });
    projectStore.getState().updateProject(() => next, "Update component properties");
  }

  function applyAssignment() {
    if (!project) {
      return;
    }
    const next = reassignComponentLayerLane(
      project,
      props.component.id as ComponentId,
      {
        layerId: draft.layerId,
        laneId: draft.laneId || null,
      },
    );
    projectStore.getState().updateProject(() => next, "Reassign component");
  }

  function applyParameter(parameter: ParameterDefinition, rawValue: string | boolean) {
    if (!project) {
      return;
    }
    const value = parseParameterValue(parameter, rawValue);
    const next = updateComponentParameterValues(project, {
      componentId: props.component.id as ComponentId,
      updates: { [parameter.key]: value },
    });
    projectStore.getState().updateProject(() => next, `Update ${parameter.label}`);
  }

  const values = getComponentParameterValues(props.component);
  const ports = project.ports.filter((port) => port.componentId === props.component.id);

  return (
    <aside className="editor-panel properties-panel" aria-label="Component properties">
      <h2>Properties</h2>
      <section className="property-group">
        <h3>{definition.displayName}</h3>
        <label>
          <span className="label">Name</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <div className="property-row">
          <label>
            <span className="label">X mm</span>
            <input
              value={draft.x}
              onChange={(event) => setDraft({ ...draft, x: event.target.value })}
            />
          </label>
          <label>
            <span className="label">Y mm</span>
            <input
              value={draft.y}
              onChange={(event) => setDraft({ ...draft, y: event.target.value })}
            />
          </label>
        </div>
        <label>
          <span className="label">Rotation rad</span>
          <input
            value={draft.rotation}
            onChange={(event) => setDraft({ ...draft, rotation: event.target.value })}
          />
        </label>
        <button
          type="button"
          onClick={() => commit("Update component properties", applyBasics)}
        >
          Apply properties
        </button>
      </section>
      <section className="property-group">
        <h3>Layer and lane</h3>
        <label>
          <span className="label">Layer</span>
          <select
            value={draft.layerId}
            onChange={(event) => setDraft({ ...draft, layerId: event.target.value })}
          >
            {project.layers.map((layer) => (
              <option value={layer.id} key={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Lane</span>
          <select
            value={draft.laneId}
            onChange={(event) => setDraft({ ...draft, laneId: event.target.value })}
          >
            <option value="">No lane</option>
            {project.lanes.map((lane) => (
              <option value={lane.id} key={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => commit("Reassign component", applyAssignment)}
        >
          Apply assignment
        </button>
      </section>
      <section className="property-group">
        <h3>Parameters</h3>
        {definition.parameters.map((parameter) => (
          <ParameterInput
            parameter={parameter}
            value={values[parameter.key]}
            draft={parameterDraft[parameter.key]}
            key={parameter.key}
            onDraft={(value) =>
              setParameterDraft((current) => ({ ...current, [parameter.key]: value }))
            }
            onApply={(value) =>
              commit(`Update ${parameter.label}`, () =>
                applyParameter(parameter, value),
              )
            }
          />
        ))}
      </section>
      <section className="property-group">
        <h3>Read only</h3>
        <p className="muted">Component ID: {props.component.id}</p>
        <p className="muted">Definition: {identity.definitionKey}</p>
        <p className="muted">Revision: {identity.definitionRevision}</p>
        <p className="muted">Kind: {props.component.kind}</p>
        <p className="muted">Ports: {ports.map((port) => port.id).join(", ")}</p>
      </section>
    </aside>
  );
}

function ParameterInput(props: {
  parameter: ParameterDefinition;
  value: ParameterValue | undefined;
  draft: string | undefined;
  onDraft: (value: string) => void;
  onApply: (value: string | boolean) => void;
}) {
  if (props.parameter.kind === "boolean") {
    return (
      <label className="parameter-line">
        <span>{props.parameter.label}</span>
        <input
          type="checkbox"
          checked={Boolean(props.value)}
          onChange={(event) => props.onApply(event.target.checked)}
        />
      </label>
    );
  }
  if (props.parameter.kind === "enum") {
    return (
      <label className="parameter-line">
        <span>{props.parameter.label}</span>
        <select
          value={String(props.draft ?? props.value ?? "")}
          onChange={(event) => {
            props.onDraft(event.target.value);
            props.onApply(event.target.value);
          }}
        >
          {props.parameter.allowedValues?.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const current = props.draft ?? formatParameterValue(props.value);
  return (
    <div className="parameter-line">
      <label>
        <span>{props.parameter.label}</span>
        <input
          value={current}
          onChange={(event) => props.onDraft(event.target.value)}
        />
      </label>
      {props.parameter.canonicalUnit ? (
        <span>{props.parameter.canonicalUnit}</span>
      ) : null}
      <button type="button" onClick={() => props.onApply(current)}>
        Apply
      </button>
    </div>
  );
}

function draftFromComponent(component: Component) {
  return {
    name: component.name,
    x: String(component.position.x.value),
    y: String(component.position.y.value),
    rotation: String(component.rotation.value),
    layerId: component.layerId,
    laneId: component.laneId ?? "",
  };
}

function formatParameterValue(value: ParameterValue | undefined): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object" && "value" in value) {
    return String(value.value);
  }
  return String(value);
}

function parseParameterValue(
  parameter: ParameterDefinition,
  rawValue: string | boolean,
): ParameterValue {
  if (parameter.kind === "boolean") {
    return Boolean(rawValue);
  }
  if (
    parameter.kind === "length" ||
    parameter.kind === "area" ||
    parameter.kind === "volume" ||
    parameter.kind === "angle"
  ) {
    const value = Number(rawValue);
    return {
      value,
      unit: parameter.canonicalUnit ?? "mm",
      provenance: { source: "user-entered" },
    };
  }
  if (parameter.kind === "integer" || parameter.kind === "number") {
    return Number(rawValue);
  }
  return String(rawValue);
}
