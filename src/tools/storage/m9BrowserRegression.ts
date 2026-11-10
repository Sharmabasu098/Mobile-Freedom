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


/** A/B/C diagnostic: same 9×8 dHash with three explicit aspect-ratio policies. */
async function runDHashAlignmentInvestigation(
  candidateFile: File, sourceFile: File,
  region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>,
): Promise<string> {
  const [candidate, source] = await Promise.all([createImageBitmap(candidateFile), createImageBitmap(sourceFile)]);
  type Mode = "stretch" | "letterbox" | "center-crop";
  const sample = (bitmap: ImageBitmap, sx: number, sy: number, sw: number, sh: number, mode: Mode) => {
    const canvas = document.createElement("canvas"); canvas.width = 9; canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create normalized dHash sample.");
    if (mode === "stretch") {
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, 9, 8);
    } else {
      const sourceAspect = sw / sh, targetAspect = 9 / 8;
      if (mode === "letterbox") {
        const scale = Math.min(9 / sw, 8 / sh);
        const width = sw * scale, height = sh * scale;
        ctx.fillStyle = "rgb(127,127,127)";
        ctx.fillRect(0, 0, 9, 8);
        ctx.drawImage(bitmap, sx, sy, sw, sh, (9-width)/2, (8-height)/2, width, height);
      } else {
        let cropX = sx, cropY = sy, cropW = sw, cropH = sh;
        if (sourceAspect > targetAspect) {
          cropW = sh * targetAspect;
          cropX = sx + (sw - cropW) / 2;
        } else {
          cropH = sw / targetAspect;
          cropY = sy + (sh - cropH) / 2;
        }
        ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, 9, 8);
      }
    }
    const rgba = ctx.getImageData(0, 0, 9, 8).data, gray: number[] = [];
    for (let i=0;i<rgba.length;i+=4) gray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
    let hash="";
    for(let y=0;y<8;y++) for(let x=0;x<8;x++) hash += gray[y*9+x]>gray[y*9+x+1]?"1":"0";
    return {gray,hash};
  };
  try {
    const sx=region.sourcePixelX, sy=region.sourcePixelY, sw=region.sourcePixelWidth, sh=region.sourcePixelHeight;
    const distance=(a:string,b:string)=>[...a].reduce((n,v,i)=>n+Number(v!==b[i]),0);
    const methods: {mode:Mode;label:string}[] = [
      {mode:"stretch",label:"A — Current Stretch"},
      {mode:"letterbox",label:"B — Aspect-Preserving Letterbox"},
      {mode:"center-crop",label:"C — Aspect-Preserving Center Crop"},
    ];
    const results=methods.map(method=>{
      const c=sample(candidate,0,0,candidate.width,candidate.height,method.mode);
      const r=sample(source,sx,sy,sw,sh,method.mode);
      const positions=Array.from({length:64},(_,i)=>i).filter(i=>c.hash[i]!==r.hash[i]);
      return {...method,candidate:c,region:r,distance:positions.length,positions};
    });
    // D — Orientation-aware 9×12 dHash. This is diagnostic only and uses
    // 8 horizontal comparisons × 12 rows = 96 bits for portrait geometry.
    const samplePortrait = (bitmap: ImageBitmap, x: number, y: number, width: number, height: number) => {
      const portraitCanvas=document.createElement("canvas");
      portraitCanvas.width=9; portraitCanvas.height=12;
      const portraitContext=portraitCanvas.getContext("2d",{willReadFrequently:true});
      if(!portraitContext) throw new Error("Could not create 9×12 orientation-aware sample.");
      portraitContext.drawImage(bitmap,x,y,width,height,0,0,9,12);
      const rgba=portraitContext.getImageData(0,0,9,12).data, gray:number[]=[];
      for(let i=0;i<rgba.length;i+=4) gray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
      let hash="";
      for(let yIndex=0;yIndex<12;yIndex++) for(let xIndex=0;xIndex<8;xIndex++) {
        hash += gray[yIndex*9+xIndex]>gray[yIndex*9+xIndex+1]?"1":"0";
      }
      return {gray,hash};
    };
    const portraitCandidate=samplePortrait(candidate,0,0,candidate.width,candidate.height);
    const portraitRegion=samplePortrait(source,sx,sy,sw,sh);
    const portraitPositions=Array.from({length:96},(_,i)=>i)
      .filter(i=>portraitCandidate.hash[i]!==portraitRegion.hash[i]);
    const portraitDistance=portraitPositions.length;
    const portraitCanvas=document.querySelector<HTMLCanvasElement>("#m9-orientation-preview");
    if(portraitCanvas) {
      const portraitContext=portraitCanvas.getContext("2d");
      if(portraitContext) {
        portraitContext.clearRect(0,0,portraitCanvas.width,portraitCanvas.height);
        portraitContext.fillStyle="#f4f4f8"; portraitContext.fillRect(0,0,portraitCanvas.width,portraitCanvas.height);
        const tile=9, top=34, lefts=[12,190,368];
        portraitContext.font="12px system-ui"; portraitContext.fillStyle="#202033";
        portraitContext.fillText("Candidate 9×12",lefts[0],18);
        portraitContext.fillText("Region 9×12",lefts[1],18);
        portraitContext.fillText("96-bit differences",lefts[2],18);
        [portraitCandidate.gray,portraitRegion.gray].forEach((values,panel)=>values.forEach((value,index)=>{
          portraitContext.fillStyle="rgb("+value+","+value+","+value+")";
          portraitContext.fillRect(lefts[panel]+(index%9)*tile,top+Math.floor(index/9)*tile,tile-1,tile-1);
        }));
        for(let index=0;index<96;index++) {
          portraitContext.fillStyle=portraitCandidate.hash[index]===portraitRegion.hash[index]?"#b9c8bd":"#d94841";
          portraitContext.fillRect(lefts[2]+(index%8)*tile,top+Math.floor(index/8)*tile,tile-1,tile-1);
        }
        portraitContext.fillStyle="#202033";
        portraitContext.fillText("Distance: "+portraitDistance+"/96",lefts[2],top+12*tile+14);
        portraitCanvas.hidden=false;
      }
    }
    const canvas=document.querySelector<HTMLCanvasElement>("#m9-normalized-preview");
    if(canvas){const ctx=canvas.getContext("2d");if(ctx){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle="#f4f4f8";ctx.fillRect(0,0,canvas.width,canvas.height);
      const tile=12,lefts=[12,190,368],topStart=34,rowGap=104;
      ctx.font="12px system-ui";ctx.fillStyle="#202033";
      ctx.fillText("Candidate 9×8",lefts[0],18);ctx.fillText("Source region 9×8",lefts[1],18);ctx.fillText("Different dHash bits",lefts[2],18);
      results.forEach((result,row)=>{
        const top=topStart+row*rowGap;
        ctx.fillStyle="#202033";ctx.font="11px system-ui";ctx.fillText(result.label,lefts[0],top-7);
        [result.candidate.gray,result.region.gray].forEach((values,panel)=>values.forEach((v,i)=>{
          ctx.fillStyle="rgb("+v+","+v+","+v+")";
          ctx.fillRect(lefts[panel]+(i%9)*tile,top+Math.floor(i/9)*tile,tile-1,tile-1);
        }));
        for(let i=0;i<64;i++){
          ctx.fillStyle=result.candidate.hash[i]===result.region.hash[i]?"#b9c8bd":"#d94841";
          ctx.fillRect(lefts[2]+(i%8)*tile,top+Math.floor(i/8)*tile,tile-1,tile-1);
        }
        ctx.fillStyle="#202033";ctx.fillText("Distance: "+result.distance+"/64",lefts[2],top+8*tile+13);
      });
      canvas.hidden=false;
    }}
    const shifts=[-.02,-.01,0,.01,.02], sweep:{dx:number;dy:number;d:number}[]=[];
    const stretchCandidate=results[0].candidate.hash;
    for(const dy of shifts)for(const dx of shifts){
      const nx=Math.max(0,Math.min(1-sw/source.width,sx/source.width+dx));
      const ny=Math.max(0,Math.min(1-sh/source.height,sy/source.height+dy));
      const moved=sample(source,Math.round(nx*source.width),Math.round(ny*source.height),sw,sh,"stretch");
      sweep.push({dx,dy,d:distance(stretchCandidate,moved.hash)});
    }
    const best=[...sweep].sort((a,b)=>a.d-b.d)[0];
    return [
      "ASPECT-RATIO NORMALIZATION A/B/C (diagnostic only)",
      "Decoded candidate: "+candidate.width+"×"+candidate.height+"; source: "+source.width+"×"+source.height,
      "Exact production region: x="+sx+", y="+sy+", width="+sw+", height="+sh,
      ...results.flatMap(result=>[
        result.label,
        "Candidate dHash: "+result.candidate.hash,
        "Region dHash: "+result.region.hash,
        "Hamming distance: "+result.distance+"/64",
        "Different bit positions (0–63): "+(result.positions.length?result.positions.join(", "):"none")
      ]),
      "Alignment sweep (Stretch only): best "+best.d+"/64 at dx="+best.dx+", dy="+best.dy,
      "Sweep rows dy −2%, −1%, 0%, +1%, +2%; columns dx −2%, −1%, 0%, +1%, +2%:",
      ...shifts.map(dy=>(dy*100)+"%: "+shifts.map(dx=>sweep.find(v=>v.dx===dx&&v.dy===dy)!.d).join(" / ")),
      "Letterbox uses neutral gray (127) padding; Center Crop fills 9×8 while preserving aspect ratio.",
      "D — Orientation-Aware dHash (9×12 portrait grid; 96 comparisons)",
      "Candidate dHash (96-bit): "+portraitCandidate.hash,
      "Region dHash (96-bit): "+portraitRegion.hash,
      "Hamming distance: "+portraitDistance+"/96",
      "Different bit positions (0–95): "+(portraitPositions.length?portraitPositions.join(", "):"none"),
      "D uses 9 columns × 12 rows (8 horizontal comparisons per row). Its 96-bit distance is not directly comparable to the 64-bit A/B/C distances; no threshold is inferred.",
      "Diagnostic only: production matcher, thresholds, and matching decisions are unchanged."
    ].join("\n");
  } finally {candidate.close();source.close();}
}


