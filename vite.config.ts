import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/",
  server: {
    host: "0.0.0.0",
  },
  preview: {
    host: "0.0.0.0",
  },
  test: {
    // CPU-heavy crop fixtures previously starved Vitest worker task updates
    // under parallel execution. Keep every test, but run files in one worker.
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        m9CropRegression: resolve(process.cwd(), "m9-crop-regression.html"),
      },
    },
  },
});
