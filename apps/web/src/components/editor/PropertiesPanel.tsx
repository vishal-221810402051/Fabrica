import { useMemo, useState, type ReactNode } from "react";
import {
  DEFINITION_IDENTITY_EXTENSION,
  getComponentDefinition,
  getComponentParameterValues,
  type DefinitionIdentity,
  type ParameterDefinition,
  type ParameterValue,
} from "microfluidic-components";
import type {
  Component,
  ComponentId,
  Connection,
  ConnectionId,
  ManufacturingProcess,
  Layer,
  LengthQuantity,
  Material,
  PhysicalRoute,
  Port,
  ProcessId,
  Project,
} from "project-model";
import type { Dimension, ProvenanceSource, Unit } from "units";

import {
  reassignComponentLayerLane,
  renameComponent,
  updateComponentParameterValues,
  updateComponentPositionAndRotation,
} from "../../editor/editorActions";
import {
  updateChipProperties,
  updateLaneProperties,
  updateLayerProperties,
  updateManufacturingProcessProperties,
  updateMaterialProperties,
  updatePortProperties,
  updateProjectName,
} from "../../editor/propertyActions";
import { updatePhysicalRouteProperties } from "../../editor/physicalRouteActions";
import {
  compatibleUnits,
  formatDisplayNumber,
  parseFiniteNumber,
  parseNonEmptyText,
  parseQuantityDraft,
  quantityDraftFromCanonical,
  type QuantityDraft,
} from "../../editor/unitDrafts";
import { projectStore } from "../../state/projectStore";
import { useProjectStore } from "../../state/projectStore.react";

type InspectorScope =
  "selection" | "project" | "chip" | "layer" | "lane" | "material" | "process";

interface FieldError {
  field: string;
  message: string;
}

export function PropertiesPanel() {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const [scope, setScope] = useState<InspectorScope>("selection");
  const [selectedLayerId, setSelectedLayerId] = useState<string>("");
  const [selectedLaneId, setSelectedLaneId] = useState<string>("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");

  if (!project) {
    return null;
  }

  const component =
    selectedComponentIds.length === 1
      ? project.components.find((item) => item.id === selectedComponentIds[0])
      : undefined;
  const layerId = selectedLayerId || project.layers[0]?.id || "";
  const laneId = selectedLaneId || project.lanes[0]?.id || "";
  const materialId = selectedMaterialId || project.materials[0]?.id || "";
  const processId = selectedProcessId || project.manufacturingProcesses[0]?.id || "";

  return (
    <aside className="editor-panel properties-panel" aria-label="Properties">
      <h2>Properties</h2>
      <label>
        <span className="label">Inspector scope</span>
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as InspectorScope)}
        >
          <option value="selection">Selection</option>
          <option value="project">Project</option>
          <option value="chip">Chip</option>
          <option value="layer">Layer</option>
          <option value="lane">Lane</option>
          <option value="material">Material</option>
          <option value="process">Manufacturing process</option>
        </select>
      </label>

      {scope === "selection" ? (
        <SelectionInspector
          project={project}
          component={component}
          selectedComponentIds={selectedComponentIds}
          selectedConnectionIds={selectedConnectionIds}
        />
      ) : null}
      {scope === "project" ? <ProjectEditor project={project} /> : null}
      {scope === "chip" ? <ChipEditor project={project} /> : null}
      {scope === "layer" ? (
        <EntityPicker
          label="Layer"
          value={layerId}
          options={project.layers.map((layer) => ({ id: layer.id, name: layer.name }))}
          onChange={setSelectedLayerId}
        >
          {layerId ? <LayerEditor project={project} layerId={layerId} /> : null}
        </EntityPicker>
      ) : null}
      {scope === "lane" ? (
        <EntityPicker
          label="Lane"
          value={laneId}
          options={project.lanes.map((lane) => ({ id: lane.id, name: lane.name }))}
          empty="No lanes in this project."
          onChange={setSelectedLaneId}
        >
          {laneId ? <LaneEditor project={project} laneId={laneId} /> : null}
        </EntityPicker>
      ) : null}
      {scope === "material" ? (
        <EntityPicker
          label="Material"
          value={materialId}
          options={project.materials.map((material) => ({
            id: material.id,
            name: material.name,
          }))}
          empty="No materials in this project."
          onChange={setSelectedMaterialId}
        >
          {materialId ? (
            <MaterialEditor project={project} materialId={materialId} />
          ) : null}
        </EntityPicker>
      ) : null}
      {scope === "process" ? (
        <EntityPicker
          label="Manufacturing process"
          value={processId}
          options={project.manufacturingProcesses.map((process) => ({
            id: process.id,
            name: process.name,
          }))}
          empty="No manufacturing processes in this project."
          onChange={setSelectedProcessId}
        >
          {processId ? (
            <ManufacturingProcessEditor project={project} processId={processId} />
          ) : null}
        </EntityPicker>
      ) : null}
    </aside>
  );
}

