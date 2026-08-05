# ADR-0001: Platform Architecture

Status: Accepted

Date: 2026-08-05

## Context

Fabricgamma is beginning as an empty repository for an AI-powered microfluidic chip 3D design platform. Before executable development begins, the repository needs locked architecture boundaries for the monorepo, authoritative project model, deterministic engines, AI trust boundary, CAD authority, internal units, testing posture, Git workflow, environment strategy, and generated-artifact policy.

The platform must avoid conflicting engineering copies across the node editor, property editor, layout, visualization, validation, calculations, AI orchestration, CAD generation, export, and persistence.

## Decision

The Git repository root is the monorepo root. No nested `microfluidic-design-platform/` directory will be created.

The monorepo will eventually contain:

- `apps/web` for the React user interface, editing workflows, 2D layout presentation, 3D preview, display-unit conversion, client-side interaction state, and structured project-model commands.
- `apps/api` for HTTP contracts, authentication and authorization, persistence, command handling, schema validation, engineering validation enforcement, deterministic-engine orchestration, AI orchestration, CAD-job orchestration, export metadata, audit records, and diagnostics.
- `packages/project-model` as the engineering source of truth.
- `packages/units` for internal units, normalization, and display conversion contracts.
- `packages/calculations` for deterministic engineering calculations.
- `packages/validation` for deterministic structured validation rules.
- `packages/layout-engine` for deterministic UI-independent layout derivation.
- `packages/geometry-core` for language-neutral geometry primitives and preview-interchange contracts, not production CAD authority.
- `packages/microfluidic-components` for reusable engineering microfluidic component definitions.
- `packages/ui` for reusable visual UI components only.
- `cad-service` for CadQuery/OpenCascade B-representation construction, CAD diagnostics, STEP export, STL export, and export validation support.
- `tests`, `docs`, `scripts`, and `.github` for shared test assets, documentation, automation, and future repository automation.

Empty future application and package directories are deferred until they have implemented content.

`packages/project-model` will own the versioned authoritative model. It must eventually include schema version, stable identifiers, component instances, ports, channels, connectivity, dimensions, constraints, engineering values, value provenance, manufacturing-profile references, material-profile references, layout inputs, validation inputs, calculation inputs, design status, and migration metadata.

JSON Schema is the planned canonical interchange representation. TypeScript types and Python Pydantic models must be generated from or mechanically checked against the canonical schema. They must not become independently maintained engineering schemas.

Every persisted project must identify its schema version. Backward-incompatible changes require a new schema version, explicit migration, migration tests, preservation of stable identifiers where possible, and documented compatibility impact.

Projects, components, ports, channels, constraints, profiles, derived artifacts, and validation findings must have stable model-owned identifiers.

Internal units are locked:

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

Display-unit conversion belongs at presentation or input/output boundaries and must not mutate canonical internal values.

Engineering values must eventually identify whether they are user-entered, calculated, AI-assumed, imported, simulated, calibrated, or defaulted. Unknown values must remain unknown, missing, required, or explicitly defaulted.

GPT output is untrusted structured input. GPT may produce proposals, but must not directly mutate persistence, bypass deterministic calculations or validation, mark a design Engineering Ready, fabricate engineering limits, execute arbitrary CAD code, or execute shell commands through generated content.

CadQuery is the approved initial production B-representation backend. CadQuery/OpenCascade output is authoritative for production STEP geometry. React Three Fiber and Three.js are visualization systems, not production CAD authority. build123d may be evaluated later only through a new ADR or an approved backend abstraction.

CAD generation is a job-oriented boundary. The job contract must be capable of asynchronous execution. Early development may use synchronous local execution behind the same contract for small deterministic operations.

Generated artifacts are normally ignored. Small deterministic fixtures may be committed only under approved test-fixture locations after intentional review.

Node.js 24, pnpm, Python 3.12, uv, Pyright, Ruff, ESLint, Prettier, Vitest, Playwright, Pytest, Docker Compose, PostgreSQL, GitHub Actions, and Conventional Commits form the planned baseline. Dependencies and executable configuration are deferred until scaffold phases.

## Consequences

- Schema, deterministic engines, CAD contracts, tests, and documentation can evolve atomically.
- Frontend state, preview geometry, and generated exports cannot become conflicting engineering truth.
- CAD deployment and OpenCascade risks are isolated behind a service boundary.
- AI behavior is constrained to validated structured proposals.
- Future migrations and stable identifiers are required before durable persistence.
- Phase 0 remains documentation and governance only.

## Alternatives Considered

- Polyrepo architecture: rejected because schema, engine, CAD, and test changes need coordinated versioning.
- Nested repository root directory: rejected because the Git repository itself is the monorepo root.
- Separate `domain` and `schemas` packages: rejected as ambiguous; replaced by `project-model`.
- `component-library` package name: rejected as ambiguous; replaced by `microfluidic-components`.
- Three.js or React Three Fiber as CAD authority: rejected because production STEP requires an approved B-representation backend.
- build123d as initial backend: deferred; it may be reconsidered through a future ADR.

## Deferred Decisions

- Concrete schema-generation tooling.
- Package manifests and workspace configuration.
- API-to-CAD transport mechanism.
- Queue technology and asynchronous job runner.
- Deployment topology.
- PostgreSQL schema design.
- Docker Compose service definitions.
- GitHub Actions workflows and CI matrix.
- CAD validation implementation details.
- Test commands for executable workspaces.

## Supersession Policy

Any future ADR that changes these locked decisions must link to this ADR, identify superseded sections, describe migration impact, and state whether persisted project models or derived artifacts require compatibility handling.