/** E — Decode/orientation/pixel-sampling consistency probe. Diagnostic only. */
async function runDecodeSamplingInvestigation(file: File): Promise<string[]> {
  const raster = (source: CanvasImageSource, width: number, height: number): Uint8ClampedArray => {
    const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
    const context=canvas.getContext("2d",{willReadFrequently:true});
    if(!context) throw new Error("Could not create pixel comparison canvas.");
    context.imageSmoothingEnabled=true;
    context.imageSmoothingQuality="high";
    context.drawImage(source,0,0,width,height,0,0,width,height);
    return context.getImageData(0,0,width,height).data;
  };
  const compare = (a:Uint8ClampedArray,b:Uint8ClampedArray,width:number,height:number):string[] => {
    let changedPixels=0, sum=0, max=0;
    const differences:number[]=[];
    for(let i=0;i<a.length;i+=4) {
      const dr=Math.abs(a[i]-b[i]), dg=Math.abs(a[i+1]-b[i+1]), db=Math.abs(a[i+2]-b[i+2]);
      const delta=Math.round((.299*dr+.587*dg+.114*db)*100)/100;
      if(dr||dg||db) changedPixels++;
      sum+=delta; max=Math.max(max,delta); differences.push(delta);
    }
    differences.sort((x,y)=>x-y);
    const count=width*height;
    const p95=differences[Math.min(count-1,Math.floor((count-1)*.95))];
    return [
      "Compared raster: "+width+"×"+height,
      "Pixels with any RGB difference: "+changedPixels+"/"+count+" ("+(100*changedPixels/count).toFixed(2)+"%)",
      "Mean absolute grayscale difference: "+(sum/count).toFixed(3)+"/255",
      "95th percentile grayscale difference: "+p95.toFixed(2)+"/255",
      "Maximum grayscale difference: "+max.toFixed(2)+"/255"
    ];
  };
  const lines:string[]=["E — IMAGE DECODE & PIXEL SAMPLING ("+file.name+")"];
  let bitmap:ImageBitmap|undefined, rawBitmap:ImageBitmap|undefined, imageElement:HTMLImageElement|undefined;
  try {
    bitmap=await createImageBitmap(file);
    const repeated=await createImageBitmap(file);
    try {
      lines.push("createImageBitmap default dimensions: "+bitmap.width+"×"+bitmap.height);
      lines.push("Repeated default decode dimensions: "+repeated.width+"×"+repeated.height);
      for(const size of [32,128]) {
        const a=raster(bitmap,size,size), b=raster(repeated,size,size);
        lines.push("Repeated default decode — "+size+"×"+size+":");
        lines.push(...compare(a,b,size,size));
      }
    } finally { repeated.close(); }
  } catch(error) {
    lines.push("Default createImageBitmap decode: ERROR — "+(error instanceof Error?error.message:String(error)));
  }
  try {
    rawBitmap=await createImageBitmap(file,{imageOrientation:"none"});
    lines.push("EXIF-orientation-ignored dimensions: "+rawBitmap.width+"×"+rawBitmap.height);
    if(bitmap) {
      lines.push("Default bitmap vs orientation-none dimensions differ: "+(bitmap.width!==rawBitmap.width||bitmap.height!==rawBitmap.height?"YES":"NO"));
      for(const size of [32,128]) {
        lines.push("Default bitmap vs orientation-none — "+size+"×"+size+":");
        lines.push(...compare(raster(bitmap,size,size),raster(rawBitmap,size,size),size,size));
      }
    }
  } catch(error) {
    lines.push("imageOrientation:none decode unavailable: "+(error instanceof Error?error.message:String(error)));
  }
  const objectUrl=URL.createObjectURL(file);
  try {
    imageElement=new Image();
    imageElement.src=objectUrl;
    await imageElement.decode();
    lines.push("HTMLImageElement natural dimensions: "+imageElement.naturalWidth+"×"+imageElement.naturalHeight);
    if(bitmap) {
      for(const size of [32,128]) {
        lines.push("Default bitmap vs HTMLImageElement — "+size+"×"+size+":");
        lines.push(...compare(raster(bitmap,size,size),raster(imageElement,size,size),size,size));
      }
    }
  } catch(error) {
    lines.push("HTMLImageElement decode: ERROR — "+(error instanceof Error?error.message:String(error)));
  } finally { URL.revokeObjectURL(objectUrl); }
  lines.push("Direct raster comparison uses the same canvas dimensions and smoothing settings; it measures decoded sampling differences, not file-byte differences.");
  lines.push("No source file, production matcher, threshold, or matching decision is changed.");
  bitmap?.close(); rawBitmap?.close();
  return lines;
}


