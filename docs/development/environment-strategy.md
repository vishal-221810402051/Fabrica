# Environment Strategy

Phase 0 documents the planned development environment. It does not install tools, create package manifests, create lockfiles, configure Docker, create virtual environments, or start services.

## Planned Tool Baseline

- Node.js: 24.
- JavaScript package manager: pnpm 11.20.0 through Corepack.
- Python: 3.12.
- Python dependency and virtual-environment manager: uv 0.12.1.
- Python type checker: Pyright.
- Python formatter and linter: Ruff.
- Frontend correctness and formatting: ESLint and Prettier.
- Version control: Git and GitHub.
- Future CI: GitHub Actions.
- Future local multi-service orchestration: Docker Compose.
- Future persistence database: PostgreSQL.

The diagnosed local repository path is `C:\Users\visha\Desktop\Projects\fabrica`. This is diagnosis context only and must not become a committed application dependency.

## Configuration Separation

Development, test, CI, and production configuration must remain distinct. Application defaults must not be confused with engineering defaults. Engineering defaults require provenance and versioned manufacturing or material profiles.

## Environment Variables

Future applications must validate required environment variables at startup and report structured diagnostics for missing or invalid configuration.

`.env` files must never be committed. `.env.example` should be introduced only when applications have real variables to document.

Secrets must come from local secret storage, deployment secret stores, or GitHub Actions secrets. Secrets must not appear in source files, documentation examples, logs, fixtures, or generated artifacts.

## Docker And PostgreSQL

Docker Compose should be introduced when database or multi-service integration requires it. PostgreSQL is the approved persistence database, but it should be introduced only when the persistence phase begins.

Phase 1 introduces Docker Compose and a PostgreSQL development service as infrastructure only. The application still contains no SQLAlchemy configuration, Alembic configuration, migration, persistence model, or database business logic.

During Phase 1 diagnosis, Docker CLI and Compose were installed locally, but the Docker daemon was unavailable. Runtime Docker validation therefore depends on a running daemon or CI.

## CAD Dependency Isolation

CadQuery and OpenCascade are high-impact binary dependencies. CAD dependencies should be isolated from general API dependencies where practical, pinned, and tested on target platforms before production claims are made.

build123d may be evaluated later only through a new ADR or approved backend abstraction.

## Cross-Platform Expectations

Development should remain viable on Windows, Linux, macOS, WSL, and containers where practical. CAD behavior must be tested on the operating systems and container images that the project intends to support.

No committed application configuration should depend on machine-specific absolute paths.

## Reproducibility And Lockfiles

Phase 1 commits `pnpm-lock.yaml` and `uv.lock` after executable workspace dependencies are introduced. CI must use lockfile-enforced install/sync commands.
