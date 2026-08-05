# System Architecture

## Goals

Fabricgamma is a monorepo for an AI-powered microfluidic chip design platform. The architecture must preserve one authoritative engineering model, deterministic engineering behavior, auditable derived artifacts, and a clear boundary between preview visualization and production CAD.

Phase 0 defined the architecture foundation. Phase 1 introduced executable workspace scaffolding, health checks, dependency manifests, lockfiles, Docker Compose configuration, and CI. Phase 2 introduces the initial project-model schema and unit system only; database migrations, CAD implementation, calculations, simulations, AI command execution, and manufacturing logic remain deferred.

## Target Monorepo Structure

The Git repository root is the monorepo root. Implementation directories are created directly under the repository root when they have real content.

```text
fabrica/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── project-model/
│   ├── units/
│   ├── calculations/
│   ├── validation/
│   ├── layout-engine/
│   ├── geometry-core/
│   ├── microfluidic-components/
│   └── ui/
├── cad-service/
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
├── docs/
├── scripts/
├── .github/
└── README.md
```

Empty future architecture directories are intentionally deferred.

## Module Responsibilities

| Area | Future responsibility | Explicit non-responsibility |
| --- | --- | --- |
| `apps/web` | React shell, node editor, property editor, 2D layout presentation, 3D preview, workflows, display-unit conversion, structured project-model commands | Independent engineering source of truth, production CAD authority |
| `apps/api` | HTTP contracts, auth, persistence, command handling, schema validation, engineering validation enforcement, AI orchestration, CAD-job orchestration, audit records | Silent acceptance of invalid engineering writes |
| `packages/project-model` | Versioned schema, stable identifiers, model commands, engineering values, provenance, design status, migration metadata | UI-only state or duplicated language-specific schemas |
| `packages/units` | Internal units, unit normalization, dimensional helpers, display conversion contracts | Inferring units from unlabeled numbers |
| `packages/calculations` | Deterministic calculations with inputs, units, assumptions, provenance, limits, fixtures | GPT-overridden calculations |
| `packages/validation` | Structured validation rules, stable finding codes, severities, engineering-readiness checks | Generic success responses that hide validation failures |
| `packages/layout-engine` | Deterministic layout derivation independent of React and React Flow | Engineering connectivity authority through UI positions |
| `packages/geometry-core` | Language-neutral geometry primitives, transforms, coordinate conventions, preview-interchange contracts | Production CAD authority or second project model |
| `packages/microfluidic-components` | Engineering component definitions referencing schemas and profiles | Reusable visual UI components or invented manufacturing limits |
| `packages/ui` | Reusable visual UI components | Engineering calculations, schemas, CAD, or manufacturing rules |
| `cad-service` | CadQuery B-representation construction, OpenCascade geometry, STEP/STL export, CAD diagnostics | Executing uncontrolled GPT-generated CAD code |
| `tests` | Shared fixtures, integration tests, e2e tests, cross-language conformance tests | Production source ownership |
| `docs` | Architecture, standards, decisions, terminology | Executable implementation |
| `scripts` | Future automation scripts | Hidden application behavior |
| `.github` | Future CI and repository automation | CI claims before workflows exist |

## Authoritative Project Model

`packages/project-model` is the engineering source of truth for persisted project documents. Phase 2 owns schema version `0.1.0`, stable identifiers, component instances, ports, connections, dimensions, engineering values, value provenance, schema validation, and initial referential integrity checks. Future phases may add constraints, profile references, layout inputs, validation inputs, calculation inputs, design status, and migration metadata.

The canonical interchange representation is JSON Schema generated from the Zod 4 model in `packages/project-model`. Python Pydantic consumers are checked against the generated schema and shared fixtures. They must not become independently maintained engineering schemas.

## Versioning And Migration

Every persisted project must identify its schema version. Backward-incompatible changes require a new schema version, an explicit migration, migration tests, preservation of stable identifiers where possible, and documented compatibility impact. Saved projects must not be silently interpreted under a different schema version.

