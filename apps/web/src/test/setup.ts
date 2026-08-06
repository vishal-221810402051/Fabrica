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
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class DOMMatrixReadOnly {
      m22 = 1;
      inverse() {
        return this;
      }
    },
  );
  vi.stubGlobal("DOMMatrix", globalThis.DOMMatrixReadOnly);
  vi.stubGlobal("PointerEvent", class PointerEvent extends MouseEvent {});
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, value: 480 },
    offsetWidth: { configurable: true, value: 640 },
  });
});

afterEach(() => {
  resetStorageConnectionForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
