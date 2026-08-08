import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import { format, resolveConfig } from "prettier";
import { z } from "zod";

const require = createRequire(import.meta.url);
const {
  PROJECT_JSON_SCHEMA_ID,
  PROJECT_JSON_SCHEMA_TITLE,
  ProjectSchema,
} = require("../dist/index.js");

const outputPath = resolve("schema/project.v0.2.0.schema.json");
const prettierOptions = (await resolveConfig(outputPath)) ?? {};

const schema = z.toJSONSchema(ProjectSchema, {
  target: "draft-2020-12",
});

schema.$schema = "https://json-schema.org/draft/2020-12/schema";
schema.$id = PROJECT_JSON_SCHEMA_ID;
schema.title = PROJECT_JSON_SCHEMA_TITLE;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  await format(JSON.stringify(schema), {
    ...prettierOptions,
    filepath: outputPath,
    parser: "json",
  }),
  "utf8",
);
