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

The app still does not contain a node editor, component palette, 2D layout, 3D
viewer, engineering calculations, GPT integration, or CAD controls.

## Commands

- `corepack pnpm --filter @fabrica/web dev`
- `corepack pnpm --filter @fabrica/web test`
- `corepack pnpm --filter @fabrica/web build`
