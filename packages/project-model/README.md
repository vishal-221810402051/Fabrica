# project-model

Authoritative versioned persisted project model for Fabricgamma.

Phase 8A defines schema version `0.2.0`, strict Zod runtime validation,
stable identifier formats, normalized quantity shapes, provenance metadata,
schema-version migration, current-version roundtrip support, referential
integrity checks, and persisted physical route records.

The generated JSON Schema artifact is:

```text
packages/project-model/schema/project.v0.2.0.schema.json
```

The schema is generated from the Zod 4 model with `z.toJSONSchema(...)` and
targets JSON Schema Draft 2020-12. Do not edit the generated artifact by hand;
change the Zod model and run schema generation.

## Commands

```powershell
corepack pnpm --filter project-model test
corepack pnpm --filter project-model typecheck
corepack pnpm --filter project-model build
corepack pnpm --filter project-model schema:generate
corepack pnpm --filter project-model schema:check
```

## Scope boundary

The package deliberately does not implement calculations, manufacturing rules,
layout derivation, persistence, CAD generation, or editor commands. Validation
is limited to persisted schema correctness, version compatibility, unit
normalization, and current referential integrity.
