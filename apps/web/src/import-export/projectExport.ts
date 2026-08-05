import * as projectModel from "project-model";
import type { Project } from "project-model";

import { sanitizeFilename } from "./filename";

export interface ProjectExportPayload {
  filename: string;
  mimeType: "application/json";
  content: string;
}

export function createProjectExport(project: Project): ProjectExportPayload {
  const parsed = projectModel.parseProject(project);
  return {
    filename: `${sanitizeFilename(parsed.name)}.fabricgamma.json`,
    mimeType: "application/json",
    content: projectModel.stringifyProject(parsed, 2),
  };
}

export function downloadProjectExport(project: Project): ProjectExportPayload {
  const payload = createProjectExport(project);
  const blob = new Blob([payload.content], { type: payload.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = payload.filename;
    anchor.rel = "noopener";
    anchor.click();
    return payload;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
