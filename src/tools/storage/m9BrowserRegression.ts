import { findSimilarPhotos, type SimilarPhotoDirectionalDiagnostic } from "./similarPhotos";

const fileInput = document.querySelector<HTMLInputElement>("#m9-files");
const expectedInput = document.querySelector<HTMLSelectElement>("#m9-expected");
const runButton = document.querySelector<HTMLButtonElement>("#m9-run");
const status = document.querySelector<HTMLDivElement>("#m9-status");
const diagnostics = document.querySelector<HTMLDivElement>("#m9-diagnostics");
const filesInfo = document.querySelector<HTMLDivElement>("#m9-files-info");

if (!fileInput || !expectedInput || !runButton || !status || !diagnostics || !filesInfo) {
  throw new Error("M9 browser regression page failed to initialize.");
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files ?? []);
  filesInfo.textContent = files.length
    ? files.map((file, index) =>
        `${index + 1}. ${file.name} — ${file.type || "unknown type"} — ${formatBytes(file.size)}`
      ).join("\n")
    : "No files selected.";
  status.textContent = files.length === 2
    ? "Ready. Choose the expected result and run the regression."
    : `Select exactly two photos (currently ${files.length}).`;
  status.className = "result";
});

runButton.addEventListener("click", async () => {
  const files = Array.from(fileInput.files ?? []);
  if (files.length !== 2) {
    status.textContent = "FAIL — Select exactly two photos.";
    status.className = "result fail";
    return;
  }

  runButton.disabled = true;
  status.textContent = "Running local image decode and similarity analysis…";
  status.className = "result";
  diagnostics.textContent = "Collecting matcher result…";

  const errors: string[] = [];
  const pairDiagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
  try {
    // The production API currently exposes an error callback and a
    // maxDistance argument only. Do not invent a diagnostics callback.
    const pairs = await findSimilarPhotos(
      files,
      (file, error) => errors.push(
        `${file.name}: ${error instanceof Error ? error.message : String(error)}`
      ),
      undefined,
      diagnostic => pairDiagnostics.push(diagnostic),
    );

    const detectedSimilar = pairs.length > 0;
    const expectedSimilar = expectedInput.value === "similar";
    const passed = detectedSimilar === expectedSimilar;

    status.textContent = [
      `${passed ? "PASS" : "FAIL"} — ${expectedSimilar ? "SIMILAR" : "NOT SIMILAR"} expected; ${detectedSimilar ? "SIMILAR" : "NOT SIMILAR"} detected.`,
      `Matched pairs: ${pairs.length}`,
      "No files were uploaded, modified, or deleted.",
    ].join("\n");
    status.className = `result ${passed ? "pass" : "fail"}`;

    diagnostics.textContent = [
      pairs.length ? pairs.map(pair => `${pair.first.name} ↔ ${pair.second.name}: distance ${pair.distance}/64; estimated similarity ${pair.similarityPercent}%`).join("\n") : "Matcher returned no similar pairs.",
      pairDiagnostics.length
        ? pairDiagnostics.map((item,index)=>[
            `Direction ${index+1}: ${item.candidate} → ${item.source}`,
            `Total generated regions: ${item.totalGeneratedRegions}`,
            `dHash pass/fail: ${item.dHashPass}/${item.dHashFail} (≤ ${item.thresholds.dHash})`,
            `Average Hash pass/fail: ${item.averageHashPass}/${item.averageHashFail} (≤ ${item.thresholds.averageHash})`,
            `Aspect ratio pass/fail: ${item.aspectRatioPass}/${item.aspectRatioFail} (≤ ${item.thresholds.aspectRatioErrorPercent}%)`,
            `All three conditions passed: ${item.allConditionsPass}`,
            `Best rejected candidate: ${item.bestRejectedCandidate?JSON.stringify(item.bestRejectedCandidate):"none"}`,
            `Selected candidate: ${item.selectedCandidate?JSON.stringify(item.selectedCandidate):"none"}`,
            `Candidate selection: ${item.decision}`
          ].join("\n")).join("\n\n")
        : "No directional matcher diagnostics were emitted.",
      errors.length?`Decode errors: ${errors.join("; ")}`:"Decode errors: none",
      "Diagnostic-only counters; thresholds and matching decisions are unchanged.",
      "ORB/SIFT/RANSAC is not integrated into production."
    ].join("\n\n");
  } catch (error) {
    status.textContent = `ERROR — ${error instanceof Error ? error.message : String(error)}`;
    status.className = "result fail";
    diagnostics.textContent = "The regression did not complete.";
  } finally {
    runButton.disabled = false;
  }
});
