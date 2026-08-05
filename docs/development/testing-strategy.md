# Testing Strategy

Phase 0 defines the testing strategy only. Executable commands will be added when executable workspaces exist.

## Objectives

Testing must protect the authoritative project model, cross-language contract conformance, deterministic repeatability, unit correctness, CAD/export integrity, migration safety, and user-facing workflows.

## Future Test Layers

- Schema tests.
- Unit tests.
- Unit-conversion tests.
- Calculation tests.
- Validation-rule tests.
- Layout-engine fixture tests.
- Component-definition tests.
- API contract tests.
- API integration tests.
- Persistence and migration tests.
- CAD geometry tests.
- CAD Boolean tests.
- STEP export and re-import tests.
- STL manifold and mesh checks.
- Frontend component tests.
- Accessibility checks.
- Browser end-to-end tests.
- Cross-language contract-conformance tests.

## Tool Ownership

- Vitest: TypeScript unit and component tests.
- Playwright: browser end-to-end tests.
- Pytest: Python API, CAD, integration, and migration tests.

ESLint, Prettier, Ruff, Pyright, and the TypeScript compiler support quality checks but are not substitutes for behavioral tests.

## Fixture Strategy

Fixtures should be small, deterministic, versioned, and intentionally reviewed. They should cover canonical project-model examples, units, calculations, validation findings, layout constraints, CAD inputs, STEP/STL export expectations, and migration paths.

Generated fixtures may be committed only under approved test-fixture locations and only when their source, purpose, and regeneration process are documented.

## Deterministic Repeatability

Calculation, validation, layout, and CAD tests must be reproducible from explicit inputs, schema version, engine version, manufacturing-profile version, and material-profile version where relevant. Non-reproducible artifacts must be marked as such and cannot be used as authoritative regression baselines.

## Cross-Language Contract Conformance

TypeScript and Python consumers must conform to the canonical project-model schema. Contract tests must catch drift between JSON Schema, generated TypeScript types, runtime validation, and Pydantic models.

## Migration Testing

Backward-incompatible schema changes require migration tests. Migration tests must verify schema version handling, stable identifier preservation where possible, compatibility impact, and explicit rejection of unsupported saved-project versions.

## Unit And Validation Testing

Unit-conversion tests must preserve internal units and the exact identity:

1 µL = 1 mm³

Validation-rule tests must distinguish schema validation, unit validation, semantic validation, connectivity validation, geometric validation, manufacturing-profile validation, material-profile validation, CAD validation, export validation, and engineering-readiness validation.

## API And UI Testing

API tests must verify command handling, authorization, validation enforcement, persistence behavior, audit metadata, and CAD-job orchestration when those features exist.

UI tests must verify editing workflows, accessibility, display-unit conversion, presentation of validation and calculations, and browser end-to-end behavior without turning UI state into a second engineering model.

## CAD And Export Testing

CAD tests must cover B-representation generation, Boolean behavior, geometry diagnostics, STEP export and re-import, STL manifold checks, mesh checks, and export validation findings. React Three Fiber and Three.js preview tests do not prove production CAD correctness.

## Engineering-Readiness Testing

Engineering Ready status must require applicable validation evidence. A design is not Engineering Ready merely because it renders, meshes, or exports.

## CI Introduction Point

GitHub Actions should be introduced when executable scaffolds and real commands exist. Phase 0 does not create CI workflows.

## Evidence Requirements

Test results must be reported with exact command, exit code, important output, and interpretation. Failures must be classified as:

- New.
- Pre-existing.
- Environmental.
- Unreproducible.
