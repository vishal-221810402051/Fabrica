# Environment Strategy

Phase 0 documents the planned development environment. It does not install tools, create package manifests, create lockfiles, configure Docker, create virtual environments, or start services.

## Planned Tool Baseline

- Node.js: 24.
- JavaScript package manager: pnpm.
- Python: 3.12.
- Python dependency and virtual-environment manager: uv.
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

Phase 0 creates no Dockerfile, Compose file, SQLAlchemy configuration, Alembic configuration, migration, local database, or container resource.

## CAD Dependency Isolation

CadQuery and OpenCascade are high-impact binary dependencies. CAD dependencies should be isolated from general API dependencies where practical, pinned, and tested on target platforms before production claims are made.

build123d may be evaluated later only through a new ADR or approved backend abstraction.

## Cross-Platform Expectations

Development should remain viable on Windows, Linux, macOS, WSL, and containers where practical. CAD behavior must be tested on the operating systems and container images that the project intends to support.

No committed application configuration should depend on machine-specific absolute paths.

## Reproducibility And Lockfiles

Lockfiles should be committed once executable workspaces exist and package managers are approved in implementation scope. Until then, Phase 0 only documents the planned package-manager choices.
