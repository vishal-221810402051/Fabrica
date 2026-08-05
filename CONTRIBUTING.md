# Contributing To Fabricgamma

Fabricgamma follows a controlled phase workflow. Each phase must be diagnosed, scoped, implemented, checked, and reviewed before later phases begin. Codex and human contributors must not merge implementation goals into diagnosis, validation, or commit steps unless Fabricgamma explicitly authorizes that combined action.

## Phase Workflow

- Diagnose the repository and environment before implementation.
- Implement only the approved phase scope.
- Preserve unrelated user work, local artifacts, ignored files, and untracked files.
- Run the approved validation or check set for the phase.
- Request review before commits, pushes, releases, or deployment actions.

## Branches And Commits

`main` is the canonical integration branch. Future work should normally happen on short-lived branches such as `feat/...`, `fix/...`, `docs/...`, and `chore/...`.

Conventional Commits are mandatory:

```text
<type>(<scope>): <concise description>
```

Commits must remain phase-scoped. Generated files, secrets, caches, local exports, and unrelated user files must not be committed. Fabricgamma controls when Codex may stage, commit, push, merge, rebase, or tag.

## Engineering Expectations

Documentation and code must preserve the versioned project model as the engineering source of truth. Contributors must not introduce duplicated authoritative models in the frontend, API, CAD service, tests, exports, or AI orchestration.

Unsupported engineering, manufacturing, pressure, optical, reaction, tolerance, or material claims are prohibited. Manufacturing limits and material properties must be explicit, configurable, versioned, and attributable to a source or organization.

## Testing And Validation

Each implementation phase must define the checks that apply to that phase. Future executable phases must include appropriate unit, integration, contract, browser, CAD, migration, and cross-language conformance tests. Validation evidence must be reviewed before a commit prompt is issued.

## Architecture Decisions

Material architecture changes require an ADR under [docs/architecture/decisions](docs/architecture/decisions/README.md). Superseding decisions must link to the ADR they replace and explain compatibility or migration impact.

## Secrets And Generated Artifacts

Secrets must not be committed. `.env` files are local only, and `.env.example` should be introduced only when applications have real variables to document.

Generated artifacts, build output, caches, logs, local databases, CAD exports, preview meshes, and temporary files must normally be ignored. Small deterministic fixtures may be committed only under an approved test-fixture location after intentional review.

## Pull Requests

Future pull requests should describe scope, phase alignment, validation evidence, architecture impact, migration impact, generated-file impact, and any known risk. Do not claim branch protection or automated checks exist until they are implemented.
