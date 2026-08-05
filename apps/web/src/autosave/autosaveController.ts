import type { ProjectRecord } from "../projects/projectRecord";

export const AUTOSAVE_DEBOUNCE_MS = 1000;
export const AUTOSAVE_MAX_DELAY_MS = 5000;

export interface AutosaveControllerOptions {
  getRecord: () => ProjectRecord | null;
  saveRecord: (record: ProjectRecord) => Promise<ProjectRecord>;
  onStatusChange: (
    status: "pending" | "saving" | "clean" | "failed",
    revision?: number,
  ) => void;
  onSaved: (record: ProjectRecord) => void;
  maxRetries?: number;
}

export interface AutosaveController {
  schedule: () => void;
  flush: () => Promise<void>;
  cleanup: () => void;
}

export function createAutosaveController(
  options: AutosaveControllerOptions,
): AutosaveController {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxDelayTimer: ReturnType<typeof setTimeout> | null = null;
  let firstPendingAt: number | null = null;
  let saving = false;
  let retries = 0;
  const maxRetries = options.maxRetries ?? 1;

  const clearTimers = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (maxDelayTimer) {
      clearTimeout(maxDelayTimer);
      maxDelayTimer = null;
    }
  };

  const flush = async () => {
    if (saving) {
      return;
    }
    const record = options.getRecord();
    if (!record) {
      return;
    }
    if (record.revision === record.savedRevision && record.autosaveState === "clean") {
      return;
    }

    clearTimers();
    firstPendingAt = null;
    const savingRevision = record.revision;
    saving = true;
    options.onStatusChange("saving", savingRevision);

    try {
      const saved = await options.saveRecord({
        ...record,
        savedRevision: savingRevision,
        locallySavedAt: new Date().toISOString(),
        autosaveState: "clean",
      });
      options.onSaved(saved);
      options.onStatusChange("clean", savingRevision);
      retries = 0;
    } catch {
      options.onStatusChange("failed", savingRevision);
      if (retries < maxRetries) {
        retries += 1;
        schedule();
      }
    } finally {
      saving = false;
    }
  };

  const schedule = () => {
    const record = options.getRecord();
    if (!record) {
      return;
    }

    options.onStatusChange("pending", record.revision);
    firstPendingAt ??= Date.now();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void flush();
    }, AUTOSAVE_DEBOUNCE_MS);

    const elapsed = Date.now() - firstPendingAt;
    if (!maxDelayTimer) {
      maxDelayTimer = setTimeout(
        () => {
          void flush();
        },
        Math.max(AUTOSAVE_MAX_DELAY_MS - elapsed, 0),
      );
    }
  };

  const visibilityHandler = () => {
    if (document.visibilityState === "hidden") {
      void flush();
    }
  };
  const pageHideHandler = () => {
    void flush();
  };

  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("pagehide", pageHideHandler);

  return {
    schedule,
    flush,
    cleanup: () => {
      clearTimers();
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.removeEventListener("pagehide", pageHideHandler);
    },
  };
}
