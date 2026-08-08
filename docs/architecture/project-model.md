# Project Model

Phase 8A defines the persisted Fabricgamma project model as schema version
`0.2.0`.

## Authority

`packages/project-model` is the TypeScript source of truth for the persisted
project schema. It owns:

- Schema version `0.2.0`.
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
packages/project-model/schema/project.v0.2.0.schema.json
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
stores its own route ID, referenced connection ID, route layer ID, intermediate
waypoints, optional width, optional depth, optional bend radius, and metadata.

Route endpoints are never persisted as global coordinates. They are derived
from the connected component footprints and physical port anchors. Waypoints
are the only persisted route points between those derived endpoints.

Width and depth are canonical millimetre quantities when present. They are
optional so a route can exist before it is complete or CAD-ready; Fabricgamma
does not invent physical channel dimensions.

Schema migration from `0.1.0` to `0.2.0` preserves all prior project data and
initializes `physicalRoutes` to an empty array.

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

Phase 8A does not introduce collision detection, routing, chip bounds editing,
3D preview, CAD generation, STL/STEP export, calculations, manufacturing rules,
simulation, GPT behavior, or Engineering Ready status.