## Stable Identifiers

Projects, components, ports, channels, constraints, profiles, derived artifacts, and validation findings must have stable model-owned identifiers. Visual editors must not replace identifiers because an object is re-rendered, moved, or repositioned.

## Internal Units

Internal engineering units are locked as:

- Length: millimetres, mm
- Area: square millimetres, mm²
- Volume: cubic millimetres, mm³
- Time: seconds, s
- Pressure: pascals, Pa
- Volumetric flow: mm³/s
- Temperature: degrees Celsius, °C
- Angle: radians

The exact identity is:

1 µL = 1 mm³

Display-unit conversion belongs at presentation and input/output boundaries. Display-unit choices must not mutate canonical internal values.

## Value Provenance

Engineering values identify whether they are user-entered, deterministically calculated, AI-assumed, imported, simulated, system-defaulted, experimentally calibrated, or manufacturer supplied. Unknown values must remain unknown, missing, required, or explicitly defaulted. They must not be silently invented.

## Deterministic Engines

Calculations, validation, and layout are deterministic engine boundaries. They must be reproducible from project-model inputs, approved versioned profiles, and engine versions. GPT may propose inputs but must not override deterministic calculation or validation results.

## AI Trust Boundary

GPT output is untrusted structured input. GPT may produce a proposed command or model patch. Before it affects the authoritative model, it must pass schema validation, version compatibility checks, unit validation, semantic validation, stable-identifier validation, authorization checks, engineering-rule validation, and manufacturing/material profile validation where applicable.

GPT must not directly mutate persistence, bypass deterministic engines, mark a design Engineering Ready, fabricate manufacturing limits, fabricate material properties, fabricate reaction constants, fabricate pressure limits, execute arbitrary CAD code, or execute shell commands through generated content.

## CAD-Service Boundary

CadQuery is the approved initial production B-representation backend. CadQuery/OpenCascade output is authoritative for production STEP geometry. build123d may be evaluated later only through a new ADR or approved backend abstraction.

The CAD service must consume a validated project-model snapshot and approved versioned profiles. CAD generation is job-oriented. The job contract must support asynchronous execution, while early development may use synchronous local execution behind the same contract when operations are small and deterministic.

## Derived Artifacts

Calculated values, validation reports, 2D layout results, preview meshes, CAD bodies, STEP exports, STL exports, simulation results, and rendered views are derived data. They are not conflicting engineering copies.

A derived artifact must eventually be traceable to project identifier, project revision, schema version, engine version, manufacturing-profile version, material-profile version where relevant, deterministic input set, creation timestamp, and artifact status. Derived data must be reproducible or explicitly marked non-reproducible.

## Persistence Boundary

PostgreSQL is the approved persistence database, but it is introduced only when the persistence phase begins. Phase 0 creates no database configuration, migrations, containers, or SQLAlchemy setup.

## Deployment Evolution

The architecture preserves separate frontend, API, and CAD-service boundaries. Deployment topology, queue technology, and transport mechanisms are deferred until implementation evidence exists.

## Engineering Readiness

A design is not Engineering Ready merely because it renders, meshes, or exports. Engineering Ready status requires applicable schema, unit, semantic, connectivity, geometric, manufacturing-profile, material-profile, CAD, export, and engineering-readiness validation.

## Explicit Exclusions

Phase 2 excludes product features, engineering calculations, validation-rule engines beyond initial schema and integrity checks, layout engines, persistence, database migrations, GPT integration, production CAD, STEP/STL export, simulation, manufacturing logic, pushes, tags, and Phase 3 work.

## Deferred Decisions

Deferred decisions include the exact schema-generation tooling, API-to-CAD transport, queue technology, deployment topology, PostgreSQL schema design, CI matrix details, Docker Compose services, concrete test commands, and any future build123d evaluation.
