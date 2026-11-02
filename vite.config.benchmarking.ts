import { defineConfig } from "vite";
import { libBuildConfig } from "./vite.config.lib";

// The benchmarks' entry point (src/bench/index.ts), built the same way as
// the library. See `pnpm build:bench`.
export default defineConfig(
  libBuildConfig({
    entry: "src/bench/index.ts",
    fileName: "benchmarking",
    outDir: "dist-bench",
  }),
);
