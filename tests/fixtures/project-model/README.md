# Project Model Fixtures

Phase 2 fixtures are shared by TypeScript, JSON Schema, and Python parity tests.

Valid fixtures:

- `minimal-valid-project.json`: smallest accepted project with one chip, one layer, one material, and no components.
- `two-lane-valid-project.json`: valid project with two lanes, channel components, ports, connections, fluid, material, validation result, and export settings.
- `provenance-valid-project.json`: valid project demonstrating `ai-assumed` provenance metadata.
- `canonical-units-valid-project.json`: valid project using only normalized canonical persisted units.
- `current-version-roundtrip.json`: current-version fixture used to verify parse/serialize idempotence.

Schema-invalid fixtures:

- `invalid-enum.json`: invalid enum value.
- `invalid-unit.json`: non-canonical persisted unit.
- `invalid-non-finite-equivalent.json`: string sentinel standing in for a non-finite runtime value because JSON cannot represent `NaN` or `Infinity`.
- `invalid-negative-dimension.json`: property-level positive dimension failure.
- `invalid-unknown-field.json`: strict unknown-field failure.
- `invalid-future-version.json`: unsupported future schema version.
- `invalid-old-version.json`: unsupported old schema version.

Integrity-invalid fixtures:

- `duplicate-id.json`: duplicate stable identifier.
- `missing-layer-reference.json`: missing layer reference.
- `missing-component-reference.json`: missing component reference.
- `missing-port-reference.json`: missing port reference.
