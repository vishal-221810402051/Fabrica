import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  compactSerpentineRouteDraft,
  isSerpentinePitchFeasible,
  minimumSerpentineBendRadius,
  minimumSerpentinePitch,
  recommendedSerpentineBendRadius,
  recommendedSerpentinePitch,
} from "geometry-core";
import {
  DEFINITION_IDENTITY_EXTENSION,
  getComponentDefinition,
  getComponentParameterValues,
  type ComponentDefinition,
  type DefinitionIdentity,
  type ParameterDefinition,
  type ParameterValue,
} from "microfluidic-components";
import type {
  Component,
  ComponentId,
  ConnectionId,
  LaneId,
  ManufacturingProcess,
  Layer,
  LengthQuantity,
  Material,
  PhysicalRoute,
  Port,
  ProcessId,
  Project,
  RoutePattern,
} from "project-model";
import type { Dimension, ProvenanceSource, Unit } from "units";

import {
  reassignComponentLayerLane,
  reassignSelectedComponentsLane,
  renameComponent,
  updateComponentParameterValues,
  updateComponentPositionAndRotation,
} from "../../editor/editorActions";
import {
  updateChipProperties,
  createLane,
  deleteEmptyLane,
  updateLaneProperties,
  updateLayerProperties,
  updateManufacturingProcessProperties,
  updateMaterialProperties,
  updatePortProperties,
  updateProjectName,
} from "../../editor/propertyActions";
import { updatePhysicalRouteProperties } from "../../editor/physicalRouteActions";
import { inspectLane } from "../../editor/laneSelectors";
import {
  resolveConnectionRouteContext,
  type ConnectionRouteContext,
} from "../../editor/connectionRouteSelectors";
import type { InspectorScope } from "../../editor/editor.types";
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

interface FieldError {
  field: string;
  message: string;
}

interface EditorNotice {
  kind: "success" | "error" | "info";
  message: string;
}

