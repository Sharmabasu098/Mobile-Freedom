import { findSimilarPhotos, type SimilarPhotoDirectionalDiagnostic } from "./similarPhotos";

const fileInput = document.querySelector<HTMLInputElement>("#m9-files");
const expectedInput = document.querySelector<HTMLSelectElement>("#m9-expected");
const runButton = document.querySelector<HTMLButtonElement>("#m9-run");
const status = document.querySelector<HTMLDivElement>("#m9-status");
const diagnostics = document.querySelector<HTMLDivElement>("#m9-diagnostics");
const filesInfo = document.querySelector<HTMLDivElement>("#m9-files-info");
const visualPreview = document.querySelector<HTMLCanvasElement>("#m9-visual-preview");
const visualCaption = document.querySelector<HTMLDivElement>("#m9-visual-caption");

if (!fileInput || !expectedInput || !runButton || !status || !diagnostics || !filesInfo || !visualPreview || !visualCaption) {
  throw new Error("M9 browser regression page failed to initialize.");
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

async function drawRejectedRegionPreview(
  candidateFile: File,
  sourceFile: File,
  region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>,
): Promise<void> {
  const candidateBitmap = await createImageBitmap(candidateFile);
  const sourceBitmap = await createImageBitmap(sourceFile);
  const context = visualPreview.getContext("2d");
  if (!context) throw new Error("Visual diagnostic canvas is unavailable.");

  const panelWidth = visualPreview.width / 2;
  const panelHeight = visualPreview.height - 34;
  const drawContained = (bitmap: ImageBitmap, x: number): { x: number; y: number; width: number; height: number } => {
    const scale = Math.min((panelWidth - 20) / bitmap.width, (panelHeight - 20) / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    const left = x + (panelWidth - width) / 2;
    const top = 24 + (panelHeight - height) / 2;
    context.drawImage(bitmap, left, top, width, height);
    return { x: left, y: top, width, height };
  };

  try {
    context.clearRect(0, 0, visualPreview.width, visualPreview.height);
    context.fillStyle = "#f4f4f8";
    context.fillRect(0, 0, visualPreview.width, visualPreview.height);
    context.fillStyle = "#202033";
    context.font = "14px system-ui";
    context.fillText("Candidate crop", 10, 18);
    context.fillText("Source + rejected region", panelWidth + 10, 18);
    const candidateRect = drawContained(candidateBitmap, 0);
    const sourceRect = drawContained(sourceBitmap, panelWidth);
    context.strokeStyle = "#d22";
    context.lineWidth = 3;
    context.strokeRect(
      sourceRect.x + region.x * sourceRect.width,
      sourceRect.y + region.y * sourceRect.height,
      region.width * sourceRect.width,
      region.height * sourceRect.height,
    );
    context.strokeStyle = "#aaa";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(panelWidth, 0);
    context.lineTo(panelWidth, visualPreview.height);
    context.stroke();
    visualPreview.hidden = false;
    visualCaption.textContent =
      `Red box = best rejected source region. Normalized bounds: x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}. Candidate display size: ${Math.round(candidateRect.width)}×${Math.round(candidateRect.height)} px.`;
  } finally {
    candidateBitmap.close();
    sourceBitmap.close();
  }
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

    const firstDirection = pairDiagnostics[0];
    const rejected = firstDirection?.bestRejectedCandidate;
    if (rejected) {
      const candidateFile = files.find(file => file.name === firstDirection.candidate);
      const sourceFile = files.find(file => file.name === firstDirection.source);
      if (candidateFile && sourceFile) {
        await drawRejectedRegionPreview(candidateFile, sourceFile, rejected);
      }
      diagnostics.textContent += [
        "",
        `Candidate dHash: ${rejected.candidateDHash}`,
        `Region dHash:    ${rejected.regionDHash}`,
        `Different bit positions (0–63): ${rejected.dHashDifferenceBitPositions.join(", ")}`,
        `Total differing bits: ${rejected.dHashDifferenceBitPositions.length}`
      ].join("\n");
    } else {
      visualPreview.hidden = true;
      visualCaption.textContent = "No rejected candidate region was available to draw.";
    }
  } catch (error) {
    status.textContent = `ERROR — ${error instanceof Error ? error.message : String(error)}`;
    status.className = "result fail";
    diagnostics.textContent = "The regression did not complete.";
  } finally {
    runButton.disabled = false;
  }
});
