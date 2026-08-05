# Local Development

Phase 1 established the reproducible development foundation for Fabricgamma. Phase 2 adds the initial project-model schema and unit system. Phase 3 adds browser-local web project management with IndexedDB, import/export, autosave, recovery, recent projects, and undo/redo. Phase 4 adds reusable component definitions, deterministic component factories, local port compatibility checks, and a read-only web catalogue. Engineering calculations, whole-project validation-rule engines, production CAD, backend persistence, authentication, GPT integration, and simulation remain deferred.

## Prerequisites

- Node.js 24.
- Corepack.
- pnpm 11.20.0 through Corepack.
- Python 3.12.
- uv 0.12.1.
- Docker Compose for configuration validation and later local orchestration.

On this Windows environment, PowerShell blocks some `.ps1` command shims. Prefer `corepack pnpm ...`, `npm.cmd ...`, and `python -m uv ...` forms when a bare command fails.

The Windows `py` launcher was unreliable during diagnosis. Repository commands should not depend on `py`.

## Install Dependencies

```powershell
corepack pnpm install
python -m uv sync
```

These commands create local dependency state such as `node_modules/` and `.venv/`, which are ignored by Git.

If the default uv cache path is unavailable on Windows, repository scripts use `scripts/run_uv.py`, which sets an ignored local `.uv-cache/` directory.

## Environment

Copy `.env.example` to `.env` for local development when needed. The committed template contains local defaults only and no real credentials.

Key ports:

- Web: `5173`
- API: `8000`
- CAD service: `8001`
- PostgreSQL: `5432`

## Local Startup

```powershell
corepack pnpm dev
```

The development script starts the web app, API service, and CAD service in separate PowerShell windows. It does not start Docker.

Individual services:

```powershell
corepack pnpm --filter @fabrica/web dev
python scripts/run_uv.py run --package fabrica-api uvicorn fabrica_api.main:app --reload --host 127.0.0.1 --port 8000
python scripts/run_uv.py run --package fabrica-cad uvicorn fabrica_cad.main:app --reload --host 127.0.0.1 --port 8001
```

## Health Endpoints

- API: `http://127.0.0.1:8000/health`
- CAD service: `http://127.0.0.1:8001/health`

Both return deterministic Phase 1 health payloads with `service`, `status`, and `version`.

The web app defaults to `VITE_API_BASE_URL=http://127.0.0.1:8000` and `VITE_CAD_BASE_URL=http://127.0.0.1:8001`. The API and CAD service accept browser health requests from both `http://localhost:5173` and `http://127.0.0.1:5173` by default through comma-separated `API_ALLOWED_ORIGINS` and `CAD_ALLOWED_ORIGINS` values.

The web app uses browser IndexedDB database `fabricgamma` for local project
records. This data is local to the browser origin and is not sent to the API.
Portable project files are exported explicitly as `.fabricgamma.json`.

## Checks

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm schema:check
```

Python checks are invoked through uv by the root scripts.

Focused Phase 4 checks:

```powershell
corepack pnpm --filter microfluidic-components test
corepack pnpm --filter @fabrica/web test
```

## Docker

`compose.yaml` defines `web`, `api`, `cad-service`, and `postgres`. PostgreSQL exists as infrastructure only; no persistence models, migrations, or database business logic exist in Phase 4.

Configuration validation:

```powershell
docker compose config
```

Runtime validation with `docker compose up` requires the Docker daemon. During Phase 1 diagnosis, Docker CLI and Compose were installed, but the daemon was unavailable locally.

## Deferred Functionality

Phase 4 intentionally excludes editor workflows, component insertion, drag-and-drop palettes, connection drawing, whole-project topology validation, calculations, process-profile DFM checks, layout algorithms, 3D chip geometry, GPT integration, production CAD, STEP/STL export, authentication, backend persistence, database business models, cloud synchronization, and simulation.
