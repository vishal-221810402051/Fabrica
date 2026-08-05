import "@testing-library/jest-dom/vitest";
import {
  IDBCursor,
  IDBCursorWithValue,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBOpenDBRequest,
  IDBRequest,
  IDBTransaction,
  IDBVersionChangeEvent,
} from "fake-indexeddb";
import { afterEach, beforeEach, vi } from "vitest";

import { resetStorageConnectionForTests } from "../persistence/database";

beforeEach(() => {
  vi.unstubAllGlobals();
  resetStorageConnectionForTests();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("IDBCursor", IDBCursor);
  vi.stubGlobal("IDBCursorWithValue", IDBCursorWithValue);
  vi.stubGlobal("IDBDatabase", IDBDatabase);
  vi.stubGlobal("IDBFactory", IDBFactory);
  vi.stubGlobal("IDBIndex", IDBIndex);
  vi.stubGlobal("IDBKeyRange", IDBKeyRange);
  vi.stubGlobal("IDBObjectStore", IDBObjectStore);
  vi.stubGlobal("IDBOpenDBRequest", IDBOpenDBRequest);
  vi.stubGlobal("IDBRequest", IDBRequest);
  vi.stubGlobal("IDBTransaction", IDBTransaction);
  vi.stubGlobal("IDBVersionChangeEvent", IDBVersionChangeEvent);
});

afterEach(() => {
  resetStorageConnectionForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