/** F — Reproduce production 9×8 sampling and quantify candidate/region geometry. */
async function runProductionSamplingGeometryInvestigation(
  candidateFile: File,
  sourceFile: File,
  region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>,
): Promise<string[]> {
  const lines:string[]=["F — PRODUCTION SAMPLING & CROP GEOMETRY"];
  const candidate=await createImageBitmap(candidateFile);
  const source=await createImageBitmap(sourceFile);
  try {
    const sample=(bitmap:ImageBitmap,x:number,y:number,w:number,h:number)=>{
      const canvas=document.createElement("canvas"); canvas.width=9; canvas.height=8;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      if(!ctx) throw new Error("Could not create production sampling canvas.");
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(bitmap,x,y,w,h,0,0,9,8);
      const rgba=ctx.getImageData(0,0,9,8).data, gray:number[]=[];
      for(let i=0;i<rgba.length;i+=4) gray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
      let hash="";
      for(let row=0;row<8;row++) for(let col=0;col<8;col++)
        hash+=gray[row*9+col]>gray[row*9+col+1]?"1":"0";
      return {gray,hash};
    };
    const sx=region.sourcePixelX, sy=region.sourcePixelY;
    const sw=region.sourcePixelWidth, sh=region.sourcePixelHeight;
    if(!Number.isFinite(sx)||!Number.isFinite(sy)||!Number.isFinite(sw)||!Number.isFinite(sh)||
      sx<0||sy<0||sw<=0||sh<=0||sx+sw>source.width||sy+sh>source.height)
      throw new Error("Rejected region pixel geometry is outside the decoded source bitmap.");
    const candidateSample=sample(candidate,0,0,candidate.width,candidate.height);
    const regionSample=sample(source,sx,sy,sw,sh);
    const bitPositions=Array.from({length:64},(_,i)=>i).filter(i=>candidateSample.hash[i]!==regionSample.hash[i]);
    const differences=candidateSample.gray.map((value,i)=>Math.abs(value-regionSample.gray[i]));
    const changed=differences.filter(value=>value!==0).length;
    const mean=differences.reduce((sum,value)=>sum+value,0)/differences.length;
    const sorted=[...differences].sort((a,b)=>a-b);
    const p95=sorted[Math.floor((sorted.length-1)*.95)];
    const max=Math.max(...differences);
    const candidateAspect=candidate.width/candidate.height;
    const regionAspect=sw/sh;
    const aspectError=Math.abs(regionAspect-candidateAspect)/candidateAspect*100;
    const productionCandidateHash=region.candidateDHash;
    const productionRegionHash=region.regionDHash;
    lines.push("F1 — Exact Production Sampling (9×8 stretch)");
    lines.push("Candidate decoded dimensions: "+candidate.width+"×"+candidate.height);
    lines.push("Source decoded dimensions: "+source.width+"×"+source.height);
    lines.push("Candidate sampled dHash: "+candidateSample.hash);
    lines.push("Matcher-recorded candidate dHash: "+productionCandidateHash);
    lines.push("Candidate sampling reproduces matcher: "+(candidateSample.hash===productionCandidateHash?"YES":"NO"));
    lines.push("Region sampled dHash: "+regionSample.hash);
    lines.push("Matcher-recorded region dHash: "+productionRegionHash);
    lines.push("Region sampling reproduces matcher: "+(regionSample.hash===productionRegionHash?"YES":"NO"));
    lines.push("Reproduced Hamming distance: "+bitPositions.length+"/64; matcher recorded: "+region.dHashDistance+"/64");
    lines.push("F2 — Crop Geometry");
    lines.push("Candidate dimensions: "+candidate.width+"×"+candidate.height+"; aspect ratio: "+candidateAspect.toFixed(6));
    lines.push("Source region pixels: x="+sx+", y="+sy+", width="+sw+", height="+sh);
    lines.push("Source region aspect ratio: "+regionAspect.toFixed(6));
    lines.push("Relative aspect-ratio error: "+aspectError.toFixed(4)+"% (matcher field: "+region.aspectRatioErrorPercent+"%)");
    lines.push("Candidate/source region width ratio: "+(candidate.width/sw).toFixed(6));
    lines.push("Candidate/source region height ratio: "+(candidate.height/sh).toFixed(6));
    lines.push("F3 — Production-Normalized Grayscale Sample Difference (both stretched to 9×8)");
    lines.push("Changed grayscale sample cells: "+changed+"/72");
    lines.push("Mean absolute grayscale difference: "+mean.toFixed(3)+"/255");
    lines.push("95th percentile grayscale difference: "+p95+"/255");
    lines.push("Maximum grayscale difference: "+max+"/255");
    lines.push("Different dHash bit positions: "+(bitPositions.length?bitPositions.join(", "):"none"));
    lines.push("Candidate grayscale rows: "+Array.from({length:8},(_,row)=>candidateSample.gray.slice(row*9,row*9+9).join(",")).join(" | "));
    lines.push("Region grayscale rows: "+Array.from({length:8},(_,row)=>regionSample.gray.slice(row*9,row*9+9).join(",")).join(" | "));
    lines.push("Diagnostic only: no production matcher, threshold, or file is modified.");
    return lines;
  } finally { candidate.close(); source.close(); }
}


