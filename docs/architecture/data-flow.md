# Data Flow

Fabricgamma data flow starts with a structured project-model command and ends with validated derived artifacts. Derived artifacts never silently overwrite the authoritative project model.

## Principal Flow

```text
User input or import
-> structured project-model command
-> schema validation
-> version compatibility
-> unit normalization
-> semantic validation
-> authorization
-> authoritative project-model update
-> deterministic calculations
-> deterministic engineering validation
-> layout derivation
-> 2D and 3D visualization derivation
-> validated CAD job
-> B-representation generation
-> STEP/STL export
-> export validation
-> persistence and audit metadata
```

The project model is the engineering source of truth throughout this flow. Calculated values, validation reports, layout results, preview meshes, CAD bodies, STEP exports, STL exports, simulation results, and rendered views are derived data.

Phase 3 browser-local project management stores a validated project-model
document inside an IndexedDB wrapper. The wrapper contains local metadata such
as local record ID, revision, save timestamps, source, autosave state, and
recovery state. That wrapper is not an engineering schema and is not exported as
portable project JSON.

Phase 4 component factories consume frozen component definitions and produce
project-model components plus owned ports. The factory persists definition
identity and port-template metadata in namespaced extensions, but it does not
insert objects into a project, create connections, mutate browser-local storage,
or produce CAD artifacts.

Phase 5 visual editing starts from the current authoritative project and derives
React Flow nodes, handles, and edges. User interactions become narrow validated
project mutations through Phase 3 history and autosave. React Flow viewport,
selection, drag preview, and connection preview state are not serialized.

Phase 8B adds first-class physical route patterns to the authoritative Project.
Logical connections still describe topology only. `geometry-core` derives
physical footprints, physical port positions, route endpoints, route centerline
line/arc primitives, actual route length, physical envelopes, layer Z ranges,
and CAD-space point transforms from the Project. React Flow positions remain
display projection state and are converted back to physical millimetres only
through validated editor mutations.

Phase 9A extends the projection chain with
`geometry-core.projectToSceneGeometry(project)`. The scene geometry is plain
data: chip, layers, component cavity/removal volumes, physical routes, ports,
physical readiness, and warnings. Three.js and React Three Fiber consume that
plain data for browser preview only and do not become CAD or engineering
authorities.

## AI Flow

```text
Natural-language request
-> GPT structured proposal
-> schema validation
-> project-version compatibility checks
-> unit and semantic validation
-> stable-identifier validation
-> authorization
-> deterministic validation
-> user review where required
-> project-model command
```

GPT output is untrusted structured input. GPT proposals must not bypass deterministic calculations, deterministic validation, authorization, manufacturing/material profile checks, or user review where review is required.

## Validation Gates

Before a command mutates a project, the system must apply the relevant gates:

- Schema validation confirms the payload shape.
- Version compatibility confirms the command applies to the project-model schema version.
- Unit validation confirms dimensions are labeled and normalized.
- Semantic validation confirms the command makes sense for the model.
- Stable-identifier validation confirms referenced identifiers exist and are not replaced accidentally.
- Authorization confirms the actor may perform the operation.
- Engineering-rule validation confirms deterministic domain constraints.
- Manufacturing-profile and material-profile validation confirm versioned process context.

## Error And Diagnostic Flow

Future errors must be structured and actionable. Engineering diagnostics should eventually include a stable code, severity, affected model identifier, human-readable message, machine-readable details, source engine, and suggested remediation where appropriate.

Validation failures must not be hidden behind generic success responses. Failed validation produces findings that reference the affected model identifiers and explain whether the failure is schema-level, unit-level, semantic, connectivity, geometric, manufacturing-profile, material-profile, CAD, export, or engineering-readiness related.

Phase 4 port compatibility is a local preflight result, not whole-project
validation. It checks ordered ports, media, roles, layers, lanes, duplicate
connections, and multiplicity for a proposed pair. Missing required ports,
network topology, routing reachability, and process-profile manufacturing rules
remain future validation responsibilities.

## Visualization Flow

