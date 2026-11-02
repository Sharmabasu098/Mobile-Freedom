const loadCV = require("@haoking/opencvjs");

loadCV().then(cv => {
  const seeds = Array.from({ length: 20 }, (_, i) => 17 + i * 13);
  const FRAME = 320;
  const GRID = 4;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Eight genuine points cover the frame. Four decoys sit close to genuine
  // points: two violate the transform; two deliberately obey the same
  // translation and are therefore geometrically indistinguishable to RANSAC.
  const genuine = [
    [35, 35], [150, 35], [275, 35], [35, 150],
    [275, 150], [35, 275], [150, 275], [275, 275]
  ];

  // Each decoy is near a genuine source point.
  const decoys = [
    { source: [39, 38], kind: "INCONSISTENT", targetOffset: [88, -64] },
    { source: [154, 39], kind: "INCONSISTENT", targetOffset: [-72, 91] },
    { source: [279, 39], kind: "TRANSFORM_COHERENT", targetOffset: [25, 15] },
    { source: [39, 154], kind: "TRANSFORM_COHERENT", targetOffset: [25, 15] }
  ];

  function run(seed) {
    const random = rng(seed);
    const points = [
      ...genuine.map((p, i) => ({ source: p, kind: "GENUINE", index: i })),
      ...decoys.map((p, i) => ({ ...p, index: 8 + i }))
    ];

    // Randomize correspondence order so decoys are not always at the end.
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [points[i], points[j]] = [points[j], points[i]];
    }

    const src = new cv.Mat(points.length, 1, cv.CV_32FC2);
    const dst = new cv.Mat(points.length, 1, cv.CV_32FC2);
    const mask = new cv.Mat();
    let homography = null;

    try {
      points.forEach((point, i) => {
        const [x, y] = point.source;
        const sx = x + (random() - 0.5) * 0.35;
        const sy = y + (random() - 0.5) * 0.35;

        let dx = sx + 25 + (random() - 0.5) * 0.35;
        let dy = sy + 15 + (random() - 0.5) * 0.35;

        if (point.kind === "INCONSISTENT") {
          dx += point.targetOffset[0];
          dy += point.targetOffset[1];
        } else if (point.kind === "TRANSFORM_COHERENT") {
          dx = sx + point.targetOffset[0] + (random() - 0.5) * 0.2;
          dy = sy + point.targetOffset[1] + (random() - 0.5) * 0.2;
        }

        src.data32F[i * 2] = sx;
        src.data32F[i * 2 + 1] = sy;
        dst.data32F[i * 2] = dx;
        dst.data32F[i * 2 + 1] = dy;
      });

      homography = cv.findHomography(src, dst, cv.RANSAC, 3.0, mask);
      const maskValues = Array.from(mask.data);
      const inlierPoints = points.filter((_, i) => maskValues[i] !== 0);

      let genuineAccepted = 0;
      let genuineRejected = 0;
      let inconsistentAccepted = 0;
      let inconsistentRejected = 0;
      let coherentFalseAccepted = 0;
      let coherentFalseRejected = 0;

      points.forEach((point, i) => {
        const accepted = maskValues[i] !== 0;
        if (point.kind === "GENUINE") {
          accepted ? genuineAccepted++ : genuineRejected++;
        } else if (point.kind === "INCONSISTENT") {
          accepted ? inconsistentAccepted++ : inconsistentRejected++;
        } else {
          accepted ? coherentFalseAccepted++ : coherentFalseRejected++;
        }
      });

      const xs = inlierPoints.map(p => p.source[0]);
      const ys = inlierPoints.map(p => p.source[1]);
      const bboxCoverage = inlierPoints.length
        ? ((Math.max(...xs) - Math.min(...xs)) *
           (Math.max(...ys) - Math.min(...ys))) / (FRAME * FRAME)
        : 0;

      const occupiedCells = new Set(
        inlierPoints.map(({ source: [x, y] }) =>
          `${Math.min(GRID - 1, Math.floor(x / (FRAME / GRID)))},${Math.min(GRID - 1, Math.floor(y / (FRAME / GRID)))}`
        )
      ).size;

      let minPairDistance = Infinity;
      for (let i = 0; i < inlierPoints.length; i++) {
        for (let j = i + 1; j < inlierPoints.length; j++) {
          const a = inlierPoints[i].source;
          const b = inlierPoints[j].source;
          minPairDistance = Math.min(
            minPairDistance,
            Math.hypot(a[0] - b[0], a[1] - b[1])
          );
        }
      }

      // Conservative interpretation:
      // ACCEPT requires broad coverage and zero false inliers.
      // Any transform-coherent decoy forces REVIEW because geometry alone
      // cannot prove semantic correspondence.
      let decision = "REVIEW";
      if (
        genuineAccepted >= 6 &&
        inconsistentRejected === 2 &&
        coherentFalseAccepted === 0 &&
        occupiedCells >= 6 &&
        bboxCoverage >= 0.25
      ) {
        decision = "ACCEPT";
      } else if (genuineAccepted < 4 || occupiedCells <= 1) {
        decision = "REJECT";
      }

      return {
        totalCorrespondences: points.length,
        genuineAccepted,
        genuineRejected,
        inconsistentFalseAccepted: inconsistentAccepted,
        inconsistentFalseRejected: inconsistentRejected,
        transformCoherentFalseAccepted: coherentFalseAccepted,
        transformCoherentFalseRejected: coherentFalseRejected,
        totalInliers: inlierPoints.length,
        occupiedGridCells: occupiedCells,
        bboxCoverage: Number(bboxCoverage.toFixed(4)),
        minInlierPairDistance: Number(minPairDistance.toFixed(2)),
        decision
      };
    } finally {
      if (homography) homography.delete();
      mask.delete();
      dst.delete();
      src.delete();
    }
  }

  let passed = 0;
  let failed = 0;

  console.log("MIXED_GENUINE_FALSE_CORRESPONDENCE_STRESS_TEST");
  console.log("20 seeds; 8 genuine + 2 inconsistent false + 2 transform-coherent false.");
  console.log("Expected: reject inconsistent decoys; flag coherent decoys for REVIEW.");

  for (const seed of seeds) {
    try {
      const result = run(seed);
      const ok =
        result.genuineAccepted >= 6 &&
        result.inconsistentFalseAccepted === 0 &&
        result.inconsistentFalseRejected === 2 &&
        result.transformCoherentFalseAccepted >= 1 &&
        result.decision === "REVIEW";

      if (ok) passed++;
      else failed++;

      console.log(JSON.stringify({
        seed,
        ...result,
        status: ok ? "PASS" : "FAIL"
      }));
    } catch (error) {
      failed++;
      console.log(JSON.stringify({
        seed,
        error: error.message,
        status: "ERROR"
      }));
    }
  }

  console.log("TOTAL_RUNS:", seeds.length);
  console.log("PASSED:", passed);
  console.log("FAILED:", failed);
  console.log("FINAL_STATUS:", passed === seeds.length && failed === 0 ? "PASS" : "REVIEW_REQUIRED");
  console.log("MIXED_CORRESPONDENCE_TEST_COMPLETE");
}).catch(error => {
  console.error("OPENCV_LOAD_ERROR:", error);
  process.exitCode = 1;
});
