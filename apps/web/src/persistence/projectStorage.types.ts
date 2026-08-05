import type { DBSchema, IDBPDatabase } from "idb";

import type { ProjectRecord } from "../projects/projectRecord";

export interface FabricgammaDatabase extends DBSchema {
  projects: {
    key: string;
    value: ProjectRecord;
    indexes: {
      openedAt: string;
      locallySavedAt: string;
      projectId: string;
    };
  };
}

export type FabricgammaDatabaseConnection = IDBPDatabase<FabricgammaDatabase>;

export interface CorruptProjectRecordSummary {
  localProjectId: string;
  projectId: string;
  name: string;
  openedAt: string | null;
  recoveryState: "corrupt";
  error: string;
}
