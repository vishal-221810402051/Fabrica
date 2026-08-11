# Environment Strategy

Phase 0 documented the planned development environment. Phase 1 introduced the executable workspace, package manifests, lockfiles, Docker Compose configuration, and service health checks. Phase 2 adds project-model and unit-system dependencies without adding persistence, production CAD, or manufacturing infrastructure.

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
- Local multi-service orchestration: Docker Compose for the web, API, and CAD
  development stack.
- Future persistence database: PostgreSQL.

The diagnosed local repository path is `C:\Users\visha\Desktop\Projects\fabrica`. This is diagnosis context only and must not become a committed application dependency.

## Configuration Separation

Development, test, CI, and production configuration must remain distinct. Application defaults must not be confused with engineering defaults. Engineering defaults require provenance and versioned manufacturing or material profiles.

## Environment Variables

Future applications must validate required environment variables at startup and report structured diagnostics for missing or invalid configuration.

`.env` files must never be committed. `.env.example` should be introduced only when applications have real variables to document.

Secrets must come from local secret storage, deployment secret stores, or GitHub Actions secrets. Secrets must not appear in source files, documentation examples, logs, fixtures, or generated artifacts.

## Docker And PostgreSQL

Docker Compose provides the integrated local-development runtime for ordinary
web, API, and CAD service work. The Compose stack is development-oriented: it
uses bind-mounted source, visible service logs, container-owned dependency
caches, and reload-capable service commands.

PostgreSQL is the approved persistence database, but it should become part of
ordinary application runtime only when the persistence phase begins. The
Compose PostgreSQL service is retained under an optional `database` profile as
future infrastructure only. The application still contains no SQLAlchemy
configuration, Alembic configuration, migration, persistence model, or database
business logic.

Docker runtime validation depends on Docker Desktop being installed and running.
Repository implementation must not modify user Docker Desktop configuration.

## CAD Dependency Isolation

CadQuery and OpenCascade are high-impact binary dependencies. CAD dependencies should be isolated from general API dependencies where practical, pinned, and tested on target platforms before production claims are made.

build123d may be evaluated later only through a new ADR or approved backend abstraction.

## Cross-Platform Expectations

Development should remain viable on Windows, Linux, macOS, WSL, and containers where practical. CAD behavior must be tested on the operating systems and container images that the project intends to support.

No committed application configuration should depend on machine-specific absolute paths.

## Reproducibility And Lockfiles

Phase 1 commits `pnpm-lock.yaml` and `uv.lock` after executable workspace dependencies are introduced. CI must use lockfile-enforced install/sync commands.
