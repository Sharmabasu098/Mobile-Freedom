# Isolated OpenCV.js Runtime Probe

This directory is a standalone experiment on the `m9-multiview-matching-poc` branch.

## Safety boundaries

- The root `package.json` and root `package-lock.json` are not used for this experiment.
- Install the pinned OpenCV package from this directory only.
- Do not copy this dependency into the production application.
- Test images are generated in the browser; no personal photos are required.
- This is an API/runtime probe, not an M9 acceptance result.

## Setup in Codespaces

From the repository root:

```bash
cd poc/opencvjs-probe
npm install --ignore-scripts
npm run dev
```

The dev server uses the repository's already-installed Vite executable and listens on port 5174. Open the forwarded port 5174.

## Probe stages

The page reports each stage independently:

1. Load the package's WebAssembly runtime.
2. Verify the required OpenCV symbols.
3. Allocate and release basic Embind objects.
4. Run ORB feature detection and descriptor generation on deterministic synthetic images.
5. Run BFMatcher KNN matching and the Lowe ratio filter.
6. Run RANSAC homography estimation when enough correspondences exist.
7. Release every created Embind object.

A browser result is required. Node-only success does not prove browser compatibility.
