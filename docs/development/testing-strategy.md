# Testing Strategy

Phase 6 adds typed inspector, unit-draft, manual property-edit, registry reset,
optional-parameter clearing, and multi-selection read-only tests on top of
Phase 5 visual-editor projection, insertion, movement, connection, property,
duplication, deletion, keyboard, and scale tests; Phase 4 component-registry,
factory, duplication, local port-compatibility, and catalogue tests; and the
Phase 3 browser-local project state,
IndexedDB persistence, import/export, autosave, recovery, recent-project,
multi-tab warning, and undo/redo tests.

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
- Browser end-to-end runner: future browser end-to-end tests when explicitly
  introduced.
- Pytest: Python API, CAD, integration, and migration tests.

ESLint, Prettier, Ruff, Pyright, and the TypeScript compiler support quality checks but are not substitutes for behavioral tests.

## Phase 2 Commands

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm schema:check
```

These root scripts invoke the configured JavaScript and Python checks. They now
cover the health-check foundations, package boundaries, unit conversions,
project-model runtime validation, JSON Schema generation, Python parity tests,
browser-local project-management behavior, component-definition registry checks,
component factory behavior, duplication behavior, and local port compatibility.
IndexedDB tests use `fake-indexeddb` under Vitest/jsdom and do not touch real
browser data.

## Phase 4 Focus

`packages/microfluidic-components` tests must verify registry immutability,
30 built-in definitions, parameter defaults and overrides, canonical unit
normalization, persisted definition identity, persisted port-template metadata,
local direction/medium/role/layer/lane/multiplicity compatibility, and
component-level duplication.

`apps/web` tests must keep the Phase 3 project-management controls and health
cards covered while verifying that the visual editor remains a projection of
the authoritative project, mutates only through validated transactions, and
does not persist React Flow viewport, node, edge, selection, or preview state.

## Phase 5 Focus

Editor tests cover handle ID mapping, project-to-node projection, click-to-add,
0.1 mm physical snapped movement, local connection compatibility, property
updates through the Phase 4 instance API, layer/lane reassignment rejection when
connections would become incompatible, duplication/deletion cleanup, keyboard
guards, and a 100-component projection scale case without fragile timing
assertions.

## Phase 6 Focus

Inspector tests must verify that drafts stay transient until explicit Apply,
invalid and no-op applies do not mutate history or persistence state, unit
display choices convert only through supported units, canonical Project values
and schema version remain authoritative, manual quantity edits receive
`user-entered` provenance, registry resets preserve registry/default provenance,
optional values clear only where allowed, and export/import payloads exclude
drafts and display-unit preferences.

Pure editor-action tests should cover project, chip, layer, lane, port,
material, manufacturing-process, component, and registry-parameter edits without
browser timing. Component-registry tests should protect shared first-class and
extension parameter behavior such as reset provenance and optional clear.
jsdom UI tests should cover the inspector's explicit Apply workflow,
undo/redo integration, and read-only multi-selection behavior.

## Phase 9A Focus

`geometry-core` tests must cover Project-to-scene projection, CAD-space
coordinates, chip dimensions, layer Z, top-down cavity placement, component
dimensions and rotation, splitter/merger geometry, full route polylines,
rectangular route segment geometry, route Z placement, incomplete route
classification, unsupported component classification, chip/layer-depth
warnings, and bend-radius approximation warnings.

Web tests must cover the lazy 3D workspace boundary, selection mapping, 2D to
3D selected IDs, 3D component clicks back to editor selection, route clicks to
connection selection, layer visibility state, view/material/camera state as
UI-only data, no Three/R3F state serialized into the Project, and scene updates
after Project geometry changes.

jsdom tests must not claim WebGL rendering correctness. Actual WebGL render,
orbit/pan/zoom, camera presets, picking feel, transparency, visual geometry,
and layer toggles require manual browser smoke validation.

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