/** G — visual overlay plus bounded translation/scale search; diagnostics only. */
async function runCropContentAlignmentInvestigation(
  candidateFile: File,
  sourceFile: File,
  region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>,
): Promise<string[]> {
  const lines:string[]=["G — CROP CONTENT ALIGNMENT INVESTIGATION"];
  const candidate=await createImageBitmap(candidateFile);
  const source=await createImageBitmap(sourceFile);
  const canvas=document.querySelector<HTMLCanvasElement>("#m9-alignment-preview");
  try {
    const sx=region.sourcePixelX, sy=region.sourcePixelY, sw=region.sourcePixelWidth, sh=region.sourcePixelHeight;
    if(!canvas) throw new Error("G1 alignment preview canvas missing.");
    if(![sx,sy,sw,sh].every(Number.isFinite)||sx<0||sy<0||sw<=0||sh<=0||sx+sw>source.width||sy+sh>source.height)
      throw new Error("G region geometry is outside the decoded source bitmap.");
    canvas.hidden=false;
    const ctx=canvas.getContext("2d");
    if(!ctx) throw new Error("G1 canvas context unavailable.");
    const panelW=canvas.width/3, panelH=canvas.height-28;
    const drawContained=(bitmap:CanvasImageSource,w:number,h:number,x:number)=>{
      const scale=Math.min((panelW-16)/w,(panelH-16)/h);
      const dw=w*scale, dh=h*scale;
      ctx.drawImage(bitmap,x+(panelW-dw)/2,22+(panelH-dh)/2,dw,dh);
    };
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#f4f4f8";ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#202033";ctx.font="13px system-ui";
    ctx.fillText("Candidate",8,16);ctx.fillText("Selected source region",panelW+8,16);ctx.fillText("50% overlay",panelW*2+8,16);
    drawContained(candidate,candidate.width,candidate.height,0);
    drawContained(source,sw,sh,panelW);
    const overlay=document.createElement("canvas");overlay.width=240;overlay.height=320;
    const octx=overlay.getContext("2d");
    if(!octx) throw new Error("G1 overlay context unavailable.");
    octx.drawImage(candidate,0,0,overlay.width,overlay.height);
    octx.globalAlpha=.5;octx.drawImage(source,sx,sy,sw,sh,0,0,overlay.width,overlay.height);octx.globalAlpha=1;
    drawContained(overlay,overlay.width,overlay.height,panelW*2);
    const sample=(x:number,y:number,w:number,h:number)=>{
      const c=document.createElement("canvas");c.width=9;c.height=8;
      const cctx=c.getContext("2d",{willReadFrequently:true});
      if(!cctx) throw new Error("G sample canvas unavailable.");
      cctx.imageSmoothingEnabled=true;cctx.imageSmoothingQuality="high";
      cctx.drawImage(source,x,y,w,h,0,0,9,8);
      const rgba=cctx.getImageData(0,0,9,8).data, gray:number[]=[];
      for(let i=0;i<rgba.length;i+=4)gray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
      let hash="";
      for(let row=0;row<8;row++)for(let col=0;col<8;col++)hash+=gray[row*9+col]>gray[row*9+col+1]?"1":"0";
      return {gray,hash};
    };
    const candidateCanvas=document.createElement("canvas");candidateCanvas.width=9;candidateCanvas.height=8;
    const cc=candidateCanvas.getContext("2d",{willReadFrequently:true});
    if(!cc) throw new Error("G candidate canvas unavailable.");
    cc.imageSmoothingEnabled=true;cc.imageSmoothingQuality="high";
    cc.drawImage(candidate,0,0,candidate.width,candidate.height,0,0,9,8);
    const rgba=cc.getImageData(0,0,9,8).data,candidateGray:number[]=[];
    for(let i=0;i<rgba.length;i+=4)candidateGray.push(Math.round(.299*rgba[i]+.587*rgba[i+1]+.114*rgba[i+2]));
    let candidateHash="";
    for(let row=0;row<8;row++)for(let col=0;col<8;col++)candidateHash+=candidateGray[row*9+col]>candidateGray[row*9+col+1]?"1":"0";
    const measure=(x:number,y:number,w:number,h:number)=>{
      const regionSample=sample(x,y,w,h);
      const deltas=candidateGray.map((v,i)=>Math.abs(v-regionSample.gray[i]));
      const mae=deltas.reduce((a,b)=>a+b,0)/72;
      const distance=Array.from({length:64},(_,i)=>i).filter(i=>candidateHash[i]!==regionSample.hash[i]).length;
      return {x,y,w,h,mae,distance,changed:deltas.filter(v=>v!==0).length,gray:regionSample.gray,hash:regionSample.hash};
    };
    const baseline=measure(sx,sy,sw,sh);
    let best=baseline;
    const scales=[.96,.98,1,1.02,1.04];
    const offsets=[-.02,-.01,0,.01,.02];
    let tested=0;
    for(const scale of scales)for(const oy of offsets)for(const ox of offsets){
      const w=sw*scale,h=sh*scale;
      const x=sx+sw*ox+(sw-w)/2,y=sy+sh*oy+(sh-h)/2;
      if(x<0||y<0||x+w>source.width||y+h>source.height)continue;
      const current=measure(x,y,w,h);tested++;
      if(current.mae<best.mae || (current.mae===best.mae&&current.distance<best.distance))best=current;
    }
    lines.push("G1 — Exact Region Visual Overlay");
    lines.push("Canvas shows candidate, selected source region, and 50% alpha overlay. Overlay is a visual diagnostic, not a registration proof.");
    lines.push("G2 — Bounded Translation + Scale Search");
    lines.push("Search space: scales 0.96, 0.98, 1.00, 1.02, 1.04; x/y offsets −2%, −1%, 0%, +1%, +2% of original region; candidates tested: "+tested);
    lines.push("Baseline: x="+sx.toFixed(2)+", y="+sy.toFixed(2)+", width="+sw.toFixed(2)+", height="+sh.toFixed(2)+", MAE="+baseline.mae.toFixed(3)+"/255, changed cells="+baseline.changed+"/72, dHash="+baseline.distance+"/64");
    lines.push("Best alignment: x="+best.x.toFixed(2)+", y="+best.y.toFixed(2)+", width="+best.w.toFixed(2)+", height="+best.h.toFixed(2));
    lines.push("Best alignment scale: "+(best.w/sw).toFixed(4)+"× width, "+(best.h/sh).toFixed(4)+"× height");
    lines.push("Best alignment MAE: "+best.mae.toFixed(3)+"/255; changed cells: "+best.changed+"/72; dHash distance: "+best.distance+"/64");
    lines.push("MAE improvement vs baseline: "+(baseline.mae-best.mae).toFixed(3)+"/255; dHash bit improvement: "+(baseline.distance-best.distance));
    lines.push("Best alignment dHash differing positions: "+Array.from({length:64},(_,i)=>i).filter(i=>candidateHash[i]!==best.hash[i]).join(", "));
    lines.push("G3 — Best-Aligned Pixel Difference");
    lines.push("Candidate and best-aligned source region are independently resampled to the same 9×8 grid.");
    lines.push("Candidate grayscale rows: "+Array.from({length:8},(_,row)=>candidateGray.slice(row*9,row*9+9).join(",")).join(" | "));
    lines.push("Best-aligned region grayscale rows: "+Array.from({length:8},(_,row)=>best.gray.slice(row*9,row*9+9).join(",")).join(" | "));
    lines.push("Search is bounded and diagnostic-only; it does not alter production matcher, threshold, or selected region.");
    return lines;
  } finally { candidate.close();source.close(); }
}

