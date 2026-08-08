# Visual Editor

Phase 5 introduces the first interactive visual authoring workflow in
`apps/web`. The editor is a projection of the authoritative Phase 2
`Project`; React Flow is used only for visual interaction.

## Authority Boundary

The data direction is:

```text
Project
-> derived React Flow nodes, handles, and edges
-> user interaction
-> narrow validated project mutation
-> Phase 3 history and autosave
-> updated Project
-> rederived projection
```

React Flow nodes, edges, viewport, and selection are not serialized, exported,
or written into IndexedDB project records. Persisted engineering data remains
components, ports, connections, layers, lanes, metadata, and extensions from
`packages/project-model`.

The web app uses `@xyflow/react` version `12.11.2`.

## Projection

Node IDs equal persisted component IDs. Visual handles are deterministic
adapters around persisted port IDs:

```text
fg-port:source:<portId>
fg-port:target:<portId>
```

Bidirectional ports render distinct source and target handles that both resolve
to the same persisted port. Connection edge IDs equal persisted connection IDs.

## Coordinates And Viewport

One canvas unit equals one millimetre. The Phase 5 grid snaps committed
positions to 1 mm. Negative coordinates are permitted. Chip-boundary
enforcement, collision detection, automatic placement, and automatic routing
are deferred.

Viewport zoom and pan are session-only. They are not exported and do not trigger
autosave.

## Editing

The palette consumes the frozen Phase 4 registry directly, supports category
filtering and text search, and uses click-to-add only. Insertion resolves the
active layer and optional lane, calls the Phase 4 factory, inserts components
and ports atomically, updates lane references, validates the whole project, and
creates one history entry.

Movement commits on drag stop only. Drag previews, selection, hover,
connection previews, palette filters, and property drafts are transient and do
not dirty the project.

Connections are created only after Phase 4 local compatibility passes. Failed
connection attempts show structured feedback and do not persist edges.

Phase 6 expands the property inspector into explicit typed editors for the
existing project, chip, layer, lane, selected component, selected component
ports, material, and manufacturing-process records. The inspector never exposes
raw JSON, metadata, or extension editing, and it does not create or delete
layers, lanes, materials, fluids, processes, ports, or components outside the
Phase 5 editor commands.

Forms keep local string drafts and session-only display-unit choices. Project
mutation happens only when the user applies a section. A successful apply
passes the resulting Project through the existing schema and integrity checks
and enters Phase 3 history as one atomic operation; invalid and no-op applies
leave timestamps, history, autosave, IndexedDB state, export payloads, and
BroadcastChannel notifications unchanged.

Component parameter controls are generated from the frozen Phase 4
`ComponentDefinition.parameters` metadata and still apply through
`updateComponentParameters` from `microfluidic-components`, keeping first-class
and extension mappings centralized. Manual quantity edits are converted into
canonical Project units and marked `user-entered`; registry resets use the
registry default value and provenance source. Optional quantity parameters can
be cleared only when the definition allows absence.

Project, chip, layer, component, and registry quantity editors offer only
conversions supported by the `units` package. Display units are not serialized,
stored in IndexedDB project records, or included in import/export content.
Selected component port name and fluid assignment are editable; port direction,
component ownership, and registry/template metadata remain read-only.

Layer or lane reassignment is rejected if any existing incident connection
would become incompatible. Connections are not removed automatically.

Multiple selected components show a read-only summary. Multi-edit is deferred.

Duplication uses the Phase 4 duplication helper, offsets by 1 mm, rewrites IDs,
preserves parameters and provenance, and does not duplicate external
connections. Deletion removes selected components, owned ports, incident
connections, selected connections, and lane references in one transaction.

## Keyboard

The editor supports Delete/Backspace for deletion, Ctrl/Cmd+Z for undo,
Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y for redo, Ctrl/Cmd+D for duplicating exactly
one selected component, Ctrl/Cmd+A for selecting all components, and Escape for
clearing selection and previews. Shortcuts are ignored inside form controls and
editable content.

## Deferred

Phase 6 does not implement drag-from-palette, minimap, automatic layout,
automatic routing, obstacle avoidance, topology validation, waste-path checks,
hydraulic calculations, manufacturing-rule engines, 3D preview, CAD generation,
STEP/STL export, GPT generation, backend persistence, authentication,
collaboration, or simulation.

## Validation

Core behavior is covered by jsdom-based unit and component tests for projection,
handle mapping, palette insertion, movement, selection, connection creation,
typed property updates, unit drafts, registry resets and optional clears,
duplication, deletion, keyboard shortcuts, and a deterministic 100-component
projection scale check. Manual browser validation is still required for pointer
feel, viewport ergonomics, and full editor workflow confidence.
