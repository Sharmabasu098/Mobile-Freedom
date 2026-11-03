import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Expose only the package's baseline WebAssembly assets at the dev-server root.
// Vite serves publicDir files as static assets, avoiding an HTML fallback response.
const opencvPublicDir = fileURLToPath(
  new URL("./node_modules/@haoking/opencvjs/dist/baseline", import.meta.url)
);

export default defineConfig({
  publicDir: opencvPublicDir,
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "same-origin"
    }
  }
});