/** H — exact sampler parity and controlled alignment comparison; diagnostic only. */
async function runSamplingParityInvestigation(candidateFile: File, sourceFile: File, region: NonNullable<SimilarPhotoDirectionalDiagnostic["bestRejectedCandidate"]>): Promise<string[]> {
  const lines: string[] = ["H — EXACT SAMPLING PARITY VERIFICATION"];
  const [candidate, source] = await Promise.all([createImageBitmap(candidateFile), createImageBitmap(sourceFile)]);
  type Mode = "default" | "high";
  const sample = (bitmap: ImageBitmap, x: number, y: number, w: number, h: number, mode: Mode) => {
    const canvas = document.createElement("canvas"); canvas.width = 9; canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("H sample canvas unavailable.");
    ctx.imageSmoothingEnabled = true;
    if (mode === "high") ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, 9, 8);
    const rgba = ctx.getImageData(0, 0, 9, 8).data, gray: number[] = [];
    for (let i = 0; i < rgba.length; i += 4) gray.push(Math.round(.299 * rgba[i] + .587 * rgba[i + 1] + .114 * rgba[i + 2]));
    let hash = "";
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) hash += gray[row * 9 + col] > gray[row * 9 + col + 1] ? "1" : "0";
    return { gray, hash, smoothing: ctx.imageSmoothingEnabled, quality: ctx.imageSmoothingQuality };
  };
  const mae = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / 72;
  const changed = (a: number[], b: number[]) => a.filter((v, i) => v !== b[i]).length;
  const distance = (a: string, b: string) => Array.from({ length: 64 }, (_, i) => i).filter(i => a[i] !== b[i]).length;
  try {
    const sx = region.sourcePixelX, sy = region.sourcePixelY, sw = region.sourcePixelWidth, sh = region.sourcePixelHeight;
    const modes: { name: string; mode: Mode }[] = [
      { name: "Production default", mode: "default" },
      { name: "F explicit smoothing=true; quality omitted", mode: "default" },
      { name: "G smoothing=true; quality=high", mode: "high" },
    ];
    const results = modes.map(m => {
      const c = sample(candidate, 0, 0, candidate.width, candidate.height, m.mode);
      const r = sample(source, sx, sy, sw, sh, m.mode);
      return { ...m, c, r, mae: mae(c.gray, r.gray), changed: changed(c.gray, r.gray), d: distance(c.hash, r.hash) };
    });
    lines.push("H1 — Canvas settings: " + results.map(v => v.name + " [smoothing=" + v.c.smoothing + ", quality=" + v.c.quality + "]").join(" | "));
    lines.push("Production vs F candidate arrays identical: " + (results[0].c.gray.every((v,i)=>v===results[1].c.gray[i]) ? "YES" : "NO"));
    lines.push("Production vs F region arrays identical: " + (results[0].r.gray.every((v,i)=>v===results[1].r.gray[i]) ? "YES" : "NO"));
    lines.push("Production vs G candidate arrays identical: " + (results[0].c.gray.every((v,i)=>v===results[2].c.gray[i]) ? "YES" : "NO"));
    lines.push("Production vs G region arrays identical: " + (results[0].r.gray.every((v,i)=>v===results[2].r.gray[i]) ? "YES" : "NO"));
    lines.push("H2 — 9×8 grayscale arrays (rows separated by |)");
    for (const v of results) {
      lines.push(v.name + " candidate: " + Array.from({length:8},(_,row)=>v.c.gray.slice(row*9,row*9+9).join(",")).join(" | "));
      lines.push(v.name + " region: " + Array.from({length:8},(_,row)=>v.r.gray.slice(row*9,row*9+9).join(",")).join(" | "));
    }
    lines.push("H3 — Hashes and MAE on identical inputs");
    for (const v of results) lines.push(v.name + ": candidateHash=" + v.c.hash + "; regionHash=" + v.r.hash + "; dHash=" + v.d + "/64; MAE=" + v.mae.toFixed(3) + "/255; changed=" + v.changed + "/72");
    lines.push("H4 — Bounded alignment search at production-default and G-high settings");
    for (const mode of ["default", "high"] as const) {
      const c = sample(candidate, 0, 0, candidate.width, candidate.height, mode);
      const measure = (x:number,y:number,w:number,h:number) => {
        const r = sample(source,x,y,w,h,mode);
        return {x,y,w,h,mae:mae(c.gray,r.gray),d:distance(c.hash,r.hash)};
      };
      const base = measure(sx,sy,sw,sh); let best = base, tested = 0;
      for (const scale of [.96,.98,1,1.02,1.04]) for (const oy of [-.02,-.01,0,.01,.02]) for (const ox of [-.02,-.01,0,.01,.02]) {
        const w=sw*scale,h=sh*scale,x=sx+sw*ox+(sw-w)/2,y=sy+sh*oy+(sh-h)/2;
        if(x<0||y<0||x+w>source.width||y+h>source.height) continue;
        const v=measure(x,y,w,h); tested++;
        if(v.mae<best.mae||(v.mae===best.mae&&v.d<best.d)) best=v;
      }
      lines.push(mode + ": tested=" + tested + "; baseline MAE=" + base.mae.toFixed(3) + ", dHash=" + base.d + "; best MAE=" + best.mae.toFixed(3) + ", dHash=" + best.d + "; MAE gain=" + (base.mae-best.mae).toFixed(3) + "; dHash gain=" + (base.d-best.d) + "; best box=" + [best.x,best.y,best.w,best.h].map(v=>v.toFixed(2)).join(","));
    }
    lines.push("Interpretation: an improvement present only with G-high sampling is a resampling effect, not proof of improved crop geometry.");
    lines.push("Diagnostic only: production matcher, thresholds, selected region, and files are unchanged.");
    return lines;
  } finally { candidate.close(); source.close(); }
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

    const decodeReports=await Promise.all(files.map(file=>runDecodeSamplingInvestigation(file)));
    diagnostics.textContent += ["", ...decodeReports.flatMap(lines=>["",...lines])].join("\n");

    for (const direction of pairDiagnostics) {
      const candidateFile = files.find(file => file.name === direction.candidate);
      const sourceFile = files.find(file => file.name === direction.source);
      const rejected = direction.bestRejectedCandidate;
      if (candidateFile && sourceFile && rejected) {
        const report = await runProductionSamplingGeometryInvestigation(candidateFile, sourceFile, rejected);
        diagnostics.textContent += ["", ...report, ""].join("\n");
      }
    }

    for (const direction of pairDiagnostics) {
      const candidateFile = files.find(file => file.name === direction.candidate);
      const sourceFile = files.find(file => file.name === direction.source);
      const rejected = direction.bestRejectedCandidate;
      if (candidateFile && sourceFile && rejected) {
        try {
          const report = await runCropContentAlignmentInvestigation(candidateFile, sourceFile, rejected);
          diagnostics.textContent += ["", ...report, ""].join("\n");
        } catch (error) {
          diagnostics.textContent += "\nG investigation error: "+(error instanceof Error?error.message:String(error));
        }
      }
    }


    for (const direction of pairDiagnostics) {
      const candidateFile = files.find(file => file.name === direction.candidate);
      const sourceFile = files.find(file => file.name === direction.source);
      const rejected = direction.bestRejectedCandidate;
      if (candidateFile && sourceFile && rejected) {
        try {
          const report = await runSamplingParityInvestigation(candidateFile, sourceFile, rejected);
          diagnostics.textContent += ["", ...report, ""].join("\n");
        } catch (error) {
          diagnostics.textContent += "\nH investigation error: " + (error instanceof Error ? error.message : String(error));
        }
      }
    }

    const firstDirection = pairDiagnostics[0];
    const rejected = firstDirection?.bestRejectedCandidate;
    if (rejected) {
      const candidateFile = files.find(file => file.name === firstDirection.candidate);
      const sourceFile = files.find(file => file.name === firstDirection.source);
      if (candidateFile && sourceFile) {
        await drawRejectedRegionPreview(candidateFile, sourceFile, rejected);
        const investigation = await runDHashAlignmentInvestigation(candidateFile, sourceFile, rejected);
        diagnostics.textContent += ["", investigation, ""].join("\n");
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
