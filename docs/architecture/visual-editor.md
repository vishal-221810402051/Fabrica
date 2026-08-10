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

Phase 8A separates physical millimetres from React Flow display coordinates.
Persisted component `position.x` and `position.y` are the physical left/top
edge of the unrotated footprint in millimetres. The editor coordinate system
uses the chip top-left as origin, positive x to the right, and positive y down.

React Flow node positions are display coordinates derived from physical
millimetres through an explicit scale in `geometry-core`. Drag stop converts
display coordinates back to millimetres, snaps to the 0.1 mm physical grid, and
then mutates the Project. The 1 mm major grid is visual only.

Components with an authoritative footprint are rejected when a moved or rotated
footprint would leave the chip boundary. Rotated boundary checks use the
footprint corners around the component center. Unsupported components render as
not physical-layout-ready rather than receiving invented dimensions. Collision
detection, automatic placement, and automatic routing are deferred.

Viewport zoom and pan are session-only. They are not exported and do not trigger
autosave.

Phase 8B projects physical routes from `geometry-core` centerline primitives.
Logical connections remain topology-only; physical route records carry route
layer, pattern, optional width, optional depth, and optional bend radius. Route
endpoints are derived from physical ports and are not persisted. Straight,
manual, and serpentine routes render from the same line/arc primitives used by
3D preview and future CAD.

Serpentine rendering is fully derived by `geometry-core`. The editor does not
calculate tail or core geometry in React Flow. A generated serpentine contains
adaptive entry-tail primitives, stable core primitives, adaptive exit-tail
primitives, and a combined primitive list. The inspector displays entry tail,
serpentine core, exit tail, and total length. Invalid serpentine configurations
keep the logical fallback edge clickable and show route issue messages instead
of rendering malformed serpentine geometry.

The serpentine solver separates parameter-owned core shape from placement and
tail routing. `geometry-core` derives the relative core from turn count, pitch,
bend radius, amplitude, and explicit orientation. Auto placement tries a
bounded deterministic set of legal translations within chip bounds. Manual
placement uses the persisted chip-coordinate `coreCenter` exactly and
regenerates only the adaptive entry and exit tails. Tail candidates escalate
from straight and L to Z and extended dogleg forms, with exact-radius filleting
required at every corner. Project parameters are never silently relaxed; a
ready serpentine must generate the requested turn count exactly.

Phase 9A adds a lazy-loaded synchronized 3D preview mode beside the 2D editor:

```text
[2D Design] [3D Preview]
```

The 3D preview consumes rendering-neutral scene data from
`geometry-core.projectToSceneGeometry(project)`. Three.js and React Three Fiber
render that data only; they do not own engineering calculations, coordinate
transforms, or persisted state.

The 3D scene uses the Phase 8A CAD-space convention with chip
bottom-left-bottom as origin, `+x` right, `+y` up in the chip plane, and `+z`
upward through the layer stack. Layer order `0` remains the bottom layer.

Chip preview uses a chip box plus internal cavity/removal-volume meshes. It
does not use browser CSG and does not claim production CAD boolean
subtraction. Component and route cavities are placed top-down within their
owning layer. Incomplete routes render as nonmanufacturable guides and keep
their missing-width/missing-depth warnings derived in UI state only. Route
`bendRadius` is represented in `geometry-core` with tangent circular arc
primitives where feasible.

3D camera mode, material mode, view preset, layer visibility, port marker
visibility, and OrbitControls state are UI-only. They are not serialized,
exported, or stored in the Project.

## Port Semantics And Branching

Phase 7A makes port direction explicit in the editor projection before physical
routing and CAD work. Persisted `Port.direction` and registry port-template
metadata remain authoritative. The canvas presents input ports as red handles on
the left side of a node and output ports as blue handles on the right side of a
node. Direction is also exposed through handle side, semantic CSS class, title,
and ARIA label; color is presentation only.

Handle IDs remain deterministic adapters around persisted port IDs:

```text
fg-port:source:<portId>
fg-port:target:<portId>
```

The projection preserves registry port-template order. For multiple input or
output ports on the same side, handles are distributed vertically in a stable
order. Safe explicit registry anchors are preserved when they already place
inputs on the left or outputs on the right without overlap; otherwise the
projection calculates non-overlapping side anchors. These anchors are visual
only and are not written to the Project, IndexedDB records, or export payloads.

Local connection compatibility continues to enforce ordered output-to-input
connections, medium compatibility, layer/lane compatibility, duplicate
rejection, and per-port `maxConnections`. Ordinary liquid ports created by the
registry default to one connection, so implicit fan-out from one physical output
port and implicit fan-in to one physical input port are rejected.

Branching and joining are represented through explicit persisted port IDs:

- `junction.splitter`: one input and two separate output ports.
- `junction.merger`: two separate input ports and one output.

Variable branch-count architecture is deferred. `junction.manifold` remains
resolvable for legacy imports and existing projects, but it is deprecated,
hidden from normal palette insertion, and capped by compatibility checks so new
unlimited branching through its shared bidirectional port is blocked with
legacy feedback directing users to splitter or merger components.

## Editing

The palette consumes the frozen Phase 4 registry directly, supports category
filtering and text search, and uses click-to-add only. Insertion resolves the
active layer and optional lane, calls the Phase 4 factory, inserts components
and ports atomically, updates lane references, validates the whole project, and
creates one history entry.

Movement commits on drag stop only. Drag previews, selection, hover,
connection previews, palette filters, and property drafts are transient and do
not dirty the project.

Connections are created only after local compatibility passes. Failed
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