2D layout and 3D preview are derived from the authoritative model and deterministic layout or geometry inputs. React Flow owns visual graph interaction, not engineering connectivity authority. React Three Fiber and Three.js own visualization, not production CAD.

In Phase 8B, rendered chip boundaries, component footprints, physical ports,
and physical routes are projections of persisted Project data. Route endpoints
are derived from component ports. Manual route waypoints are persisted inside
the manual route pattern; serpentine generated points and arcs are never
persisted. They are regenerated from the route pattern, exact physical port
positions, derived port outward normals, and current component placement.
Serpentine generation derives an adaptive entry tail, parameter-owned stable
core, and adaptive exit tail. Hard geometry requires bend radius greater than
half route width, `pitch >= 2 * bendRadius`, and `pitch > route width`; these
checks are not manufacturing DRC. Equality creates two tangent quarter arcs;
larger pitch adds the transverse straight between those arcs. Entrance and exit
lengths are minimum tail lengths, not exact persisted tail geometry.
Target-length mode is a one-time apply-time solver that persists explicit
amplitude after success. Serpentine placement is persisted only as auto mode or
a manual chip-coordinate core center. Generated tail/core buckets, generated
turn count, length breakdown, envelopes, points, solved auto placement, and
warnings remain derived. Invalid route issues are returned when geometric
constraints, complete-core fit, amplitude, target-length solving, tail fitting,
or chip bounds cannot be satisfied.

The adaptive serpentine route derivation is a bounded deterministic search, not
a persisted routing model. `geometry-core` first derives the immutable relative
core shape, then either tries legal auto translations or uses the persisted
manual core center exactly. Each tail candidate is filleted with the exact
configured bend radius or rejected. A route is invalid only when no complete
candidate can satisfy both tails, continuity, anchoring, and bounds. The same
generated primitives feed 2D, 3D, and future CAD consumers.

Connection-wire selection is also projection state. A 2D or 3D route click
selects the persisted `connectionId`, resolves the route and derived lane
context from the current Project, and edits route parameters through the
authoritative physical-route mutation helpers. Inspector scope, hover state,
hit targets, and viewer state are not serialized.

In Phase 9A plus Phase 8B, 3D preview meshes are derived from the same
physical interpretation and route primitives used by the 2D editor. Internal
component and route meshes represent cavity/removal volumes inside a
translucent chip preview. Incomplete physical routes remain guide geometry and
are not rendered as manufacturable channels.

Phase 9B-B inserts a rendering-neutral route-body derivation between generated
centerline primitives and the browser 3D mesh. Ready physical routes flow as:

```text
PhysicalRoute
-> deriveRouteGeometry(...)
-> CenterlinePrimitive[]
-> derive sourceInside/sourcePort and targetPort/targetInside interface lines
-> CAD-space deriveRouteBody2D(extendedPrimitives, width)
-> SceneRoute.body { boundary, zTop, zBottom, depth }
-> one Three.js route-body mesh
```

The route-body boundary, sampled centerline, interface penetration, warnings,
and mesh triangulation are derived artifacts. They are not Project fields and
are not exported as authoritative design data. Interface penetration affects
only the physical body used for rendering/future cavity subtraction; the
authoritative port-center-to-port-center route length remains unchanged.
Future CAD generation should consume the authoritative centerline, width,
depth, and/or the rendering-neutral route-body boundary; it must not
reverse-engineer React Flow paths or Three.js meshes.

## CAD And Export Flow

The CAD job consumes a validated project-model snapshot and approved versioned profiles. CadQuery builds the production B-representation through OpenCascade. STEP and STL exports are derived artifacts, and export validation must report structured findings.

Exportable, renderable, validated, manufacturable, and Engineering Ready are separate statuses. Rendering or exporting a design does not by itself make the design Engineering Ready.

## Artifact Traceability

Each derived artifact must eventually be traceable to:

- Project identifier.
- Project revision.
- Project-model schema version.
- Engine version.
- Manufacturing-profile version.
- Material-profile version where relevant.
- Deterministic input set.
- Creation timestamp.
- Artifact status.

Derived data must be reproducible or explicitly marked non-reproducible.
