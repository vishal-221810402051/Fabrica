import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const packagesUrl = new URL("../packages/", import.meta.url);
const directories = await readdir(packagesUrl, { withFileTypes: true });

for (const directory of directories.filter((entry) => entry.isDirectory())) {
  const packageUrl = new URL(`${directory.name}/package.json`, packagesUrl);
  const manifest = JSON.parse(await readFile(packageUrl, "utf8"));
  const require = createRequire(packageUrl);
  const entrypoint = require.resolve(manifest.name);
  const promisedRuntime = fileURLToPath(new URL(manifest.main, packageUrl));

  assert.equal(entrypoint, promisedRuntime, `${manifest.name}: runtime export`);
  await access(new URL(manifest.types, packageUrl));
  const exports = await import(pathToFileURL(entrypoint).href);
  assert.ok(Object.keys(exports).length > 0, `${manifest.name}: runtime exports`);
  console.log(`${manifest.name}: runtime import and declarations OK`);
}
