import type { Project } from "project-model";

import { createProject } from "../projects/createProject";

export function makeProject(name = "Test Project"): Project {
  return createProject({ name, now: "2026-08-05T00:00:00.000Z" });
}
