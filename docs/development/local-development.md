# Local Development

Phase 1 established the reproducible development foundation for Fabricgamma. Phase 2 adds the initial project-model schema and unit system. Phase 3 adds browser-local web project management with IndexedDB, import/export, autosave, recovery, recent projects, and undo/redo. Phase 4 adds reusable component definitions and local port compatibility checks. Phase 5 adds a React Flow visual editor for component placement, movement, local connections, and basic property editing. Engineering calculations, whole-project validation-rule engines, production CAD, backend persistence, authentication, GPT integration, and simulation remain deferred.

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

## Docker Local Startup

Docker Compose is the recommended integrated local-development path when
Docker Desktop is running.

Before starting Docker, stop any native processes already using ports `5173`,
`8000`, or `8001`. On Windows, inspect those ports without terminating
anything:

```powershell
Get-NetTCPConnection -LocalPort 5173,8000,8001 -ErrorAction SilentlyContinue
```

Start the default development stack:

```powershell
docker compose up --build
```

The default stack starts:

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000`
- CAD service: `http://127.0.0.1:8001`

Detached startup:

```powershell
docker compose up -d --build
```

Status and logs:

```powershell
docker compose ps
docker compose logs -f
docker compose logs -f cad
docker compose restart cad
```

Stop the stack:

```powershell
docker compose down
```

The Docker stack bind-mounts repository source for development reload. Source
edits should not require rebuilding. Changes to JavaScript dependencies,
Python dependencies, lockfiles, or Dockerfiles require:

```powershell
docker compose up --build
```

Container dependency state is isolated from host Windows dependency folders.
The web service uses container-owned `node_modules` volumes and a pnpm store
cache. The API and CAD services use uv with a container Python environment
outside `/workspace` and a container uv cache. Native Windows `node_modules/`,
`.venv/`, and `.uv-cache/` remain ignored local development state.

The CAD service mounts `./generated-cad` to `/workspace/generated-cad` so future
local CAD outputs are visible on the host. The path is ignored by Git.

If Docker Desktop on Windows does not report file changes reliably through bind
mounts, enable a development-only polling fallback for the affected service
rather than changing application code.

During Phase 9E diagnosis, Docker CLI reported an environment warning when it
could not read `C:\Users\visha\.docker\config.json` due to access denied. That
file is user Docker Desktop configuration and is not modified by this
repository.

Optional future PostgreSQL infrastructure is behind the `database` profile and
does not start by default:

```powershell
docker compose --profile database up --build
```

To remove named dependency caches and optional database state, use only when a
clean reset is intended:

```powershell
docker compose down -v
```

## Native Local Startup

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

Python checks are invoked through uv by the root scripts. Tests run through
`python -m pytest` inside that environment so they do not depend on the pytest
console launcher being executable on Windows.

### Compiled Workspace Package Contract

Shared packages expose compiled JavaScript and declarations under `dist/`.
Builds must emit both the runtime file advertised by `main`/`exports` and the
declarations advertised by `types`. Generated output remains ignored by Git.
The existing CommonJS packages and ESM packages retain their module types.

Package `build`, `typecheck`, and `test` scripts prepare their workspace
prerequisites explicitly: `project-model` builds `units`,
`microfluidic-components` builds `project-model`, `geometry-core` builds
`microfluidic-components`, and the web app builds `geometry-core`. Each build
recursively prepares its own prerequisites, so filtered package commands do
not require a remembered bootstrap build. Packages without workspace
dependencies compile directly. Root recursive commands use the same package
scripts; CI intentionally still typechecks before its full build step.

Vite source aliases remain useful for development reload and browser tests,
but they do not establish the compiled package contract. Verify the actual
Node runtime entrypoints and declaration files with:

```powershell
corepack pnpm workspace:smoke
```

This command builds the workspace before running the entrypoint smoke check.
CI runs `node scripts/check-workspace-entrypoints.mjs` immediately after its
existing build step. The smoke check resolves each shared package through its
package exports and imports the emitted runtime without Vite aliases.

For reproducibility checks, use a separate clean checkout or source copy with
its own dependency installation and no existing `dist` directories. Run
typecheck, tests, and build independently from missing outputs; success in a
working tree containing old generated declarations is insufficient evidence.
Do not remove another developer's outputs or in-progress changes to simulate
a clean checkout.

Focused Phase 4 checks:

```powershell
corepack pnpm --filter microfluidic-components test
corepack pnpm --filter @fabrica/web test
```

The web editor uses `@xyflow/react@12.11.2`. Manual browser validation should
confirm click-to-add, movement, connection feedback, property editing, undo,
redo, export, and import because jsdom tests do not prove pointer ergonomics.

## Docker Configuration

Configuration validation:

```powershell
docker compose config
```

Runtime validation with `docker compose up --build` requires Docker Desktop to
be running. The default service names are `web`, `api`, and `cad`; PostgreSQL
is retained only under the optional `database` profile. Application services do
not depend on PostgreSQL today, and there are still no persistence models,
migrations, or database business rules.

## Deferred Functionality

Phase 5 intentionally excludes drag-from-palette, automatic routing, automatic layout, whole-project topology validation, calculations, process-profile DFM checks, 3D chip geometry, GPT integration, production CAD, STEP/STL export, authentication, backend persistence, database business models, cloud synchronization, and simulation.
