import { defineConfig } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const wasmPath = fileURLToPath(
  new URL("./node_modules/@haoking/opencvjs/dist/baseline/opencv_js.wasm", import.meta.url)
);

export default defineConfig({
  plugins: [
    {
      name: "serve-opencvjs-wasm",
      configureServer(server) {
        server.middlewares.use("/opencv_js.wasm", async (_request, response, next) => {
          try {
            const wasm = await readFile(wasmPath);
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/wasm");
            response.setHeader("Content-Length", wasm.byteLength);
            response.end(wasm);
          } catch (error) {
            next(error);
          }
        });
      }
    }
  ]
});
