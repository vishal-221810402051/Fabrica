# Fabricgamma Web

React/Vite web application for the Fabricgamma development foundation.

Phase 3 adds browser-local project management around the Phase 2 project model:

- one validated in-memory `Project`;
- separated local metadata, transient UI state, and history state;
- IndexedDB storage in the `fabricgamma` database;
- local save, autosave, recent projects, recovery, duplicate, delete;
- JSON import and `.fabricgamma.json` export;
- bounded undo/redo using full project snapshots.

IndexedDB storage is local browser persistence only. It is not cloud sync,
server save, authentication, collaboration, or backend persistence.

Phase 5 adds a visual editor sourced from `microfluidic-components` and
rendered with `@xyflow/react@12.11.2`. The editor supports click-to-add
components, manual placement and movement, port handles, locally compatible
connections, basic property edits, duplication, deletion, undo/redo, and
autosave through the existing Phase 3 project store.

React Flow nodes, handles, edges, selection, and viewport state are visual-only
projections and are not exported as engineering data.

The app still does not contain drag-from-palette, automatic layout, automatic
routing, whole-network validation, 3D viewer, engineering calculations, GPT
integration, or CAD controls.

## Commands

- `corepack pnpm --filter @fabrica/web dev`
- `corepack pnpm --filter @fabrica/web test`
- `corepack pnpm --filter @fabrica/web build`