export function PropertiesPanel() {
  const project = useProjectStore((state) => state.project);
  const selectedComponentIds = useProjectStore((state) => state.selectedComponentIds);
  const selectedConnectionIds = useProjectStore((state) => state.selectedConnectionIds);
  const scope = useProjectStore((state) => state.inspectorScope);
  const setScope = useProjectStore((state) => state.setInspectorScope);
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
        <LaneScope
          project={project}
          laneId={laneId}
          onSelectedLaneId={setSelectedLaneId}
        />
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

function LaneScope(props: {
  project: Project;
  laneId: string;
  onSelectedLaneId: (laneId: string) => void;
}) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const laneOptions = props.project.lanes.map((lane) => ({
    id: lane.id,
    name: lane.name,
  }));
  return (
    <>
      <section className="property-group">
        <h3>Lanes</h3>
        {errors.length > 0 ? (
          <div className="editor-feedback editor-feedback-error" role="status">
            <strong>Update blocked</strong>
            <p>{errors.map((error) => error.message).join(", ")}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() =>
            applyProjectUpdate(setErrors, "Add lane", () => {
              let createdLaneId = "";
              const currentProject = projectStore.getState().project ?? props.project;
              const result = createLane(currentProject);
              createdLaneId = result.lane.id;
              props.onSelectedLaneId(createdLaneId);
              return result.project;
            })
          }
        >
          + Add Lane
        </button>
      </section>
      <EntityPicker
        label="Lane"
        value={props.laneId}
        options={laneOptions}
        empty="No lanes in this project."
        onChange={props.onSelectedLaneId}
      >
        {props.laneId ? (
          <LaneEditor
            project={props.project}
            laneId={props.laneId}
            onDeleted={() => props.onSelectedLaneId("")}
          />
        ) : null}
      </EntityPicker>
    </>
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
      <MultiComponentSelectionEditor
        project={props.project}
        selectedComponentIds={props.selectedComponentIds}
      />
    );
  }
  if (props.selectedConnectionIds.length > 1) {
    return (
      <section className="property-group">
        <h3>Connection selection</h3>
        <p className="muted">
          {props.selectedConnectionIds.length} connections selected. Bulk route editing
          is not available.
        </p>
      </section>
    );
  }
  if (props.selectedConnectionIds.length === 1 && !props.component) {
    return (
      <ConnectionEditor
        project={props.project}
        connectionId={props.selectedConnectionIds[0]!}
      />
    );
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

function MultiComponentSelectionEditor(props: {
  project: Project;
  selectedComponentIds: string[];
}) {
  const [laneId, setLaneId] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  return (
    <FormSection
      title="Multi-selection"
      errors={errors}
      onApply={() =>
        applyProjectUpdate(setErrors, "Assign selected components to lane", () =>
          reassignSelectedComponentsLane(
            props.project,
            props.selectedComponentIds as ComponentId[],
            laneId || null,
          ),
        )
      }
    >
      <p className="muted">
        {props.selectedComponentIds.length} components selected. Route properties remain
        single-selection only.
      </p>
      <label>
        <span className="label">Assign selected components to</span>
        <select value={laneId} onChange={(event) => setLaneId(event.target.value)}>
          <option value="">No lane</option>
          {props.project.lanes.map((lane) => (
            <option value={lane.id} key={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </label>
    </FormSection>
  );
}

function ConnectionEditor(props: { project: Project; connectionId: string }) {
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const context = resolveConnectionRouteContext(props.project, props.connectionId);
  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = globalThis.setTimeout(() => setNotice(null), 2500);
    return () => globalThis.clearTimeout(timeout);
  }, [notice]);

  if (!context.connection) {
    return (
      <section className="property-group">
        <h3>Channel / Connection</h3>
        <p className="muted">Selected connection no longer exists.</p>
      </section>
    );
  }
  return (
    <PhysicalRouteProperties
      project={props.project}
      context={context}
      notice={notice}
      onNotice={setNotice}
      key={physicalRouteDraftKey(context, props.connectionId)}
    />
  );
}

function PhysicalRouteProperties(props: {
  project: Project;
  context: ConnectionRouteContext;
  notice: EditorNotice | null;
  onNotice: (notice: EditorNotice | null) => void;
}) {
  const route =
    props.context.physicalRoute.status === "unique"
      ? props.context.physicalRoute.route
      : undefined;
  const routePattern = route?.pattern ?? { kind: "straight" as const };
  const initialDraft = physicalRouteToDraft(route);
  const [width, setWidth] = useState(() => initialDraft.width);
  const [depth, setDepth] = useState(() => initialDraft.depth);
  const [bendRadius, setBendRadius] = useState(() => initialDraft.bendRadius);
  const [patternKind, setPatternKind] = useState<RoutePattern["kind"]>(
    initialDraft.patternKind,
  );
  const [turnCount, setTurnCount] = useState(initialDraft.turnCount);
  const [pitch, setPitch] = useState(() => initialDraft.pitch);
  const [axis, setAxis] = useState<"auto" | "horizontal" | "vertical">(
    initialDraft.axis,
  );
  const [entranceLength, setEntranceLength] = useState(
    () => initialDraft.entranceLength,
  );
  const [exitLength, setExitLength] = useState(() => initialDraft.exitLength);
  const [sizingMode, setSizingMode] = useState<"explicit" | "target-length">(
    initialDraft.sizingMode,
  );
  const [amplitude, setAmplitude] = useState(() => initialDraft.amplitude);
  const [targetLength, setTargetLength] = useState(() => initialDraft.targetLength);
  const [placementMode, setPlacementMode] = useState<"auto" | "manual">(
    initialDraft.placementMode,
  );
  const [coreX, setCoreX] = useState(() => initialDraft.coreX);
  const [coreY, setCoreY] = useState(() => initialDraft.coreY);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const generated = props.context.geometry;
  const editsDisabled = props.context.physicalRoute.status === "duplicate";
  const widthQuantity = optionalQuantityOrNull(width);
  const bendRadiusQuantity = optionalQuantityOrNull(bendRadius);
  const geometricMinimumRadius =
    widthQuantity && widthQuantity.value > 0
      ? minimumSerpentineBendRadius(widthQuantity.value)
      : null;
  const geometricMinimumPitch =
    bendRadiusQuantity && bendRadiusQuantity.value > 0
      ? minimumSerpentinePitch(widthQuantity?.value ?? 0, bendRadiusQuantity.value)
      : null;
  const draftValidationErrors = validateRouteDraft({
    patternKind,
    pitch,
    bendRadius,
    width,
  });
  const formErrors = draftValidationErrors.length > 0 ? draftValidationErrors : errors;
  const applyDisabled = editsDisabled || draftValidationErrors.length > 0;
  function handlePatternKindChange(nextPatternKind: RoutePattern["kind"]) {
    if (nextPatternKind === "serpentine" && patternKind !== "serpentine") {
      const serpentineDraft = defaultSerpentineDraft(route);
      setBendRadius(serpentineDraft.bendRadius);
      setTurnCount(serpentineDraft.turnCount);
      setPitch(serpentineDraft.pitch);
      setAxis(serpentineDraft.axis);
      setEntranceLength(serpentineDraft.entranceLength);
      setExitLength(serpentineDraft.exitLength);
      setSizingMode(serpentineDraft.sizingMode);
      setAmplitude(serpentineDraft.amplitude);
      setTargetLength(serpentineDraft.targetLength);
      setPlacementMode(serpentineDraft.placementMode);
      setCoreX(serpentineDraft.coreX);
      setCoreY(serpentineDraft.coreY);
    }
    setPatternKind(nextPatternKind);
    setErrors([]);
  }
  function handlePlacementModeChange(nextMode: "auto" | "manual") {
    setPlacementMode(nextMode);
    if (nextMode === "manual") {
      const center = generated?.coreCenter;
      setCoreX(lengthDraft(formatDisplayNumber(center?.x ?? 0)));
      setCoreY(lengthDraft(formatDisplayNumber(center?.y ?? 0)));
    }
    setErrors([]);
  }
  function handleCenterCore() {
    const center = generated?.coreCenter;
    if (!center) {
      setErrors([
        {
          field: "placement",
          message: "Core center is not available until the current route is solvable.",
        },
      ]);
      return;
    }
    setPlacementMode("manual");
    setCoreX(lengthDraft(formatDisplayNumber(center.x)));
    setCoreY(lengthDraft(formatDisplayNumber(center.y)));
  }
  function handleCompactToFit() {
    try {
      const candidateRoute = {
        ...(route ?? {
          id: "route_draft_compact",
          connectionId: props.context.connection!.id,
          layerId: props.context.sourceComponent!.layerId,
          pattern: { kind: "straight" as const },
          metadata: {},
        }),
        width: optionalQuantity(width, "Width") ?? undefined,
        depth: optionalQuantity(depth, "Depth") ?? undefined,
        bendRadius: optionalQuantity(bendRadius, "Bend radius") ?? undefined,
        pattern: buildRoutePattern({
          existingPattern: routePattern,
          patternKind,
          turnCount,
          pitch,
          axis,
          entranceLength,
          exitLength,
          sizingMode,
          amplitude,
          targetLength,
          placementMode,
          coreX,
          coreY,
        }),
      } as PhysicalRoute;
      const compacted = compactSerpentineRouteDraft(props.project, candidateRoute);
      if (compacted.status === "fit" && compacted.bendRadius && compacted.pitch) {
        setBendRadius(lengthDraft(formatDisplayNumber(compacted.bendRadius)));
        setPitch(lengthDraft(formatDisplayNumber(compacted.pitch)));
        setErrors([]);
        return;
      }
      setErrors([
        {
          field: "compact",
          message:
            compacted.message ??
            "Configured number of turns cannot fit in available space.",
        },
      ]);
    } catch (error) {
      setErrors([
        {
          field: "compact",
          message:
            error instanceof Error ? error.message : "Compact fit could not run.",
        },
      ]);
    }
  }
  function handleApply() {
    const connectionId = props.context.connection?.id;
    if (!connectionId) {
      const message = "Channel update blocked: Selected connection no longer exists.";
      setErrors([{ field: "connection", message }]);
      props.onNotice({ kind: "error", message });
      return;
    }
    const validationErrors = validateRouteDraft({
      patternKind,
      pitch,
      bendRadius,
      width,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      props.onNotice({
        kind: "error",
        message: `Channel update blocked: ${validationErrors[0]!.message}`,
      });
      return;
    }
    try {
      const nextProject = updatePhysicalRouteProperties(
        props.project,
        connectionId as ConnectionId,
        {
          pattern: buildRoutePattern({
            existingPattern: routePattern,
            patternKind,
            turnCount,
            pitch,
            axis,
            entranceLength,
            exitLength,
            sizingMode,
            amplitude,
            targetLength,
            placementMode,
            coreX,
            coreY,
          }),
          width: optionalQuantity(width, "Width"),
          depth: optionalQuantity(depth, "Depth"),
          bendRadius: optionalQuantity(bendRadius, "Bend radius"),
        },
      );
      if (nextProject === props.project) {
        setErrors([]);
        projectStore.getState().setEditorError(null);
        projectStore.getState().selectConnectionForInspection(connectionId);
        props.onNotice({ kind: "info", message: "No channel changes to apply" });
        return;
      }
      projectStore
        .getState()
        .updateProject(() => nextProject, "Update route properties");
      projectStore.getState().selectConnectionForInspection(connectionId);
      projectStore.getState().setEditorError(null);
      setErrors([]);
      props.onNotice({ kind: "success", message: "Channel properties updated" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Property update failed";
      const message = `Channel update blocked: ${reason}`;
      setErrors([{ field: "form", message: reason }]);
      projectStore.getState().setEditorError({
        code:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "EDITOR_PARAMETER_INVALID",
        message: reason,
      });
      props.onNotice({ kind: "error", message });
    }
  }
  return (
    <FormSection
      title="Channel / Connection"
      errors={formErrors}
      onApply={handleApply}
      disabled={applyDisabled}
    >
      {props.notice ? (
        <EditorNoticeView
          notice={props.notice}
          onDismiss={() => props.onNotice(null)}
        />
      ) : null}
      <ReadOnly
        label="Connection ID"
        value={props.context.connection?.id ?? "missing"}
      />
      <ReadOnly
        label="Source"
        value={`${props.context.sourceComponent?.name ?? "missing component"} / ${props.context.sourcePort?.name ?? "missing port"} (${props.context.sourcePort?.direction ?? "unknown"})`}
      />
      <ReadOnly
        label="Target"
        value={`${props.context.targetComponent?.name ?? "missing component"} / ${props.context.targetPort?.name ?? "missing port"} (${props.context.targetPort?.direction ?? "unknown"})`}
      />
      <ReadOnly label="Lane context" value={formatLaneContext(props.context)} />
      <ReadOnly
        label="Ports"
        value={`${props.context.connection?.sourcePortId ?? "missing"} to ${props.context.connection?.targetPortId ?? "missing"}`}
      />
      <ReadOnly label="Route status" value={formatRouteResolution(props.context)} />
      <ReadOnly label="Route ID" value={route?.id ?? "created on apply"} />
      <ReadOnly label="Layer" value={route?.layerId ?? "endpoint layer"} />
      <ReadOnly label="Readiness" value={formatRouteReadiness(props.context)} />
      {props.context.issues.length > 0 ? (
        <p className="muted">Issues: {props.context.issues.join(", ")}</p>
      ) : null}
      <ReadOnly
        label="Actual length"
        value={
          generated ? `${formatDisplayNumber(generated.actualLength)} mm` : "pending"
        }
      />
      {generated ? (
        <>
          <ReadOnly
            label="Entry tail"
            value={`${formatDisplayNumber(generated.entryTailLength)} mm`}
          />
          <ReadOnly
            label="Serpentine core"
            value={`${formatDisplayNumber(generated.coreLength)} mm`}
          />
          <ReadOnly
            label="Exit tail"
            value={`${formatDisplayNumber(generated.exitTailLength)} mm`}
          />
        </>
      ) : null}
      {generated?.solvedAmplitude !== undefined ? (
        <ReadOnly
          label="Solved amplitude"
          value={`${formatDisplayNumber(generated.solvedAmplitude)} mm`}
        />
      ) : null}
      {generated?.targetDifference !== undefined ? (
        <ReadOnly
          label="Target difference"
          value={`${formatDisplayNumber(generated.targetDifference)} mm`}
        />
      ) : null}
      {generated?.envelope ? (
        <ReadOnly
          label="Envelope"
          value={`${formatDisplayNumber(generated.envelope.minX)}, ${formatDisplayNumber(
            generated.envelope.minY,
          )} to ${formatDisplayNumber(generated.envelope.maxX)}, ${formatDisplayNumber(
            generated.envelope.maxY,
          )} mm`}
        />
      ) : null}
      {generated && generated.issues.length > 0 ? (
        <p className="muted">
          Issues:{" "}
          {generated.issues
            .map((issue) => `${issue.code}: ${issue.message}`)
            .join(", ")}
        </p>
      ) : null}
      <label>
        <span className="label">Pattern</span>
        <select
          value={patternKind}
          onChange={(event) =>
            handlePatternKindChange(event.target.value as RoutePattern["kind"])
          }
        >
          <option value="straight">Straight</option>
          <option value="manual">Manual</option>
          <option value="serpentine">Serpentine</option>
        </select>
      </label>
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
      {patternKind === "serpentine" ? (
        <div className="derived-route-values" aria-label="Geometric limits">
          <p className="muted">
            Minimum radius:{" "}
            {geometricMinimumRadius !== null
              ? `> ${formatDisplayNumber(widthQuantity!.value / 2)} mm`
              : "requires width"}
          </p>
          <p className="muted">
            Minimum pitch:{" "}
            {geometricMinimumPitch !== null
              ? `${formatDisplayNumber(geometricMinimumPitch)} mm`
              : "requires bend radius"}
          </p>
        </div>
      ) : null}
      {patternKind === "manual" ? (
        <p className="muted">
          Waypoints:{" "}
          {routePattern.kind === "manual" ? routePattern.waypoints.length : 0}. Canvas
          waypoint editing is not available yet.
        </p>
      ) : null}
      {patternKind === "serpentine" ? (
        <>
          <TextField label="Turn count" value={turnCount} onChange={setTurnCount} />
          {generated?.generatedTurnCount !== undefined ? (
            <ReadOnly
              label="Generated turns"
              value={`${generated.generatedTurnCount}`}
            />
          ) : null}
          <QuantityField
            label="Pitch"
            draft={pitch}
            dimension="length"
            onChange={setPitch}
          />
          <label>
            <span className="label">Axis</span>
            <select
              value={axis}
              onChange={(event) =>
                setAxis(event.target.value as "auto" | "horizontal" | "vertical")
              }
            >
              <option value="auto">Auto</option>
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
          <QuantityField
            label="Entrance length"
            draft={entranceLength}
            dimension="length"
            onChange={setEntranceLength}
          />
          <QuantityField
            label="Exit length"
            draft={exitLength}
            dimension="length"
            onChange={setExitLength}
          />
          <label>
            <span className="label">Sizing</span>
            <select
              value={sizingMode}
              onChange={(event) =>
                setSizingMode(event.target.value as "explicit" | "target-length")
              }
            >
              <option value="explicit">Explicit amplitude</option>
              <option value="target-length">Target length</option>
            </select>
          </label>
          {sizingMode === "explicit" ? (
            <QuantityField
              label="Amplitude"
              draft={amplitude}
              dimension="length"
              onChange={setAmplitude}
            />
          ) : (
            <QuantityField
              label="Target length"
              draft={targetLength}
              dimension="length"
              onChange={setTargetLength}
            />
          )}
          <label>
            <span className="label">Placement</span>
            <select
              value={placementMode}
              onChange={(event) =>
                handlePlacementModeChange(event.target.value as "auto" | "manual")
              }
            >
              <option value="auto">Auto</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {placementMode === "manual" ? (
            <>
              <QuantityField
                label="Core X"
                draft={coreX}
                dimension="length"
                onChange={setCoreX}
              />
              <QuantityField
                label="Core Y"
                draft={coreY}
                dimension="length"
                onChange={setCoreY}
              />
            </>
          ) : null}
          <div className="inspector-button-row">
            <button type="button" onClick={handleCenterCore}>
              Center core
            </button>
            <button type="button" onClick={handleCompactToFit}>
              Compact to fit
            </button>
          </div>
          {generated?.coreEnvelope ? (
            <ReadOnly
              label="Core envelope"
              value={`${formatDisplayNumber(generated.coreEnvelope.minX)}, ${formatDisplayNumber(
                generated.coreEnvelope.minY,
              )} to ${formatDisplayNumber(generated.coreEnvelope.maxX)}, ${formatDisplayNumber(
                generated.coreEnvelope.maxY,
              )} mm`}
            />
          ) : null}
        </>
      ) : null}
    </FormSection>
  );
}

function EditorNoticeView(props: { notice: EditorNotice; onDismiss: () => void }) {
  const className =
    props.notice.kind === "error"
      ? "editor-feedback editor-feedback-error"
      : props.notice.kind === "success"
        ? "editor-feedback editor-feedback-ok"
        : "editor-feedback editor-feedback-info";
  return (
    <div
      role={props.notice.kind === "error" ? "alert" : "status"}
      className={className}
    >
      <span>{props.notice.message}</span>
      <button type="button" onClick={props.onDismiss} aria-label="Dismiss notice">
        Dismiss
      </button>
    </div>
  );
}

function formatLaneContext(context: ConnectionRouteContext): string {
  if (context.laneContext.status === "same-lane") {
    return context.laneContext.lane.name;
  }
  if (context.laneContext.status === "cross-lane") {
    return `Cross-lane; Source: ${context.sourceLane?.name ?? "Unassigned"}; Target: ${context.targetLane?.name ?? "Unassigned"}`;
  }
  return "Unassigned";
}

function formatRouteResolution(context: ConnectionRouteContext): string {
  if (context.physicalRoute.status === "missing") {
    return "Missing physical route";
  }
  if (context.physicalRoute.status === "duplicate") {
    return `${context.physicalRoute.routes.length} physical routes found; editing disabled`;
  }
  return "Unique physical route";
}

function formatRouteReadiness(context: ConnectionRouteContext): string {
  if (context.physicalRoute.status === "duplicate") {
    return "INVALID - duplicate route records";
  }
  if (context.physicalRoute.status === "missing") {
    return "INCOMPLETE - Missing physical route";
  }
  if (context.issues.length > 0) {
    return `INVALID - ${context.issues.join(", ")}`;
  }
  const route = context.physicalRoute.route;
  const missing = [
    route.width ? "" : "Missing width",
    route.depth ? "" : "Missing depth",
  ].filter(Boolean);
  if (context.geometry && context.geometry.issues.length > 0) {
    return `INVALID - ${context.geometry.issues.map((issue) => issue.code).join(", ")}`;
  }
  if (missing.length > 0) {
    return `INCOMPLETE - ${missing.join(", ")}`;
  }
  return context.geometry?.physicalReady ? "READY" : "INCOMPLETE";
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

function LaneEditor(props: {
  project: Project;
  laneId: string;
  onDeleted: () => void;
}) {
  const lane = props.project.lanes.find((item) => item.id === props.laneId);
  const [name, setName] = useState(lane?.name ?? "");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [routeNotice, setRouteNotice] = useState<EditorNotice | null>(null);
  useEffect(() => {
    if (!routeNotice) {
      return;
    }
    const timeout = globalThis.setTimeout(() => setRouteNotice(null), 2500);
    return () => globalThis.clearTimeout(timeout);
  }, [routeNotice]);

  if (!lane) {
    return null;
  }
  const summary = inspectLane(props.project, lane.id);
  const selectedRoute =
    summary.routes.find((route) => route.route.id === selectedRouteId) ??
    summary.routes[0];
  const selectedConnection = selectedRoute
    ? props.project.connections.find(
        (connection) => connection.id === selectedRoute.route.connectionId,
      )
    : undefined;
  return (
    <>
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
        <ReadOnly label="Components" value={String(summary.components.length)} />
        <ReadOnly label="Chambers" value={String(summary.chambers.length)} />
        <ReadOnly label="Routes" value={String(summary.routes.length)} />
        <ReadOnly
          label="Ready routes"
          value={`${summary.readyRouteCount}/${summary.routes.length}`}
        />
        <ReadOnly
          label="Total actual channel length"
          value={`${formatDisplayNumber(summary.totalActualLength)} mm`}
        />
        {summary.crossLaneRoutes.length > 0 ? (
          <p className="muted">
            {summary.crossLaneRoutes.length} cross-lane or unassigned routes touch this
            lane.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() =>
            applyProjectUpdate(setErrors, "Delete lane", () => {
              const next = deleteEmptyLane(props.project, lane.id as LaneId);
              props.onDeleted();
              return next;
            })
          }
        >
          Delete Empty Lane
        </button>
      </FormSection>
      <section className="property-group">
        <h3>Lane routes</h3>
        {summary.routes.length === 0 ? <p className="muted">No lane routes.</p> : null}
        {summary.routes.map((route) => (
          <button
            type="button"
            key={route.route.id}
            className={selectedRoute?.route.id === route.route.id ? "active" : ""}
            onClick={() => {
              setSelectedRouteId(route.route.id);
              projectStore
                .getState()
                .setSelectedConnections([route.route.connectionId]);
            }}
          >
            {route.sourceComponent.name} to {route.targetComponent.name} ·{" "}
            {formatDisplayNumber(route.actualLength)} mm
          </button>
        ))}
      </section>
      <section className="property-group">
        <h3>Lane chambers</h3>
        {summary.chambers.length === 0 ? (
          <p className="muted">No lane chambers.</p>
        ) : null}
        {summary.chambers.map((component) => (
          <button
            type="button"
            key={component.id}
            onClick={() =>
              projectStore.getState().setSelectedComponents([component.id])
            }
          >
            {component.name}
          </button>
        ))}
      </section>
      {selectedRoute && selectedConnection ? (
        <PhysicalRouteProperties
          project={props.project}
          context={resolveConnectionRouteContext(props.project, selectedConnection.id)}
          notice={routeNotice}
          onNotice={setRouteNotice}
          key={physicalRouteDraftKey(
            resolveConnectionRouteContext(props.project, selectedConnection.id),
            selectedConnection.id,
          )}
        />
      ) : null}
    </>
  );
}

function ComponentEditor(props: { project: Project; component: Component }) {
  const identity = readComponentDefinitionIdentity(props.component);
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
  const hasExplicitJunctionDimensions = isPhysicalSplitterMergerJunction(
    props.component,
    identity.definitionKey,
  );
  const genericParameters = hasExplicitJunctionDimensions
    ? definition.parameters.filter(
        (parameter) => !isJunctionDimensionKey(parameter.key),
      )
    : definition.parameters;
  const volumePreview =
    props.component.kind === "junction" ? null : componentVolumePreview(values);
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
      {hasExplicitJunctionDimensions ? (
        <JunctionPhysicalDimensionsEditor
          project={props.project}
          component={props.component}
          definition={definition}
        />
      ) : null}
      {genericParameters.length > 0 || volumePreview ? (
        <section className="property-group">
          <h3>Parameters</h3>
          {genericParameters.map((parameter) => (
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
      ) : null}
      <section className="property-group">
        <h3>Ports</h3>
        {ports.map((port) => (
          <PortEditor project={props.project} port={port} key={port.id} />
        ))}
      </section>
    </>
  );
}

function JunctionPhysicalDimensionsEditor(props: {
  project: Project;
  component: Component;
  definition: ComponentDefinition;
}) {
  const values = junctionDimensionValues(props.component);
  const defaults = junctionDimensionDefaults(props.definition);
  const [width, setWidth] = useState(() =>
    quantityDraftFromCanonical(
      requiredJunctionDimension(values.width, defaults.width),
      "mm",
      "length",
    ),
  );
  const [height, setHeight] = useState(() =>
    quantityDraftFromCanonical(
      requiredJunctionDimension(values.height, defaults.height),
      "mm",
      "length",
    ),
  );
  const [depth, setDepth] = useState(() =>
    quantityDraftFromCanonical(
      requiredJunctionDimension(values.depth, defaults.depth),
      "mm",
      "length",
    ),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);

  function applyDimensions(
    nextValues: {
      width: ParameterValue;
      height: ParameterValue;
      depth: ParameterValue;
    },
    label: string,
    provenanceSource?: ProvenanceSource,
  ) {
    applyProjectUpdate(setErrors, label, () =>
      updateComponentParameterValues(props.project, {
        componentId: props.component.id as ComponentId,
        updates: nextValues,
        ...(provenanceSource
          ? {
              provenanceOverrides: {
                width: provenanceSource,
                height: provenanceSource,
                depth: provenanceSource,
              },
            }
          : {}),
      }),
    );
  }

  function resetDrafts() {
    setWidth(quantityDraftFromCanonical(defaults.width, "mm", "length"));
    setHeight(quantityDraftFromCanonical(defaults.height, "mm", "length"));
    setDepth(quantityDraftFromCanonical(defaults.depth, "mm", "length"));
  }

  return (
    <FormSection
      title="Physical dimensions"
      errors={errors}
      onApply={() =>
        applyDimensions(
          {
            width: requiredQuantity(width, "length", "Width"),
            height: requiredQuantity(height, "length", "Height"),
            depth: requiredQuantity(depth, "length", "Depth"),
          },
          `Update ${props.definition.displayName} dimensions`,
        )
      }
      reset={() => {
        resetDrafts();
        applyDimensions(
          { width: defaults.width, height: defaults.height, depth: defaults.depth },
          `Reset ${props.definition.displayName} dimensions`,
          "system-default",
        );
      }}
      resetLabel="Reset dimensions"
    >
      <QuantityField
        label="Width"
        draft={width}
        dimension="length"
        required
        onChange={setWidth}
      />
      <QuantityField
        label="Height"
        draft={height}
        dimension="length"
        required
        onChange={setHeight}
      />
      <QuantityField
        label="Depth"
        draft={depth}
        dimension="length"
        required
        onChange={setDepth}
      />
      <p className="muted">Instance-owned junction footprint.</p>
    </FormSection>
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
  resetLabel?: string;
  disabled?: boolean;
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
      <button type="button" onClick={props.onApply} disabled={props.disabled}>
        Apply
      </button>
      {props.reset ? (
        <button type="button" onClick={props.reset}>
          {props.resetLabel ?? "Reset"}
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

interface PhysicalRouteDraft {
  width: QuantityDraft;
  depth: QuantityDraft;
  bendRadius: QuantityDraft;
  patternKind: RoutePattern["kind"];
  turnCount: string;
  pitch: QuantityDraft;
  axis: "auto" | "horizontal" | "vertical";
  entranceLength: QuantityDraft;
  exitLength: QuantityDraft;
  sizingMode: "explicit" | "target-length";
  amplitude: QuantityDraft;
  targetLength: QuantityDraft;
  placementMode: "auto" | "manual";
  coreX: QuantityDraft;
  coreY: QuantityDraft;
}

const DEFAULT_SERPENTINE_TURN_COUNT = "4";
const DEFAULT_SERPENTINE_AMPLITUDE_MM = "8";
const DEFAULT_SERPENTINE_TARGET_LENGTH_MM = "20";

function physicalRouteDraftKey(
  context: ConnectionRouteContext,
  fallbackConnectionId: string,
): string {
  if (context.physicalRoute.status !== "unique") {
    return `connection:${fallbackConnectionId}:${context.physicalRoute.status}`;
  }
  const route = context.physicalRoute.route;
  return JSON.stringify({
    id: route.id,
    connectionId: route.connectionId,
    layerId: route.layerId,
    pattern: route.pattern,
    width: route.width,
    depth: route.depth,
    bendRadius: route.bendRadius,
  });
}

function physicalRouteToDraft(route: PhysicalRoute | undefined): PhysicalRouteDraft {
  const routePattern = route?.pattern ?? { kind: "straight" as const };
  const defaultSerpentine = defaultSerpentineDraft(route);
  return {
    width: optionalLengthDraft(route?.width),
    depth: optionalLengthDraft(route?.depth),
    bendRadius: optionalLengthDraft(route?.bendRadius),
    patternKind: routePattern.kind,
    turnCount:
      routePattern.kind === "serpentine"
        ? String(routePattern.turnCount)
        : defaultSerpentine.turnCount,
    pitch:
      routePattern.kind === "serpentine"
        ? quantityDraftFromCanonical(routePattern.pitch, "mm", "length")
        : defaultSerpentine.pitch,
    axis:
      routePattern.kind === "serpentine" ? routePattern.axis : defaultSerpentine.axis,
    entranceLength:
      routePattern.kind === "serpentine"
        ? optionalLengthDraft(routePattern.entranceLength)
        : defaultSerpentine.entranceLength,
    exitLength:
      routePattern.kind === "serpentine"
        ? optionalLengthDraft(routePattern.exitLength)
        : defaultSerpentine.exitLength,
    sizingMode:
      routePattern.kind === "serpentine"
        ? routePattern.sizing.mode
        : defaultSerpentine.sizingMode,
    amplitude:
      routePattern.kind === "serpentine" && routePattern.sizing.mode === "explicit"
        ? quantityDraftFromCanonical(routePattern.sizing.amplitude, "mm", "length")
        : defaultSerpentine.amplitude,
    targetLength:
      routePattern.kind === "serpentine" && routePattern.sizing.mode === "target-length"
        ? quantityDraftFromCanonical(routePattern.sizing.targetLength, "mm", "length")
        : defaultSerpentine.targetLength,
    placementMode:
      routePattern.kind === "serpentine"
        ? routePattern.placement.mode
        : defaultSerpentine.placementMode,
    coreX:
      routePattern.kind === "serpentine" && routePattern.placement.mode === "manual"
        ? quantityDraftFromCanonical(
            routePattern.placement.coreCenter.x,
            "mm",
            "length",
          )
        : defaultSerpentine.coreX,
    coreY:
      routePattern.kind === "serpentine" && routePattern.placement.mode === "manual"
        ? quantityDraftFromCanonical(
            routePattern.placement.coreCenter.y,
            "mm",
            "length",
          )
        : defaultSerpentine.coreY,
  };
}

function defaultSerpentineDraft(route: PhysicalRoute | undefined): PhysicalRouteDraft {
  const widthMm =
    route?.width && Number.isFinite(route.width.value) && route.width.value > 0
      ? route.width.value
      : undefined;
  const bendRadiusMm =
    route?.bendRadius &&
    Number.isFinite(route.bendRadius.value) &&
    route.bendRadius.value > 0
      ? route.bendRadius.value
      : recommendedSerpentineBendRadius(widthMm);
  const pitchMm = recommendedSerpentinePitch(widthMm, bendRadiusMm);
  return {
    width: optionalLengthDraft(route?.width),
    depth: optionalLengthDraft(route?.depth),
    bendRadius: route?.bendRadius
      ? quantityDraftFromCanonical(route.bendRadius, "mm", "length")
      : lengthDraft(formatDisplayNumber(bendRadiusMm)),
    patternKind: "serpentine",
    turnCount: DEFAULT_SERPENTINE_TURN_COUNT,
    pitch: lengthDraft(formatDisplayNumber(pitchMm)),
    axis: "auto",
    entranceLength: lengthDraft(""),
    exitLength: lengthDraft(""),
    sizingMode: "explicit",
    amplitude: lengthDraft(DEFAULT_SERPENTINE_AMPLITUDE_MM),
    targetLength: lengthDraft(DEFAULT_SERPENTINE_TARGET_LENGTH_MM),
    placementMode: "auto",
    coreX: lengthDraft(""),
    coreY: lengthDraft(""),
  };
}

function validateRouteDraft(input: {
  patternKind: RoutePattern["kind"];
  pitch: QuantityDraft;
  bendRadius: QuantityDraft;
  width: QuantityDraft;
}): FieldError[] {
  if (input.patternKind !== "serpentine") {
    return [];
  }
  const errors: FieldError[] = [];
  let pitch: LengthQuantity | null = null;
  let bendRadius: LengthQuantity | null = null;
  let width: LengthQuantity | null = null;
  try {
    pitch = requiredLengthQuantity(input.pitch, "Pitch");
  } catch (error) {
    errors.push({
      field: "pitch",
      message: error instanceof Error ? error.message : "Pitch is invalid",
    });
  }
  try {
    bendRadius = optionalQuantity(input.bendRadius, "Bend radius");
  } catch (error) {
    errors.push({
      field: "bendRadius",
      message: error instanceof Error ? error.message : "Bend radius is invalid",
    });
  }
  try {
    width = optionalQuantity(input.width, "Width");
  } catch (error) {
    errors.push({
      field: "width",
      message: error instanceof Error ? error.message : "Width is invalid",
    });
  }
  if (
    width &&
    bendRadius &&
    bendRadius.value < minimumSerpentineBendRadius(width.value)
  ) {
    errors.push({
      field: "bendRadius",
      message: `Minimum bend radius for a ${formatDisplayNumber(
        width.value,
      )} mm route width is greater than ${formatDisplayNumber(width.value / 2)} mm.`,
    });
  }
  if (
    pitch &&
    bendRadius &&
    !isSerpentinePitchFeasible(pitch.value, bendRadius.value, width?.value)
  ) {
    errors.push({
      field: "pitch",
      message: `Minimum pitch for a ${formatDisplayNumber(
        bendRadius.value,
      )} mm bend radius is ${formatDisplayNumber(
        minimumSerpentinePitch(width?.value ?? 0, bendRadius.value),
      )} mm.`,
    });
  }
  return errors;
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

function buildRoutePattern(input: {
  existingPattern: RoutePattern;
  patternKind: RoutePattern["kind"];
  turnCount: string;
  pitch: QuantityDraft;
  axis: "auto" | "horizontal" | "vertical";
  entranceLength: QuantityDraft;
  exitLength: QuantityDraft;
  sizingMode: "explicit" | "target-length";
  amplitude: QuantityDraft;
  targetLength: QuantityDraft;
  placementMode: "auto" | "manual";
  coreX: QuantityDraft;
  coreY: QuantityDraft;
}): RoutePattern {
  if (input.patternKind === "straight") {
    return { kind: "straight" };
  }
  if (input.patternKind === "manual") {
    return {
      kind: "manual",
      waypoints:
        input.existingPattern.kind === "manual" ? input.existingPattern.waypoints : [],
    };
  }
  return {
    kind: "serpentine",
    turnCount: parseInteger(input.turnCount, "Turn count"),
    pitch: requiredLengthQuantity(input.pitch, "Pitch"),
    axis: input.axis,
    ...(optionalQuantity(input.entranceLength, "Entrance length")
      ? {
          entranceLength: optionalQuantity(input.entranceLength, "Entrance length")!,
        }
      : {}),
    ...(optionalQuantity(input.exitLength, "Exit length")
      ? { exitLength: optionalQuantity(input.exitLength, "Exit length")! }
      : {}),
    sizing:
      input.sizingMode === "explicit"
        ? {
            mode: "explicit",
            amplitude: requiredLengthQuantity(input.amplitude, "Amplitude"),
          }
        : {
            mode: "target-length",
            targetLength: requiredLengthQuantity(input.targetLength, "Target length"),
          },
    placement:
      input.placementMode === "manual"
        ? {
            mode: "manual",
            coreCenter: {
              x: requiredLengthQuantity(input.coreX, "Core X"),
              y: requiredLengthQuantity(input.coreY, "Core Y"),
            },
          }
        : { mode: "auto" },
  };
}

function optionalLengthDraft(quantity: PhysicalRoute["width"]): QuantityDraft {
  return quantity
    ? quantityDraftFromCanonical(quantity, "mm", "length")
    : lengthDraft("");
}

function optionalQuantityOrNull(draft: QuantityDraft): LengthQuantity | null {
  try {
    return optionalQuantity(draft, "");
  } catch {
    return null;
  }
}

function lengthDraft(text: string): QuantityDraft {
  return { text, displayUnit: "mm" };
}

function requiredLengthQuantity(draft: QuantityDraft, label: string): LengthQuantity {
  return requiredQuantity(draft, "length", label) as LengthQuantity;
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

function readComponentDefinitionIdentity(component: Component): DefinitionIdentity {
  const identity = component.extensions[DEFINITION_IDENTITY_EXTENSION] as unknown as
    DefinitionIdentity | undefined;
  if (!identity?.definitionKey) {
    throw new Error(`Component ${component.id} has no registry identity`);
  }
  return identity;
}

function isPhysicalSplitterMergerJunction(
  component: Component,
  definitionKey: string,
): boolean {
  return (
    component.kind === "junction" &&
    (definitionKey === "junction.splitter" || definitionKey === "junction.merger") &&
    Boolean(component.junction.dimensions?.width) &&
    Boolean(component.junction.dimensions?.height) &&
    Boolean(component.junction.dimensions?.depth)
  );
}

function isJunctionDimensionKey(key: string): boolean {
  return key === "width" || key === "height" || key === "depth";
}

function junctionDimensionDefaults(definition: ComponentDefinition): {
  width: LengthQuantity;
  height: LengthQuantity;
  depth: LengthQuantity;
} {
  const footprint = definition.physicalGeometry?.footprint;
  if (!footprint?.width || !footprint.height || !footprint.depth) {
    throw new Error(`Missing physical defaults for ${definition.key}`);
  }
  return {
    width: requiredJunctionDimension(footprint.width, footprint.width),
    height: requiredJunctionDimension(footprint.height, footprint.height),
    depth: requiredJunctionDimension(footprint.depth, footprint.depth),
  };
}

function junctionDimensionValues(component: Component): {
  width: ParameterValue | undefined;
  height: ParameterValue | undefined;
  depth: ParameterValue | undefined;
} {
  return component.kind === "junction"
    ? {
        width: component.junction.dimensions?.width,
        height: component.junction.dimensions?.height,
        depth: component.junction.dimensions?.depth,
      }
    : { width: undefined, height: undefined, depth: undefined };
}

function requiredJunctionDimension(
  value: ParameterValue | undefined,
  fallback: ParameterValue,
): LengthQuantity {
  const quantity = value ?? fallback;
  if (!isLengthQuantity(quantity)) {
    throw new Error("Junction dimension must be a length quantity");
  }
  return quantity;
}

function isLengthQuantity(value: ParameterValue): value is LengthQuantity {
  return (
    typeof value === "object" && value !== null && "value" in value && "unit" in value
  );
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
