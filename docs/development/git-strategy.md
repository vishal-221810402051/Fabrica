# Git Strategy

`main` is the canonical integration branch for Fabricgamma.

## Branching

After repository initialization, work should normally happen on short-lived branches:

- `feat/...`
- `fix/...`
- `docs/...`
- `chore/...`

Branches should have a narrow purpose and stay aligned with the active Fabricgamma phase.

## Commits

Conventional Commits are mandatory:

```text
<type>(<scope>): <concise description>
```

Commits must remain phase-scoped. A commit should not mix diagnosis, implementation, formal validation, and unrelated cleanup unless Fabricgamma explicitly approves that combined scope.

## Staging Rules

Review the staged diff before any commit. Do not stage unrelated user work, ignored files, generated artifacts, secrets, caches, local exports, local databases, or diagnostic files unless Fabricgamma explicitly includes them in scope.

## Preservation Of User Work

Contributors and Codex must preserve tracked changes, staged changes, ignored files, untracked files, editor files, generated artifacts, and local configuration that are not part of the approved task.

## Validation Before Commit

Applicable checks must pass before a commit prompt is issued. The validation evidence should include exact commands, exit codes, important output, and interpretation.

## Pull Requests

Future pull requests should summarize scope, phase alignment, validation evidence, architecture impact, migration impact, generated-file impact, and known risks. Do not claim branch protection or automated checks exist until they are implemented.

## Release And Tag Policy

Release and tag policy is deferred. Codex must not push, merge, rebase, tag, or force-update Git state without a separate explicit instruction.
