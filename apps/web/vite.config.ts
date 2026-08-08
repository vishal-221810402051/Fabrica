import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "project-model": fileURLToPath(
        new URL("../../packages/project-model/src/index.ts", import.meta.url),
      ),
      "microfluidic-components": fileURLToPath(
        new URL("../../packages/microfluidic-components/src/index.ts", import.meta.url),
      ),
      "geometry-core": fileURLToPath(
        new URL("../../packages/geometry-core/src/index.ts", import.meta.url),
      ),
      units: fileURLToPath(
        new URL("../../packages/units/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
