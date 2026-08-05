# Project Model

Phase 2 defines the initial persisted Fabricgamma project model as schema
version `0.1.0`.

## Authority

`packages/project-model` is the TypeScript source of truth for the persisted
project schema. It owns:

- Schema version `0.1.0`.
- Stable identifier formats.
- Project, chip, layer, lane, component, port, connection, material, fluid,
  manufacturing-process, validation-result, and export-configuration shapes.
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
packages/project-model/schema/project.v0.1.0.schema.json
```

It is produced from the Zod 4 model with `z.toJSONSchema(...)` and targets JSON
Schema Draft 2020-12. The check command verifies that the generated output
matches the committed artifact:

```powershell
corepack pnpm schema:check
```

## Phase boundary

Phase 2 does not introduce calculations, manufacturing limits, material-profile
behavior, layout engines, persistence, CAD generation, simulation, AI command
execution, or Engineering Ready status.