function SelectionInspector(props: {
  project: Project;
  component: Component | undefined;
  selectedComponentIds: string[];
  selectedConnectionIds: string[];
}) {
  if (props.selectedComponentIds.length > 1) {
    return (
      <section className="property-group">
        <h3>Multi-selection</h3>
        <p className="muted">
          {props.selectedComponentIds.length} components selected. Multi-edit is
          read-only in Phase 6.
        </p>
      </section>
    );
  }
  if (props.selectedConnectionIds.length === 1 && !props.component) {
    const connection = props.project.connections.find(
      (item) => item.id === props.selectedConnectionIds[0],
    );
    return connection ? (
      <ConnectionEditor project={props.project} connection={connection} />
    ) : null;
  }
  if (!props.component) {
    return (
      <section className="property-group">
        <p className="muted">Select one component to edit its properties.</p>
      </section>
    );
  }
  return <ComponentEditor project={props.project} component={props.component} />;
}

function ConnectionEditor(props: { project: Project; connection: Connection }) {
  const route = props.project.physicalRoutes.find(
    (candidate) => candidate.connectionId === props.connection.id,
  );
  return (
    <ConnectionRouteEditor
      project={props.project}
      connection={props.connection}
      route={route}
      key={route?.id ?? props.connection.id}
    />
  );
}

function ConnectionRouteEditor(props: {
  project: Project;
  connection: Connection;
  route: PhysicalRoute | undefined;
}) {
  const [width, setWidth] = useState(() => optionalLengthDraft(props.route?.width));
  const [depth, setDepth] = useState(() => optionalLengthDraft(props.route?.depth));
  const [bendRadius, setBendRadius] = useState(() =>
    optionalLengthDraft(props.route?.bendRadius),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Connection route"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update route properties", () =>
          updatePhysicalRouteProperties(
            props.project,
            props.connection.id as ConnectionId,
            {
              width: optionalQuantity(width, "Width"),
              depth: optionalQuantity(depth, "Depth"),
              bendRadius: optionalQuantity(bendRadius, "Bend radius"),
            },
          ),
        )
      }
    >
      <ReadOnly label="Connection ID" value={props.connection.id} />
      <ReadOnly
        label="Ports"
        value={`${props.connection.sourcePortId} to ${props.connection.targetPortId}`}
      />
      <ReadOnly label="Route ID" value={props.route?.id ?? "created on apply"} />
      <ReadOnly label="Route layer" value={props.route?.layerId ?? "endpoint layer"} />
      <QuantityField
        label="Width"
        draft={width}
        dimension="length"
        onChange={setWidth}
      />
      <QuantityField
        label="Depth"
        draft={depth}
        dimension="length"
        onChange={setDepth}
      />
      <QuantityField
        label="Bend radius"
        draft={bendRadius}
        dimension="length"
        onChange={setBendRadius}
      />
      <p className="muted">
        Route endpoints are derived from component ports. Intermediate waypoints are not
        edited in Phase 8A.
      </p>
    </FormSection>
  );
}

