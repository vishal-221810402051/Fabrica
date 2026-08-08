# Component Library

Phase 4 introduces `packages/microfluidic-components` as the deterministic,
React-independent authority for reusable component definitions and local port
compatibility.

## Authority Boundary

The package depends on `project-model` and `units`.

```text
apps/web
-> microfluidic-components
-> project-model
-> units
```

`project-model` remains the persisted engineering schema authority.
`microfluidic-components` does not increment the schema version, does not add
Python parity models, and does not own saved-project structure.

## Definitions And Instances

A component definition describes the reusable catalogue entry: key, display
name, persisted kind, category, parameters, port templates, policies,
geometry hints, optional physical geometry metadata, manufacturing metadata,
and icon descriptor.

Geometry hints remain schematic UI hints. They are not CAD authority. Phase 8A
adds optional `physicalGeometry` metadata for definition families whose
physical footprint is versioned by the registry instead of stored on the
Project component instance.

A component instance is a project-model `Component` created by the factory.
Instances persist stable definition identity under
`component.extensions["fabricgamma.component-definition"]` with the definition
key, registry version, and definition revision.

Definition-specific values that cannot be represented as first-class
project-model fields are stored only in
`component.extensions["fabricgamma.definition-parameters"]`.

## Registry Versioning

The Phase 4 registry version is `1.0.0`. Every built-in definition uses
`definitionRevision: 1`.

The registry is immutable after construction. Runtime registration,
unregistration, executable plugins, and arbitrary validation callbacks are
deferred.

## Built-In Definitions

The initial registry contains 30 built-ins:

- Channels: rectangular and circular.
- Junctions: Y, T, splitter, merger, legacy manifold, and generic.
- Chambers: generic, metering, reaction, incubation, mixing, detection, and
  neutralization.
- Reservoirs: generic, sample inlet, reagent inlet, outlet, and waste.
- Valves: generic, normally closed, and normally open.
- Conditioning: debris filter, bubble trap, and passive mixer.
- Interfaces: sensor, optical, and external generic.
- Generic: custom component.

## Parameters

Parameters are declarative and serializable. Supported kinds include length,
area, volume, angle, integer, number, boolean, enum, text,
material-reference, and fluid-reference.

Quantity defaults use canonical internal units and overrides are normalized
through `packages/units`. Unknown override keys, invalid units, non-finite
numbers, invalid enum values, and missing required values are rejected.

## Ports And Compatibility

Port templates define direction, medium, role, multiplicity, anchor,
orientation, same-component policy, and metadata. Factory-created ports persist
template semantics under `port.metadata["fabricgamma.port-template"]`.

Legal ordered direction combinations are:

- output to input
- output to bidirectional
- bidirectional to input
- bidirectional to bidirectional

Medium compatibility is exact by default. Generic media connect only when both
definitions explicitly allow generic compatibility.

Role compatibility is conservative. The Phase 4 local checker allows expected
sample, reagent, buffer, generic, waste, control, detection, and vent pairings
only where represented by port roles and direction.

Multiplicity checks count existing project connections that reference each
port. `null` maximum means explicitly unbounded. Minimum connection counts are
metadata for later whole-project validation and do not make a newly-created
component invalid.

Phase 7A locks explicit branching semantics. Ordinary liquid ports continue to
default to `maxConnections: 1`, so branching and joining must be represented by
multiple physical port IDs rather than multiple connections on one ordinary
port. `junction.splitter` provides one liquid input and two distinct liquid
outputs. `junction.merger` provides two distinct liquid inputs and one liquid
output. These fixed definitions are sufficient for Phase 7A; variable branch
counts are deferred.

`junction.manifold` is legacy. Its existing one-port bidirectional structure is
preserved so old projects can load and render, and `getComponentDefinition`
continues to resolve it. The definition is marked deprecated with
`junction.splitter` as its replacement hint and is hidden from normal web
palette insertion. Compatibility treats the legacy shared port as effectively
capped for new connections and returns a legacy capacity issue once it already
has a connection, directing new designs toward splitter or merger components.

Phase 8A gives `junction.splitter` and `junction.merger` explicit versioned
physical geometry metadata and physical port anchors. These fixed registry
defaults are used only for the physical geometry foundation. The legacy
`junction.manifold` is not promoted into the preferred physical branching
mechanism.

Reservoir and chamber footprints are derived from their first-class Project
dimensions. Channel footprints are derived from their channel cross-section
dimensions. Components without first-class dimensions or registry physical
metadata are not physical-layout-ready and must not receive fabricated
footprints.

## Layer And Lane Policies

Phase 4 supports `same-layer` and `layer-agnostic` policies. Ports do not own
independent layers and vias are not introduced.

Lane policies are `required`, `optional`, `forbidden`, and `shared`. Local
compatibility rejects different explicit lanes unless at least one side is
shared. Lane reachability and complete lane topology are deferred.

## Factory And Duplication

`createComponentFromDefinition` creates a valid project-model component plus
owned ports. It generates stable IDs, applies defaults, normalizes overrides,
persists definition identity, persists port-template metadata, and returns the
objects without inserting them into a project or creating connections.

`duplicateComponentInstance` creates new component and port IDs, rewrites
ownership, preserves engineering values, provenance, layer, lane, and
definition extensions, applies a deterministic position offset, and returns ID
mappings. External connections are not copied.

## Web Consumption

`apps/web` includes the Phase 4 read-only catalogue component and the Phase 5
visual-editor palette. Both import registry data from
`microfluidic-components`; the Phase 5 palette adds click-to-add project
mutation through the component factory and editor actions instead of copying
registry data into the web app.

The registry remains independent of drag and drop, canvas rendering, topology
engines, CAD, and web-specific state. Phase 5 project mutation lives in the web
editor action layer, not inside `microfluidic-components`.

## Deferred

Drag-from-palette, automatic layout, automatic routing, whole-project
validation, process-profile DFM checks, CAD generation, runtime plugins,
backend persistence, and AI command execution remain future work.
