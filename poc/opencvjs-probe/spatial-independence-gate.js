const loadCV = require("@haoking/opencvjs");

loadCV().then(cv => {
  const seeds = Array.from({ length: 20 }, (_, i) => 11 + i * 10);

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Corrected fixture: two widely separated rows produce 8 occupied
  // 4x4 grid cells and bbox coverage of 0.5625 in a 320x320 frame.
  const scenarios = {
    DISTRIBUTED: [
      [40, 40], [120, 40], [200, 40], [280, 40],
      [40, 280], [120, 280], [200, 280], [280, 280]
    ],
    CLUSTERED: [
      [140, 140], [145, 140], [150, 142], [155, 145],
      [140, 150], [145, 153], [150, 155], [155, 158]
    ],
    NEARBY_OVERLAPPING: [
      [60, 60], [63, 62], [160, 60], [163, 62],
      [60, 160], [63, 162], [160, 160], [163, 162]
    ]
  };

  function run(points, seed) {
    const random = rng(seed);
    const src = new cv.Mat(8, 1, cv.CV_32FC2);
    const dst = new cv.Mat(8, 1, cv.CV_32FC2);
    const mask = new cv.Mat();
    let homography = null;

    try {
      points.forEach(([x, y], i) => {
        const sx = x + (random() - 0.5) * 0.4;
        const sy = y + (random() - 0.5) * 0.4;
        src.data32F[i * 2] = sx;
        src.data32F[i * 2 + 1] = sy;
        dst.data32F[i * 2] = sx + 25 + (random() - 0.5) * 0.4;
        dst.data32F[i * 2 + 1] = sy + 15 + (random() - 0.5) * 0.4;
      });

      homography = cv.findHomography(src, dst, cv.RANSAC, 3.0, mask);
      const values = Array.from(mask.data);
      const inlierPoints = points.filter((_, i) => values[i] !== 0);
      const inliers = inlierPoints.length;

      const xs = inlierPoints.map(p => p[0]);
      const ys = inlierPoints.map(p => p[1]);
      const bboxCoverage = inliers
        ? ((Math.max(...xs) - Math.min(...xs)) *
           (Math.max(...ys) - Math.min(...ys))) / (320 * 320)
        : 0;

      const occupiedCells = new Set(
        inlierPoints.map(([x, y]) =>
          `${Math.min(3, Math.floor(x / 80))},${Math.min(3, Math.floor(y / 80))}`
        )
      ).size;

      let minPairDistance = Infinity;
      for (let i = 0; i < inlierPoints.length; i++) {
        for (let j = i + 1; j < inlierPoints.length; j++) {
          minPairDistance = Math.min(
            minPairDistance,
            Math.hypot(
              inlierPoints[i][0] - inlierPoints[j][0],
              inlierPoints[i][1] - inlierPoints[j][1]
            )
          );
        }
      }

      let decision = "REVIEW";
      if (occupiedCells >= 6 && bboxCoverage >= 0.25 && minPairDistance >= 20) {
        decision = "ACCEPT";
      } else if (occupiedCells <= 1 && bboxCoverage < 0.02) {
        decision = "REJECT";
      }

      return {
        inliers,
        occupiedCells,
        bboxCoverage: Number(bboxCoverage.toFixed(4)),
        minPairDistance: Number(minPairDistance.toFixed(2)),
        decision
      };
    } finally {
      if (homography) homography.delete();
      mask.delete();
      dst.delete();
      src.delete();
    }
  }

  const expected = {
    DISTRIBUTED: "ACCEPT",
    CLUSTERED: "REJECT",
    NEARBY_OVERLAPPING: "REVIEW"
  };

  let totalPassed = 0;
  let totalFailed = 0;

  console.log("SPATIAL_INDEPENDENCE_ACCEPTANCE_GATE");
  console.log("NOTE: Synthetic geometry only; thresholds are provisional PoC values.");

  for (const [name, points] of Object.entries(scenarios)) {
    let passed = 0;
    let failed = 0;

    for (const seed of seeds) {
      try {
        const result = run(points, seed);
        const ok = result.inliers === 8 && result.decision === expected[name];
        if (ok) passed++;
        else failed++;

        console.log(JSON.stringify({
          scenario: name,
          seed,
          ...result,
          expected: expected[name],
          status: ok ? "PASS" : "FAIL"
        }));
      } catch (error) {
        failed++;
        console.log(JSON.stringify({
          scenario: name,
          seed,
          error: error.message,
          status: "ERROR"
        }));
      }
    }

    totalPassed += passed;
    totalFailed += failed;
    console.log("SCENARIO_SUMMARY", JSON.stringify({
      scenario: name,
      expected: expected[name],
      passed,
      failed
    }));
  }

  console.log("TOTAL_RUNS:", totalPassed + totalFailed);
  console.log("TOTAL_PASSED:", totalPassed);
  console.log("TOTAL_FAILED:", totalFailed);
  console.log(
    "FINAL_STATUS:",
    totalPassed === 60 && totalFailed === 0 ? "PASS" : "REVIEW_REQUIRED"
  );
  console.log("SPATIAL_GATE_TEST_COMPLETE");
}).catch(error => {
  console.error("OPENCV_LOAD_ERROR:", error);
  process.exitCode = 1;
});
