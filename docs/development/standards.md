# Development Standards

Fabricgamma development must protect the authoritative project model, deterministic engineering behavior, and user work. These standards apply to future code, documentation, tests, scripts, generated artifacts, and AI-assisted changes.

## General Principles

- Prefer strongly typed, explicit interfaces.
- Keep modules focused and boundaries documented.
- Do not maintain duplicated authoritative project models.
- Treat engineering values, units, provenance, and validation status as first-class data.
- Preserve unrelated user work and local artifacts.
- Avoid unsupported engineering, manufacturing, pressure, optical, reaction, tolerance, or material claims.

## TypeScript Standards

Future TypeScript code should use strict typing, explicit public interfaces, small modules, and deterministic data transformations where possible. React components should not own engineering truth. Zustand should hold transient UI/application state only. Zod may validate runtime payloads, but it must not become an independent engineering schema when canonical project-model schemas exist.

ESLint owns TypeScript and React correctness rules. Prettier owns TypeScript, JSON, YAML, Markdown, and frontend formatting. The TypeScript compiler owns TypeScript type checking.

## Python Standards

Future Python code should target Python 3.12, use explicit types, small modules, clear service boundaries, and deterministic pure functions for calculation, validation, layout, and CAD preprocessing where feasible.

Pydantic models must be generated from or mechanically checked against the canonical project-model schema. Ruff owns Python formatting and linting. Pyright owns Python static type checking.

## Naming

Names should distinguish product concepts from implementation details:

- `project-model` means the authoritative engineering model.
- `microfluidic-components` means engineering component definitions.
- `ui` means visual user-interface components.
- `geometry-core` means geometry primitives and preview-interchange contracts, not production CAD authority.

## Deterministic Engines

Deterministic engines should prefer immutable inputs, pure functions, explicit outputs, stable diagnostic codes, fixture-based tests, and reproducible results from model inputs and engine versions.

GPT may propose inputs but must not override deterministic calculation or validation outputs.

## Units And Dimensional Clarity

Internal units are millimetres, mm², mm³, seconds, pascals, mm³/s, degrees Celsius, and radians. The exact identity is:

1 µL = 1 mm³

Units must be explicit. Units must never be inferred solely from an unlabeled number. Display-unit conversion belongs at presentation or input/output boundaries.

## Value Provenance

Engineering values must eventually identify whether they are user-entered, calculated, AI-assumed, imported, simulated, calibrated, or defaulted. Unknown values must remain unknown, missing, required, or explicitly defaulted.

## Error Handling And Diagnostics

Future errors must be structured and actionable. Engineering diagnostics should include stable code, severity, affected model identifier, human-readable message, machine-readable details, source engine, and suggested remediation where appropriate.

Do not hide validation failures behind generic success responses.

## Comments And Documentation

Comments should explain non-obvious decisions, invariants, units, assumptions, or safety constraints. Documentation should stay phase-scoped and must not claim executable capabilities before they exist.

## Dependency Rules

Dependencies must be evaluated for license, redistribution restrictions, maintenance status, target-platform support, security status, binary distribution constraints, and OpenCascade/CAD deployment implications. Licensing is not fully approved until reviewed.

## Generated Code And Artifacts

Generated code must identify its source and regeneration path. Generated artifacts, build output, caches, local databases, logs, CAD exports, preview meshes, and temporary files must normally be ignored. Small deterministic fixtures may be committed only under approved fixture paths after review.

## Security And Secrets

Secrets must not be committed. `.env` files are local only. `.env.example` should be introduced only when applications have real variables to document. Future application startup must validate required environment variables.

## Prohibited Shortcuts

- Do not create a second engineering source of truth.
- Do not let GPT mutate persistence directly.
- Do not execute uncontrolled GPT-generated CAD, Python, shell, or OpenCascade code.
- Do not describe rendering, meshing, exporting, or previewing as Engineering Ready.
- Do not invent manufacturing limits, material properties, reaction constants, optical values, or pressure limits.
- Do not commit unrelated local files, generated artifacts, caches, exports, or secrets.

An unsupported claim is any engineering or manufacturing statement that is not backed by validated model data, versioned profiles, deterministic calculations, or reviewed source attribution.
