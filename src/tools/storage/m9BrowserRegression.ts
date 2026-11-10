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

// Capture the validated DOM elements in non-null constants. TypeScript does
// not preserve nullable-variable narrowing inside nested async functions.
const previewCanvas = visualPreview;
const previewCaption = visualCaption;

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
  const context = previewCanvas.getContext("2d");
  if (!context) throw new Error("Visual diagnostic canvas is unavailable.");

  const panelWidth = previewCanvas.width / 2;
  const panelHeight = previewCanvas.height - 34;
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
    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    context.fillStyle = "#f4f4f8";
    context.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
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
    context.lineTo(panelWidth, previewCanvas.height);
    context.stroke();
    previewCanvas.hidden = false;
    previewCaption.textContent =
      `Red box = best rejected source region. Normalized bounds: x=${region.x}, y=${region.y}, width=${region.width}, height=${region.height}. Candidate display size: ${Math.round(candidateRect.width)}×${Math.round(candidateRect.height)} px.`;
  } finally {
    candidateBitmap.close();
    sourceBitmap.close();
  }
}


/** Diagnostic-only reproduction of production 9×8 dHash sampling plus a small translation sweep. */
async function runDHashAlignmentInvestigation(
  candidateFile: File, sourceFile: File,
  region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>,
): Promise<string> {
  const [candidate, source] = await Promise.all([createImageBitmap(candidateFile), createImageBitmap(sourceFile)]);
  const sample = (bitmap: ImageBitmap, sx: number, sy: number, sw: number, sh: number) => {
    const canvas = document.createElement("canvas"); canvas.width = 9; canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create normalized dHash sample.");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, 9, 8);
    const rgba = ctx.getImageData(0, 0, 9, 8).data, gray: number[] = [];
    for (let i=0;i<rgba.length;i+=4) gray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
    let hash=""; for(let y=0;y<8;y++) for(let x=0;x<8;x++) hash += gray[y*9+x]>gray[y*9+x+1]?"1":"0";
    return {gray,hash};
  };
  try {
    const c=sample(candidate,0,0,candidate.width,candidate.height);
    const sx=Math.round(region.x*source.width), sy=Math.round(region.y*source.height);
    const sw=Math.round(region.width*source.width), sh=Math.round(region.height*source.height);
    const r=sample(source,sx,sy,sw,sh);
    const distance=(a:string,b:string)=>[...a].reduce((n,v,i)=>n+Number(v!==b[i]),0);
    const canvas=document.querySelector<HTMLCanvasElement>("#m9-normalized-preview");
    if(canvas){const ctx=canvas.getContext("2d");if(ctx){
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#f4f4f8";ctx.fillRect(0,0,canvas.width,canvas.height);
      const tile=18,top=38,lefts=[16,250,484],labels=["Candidate 9×8 grayscale","Region 9×8 grayscale","dHash bit differences"];
      ctx.font="13px system-ui";ctx.fillStyle="#202033";labels.forEach((v,i)=>ctx.fillText(v,lefts[i],20));
      [c.gray,r.gray].forEach((values,p)=>values.forEach((v,i)=>{ctx!.fillStyle=`rgb(${v},${v},${v})`;ctx!.fillRect(lefts[p]+i%9*tile,top+Math.floor(i/9)*tile,tile-1,tile-1);}));
      for(let i=0;i<64;i++){ctx.fillStyle=c.hash[i]===r.hash[i]?"#b9c8bd":"#d94841";ctx.fillRect(lefts[2]+i%8*tile,top+Math.floor(i/8)*tile,tile-1,tile-1);}
      canvas.hidden=false;
    }}
    const shifts=[-.02,-.01,0,.01,.02], sweep:{dx:number;dy:number;d:number}[]=[];
    for(const dy of shifts)for(const dx of shifts){
      const nx=Math.max(0,Math.min(1-region.width,region.x+dx)),ny=Math.max(0,Math.min(1-region.height,region.y+dy));
      const moved=sample(source,Math.round(nx*source.width),Math.round(ny*source.height),sw,sh);
      sweep.push({dx,dy,d:distance(c.hash,moved.hash)});
    }
    const best=[...sweep].sort((a,b)=>a.d-b.d)[0];
    return [
      "NORMALIZATION / ALIGNMENT INVESTIGATION (diagnostic only)",
      `Decoded candidate dimensions: ${candidate.width}×${candidate.height}`,
      `Decoded source dimensions: ${source.width}×${source.height}`,
      `Reconstructed region pixels: x=${sx}, y=${sy}, width=${sw}, height=${sh}`,
      `Independent candidate dHash: ${c.hash}`,`Independent region dHash: ${r.hash}`,
      `Independent baseline distance: ${distance(c.hash,r.hash)} bits`,
      `Production-reported baseline: ${region.dHashDistance} bits`,
      `Translation sweep best: ${best.d} bits at dx=${best.dx}, dy=${best.dy}`,
      "Sweep rows are dy −2%, −1%, 0%, +1%, +2%; columns are dx −2%, −1%, 0%, +1%, +2%:",
      ...shifts.map(dy=>`${dy*100}%: ${shifts.map(dx=>sweep.find(v=>v.dx===dx&&v.dy===dy)!.d).join(" / ")}`),
      "Gray tiles are the normalized 9×8 samples; red cells are differing dHash comparisons.",
      "Diagnostic only: matcher thresholds and production decisions are unchanged."
    ].join("\\n");
  } finally {candidate.close();source.close();}
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
        const investigation = await runDHashAlignmentInvestigation(candidateFile, sourceFile, rejected);
        diagnostics.textContent += ["", investigation, ""].join("\\n");
      }
      diagnostics.textContent += [
        "",
        `Candidate dHash: ${rejected.candidateDHash}`,
        `Region dHash:    ${rejected.regionDHash}`,
        `Different bit positions (0–63): ${rejected.dHashDifferenceBitPositions.join(", ")}`,
        `Total differing bits: ${rejected.dHashDifferenceBitPositions.length}`
      ].join("\n");
    } else {
      previewCanvas.hidden = true;
      previewCaption.textContent = "No rejected candidate region was available to draw.";
    }
  } catch (error) {
    status.textContent = `ERROR — ${error instanceof Error ? error.message : String(error)}`;
    status.className = "result fail";
    diagnostics.textContent = "The regression did not complete.";
  } finally {
    runButton.disabled = false;
  }
});