Multiple selected components expose one narrow bulk operation: atomic lane
assignment to no lane or one existing lane. The command builds the complete
proposed Project first, synchronizes `component.laneId` with
`lane.componentIds`, validates all affected existing connections against that
complete proposal, and then commits one undoable mutation. This avoids the
connected-component lane-assignment deadlock without weakening lane
compatibility.

Phase 8B makes the Lane inspector an engineering workflow. It derives lane
components from canonical `component.laneId`, lists chambers, discovers
associated physical routes only when both route endpoints are in the lane,
shows cross-lane/unassigned route warnings, derives total actual channel
length, and edits the selected route pattern and channel dimensions without
adding `physicalRoute.laneId`. Chamber editing reuses selected component
properties; chamber dimensions are not copied onto lanes.

Clicking a 2D connection wire selects the persisted `connection.id`, clears
component selection, switches the properties panel back to Selection scope, and
opens the same Connection/PhysicalRoute inspector used from Lane route lists.
The visible route stroke reflects physical channel width, while an independent
screen-space hit target keeps narrow channels selectable. Selection and hover
styling are UI-only. The inspector shows connection endpoints, derived lane
context, route cardinality, readiness, generated geometry values, and editable
route parameters. Lane context is read-only; changing lane membership remains a
component or selected-components operation. Manual route waypoints are
preserved and counted, but canvas waypoint editing is still deferred.

The 2D projection consumes only authoritative `geometry-core` line and arc
primitives for physical routes. Serpentine routes are not redrawn with
React-specific math; the SVG path and React Flow interaction path use the same
primitive-derived route path. When a connection has zero physical routes, the
edge remains an incomplete guide. When it has duplicate physical routes, the
projection follows the Connection inspector policy and treats the route as an
integrity conflict instead of silently choosing one duplicate.

Every projected route edge uses the persisted `connectionId` as its React Flow
edge ID and as `edge.data.connectionId`. The transient project/editor store is
the single authority for engineering selection. React Flow may report node
selection for component selection, but physical-route edges are not React Flow
selection authorities. Route readiness affects engineering feedback, not
clickability: complete routes, incomplete guides, invalid fallbacks, manual
primitives, and serpentine tails all remain selectable through the same
connection identity with an interaction hit area of at least 24 px. The rendered
route SVG owns a direct transparent interaction stroke that adaptively trims
away from port handles while retaining a center hit segment for short visible
routes. Direct 2D route interaction, serpentine core overlay clicks, and 3D
route clicks all restore Selection scope idempotently, clear component
selection, and show the Channel / Connection inspector for that connection.
The selected channel is presented in engineering red in both 2D and 3D; this is
pure UI state and does not change apparent route width, depth, geometry, or
exported Project data. Other routes keep their normal unselected colors.
Selection state, hover state, drag preview state, and interaction geometry
remain transient UI data and are never serialized.

The Channel / Connection inspector is always available for a single selected
connection, including incomplete and invalid physical routes. It keeps topology
fields read-only, exposes editable pattern, width, depth, bend radius, and
route-specific parameters, and applies through the canonical
`updatePhysicalRouteProperties` mutation. Successful applies keep the
connection selected and show `Channel properties updated`; invalid applies show
`Channel update blocked`; true no-op applies show `No channel changes to
apply`. These notices are transient UI state and are not serialized.

For serpentine routes, hard geometry requires bend radius greater than half the
route width, `pitch >= 2 * bendRadius`, and `pitch > route width`. These are
centerline/body geometry checks, not manufacturing DRC. Compact editor defaults
are recommendations only. `pitch == 2R` derives two tangent quarter arcs with
no transverse straight; `pitch > 2R` derives quarter arc, transverse straight,
and quarter arc. Persisted amplitude defines the core run span. Component
movement can translate an auto core within its legal placement region and
reshape derived tails, but it does not stretch or collapse the relative core.
For manual placement, component movement and rotation leave the persisted core
center fixed and regenerate tails from the changed physical port frames.
`axis: auto` is resolved to an explicit axis on successful route apply, and
target-length sizing is converted to explicit amplitude when solved.

Selecting a single manual serpentine route renders a thin UI-only serpentine
core overlay derived from `geometry-core`'s core envelope. The overlay is a drag
affordance, not physical channel geometry, and it must not visually thicken or
duplicate the selected route. Dragging the overlay translates only
`pattern.placement.coreCenter`, snaps the committed center to the existing
0.1 mm physical grid, and creates one history operation on drag stop. Clicking
the overlay without dragging reselects the parent connection and opens the
route inspector; dragging preserves the existing core movement workflow and
does not commit movement on a simple click. The overlay, hover state, and drag
preview are never serialized. The
inspector also exposes Auto/Manual placement, Core X/Y draft fields, Center
core, derived geometric limits, generated turn count, core envelope, and a
Compact to fit action. Compact to fit adjusts only draft pitch and bend radius,
preserves turn count and amplitude, and requires Apply before project mutation.

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

Phase 8B/9A do not implement drag-from-palette, minimap, split-screen editing,
automatic layout, global automatic routing, obstacle avoidance, browser CSG,
full manufacturing DRC, topology validation, waste-path checks, hydraulic
calculations, manufacturing-rule engines, CAD generation, STEP/STL export, GPT
generation, backend persistence, authentication, collaboration, or simulation.

## Validation

Core behavior is covered by jsdom-based unit and component tests for projection,
handle mapping, palette insertion, movement, selection, connection creation,
typed property updates, unit drafts, registry resets and optional clears,
duplication, deletion, keyboard shortcuts, and a deterministic 100-component
projection scale check. Manual browser validation is still required for pointer
feel, viewport ergonomics, and full editor workflow confidence.
