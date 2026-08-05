import type { Project } from "project-model";

export interface ProjectHistoryEntry {
  project: Project;
  label: string;
  createdAt: string;
  transactionId?: string;
}

export interface ProjectTransaction {
  baseProject: Project;
  label: string;
  transactionId: string;
  createdAt: string;
}

export interface ProjectHistory {
  past: ProjectHistoryEntry[];
  future: ProjectHistoryEntry[];
  transaction: ProjectTransaction | null;
  maximumDepth: number;
}
