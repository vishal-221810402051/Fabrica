import * as projectModel from "project-model";
import type { Project } from "project-model";

import type { ProjectHistory, ProjectHistoryEntry } from "./projectHistory.types";

export const PROJECT_HISTORY_LIMIT = 50;

export function createProjectHistory(
  maximumDepth = PROJECT_HISTORY_LIMIT,
): ProjectHistory {
  return { past: [], future: [], transaction: null, maximumDepth };
}

export function resetProjectHistory(history: ProjectHistory): ProjectHistory {
  return { ...history, past: [], future: [], transaction: null };
}

export function beginProjectTransaction(
  history: ProjectHistory,
  baseProject: Project,
  label: string,
  transactionId = createTransactionId(),
  createdAt = new Date().toISOString(),
): ProjectHistory {
  return {
    ...history,
    transaction: {
      baseProject: projectModel.parseProject(baseProject),
      label,
      transactionId,
      createdAt,
    },
  };
}

export function cancelProjectTransaction(history: ProjectHistory): ProjectHistory {
  return { ...history, transaction: null };
}

export function commitProjectChange(
  history: ProjectHistory,
  currentProject: Project,
  nextProject: Project,
  label: string,
  createdAt = new Date().toISOString(),
): { history: ProjectHistory; project: Project; changed: boolean } {
  const parsedNext = projectModel.parseProject(nextProject);
  const base = history.transaction?.baseProject ?? currentProject;
  const parsedBase = projectModel.parseProject(base);

  if (projectsEqual(parsedBase, parsedNext)) {
    return {
      history: { ...history, transaction: null },
      project: parsedNext,
      changed: false,
    };
  }

  const entry: ProjectHistoryEntry = {
    project: parsedBase,
    label: history.transaction?.label ?? label,
    createdAt: history.transaction?.createdAt ?? createdAt,
    ...(history.transaction?.transactionId
      ? { transactionId: history.transaction.transactionId }
      : {}),
  };

  return {
    history: {
      ...history,
      past: [...history.past, entry].slice(-history.maximumDepth),
      future: [],
      transaction: null,
    },
    project: parsedNext,
    changed: true,
  };
}

export function undoProjectChange(
  history: ProjectHistory,
  currentProject: Project,
  createdAt = new Date().toISOString(),
): { history: ProjectHistory; project: Project; changed: boolean } {
  const previous = history.past.at(-1);
  if (!previous) {
    return { history, project: currentProject, changed: false };
  }

  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [
        {
          project: projectModel.parseProject(currentProject),
          label: previous.label,
          createdAt,
          ...(previous.transactionId ? { transactionId: previous.transactionId } : {}),
        },
        ...history.future,
      ],
      transaction: null,
    },
    project: projectModel.parseProject(previous.project),
    changed: true,
  };
}

export function redoProjectChange(
  history: ProjectHistory,
  currentProject: Project,
  createdAt = new Date().toISOString(),
): { history: ProjectHistory; project: Project; changed: boolean } {
  const next = history.future[0];
  if (!next) {
    return { history, project: currentProject, changed: false };
  }

  return {
    history: {
      ...history,
      past: [
        ...history.past,
        {
          project: projectModel.parseProject(currentProject),
          label: next.label,
          createdAt,
          ...(next.transactionId ? { transactionId: next.transactionId } : {}),
        },
      ].slice(-history.maximumDepth),
      future: history.future.slice(1),
      transaction: null,
    },
    project: projectModel.parseProject(next.project),
    changed: true,
  };
}

export function projectsEqual(left: Project, right: Project): boolean {
  return projectModel.stringifyProject(left) === projectModel.stringifyProject(right);
}

function createTransactionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
