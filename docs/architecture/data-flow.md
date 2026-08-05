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

## Visualization Flow

2D layout and 3D preview are derived from the authoritative model and deterministic layout or geometry inputs. React Flow owns visual graph interaction, not engineering connectivity authority. React Three Fiber and Three.js own visualization, not production CAD.

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