function ProjectEditor(props: { project: Project }) {
  const [name, setName] = useState(props.project.name);
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Project"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update project", () =>
          updateProjectName(props.project, name),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <ReadOnly label="Project ID" value={props.project.id} />
      <ReadOnly label="Schema" value={props.project.schemaVersion} />
    </FormSection>
  );
}

function ChipEditor(props: { project: Project }) {
  const chip = props.project.chip;
  const [name, setName] = useState(chip.name);
  const [width, setWidth] = useState(() =>
    quantityDraftFromCanonical(chip.overallDimensions.width, "mm", "length"),
  );
  const [height, setHeight] = useState(() =>
    quantityDraftFromCanonical(chip.overallDimensions.height, "mm", "length"),
  );
  const [depth, setDepth] = useState(() =>
    quantityDraftFromCanonical(chip.overallDimensions.depth, "mm", "length"),
  );
  const [materialId, setMaterialId] = useState(chip.materialId ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Chip"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update chip", () =>
          updateChipProperties(props.project, {
            name,
            width: requiredQuantity(width, "length", "Width"),
            height: requiredQuantity(height, "length", "Height"),
            depth: requiredQuantity(depth, "length", "Depth"),
            materialId: materialId || null,
          }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <QuantityField
        label="Width"
        draft={width}
        dimension="length"
        onChange={setWidth}
      />
      <QuantityField
        label="Height"
        draft={height}
        dimension="length"
        onChange={setHeight}
      />
      <QuantityField
        label="Depth"
        draft={depth}
        dimension="length"
        onChange={setDepth}
      />
      <MaterialSelect
        project={props.project}
        value={materialId}
        onChange={setMaterialId}
      />
      <ReadOnly label="Chip ID" value={chip.id} />
    </FormSection>
  );
}

function LayerEditor(props: { project: Project; layerId: string }) {
  const layer = props.project.layers.find((item) => item.id === props.layerId);
  if (!layer) {
    return null;
  }
  return <LayerEditorInner project={props.project} layer={layer} key={layer.id} />;
}

function LayerEditorInner(props: { project: Project; layer: Layer }) {
  const [name, setName] = useState(props.layer.name);
  const [order, setOrder] = useState(String(props.layer.order));
  const [thickness, setThickness] = useState(() =>
    quantityDraftFromCanonical(props.layer.thickness, "mm", "length"),
  );
  const [materialId, setMaterialId] = useState(props.layer.materialId ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Layer"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update layer", () =>
          updateLayerProperties(props.project, props.layer.id, {
            name,
            order: parseInteger(order, "Layer order"),
            thickness: requiredQuantity(thickness, "length", "Thickness"),
            materialId: materialId || null,
          }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <TextField label="Order" value={order} onChange={setOrder} />
      <QuantityField
        label="Thickness"
        draft={thickness}
        dimension="length"
        onChange={setThickness}
      />
      <MaterialSelect
        project={props.project}
        value={materialId}
        onChange={setMaterialId}
      />
      <ReadOnly label="Layer ID" value={props.layer.id} />
    </FormSection>
  );
}

function LaneEditor(props: { project: Project; laneId: string }) {
  const lane = props.project.lanes.find((item) => item.id === props.laneId);
  const [name, setName] = useState(lane?.name ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  if (!lane) {
    return null;
  }
  return (
    <FormSection
      title="Lane"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update lane", () =>
          updateLaneProperties(props.project, lane.id, { name }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <ReadOnly label="Lane ID" value={lane.id} />
      <ReadOnly label="Components" value={String(lane.componentIds.length)} />
    </FormSection>
  );
}

function ComponentEditor(props: { project: Project; component: Component }) {
  const identity = props.component.extensions[
    DEFINITION_IDENTITY_EXTENSION
  ] as unknown as DefinitionIdentity;
  const definition = useMemo(
    () => getComponentDefinition(identity.definitionKey),
    [identity.definitionKey],
  );
  const [name, setName] = useState(props.component.name);
  const [x, setX] = useState(String(props.component.position.x.value));
  const [y, setY] = useState(String(props.component.position.y.value));
  const [rotation, setRotation] = useState(String(props.component.rotation.value));
  const [layerId, setLayerId] = useState(props.component.layerId);
  const [laneId, setLaneId] = useState(props.component.laneId ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const ports = props.project.ports.filter(
    (port) => port.componentId === props.component.id,
  );
  const values = getComponentParameterValues(props.component);
  const volumePreview = componentVolumePreview(values);
  return (
    <>
      <FormSection
        title={definition.displayName}
        errors={errors}
        onApply={() =>
          applyProjectUpdate(setErrors, "Update component properties", () => {
            let next = renameComponent(
              props.project,
              props.component.id as ComponentId,
              parseNonEmptyText(name, "Component name"),
            );
            next = updateComponentPositionAndRotation(
              next,
              props.component.id as ComponentId,
              {
                x: parseFiniteNumber(x, "X"),
                y: parseFiniteNumber(y, "Y"),
                rotation: parseFiniteNumber(rotation, "Rotation"),
              },
            );
            return next;
          })
        }
      >
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label="X mm" value={x} onChange={setX} />
        <TextField label="Y mm" value={y} onChange={setY} />
        <TextField label="Rotation rad" value={rotation} onChange={setRotation} />
        <ReadOnly label="Component ID" value={props.component.id} />
        <ReadOnly label="Kind" value={props.component.kind} />
      </FormSection>
      <FormSection
        title="Layer and lane"
        errors={errors}
        onApply={() =>
          applyProjectUpdate(setErrors, "Reassign component", () =>
            reassignComponentLayerLane(
              props.project,
              props.component.id as ComponentId,
              {
                layerId,
                laneId: laneId || null,
              },
            ),
          )
        }
      >
        <label>
          <span className="label">Layer</span>
          <select value={layerId} onChange={(event) => setLayerId(event.target.value)}>
            {props.project.layers.map((layer) => (
              <option value={layer.id} key={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Lane</span>
          <select
            value={laneId}
            onChange={(event) => setLaneId(event.target.value)}
            disabled={definition.lanePolicy === "forbidden"}
          >
            <option value="">No lane</option>
            {props.project.lanes.map((lane) => (
              <option value={lane.id} key={lane.id}>
                {lane.name}
              </option>
            ))}
          </select>
        </label>
        <ReadOnly label="Lane policy" value={definition.lanePolicy} />
      </FormSection>
      <section className="property-group">
        <h3>Parameters</h3>
        {definition.parameters.map((parameter) => (
          <ParameterInput
            key={parameter.key}
            component={props.component}
            parameter={parameter}
            value={values[parameter.key]}
            project={props.project}
          />
        ))}
        {volumePreview ? <p className="muted">{volumePreview}</p> : null}
      </section>
      <section className="property-group">
        <h3>Ports</h3>
        {ports.map((port) => (
          <PortEditor project={props.project} port={port} key={port.id} />
        ))}
      </section>
    </>
  );
}

function ParameterInput(props: {
  project: Project;
  component: Component;
  parameter: ParameterDefinition;
  value: ParameterValue | undefined;
}) {
  const [draft, setDraft] = useState(() =>
    parameterDraft(props.parameter, props.value),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  const hasDefault = props.parameter.defaultValue !== undefined;

  function apply(
    value: ParameterValue | undefined,
    label: string,
    provenanceSource?: ProvenanceSource,
  ) {
    applyProjectUpdate(setErrors, label, () =>
      updateComponentParameterValues(props.project, {
        componentId: props.component.id as ComponentId,
        updates: { [props.parameter.key]: value ?? null },
        ...(provenanceSource
          ? { provenanceOverrides: { [props.parameter.key]: provenanceSource } }
          : {}),
      }),
    );
  }

  if (props.parameter.kind === "boolean") {
    return (
      <FormSection
        title={props.parameter.label}
        errors={errors}
        onApply={() =>
          apply(Boolean(draft.text === "true"), `Update ${props.parameter.label}`)
        }
        reset={
          hasDefault
            ? () =>
                apply(
                  props.parameter.defaultValue,
                  `Reset ${props.parameter.label}`,
                  props.parameter.provenanceSource,
                )
            : undefined
        }
      >
        <label className="parameter-line">
          <span>{props.parameter.label}</span>
          <input
            type="checkbox"
            checked={draft.text === "true"}
            onChange={(event) =>
              setDraft({ text: String(event.target.checked), unit: draft.unit })
            }
          />
        </label>
      </FormSection>
    );
  }

  if (props.parameter.kind === "enum") {
    return (
      <FormSection
        title={props.parameter.label}
        errors={errors}
        onApply={() => apply(draft.text, `Update ${props.parameter.label}`)}
        reset={
          hasDefault
            ? () =>
                apply(
                  props.parameter.defaultValue,
                  `Reset ${props.parameter.label}`,
                  props.parameter.provenanceSource,
                )
            : undefined
        }
      >
        <label>
          <span className="label">{props.parameter.label}</span>
          <select
            value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          >
            {props.parameter.allowedValues?.map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </FormSection>
    );
  }

  if (props.parameter.dimension) {
    const quantityDraft = { text: draft.text, displayUnit: draft.unit };
    return (
      <FormSection
        title={props.parameter.label}
        errors={errors}
        onApply={() => {
          const parsed = parseQuantityDraft(quantityDraft, props.parameter.dimension!, {
            required: props.parameter.required,
            positive: props.parameter.minimum === 0 && props.parameter.exclusiveMinimum,
          });
          apply(parsed ?? undefined, `Update ${props.parameter.label}`);
        }}
        reset={
          hasDefault
            ? () =>
                apply(
                  props.parameter.defaultValue,
                  `Reset ${props.parameter.label}`,
                  props.parameter.provenanceSource,
                )
            : undefined
        }
      >
        <QuantityField
          label={props.parameter.label}
          draft={quantityDraft}
          dimension={props.parameter.dimension}
          required={props.parameter.required}
          onChange={(next) => setDraft({ text: next.text, unit: next.displayUnit })}
        />
        {!props.parameter.required ? (
          <button type="button" onClick={() => setDraft({ ...draft, text: "" })}>
            Clear
          </button>
        ) : null}
        <ProvenanceView value={props.value} />
      </FormSection>
    );
  }

  return (
    <FormSection
      title={props.parameter.label}
      errors={errors}
      onApply={() => {
        const value =
          props.parameter.kind === "integer"
            ? parseInteger(draft.text, props.parameter.label)
            : props.parameter.kind === "number"
              ? parseFiniteNumber(draft.text, props.parameter.label)
              : draft.text;
        apply(value, `Update ${props.parameter.label}`);
      }}
      reset={
        hasDefault
          ? () =>
              apply(
                props.parameter.defaultValue,
                `Reset ${props.parameter.label}`,
                props.parameter.provenanceSource,
              )
          : undefined
      }
    >
      <TextField
        label={props.parameter.label}
        value={draft.text}
        onChange={(text) => setDraft({ ...draft, text })}
      />
    </FormSection>
  );
}

function PortEditor(props: { project: Project; port: Port }) {
  const [name, setName] = useState(props.port.name);
  const [fluidId, setFluidId] = useState(props.port.fluidId ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title={props.port.name}
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update port", () =>
          updatePortProperties(props.project, props.port.id, {
            name,
            fluidId: fluidId || null,
          }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <label>
        <span className="label">Fluid</span>
        <select value={fluidId} onChange={(event) => setFluidId(event.target.value)}>
          <option value="">No fluid</option>
          {props.project.fluids.map((fluid) => (
            <option value={fluid.id} key={fluid.id}>
              {fluid.name}
            </option>
          ))}
        </select>
      </label>
      <ReadOnly label="Port ID" value={props.port.id} />
      <ReadOnly label="Direction" value={props.port.direction} />
    </FormSection>
  );
}

function MaterialEditor(props: { project: Project; materialId: string }) {
  const material = props.project.materials.find((item) => item.id === props.materialId);
  if (!material) {
    return null;
  }
  return (
    <MaterialEditorInner
      project={props.project}
      material={material}
      key={material.id}
    />
  );
}

function MaterialEditorInner(props: { project: Project; material: Material }) {
  const [name, setName] = useState(props.material.name);
  const [category, setCategory] = useState(props.material.category);
  const [manufacturer, setManufacturer] = useState(props.material.manufacturer ?? "");
  const [reference, setReference] = useState(props.material.reference ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Material"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update material", () =>
          updateMaterialProperties(props.project, props.material.id, {
            name,
            category,
            manufacturer,
            reference,
          }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <label>
        <span className="label">Category</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Material["category"])}
        >
          {[
            "pdms",
            "glass",
            "silicon",
            "thermoplastic",
            "metal",
            "adhesive",
            "other",
            "unknown",
          ].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Manufacturer" value={manufacturer} onChange={setManufacturer} />
      <TextField label="Reference" value={reference} onChange={setReference} />
      <ReadOnly label="Material ID" value={props.material.id} />
    </FormSection>
  );
}

function ManufacturingProcessEditor(props: { project: Project; processId: string }) {
  const process = props.project.manufacturingProcesses.find(
    (item) => item.id === props.processId,
  );
  const [name, setName] = useState(process?.name ?? "");
  const [processType, setProcessType] = useState<ManufacturingProcess["processType"]>(
    process?.processType ?? "unknown",
  );
  const [profileReference, setProfileReference] = useState(
    process?.profileReference ?? "",
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  if (!process) {
    return null;
  }
  return (
    <FormSection
      title="Manufacturing process"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Update manufacturing process", () =>
          updateManufacturingProcessProperties(props.project, process.id as ProcessId, {
            name,
            processType,
            profileReference,
          }),
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} />
      <label>
        <span className="label">Process type</span>
        <select
          value={processType}
          onChange={(event) =>
            setProcessType(event.target.value as typeof process.processType)
          }
        >
          {[
            "soft-lithography",
            "micromilling",
            "injection-molding",
            "laser-ablation",
            "3d-printing",
            "other",
            "unknown",
          ].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Profile reference"
        value={profileReference}
        onChange={setProfileReference}
      />
      <ReadOnly label="Process ID" value={process.id} />
    </FormSection>
  );
}

function EntityPicker(props: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  empty?: string;
  onChange: (id: string) => void;
  children: ReactNode;
}) {
  if (props.options.length === 0) {
    return (
      <section className="property-group">
        <p className="muted">
          {props.empty ?? `No ${props.label.toLowerCase()} records.`}
        </p>
      </section>
    );
  }
  return (
    <>
      <label>
        <span className="label">{props.label}</span>
        <select
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {props.options.map((option) => (
            <option value={option.id} key={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {props.children}
    </>
  );
}

function FormSection(props: {
  title: string;
  errors: FieldError[];
  onApply: () => void;
  reset?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="property-group">
      <h3>{props.title}</h3>
      {props.children}
      {props.errors.length > 0 ? (
        <div className="editor-feedback editor-feedback-error" role="status">
          <strong>Update blocked</strong>
          <p>{props.errors.map((error) => error.message).join(", ")}</p>
        </div>
      ) : null}
      <button type="button" onClick={props.onApply}>
        Apply
      </button>
      {props.reset ? (
        <button type="button" onClick={props.reset}>
          Reset
        </button>
      ) : null}
    </section>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

function QuantityField(props: {
  label: string;
  draft: QuantityDraft;
  dimension: Dimension;
  required?: boolean;
  onChange: (draft: QuantityDraft) => void;
}) {
  return (
    <div className="property-row">
      <label>
        <span className="label">{props.label}</span>
        <input
          value={props.draft.text}
          onChange={(event) =>
            props.onChange({ ...props.draft, text: event.target.value })
          }
          aria-invalid={draftHasError(
            props.draft,
            props.dimension,
            Boolean(props.required),
          )}
        />
      </label>
      <label>
        <span className="label">Unit</span>
        <select
          value={props.draft.displayUnit}
          onChange={(event) => {
            const nextUnit = event.target.value as Unit;
            let parsed = null;
            try {
              parsed = parseQuantityDraft(props.draft, props.dimension, {
                required: Boolean(props.required),
                positive: false,
              });
            } catch {
              parsed = null;
            }
            props.onChange(
              parsed
                ? quantityDraftFromCanonical(parsed, nextUnit, props.dimension)
                : { ...props.draft, displayUnit: nextUnit },
            );
          }}
        >
          {compatibleUnits(props.dimension).map((unit) => (
            <option value={unit} key={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function MaterialSelect(props: {
  project: Project;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="label">Material</span>
      <select
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option value="">No material</option>
        {props.project.materials.map((material) => (
          <option value={material.id} key={material.id}>
            {material.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnly(props: { label: string; value: string }) {
  return (
    <p className="muted">
      {props.label}: {props.value}
    </p>
  );
}

function ProvenanceView(props: { value: ParameterValue | undefined }) {
  if (
    !props.value ||
    typeof props.value !== "object" ||
    !("provenance" in props.value)
  ) {
    return null;
  }
  return <p className="muted">Provenance: {props.value.provenance?.source}</p>;
}

function applyProjectUpdate(
  setErrors: (errors: FieldError[]) => void,
  label: string,
  updater: () => Project,
) {
  try {
    const next = updater();
    projectStore.getState().updateProject(() => next, label);
    projectStore.getState().setEditorError(null);
    setErrors([]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Property update failed";
    setErrors([{ field: "form", message }]);
    projectStore.getState().setEditorError({
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : "EDITOR_PARAMETER_INVALID",
      message,
    });
  }
}

function requiredQuantity(draft: QuantityDraft, dimension: Dimension, label: string) {
  try {
    return parseQuantityDraft(draft, dimension, {
      required: true,
      positive: true,
    })!;
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : error}`);
  }
}

function optionalQuantity(draft: QuantityDraft, label: string): LengthQuantity | null {
  if (!draft.text.trim()) {
    return null;
  }
  try {
    return parseQuantityDraft(draft, "length", {
      required: false,
      positive: true,
    }) as LengthQuantity | null;
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : error}`);
  }
}

function optionalLengthDraft(quantity: PhysicalRoute["width"]): QuantityDraft {
  return quantity
    ? quantityDraftFromCanonical(quantity, "mm", "length")
    : { text: "", displayUnit: "mm" };
}

function parseInteger(text: string, label: string): number {
  const value = parseFiniteNumber(text, label);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

function draftHasError(
  draft: QuantityDraft,
  dimension: Dimension,
  required: boolean,
): boolean {
  try {
    parseQuantityDraft(draft, dimension, { required, positive: false });
    return false;
  } catch {
    return true;
  }
}

function parameterDraft(
  parameter: ParameterDefinition,
  value: ParameterValue | undefined,
) {
  if (parameter.dimension) {
    const quantity =
      value && typeof value === "object" && "value" in value
        ? value
        : parameter.defaultValue &&
            typeof parameter.defaultValue === "object" &&
            "value" in parameter.defaultValue
          ? parameter.defaultValue
          : undefined;
    const draft = quantity
      ? quantityDraftFromCanonical(
          quantity,
          parameter.canonicalUnit,
          parameter.dimension,
        )
      : { text: "", displayUnit: parameter.canonicalUnit ?? "mm" };
    return { text: draft.text, unit: draft.displayUnit };
  }
  return {
    text: value === undefined || value === null ? "" : String(value),
    unit: "mm" as Unit,
  };
}

function componentVolumePreview(values: Record<string, ParameterValue>): string | null {
  const width = quantityNumber(values.width);
  const height = quantityNumber(values.height);
  const depth = quantityNumber(values.depth);
  if (width === null || height === null || depth === null) {
    return null;
  }
  return `Geometric volume preview: ${formatDisplayNumber(width * height * depth)} mm3`;
}

function quantityNumber(value: ParameterValue | undefined): number | null {
  return value && typeof value === "object" && "value" in value ? value.value : null;
}
