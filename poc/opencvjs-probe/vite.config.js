import { defineConfig } from "vite";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wasmPath = fileURLToPath(
  new URL("./node_modules/@haoking/opencvjs/dist/baseline/opencv_js.wasm", import.meta.url)
);

function serveOpenCVWasm() {
  return {
    name: "mobile-freedom-opencv-wasm",
    configureServer(server) {
      server.middlewares.use("/opencv_js.wasm", (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        try {
          const stat = statSync(wasmPath);
          if (!stat.isFile()) return next();

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/wasm");
          res.setHeader("Content-Length", String(stat.size));
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-OpenCV-Wasm-Source", "pinned-package-baseline");
          if (req.method === "HEAD") return res.end();
          return res.end(readFileSync(wasmPath));
        } catch {
          res.statusCode = 503;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          return res.end("OpenCV baseline WASM asset is not installed at the expected path.");
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [serveOpenCVWasm()],
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "same-origin"
    }
  }
});
