# Project Model

Phase 8C-A defines the persisted Fabricgamma project model as schema version
`0.4.0`.

## Authority

`packages/project-model` is the TypeScript source of truth for the persisted
project schema. It owns:

- Schema version `0.4.0`.
- Stable identifier formats.
- Project, chip, layer, lane, component, port, connection, physical-route,
  material, fluid, manufacturing-process, validation-result, and
  export-configuration shapes.
- Normalized engineering quantities.
- Value provenance.
- Schema-version handling and current-version roundtrip behavior.
- Initial referential-integrity checks.

Python consumers in `apps/api/src/fabrica_api/project_model/` mirror the
persisted format and are checked against the shared JSON fixtures and generated
JSON Schema.

## Schema artifact

The generated interchange schema is:

```text
packages/project-model/schema/project.v0.4.0.schema.json
```

It is produced from the Zod 4 model with `z.toJSONSchema(...)` and targets JSON
Schema Draft 2020-12. The check command verifies that the generated output
matches the committed artifact:

```powershell
corepack pnpm schema:check
```

## Physical Routes

`Project.physicalRoutes` is a first-class persisted array keyed by
`connectionId`. Logical connections remain topology-only. A physical route
stores its own route ID, referenced connection ID, route layer ID, first-class
route pattern, optional width, optional depth, optional bend radius, and metadata.
Editor selection uses `connectionId` as the canonical identity for a selected
wire/channel. It resolves the associated PhysicalRoute at view time and never
persists `routeId` selection state.

Route endpoints are never persisted as global coordinates. They are derived
from the connected component footprints and physical port anchors. Straight
routes persist no intermediate points. Manual routes persist waypoints inside
their pattern. Serpentine routes persist only their parametric definition;
generated line and arc geometry is derived by `geometry-core`.

Route patterns are `straight`, `manual`, and `serpentine`. Serpentine supports
turn count, pitch, axis, optional entrance/exit lead lengths, either explicit
amplitude or target-length sizing, and placement intent. Target length is a
user constraint; actual length is always derived from generated centerline
primitives and is never persisted as a second engineering authority.

Serpentine geometry is derived as adaptive entry tail, stable serpentine core,
and adaptive exit tail. The first generated primitive starts at the selected
source port and the last primitive ends at the selected target port. Phase 8B
defines `turnCount` as the number of U-turn transitions, so one turn creates
two parallel runs. `pitch` is adjacent centerline spacing. A U-turn is feasible
when `pitch >= 2 * bendRadius`; equality produces two tangent quarter arcs with
no transverse straight, and larger pitch produces quarter arc, transverse
straight of `pitch - 2R`, and quarter arc. The persisted amplitude defines the
core run span and is not stretched when components move.

Core shape and core placement are separate concerns. The relative core is
determined only by turn count, pitch, bend radius, amplitude, and explicit
orientation. Serpentine placement is either `{ mode: "auto" }` or
`{ mode: "manual", coreCenter }`. `coreCenter` is a persisted chip-coordinate
millimetre position and is the only manual core-placement authority. In auto
mode, `geometry-core` derives a finite legal placement region from chip bounds,
route width, and the core envelope, evaluates deterministic translations,
solves both oriented endpoint tails for each translation, and chooses the best
complete solution by a stable cost tuple. In manual mode, the solver translates
the unchanged core to the requested center and may only regenerate entry and
exit tails. It must not silently move the core.

Serpentine bend-radius and pitch checks are geometric constraints, not
manufacturing DRC. Hard geometry requires bend radius greater than half the
route width, `pitch >= 2 * bendRadius`, and `pitch > route width` so adjacent
channel bodies do not collapse. Recommended compact editor defaults are
separate from those hard limits and do not prevent smaller legal user-entered
values.

`entranceLength` and `exitLength` are minimum adaptive tail lengths. Moving or
rotating endpoint components regenerates tails from exact physical port
positions and outward normals, while the relative core geometry remains stable
apart from deterministic corridor-centered translation. Target-length sizing is
a one-time design aid: a successful apply solves and persists an explicit
amplitude, after which total route length may change as derived tails change.
Generated entry/core/exit primitive buckets, generated turn count, length
breakdown, envelopes, actual length, solved auto core center, and issues are
derived data and are never serialized. A ready serpentine route must generate
exactly the requested number of U-turn transitions. If axis, pitch, bend
radius, amplitude, target-length solving, tail fitting, complete-core fit, or
chip bounds cannot be satisfied, the route is reported invalid while the
connection remains selectable.

When a serpentine route has `bendRadius`, adaptive tail candidates that require
corners must generate authoritative `CenterlineArc` primitives with exactly that
radius. Straight tails need no arcs. L, Z, and extended dogleg tails that cannot
fit the configured radius are rejected; geometry-core does not silently reduce
the radius or emit sharp line-line tail corners. Entry or exit tail
infeasibility is reported only after all deterministic core placements and
tail topologies have been exhausted.

Width and depth are canonical millimetre quantities when present. They are
optional so a route can exist before it is complete or CAD-ready; Fabricgamma
does not invent physical channel dimensions.

The normal editor path maintains one PhysicalRoute per Connection. The
Connection/PhysicalRoute inspector handles zero routes as incomplete and
duplicate routes as an integrity conflict with route editing disabled. This
focused Phase 8B correction does not change schema cardinality.

Schema migration from `0.1.0` to `0.2.0` preserves prior project data and
initializes `physicalRoutes` to an empty array. Migration from `0.2.0` to
`0.3.0` converts empty-waypoint routes to `straight` and non-empty waypoint
routes to `manual`, preserving all other route properties. Migration from
`0.3.0` to `0.4.0` adds `{ mode: "auto" }` placement to existing serpentine
route patterns and leaves straight/manual routes semantically unchanged.

## Lane Membership

`component.laneId` is canonical lane membership. `lane.componentIds` remains a
synchronized index. Mutation helpers and integrity checks enforce both
directions. Migration keeps valid component lane IDs, recovers missing lane IDs
only from exactly one unambiguous lane index membership, and does not guess
ambiguous membership.

Physical routes do not store `laneId`. A route belongs to a lane only when both
endpoint components, discovered through the referenced connection and ports,
have the same `component.laneId`.

Connection inspectors may display same-lane, cross-lane, or unassigned context
derived from endpoint components. They do not move components between lanes.

## Coordinate Semantics

Persisted component `position.x` and `position.y` are the physical left/top
edge of the unrotated footprint in millimetres. Rotation is around the
footprint center. The editor coordinate system uses chip top-left as origin,
positive x to the right, and positive y down.

React Flow viewport, node positions, and canvas state remain projection state.
They are not engineering millimetres and are not serialized.

Layer order `0` is bottom. Cumulative layer thickness defines Z. CAD-space
conversion keeps `cadX = x`, flips Y with `cadY = chipHeight - y`, and uses the
layer cumulative Z for `cadZ`.

## Phase boundary

Phase 8B does not introduce lane-wide bulk editing, full manufacturing DRC,
global auto-routing, auto-layout, pressure-drop calculations, CFD, GPT
behavior, STL, STEP, CAD booleans, or Engineering Ready status.
