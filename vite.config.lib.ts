import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig, type UserConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

/**
 * A library-mode build of one entry point, leaving dependencies and peer
 * dependencies as imports (the way an npm consumer resolves them). Shared
 * with vite.config.benchmarking.ts.
 */
export function libBuildConfig(opts: {
  entry: string;
  fileName: string;
  outDir: string;
}): UserConfig {
  return {
    plugins: [react()],
    build: {
      lib: {
        entry: opts.entry,
        formats: ["es"],
        fileName: opts.fileName,
      },
      rollupOptions: {
        external: [
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
          /^react\//,
        ],
      },
      outDir: opts.outDir,
      emptyOutDir: true,
    },
  };
}

export default defineConfig(
  libBuildConfig({
    entry: "src/lib.ts",
    fileName: "index",
    outDir: "dist-lib",
  }),
);
