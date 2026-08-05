# Project State

Phase 3 introduces browser-local project management for the Phase 2 project
model. The authoritative engineering document remains the validated
`Project` type from `packages/project-model`.

## State Boundaries

The web app separates four state categories:

- Engineering state: one current validated `Project`.
- Local metadata: browser-local record ID, storage version, revision, save and
  export timestamps, source, autosave state, recovery state, and external
  revision warnings.
- Transient UI state: selection, active dialog, operation status, and visible
  errors.
- History state: bounded immutable `Project` snapshots for undo and redo.

Browser-local metadata, UI state, and history are never inserted into the
persisted engineering project document.

## Browser Storage

The browser database is IndexedDB through `idb`.

- Database name: `fabricgamma`
- Database version: `1`
- Object store: `projects`
- Key: `localProjectId`
- Indexes: `openedAt`, `locallySavedAt`, and `project.id`

Stored records use wrapper `storageVersion: 1`. Loading migrates and validates
the wrapper before extracting the project. The project is then passed through
the Phase 2 migration, validation, integrity, and canonicalization pipeline.
Unsupported storage versions or invalid project bodies are rejected explicitly.

IndexedDB persistence is local to the browser origin. It is not cloud sync,
server save, collaboration, audit storage, or backend persistence.

## Save And Export

Local save writes the browser-local wrapper to IndexedDB. Export creates a
portable `.fabricgamma.json` file containing only canonical Phase 2 project
JSON. The export excludes local record metadata, UI state, and history.

Dirty-state semantics distinguish:

- Unsaved locally: no successful local save exists.
- Saved locally: current revision equals the last saved revision.
- Unsaved local changes: current revision differs from saved revision.
- Exported: a portable JSON download was initiated successfully.
- Changes since export: current revision differs from the exported revision.

## Autosave

Autosave is project-owned web logic with a 1000 ms debounce and 5000 ms maximum
delay. It triggers after validated engineering project mutations, undo, and
redo. It does not trigger for selection, dialog, health status, or operation
message changes.

The app attempts best-effort flushes when the document becomes hidden or a page
hide event fires. Browser unload-time asynchronous persistence is not
guaranteed.

## History

Undo and redo use full immutable `Project` snapshots. The history cap is 50
entries. History entries are created only for validated engineering project
changes. Opening, importing, recovering, and schema migration reset history.
History is not persisted inside the project document.

## Import And Recovery

Import accepts `.fabricgamma.json` and `.json` files up to 5 MiB. Imported JSON
is parsed, checked for unsafe prototype-related keys, passed through the Phase 2
pipeline, and then wrapped in a new local record. Invalid or unsupported project
files are rejected rather than silently repaired.

Startup lists recent local records and attempts to open the most recently
opened valid project. Corrupt local records are not silently deleted and cannot
be opened.

## Multi-Tab Behavior

The web app uses `BroadcastChannel` with channel name `fabricgamma-projects`
when available. A newer externally saved revision produces a warning and an
explicit reload action. The app does not automatically merge, overwrite, lock,
or implement CRDT behavior.

## Phase Boundary

Phase 3 does not implement the node editor, component palette, 2D layout, 3D
preview, engineering calculations, manufacturing profiles, GPT integration,
CAD generation, STEP/STL export, backend persistence, authentication,
collaboration, or cloud synchronization.
