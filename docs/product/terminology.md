# Product Terminology

## Authoritative Project Model

The versioned model that is the engineering source of truth for a project. Editors, previews, calculations, validation, CAD generation, export, AI orchestration, and persistence must consume this model or reproducible derived data.

## Project-Model Schema

The language-neutral structure that defines valid project-model data. JSON Schema is the planned canonical interchange representation.

## Schema Version

The explicit version attached to a persisted project model. Saved projects must not be silently interpreted under a different schema version.

## Migration

An explicit transformation from one project-model schema version to another. Backward-incompatible model changes require migration tests and documented compatibility impact.

## Project Revision

A specific saved state of a project model used to trace derived artifacts and audit records.

## Local Project Record

A browser-local IndexedDB wrapper around one authoritative project model. It
contains local record metadata such as local project ID, revision, save time,
source, autosave state, and recovery state. It is not an engineering schema.

## Local Save

A write to browser-local IndexedDB storage. Local save is not cloud sync,
server save, upload, collaboration, or audit persistence.

## Project Export

An explicit portable JSON download containing only canonical project-model data.
Browser-local wrapper metadata, UI state, and history are excluded.

## Stable Identifier

A model-owned identifier for projects, components, ports, channels, constraints, profiles, derived artifacts, or validation findings. Visual rendering must not replace stable identifiers.

## Component

A model element representing a microfluidic design feature such as a channel, reservoir, chamber, mixer, valve, membrane, vent, filter, optical cell, or electrode region.

## Component Definition

A reusable, serializable catalogue description for a component type. A
definition contains parameters, port templates, policies, geometry hints,
manufacturing metadata, and an icon descriptor. It is not a project instance,
editor node, CAD body, or executable plugin.

## Component Instance

A project-model `Component` created from a definition or authored directly by
approved commands. Definition identity may be persisted in a namespaced
extension, while first-class project-model fields remain authoritative.

## Port

A defined connection point on a component.

## Port Template

A declarative definition-level connection point describing direction, medium,
role, multiplicity, anchor, orientation, and same-component policy. Factory
created ports persist template metadata, but port templates are not CAD
coordinates.

## Port Medium

The physical communication medium of a port, such as liquid, gas,
pneumatic-control, electrical, optical, or generic.

## Port Role

The functional purpose of a port, such as sample, reagent, buffer, waste, vent,
control, detection, or generic.

## Channel

A model element representing a fluid path between ports or components.

## Constraint

A rule or relationship that restricts valid design state, layout, geometry, material use, manufacturing process, or export readiness.

## Engineering Value

A value with explicit units, meaning, and provenance. Units must not be inferred from an unlabeled number.

## Value Provenance

Metadata describing whether an engineering value is user-entered, calculated, AI-assumed, imported, simulated, calibrated, or defaulted.

## Internal Unit

The canonical unit used inside the project model and deterministic engines. Internal units include millimetres, mm², mm³, seconds, pascals, mm³/s, degrees Celsius, and radians. The exact identity is:

1 µL = 1 mm³

## Display Unit

A unit used for presentation or input/output conversion. Display-unit choices must not mutate canonical internal values.

## Deterministic Engine

A calculation, validation, layout, or CAD-related engine that produces reproducible results from explicit inputs and engine versions.

## Calculation

A deterministic engineering computation with defined inputs, units, assumptions, applicability limits, result provenance, error conditions, and tests.

## Validation Rule

A deterministic rule that checks whether model data satisfies schema, unit, semantic, connectivity, geometric, manufacturing-profile, material-profile, CAD, export, or engineering-readiness requirements.

## Local Port Compatibility

A deterministic pairwise preflight check for a proposed connection. It can
report direction, medium, role, layer, lane, duplicate, ownership, and
multiplicity issues. It is not whole-project topology validation.

## Visual Editor

A browser UI that derives visual nodes, handles, and edges from the
authoritative project model. It may support interaction, selection, viewport
movement, and draft inputs, but those visual states are not persisted
engineering data.

## Visual Handle

A deterministic UI adapter for a persisted port. Phase 5 handle IDs map back to
port IDs and are never stored in authoritative connection records.

## Validation Finding

A structured diagnostic produced by validation. It should have a stable code, severity, affected model identifier, message, machine-readable details, source engine, and suggested remediation where appropriate.

## Derived Data

Information produced from the authoritative project model rather than independently authored as engineering truth.

## Derived Artifact

A concrete output such as a validation report, layout result, preview mesh, CAD body, STEP export, STL export, simulation result, or rendered view.

## Manufacturing Profile

A versioned configuration describing process-specific manufacturing limits, tolerances, and rules. It must be explicit and attributable.

## Material Profile

A versioned configuration describing material properties and limits. It must be explicit and attributable.

## Layout Engine

A deterministic engine that derives layout from project-model inputs and reports constraints or unresolved conditions independently of React and React Flow rendering.

## Geometry Core

A future package for language-neutral geometry primitives, coordinate conventions, transforms, bounding representations, preview-interchange contracts, and references between model elements and derived geometry. It is not production CAD authority.

## Preview Geometry

Geometry used for visualization. React Three Fiber and Three.js may render preview geometry, but preview geometry is not production CAD.

## B-Representation

Boundary representation geometry used by the production CAD backend to model solids and faces for manufacturing-oriented CAD output.

## CAD Job

A validated request to generate CAD-derived artifacts from a project-model snapshot and approved versioned profiles.

## STEP

A CAD exchange format for production-oriented geometry. Fabricgamma production STEP geometry must come from the approved B-representation backend.

## STL

A mesh export format. STL exportability does not by itself prove manufacturing readiness or Engineering Ready status.

## GPT Proposal

An untrusted structured input generated from a natural-language request. It must pass validation and authorization gates before becoming a project-model command.

## Engineering Ready

A design status requiring applicable validation evidence. Rendering, meshing, exporting, or previewing does not by itself make a design Engineering Ready.

## Exportable

Capable of producing an export artifact. Exportable does not automatically mean validated, manufacturable, or Engineering Ready.

## Manufacturable

Supported by selected versioned manufacturing and material profiles and applicable engineering validation. It is not implied by rendering or export.

## Validated

Checked by relevant validation rules. Validated must specify which rules and profiles were applied.

## Simulated

Produced or evaluated by a simulation process. Simulated values require provenance and are not automatically calibrated or validated.

## Calibrated

Adjusted or verified against calibration data. Calibrated values require provenance.

## Defaulted

Explicitly assigned by a known default source. Defaulted values require provenance and must not be confused with silently invented values.

## Unknown Value

A value that is unknown, missing, required, or explicitly unresolved. Unknown values must not be silently invented.

## Status Boundaries

Exportable, renderable, validated, manufacturable, and Engineering Ready are not interchangeable.
