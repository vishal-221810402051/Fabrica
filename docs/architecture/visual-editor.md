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

The property panel edits component name, position, rotation, layer, lane, and
Phase 4 declarative parameter values. Parameter updates use
`updateComponentParameters` from `microfluidic-components` so first-class and
extension mappings remain centralized.

Layer or lane reassignment is rejected if any existing incident connection
would become incompatible. Connections are not removed automatically.

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

Phase 5 does not implement drag-from-palette, minimap, automatic layout,
automatic routing, obstacle avoidance, topology validation, waste-path checks,
hydraulic calculations, manufacturing-rule engines, 3D preview, CAD generation,
STEP/STL export, GPT generation, backend persistence, authentication,
collaboration, or simulation.

## Validation

Core behavior is covered by jsdom-based unit and component tests for projection,
handle mapping, palette insertion, movement, selection, connection creation,
property updates, duplication, deletion, keyboard shortcuts, and a deterministic
100-component projection scale check. Manual browser validation is still
required for pointer feel and viewport ergonomics.
