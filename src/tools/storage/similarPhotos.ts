/**
 * Mobile Freedom — M9 Similar Photo Detection
 *
 * Estimates visual similarity using local perceptual hashing.
 * Images are decoded and analyzed locally in the browser.
 * Files are never uploaded, modified, or deleted by this module.
 */

export const MAX_SIMILARITY_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_SIMILARITY_DISTANCE = 4;

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const REGION_WIDTH_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.8, 0.9, 0.95] as const;
const REGION_HEIGHT_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.78, 0.8, 0.9, 0.95] as const;
const REGION_GRID_STEPS = 8;

const SUPPORTED_SIMILARITY_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface SimilarPhotoDirectionalDiagnostic {
 candidate:string; source:string; totalGeneratedRegions:number;
 thresholds:{dHash:number;averageHash:number;aspectRatioErrorPercent:number;normalizedPixelMae:number;minimumIndependentRegions:number};
 dHashPass:number;dHashFail:number;averageHashPass:number;averageHashFail:number;
 aspectRatioPass:number;aspectRatioFail:number;pixelPass:number;pixelFail:number;allConditionsPass:number;independentRegionCount:number;
 bestRejectedCandidate?:{x:number;y:number;width:number;height:number;sourcePixelX:number;sourcePixelY:number;sourcePixelWidth:number;sourcePixelHeight:number;dHashDistance:number;averageHashDistance:number;aspectRatioErrorPercent:number;failedChecks:string[];candidateDHash:string;regionDHash:string;dHashDifferenceBitPositions:number[]};
 selectedCandidate?:{x:number;y:number;width:number;height:number;dHashDistance:number;averageHashDistance:number;aspectRatioErrorPercent:number};
 decision:"ACCEPT"|"REJECT";
}
export type SimilarPhotoDiagnosticHandler=(diagnostic:SimilarPhotoDirectionalDiagnostic)=>void;

export interface SimilarPhotoPair {
  first: File;
  second: File;
  distance: number;
  similarityPercent: number;
}

export interface SimilarPhotoError {
  file: File;
  error: unknown;
}

export type SimilarPhotoErrorHandler = (
  file: File,
  error: unknown,
) => void;

interface RegionHash {
  hash: string;
  averageHash: string;
  pixels: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

interface ImageHashSet {
  file: File;
  width: number;
  height: number;
  wholeImageHash: string;
  wholeImageAverageHash: string;
  wholeImagePixels: number[];
  regions: RegionHash[];
}

interface CropMatch {
  distance: number;
  matches: number;
}

/** Intersection-over-union for two normalized source-image windows. */
function regionIntersectionOverUnion(first: RegionHash, second: RegionHash): number {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const firstArea = first.width * first.height;
  const secondArea = second.width * second.height;
  const union = firstArea + secondArea - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Greedy non-maximum suppression: overlapping windows describing the
 * same source area count as one spatial evidence cluster.
 */
function selectSpatiallyIndependentRegions<T extends { region: RegionHash }>(
  candidates: T[],
  maximumOverlap = 0.25,
): T[] {
  const selected: T[] = [];
  for (const candidate of candidates) {
    if (
      selected.every(
        accepted =>
          regionIntersectionOverUnion(candidate.region, accepted.region) <= maximumOverlap,
      )
    ) {
      selected.push(candidate);
    }
  }
  return selected;
}

export function calculateDifferenceHashFromPixels(
  pixels: ArrayLike<number>,
  width = HASH_WIDTH,
  height = HASH_HEIGHT,
): string {
  if (
    width !== HASH_WIDTH ||
    height !== HASH_HEIGHT ||
    pixels.length !== width * height
  ) {
    throw new Error(
      "dHash requires exactly 72 grayscale pixels arranged as 9 × 8.",
    );
  }

  let hash = "";

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      hash += pixels[y * width + x] > pixels[y * width + x + 1]
        ? "1"
        : "0";
    }
  }

  return hash;
}

export function calculateHashDistance(
  firstHash: string,
  secondHash: string,
): number {
  if (
    firstHash.length !== 64 ||
    secondHash.length !== 64 ||
    !/^[01]+$/.test(firstHash) ||
    !/^[01]+$/.test(secondHash)
  ) {
    throw new Error(
      "Both perceptual hashes must contain exactly 64 binary digits.",
    );
  }

  let distance = 0;

  for (let index = 0; index < 64; index += 1) {
    if (firstHash[index] !== secondHash[index]) {
      distance += 1;
    }
  }

  return distance;
}

function readGrayscalePixels(context: CanvasRenderingContext2D): number[] {
  const imageData = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
  const grayscale: number[] = [];
  for (let index = 0; index < imageData.data.length; index += 4) {
    grayscale.push(Math.round(
      0.299 * imageData.data[index] +
      0.587 * imageData.data[index + 1] +
      0.114 * imageData.data[index + 2],
    ));
  }
  return grayscale;
}

function calculateAverageHash(pixels: number[]): string {
  if (pixels.length !== HASH_WIDTH * HASH_HEIGHT) {
    throw new Error("Average hash requires exactly 72 grayscale pixels.");
  }
  const average = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  return pixels.map(value => value >= average ? "1" : "0").join("");
}

function normalizePixels(pixels: number[]): number[] {
  const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  const variance = pixels.reduce((sum, value) => sum + (value - mean) ** 2, 0) / pixels.length;
  const deviation = Math.sqrt(variance);
  return deviation < 1 ? pixels.map(() => 0.5) : pixels.map(value => Math.max(0, Math.min(1, 0.5 + ((value - mean) / deviation) * 0.2)));
}

function pixelMae(first: number[], second: number[]): number {
  let total = 0;
  for (let i = 0; i < 72; i += 1) total += Math.abs(first[i] - second[i]);
  return total / 72;
}

function calculateAverageHashDistance(first: string, second: string): number {
  if (first.length !== 72 || second.length !== 72 ||
      !/^[01]+$/.test(first) || !/^[01]+$/.test(second)) {
    throw new Error("Both average hashes must contain exactly 72 binary digits.");
  }
  let distance = 0;
  for (let index = 0; index < 72; index += 1) {
    if (first[index] !== second[index]) distance += 1;
  }
  return distance;
}

function readDescriptors(context: CanvasRenderingContext2D): {
  differenceHash: string;
  averageHash: string;
} {
  const grayscale = readGrayscalePixels(context);
  return {
    differenceHash: calculateDifferenceHashFromPixels(grayscale),
    averageHash: calculateAverageHash(grayscale),
  };
}

function readHash(context: CanvasRenderingContext2D): string {
  return readDescriptors(context).differenceHash;
}

function validateImageFile(file: File): void {
  if (file.size <= 0) {
    throw new Error("The selected image is empty.");
  }

  if (file.size > MAX_SIMILARITY_FILE_SIZE_BYTES) {
    throw new Error(
      "Image is too large for similarity checking. Maximum supported size is 20 MiB.",
    );
  }

  if (!SUPPORTED_SIMILARITY_TYPES.has(file.type.toLowerCase())) {
    throw new Error(
      "Unsupported image format. Choose a JPEG, PNG, or WebP image.",
    );
  }
}

/**
 * Produces a bounded descriptor set: one whole-image dHash plus
 * overlapping region hashes across multiple scales and nine positions
 * per axis, improving coverage of off-center and edge crops. Each region is sampled directly from the decoded bitmap.
 */
async function calculateImageHashSet(file: File): Promise<ImageHashSet> {
  validateImageFile(file);

  if (typeof createImageBitmap !== "function") {
    throw new Error("Image decoding is not supported by this browser.");
  }

  const bitmap = await createImageBitmap(file);
  let canvas: HTMLCanvasElement | undefined;

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      throw new Error("The image has invalid dimensions.");
    }

    canvas = document.createElement("canvas");
    canvas.width = HASH_WIDTH;
    canvas.height = HASH_HEIGHT;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error(
        "Image similarity checking is not supported by this browser.",
      );
    }

    // Keep the whole-image descriptor separate from positioned regions.
    context.drawImage(bitmap, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    const wholeImageDescriptors = readDescriptors(context);
    const wholeImageHash = wholeImageDescriptors.differenceHash;
    const wholeImageAverageHash = wholeImageDescriptors.averageHash;
    const wholeImagePixels = normalizePixels(readGrayscalePixels(context));
    const regions: RegionHash[] = [];

    // Multi-scale windows sampled on a denser 8-step grid cover centered,
    // off-center, and edge crops with less positional quantization.
    // Use independent horizontal/vertical scales so portrait, landscape,
    // and edge-biased crops are represented without a huge canvas.
    for (const widthScale of REGION_WIDTH_SCALES) {
      for (const heightScale of REGION_HEIGHT_SCALES) {
        const regionWidth = Math.max(1, Math.round(bitmap.width * widthScale));
        const regionHeight = Math.max(1, Math.round(bitmap.height * heightScale));
        const maxX = bitmap.width - regionWidth;
        const maxY = bitmap.height - regionHeight;

        for (let yStep = 0; yStep <= REGION_GRID_STEPS; yStep += 1) {
          const sourceY = Math.round(maxY * yStep / REGION_GRID_STEPS);

          for (let xStep = 0; xStep <= REGION_GRID_STEPS; xStep += 1) {
            const sourceX = Math.round(maxX * xStep / REGION_GRID_STEPS);

            context.drawImage(
              bitmap,
              sourceX,
              sourceY,
              regionWidth,
              regionHeight,
              0,
              0,
              HASH_WIDTH,
              HASH_HEIGHT,
            );

            const regionDescriptors = readDescriptors(context);
            regions.push({
              hash: regionDescriptors.differenceHash,
              averageHash: regionDescriptors.averageHash,
              pixels: normalizePixels(readGrayscalePixels(context)),
              x: sourceX / bitmap.width,
              y: sourceY / bitmap.height,
              width: regionWidth / bitmap.width,
              height: regionHeight / bitmap.height,
              centerX: (sourceX + regionWidth / 2) / bitmap.width,
              centerY: (sourceY + regionHeight / 2) / bitmap.height,
            });
          }
        }
      }
    }

    return {
      file,
      width: bitmap.width,
      height: bitmap.height,
      wholeImageHash,
      wholeImageAverageHash,
      wholeImagePixels,
      regions,
    };
  } finally {
    bitmap.close();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * Public single-image API retained for existing callers.
 * Returns the whole-image dHash, preserving its established behavior.
 */
export async function calculateImageDifferenceHash(
  file: File,
): Promise<string> {
  validateImageFile(file);

  if (typeof createImageBitmap !== "function") {
    throw new Error("Image decoding is not supported by this browser.");
  }

  const bitmap = await createImageBitmap(file);
  let canvas: HTMLCanvasElement | undefined;

  try {
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      throw new Error("The image has invalid dimensions.");
    }

    canvas = document.createElement("canvas");
    canvas.width = HASH_WIDTH;
    canvas.height = HASH_HEIGHT;

    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      throw new Error(
        "Image similarity checking is not supported by this browser.",
      );
    }

    context.drawImage(bitmap, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    return readHash(context);
  } finally {
    bitmap.close();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * Finds similar-photo candidates using directional crop-region matching.
 *
 * A crop may match a region of its parent in either direction. Each
 * accepted direction must have at least two spatially independent
 * matching regions; overlapping samples of the same area count once.
 * A whole-image hash match alone is never sufficient. This remains a
 * heuristic and is not proof of identity.
 */
function compareHashSets(
  first: ImageHashSet,
  second: ImageHashSet,
  maxDistance: number,
  onDiagnostic?: SimilarPhotoDiagnosticHandler,
): CropMatch | undefined {
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  const largerArea = Math.max(first.width * first.height, second.width * second.height);
  if (smallerArea / largerArea < 0.08) return undefined;

  const MAX_RELATIVE_ASPECT_ERROR = 0.04;
  // A second, differently constructed descriptor reduces accidental
  // dHash-only matches while remaining tolerant of global brightness shifts.
  const MAX_AVERAGE_HASH_DISTANCE = 12;
  const MAX_NORMALIZED_PIXEL_MAE = 0.22;
  const MIN_INDEPENDENT_REGIONS = 2;

  const directionalMatch = (
    candidateImage: ImageHashSet,
    sourceImage: ImageHashSet,
  ): CropMatch | undefined => {
    const candidateRegions = sourceImage.regions;
    const candidateAspect = candidateImage.width / candidateImage.height;
    const measured = candidateRegions.map(region => {
      const regionAspect=(region.width*sourceImage.width)/(region.height*sourceImage.height);
      const relativeAspectError=Math.abs(regionAspect-candidateAspect)/candidateAspect;
      const distance=calculateHashDistance(candidateImage.wholeImageHash,region.hash);
      const averageDistance=calculateAverageHashDistance(candidateImage.wholeImageAverageHash,region.averageHash);
      const pixelsDistance=pixelMae(candidateImage.wholeImagePixels,region.pixels);
      return {region,distance,averageDistance,pixelsDistance,regionAspect,relativeAspectError,
        dHashPass:distance<=maxDistance,averageHashPass:averageDistance<=MAX_AVERAGE_HASH_DISTANCE,
        aspectRatioPass:relativeAspectError<=MAX_RELATIVE_ASPECT_ERROR,
        pixelPass:pixelsDistance<=MAX_NORMALIZED_PIXEL_MAE};
    });
    const candidates=measured.filter(v=>v.dHashPass&&v.averageHashPass&&v.aspectRatioPass&&v.pixelPass)
      .sort((a,b)=>a.distance-b.distance||a.pixelsDistance-b.pixelsDistance||a.relativeAspectError-b.relativeAspectError);
    const rejected=measured.filter(v=>!(v.dHashPass&&v.averageHashPass&&v.aspectRatioPass&&v.pixelPass));
    const bestRejected=rejected.map(v=>({...v,rejectionScore:
      Math.max(0,v.distance-maxDistance)/Math.max(1,maxDistance)+
      Math.max(0,v.averageDistance-MAX_AVERAGE_HASH_DISTANCE)/MAX_AVERAGE_HASH_DISTANCE+
      Math.max(0,v.relativeAspectError-MAX_RELATIVE_ASPECT_ERROR)/MAX_RELATIVE_ASPECT_ERROR+
      Math.max(0,v.pixelsDistance-MAX_NORMALIZED_PIXEL_MAE)/MAX_NORMALIZED_PIXEL_MAE
    })).sort((a,b)=>a.rejectionScore-b.rejectionScore)[0];
    const independentCandidates=selectSpatiallyIndependentRegions(candidates);
    const best=candidates[0];
    const summary=(v:typeof measured[number])=>({x:Number(v.region.x.toFixed(4)),y:Number(v.region.y.toFixed(4)),
      width:Number(v.region.width.toFixed(4)),height:Number(v.region.height.toFixed(4)),
      dHashDistance:v.distance,averageHashDistance:v.averageDistance,
      normalizedPixelMae:Number(v.pixelsDistance.toFixed(4)),
      aspectRatioErrorPercent:Number((v.relativeAspectError*100).toFixed(2))});
    onDiagnostic?.({
      candidate:candidateImage.file.name,source:sourceImage.file.name,totalGeneratedRegions:measured.length,
      thresholds:{dHash:maxDistance,averageHash:MAX_AVERAGE_HASH_DISTANCE,aspectRatioErrorPercent:MAX_RELATIVE_ASPECT_ERROR*100},
      dHashPass:measured.filter(v=>v.dHashPass).length,dHashFail:measured.filter(v=>!v.dHashPass).length,
      averageHashPass:measured.filter(v=>v.averageHashPass).length,averageHashFail:measured.filter(v=>!v.averageHashPass).length,
      aspectRatioPass:measured.filter(v=>v.aspectRatioPass).length,aspectRatioFail:measured.filter(v=>!v.aspectRatioPass).length,
      allConditionsPass:candidates.length,
      bestRejectedCandidate:bestRejected?{...summary(bestRejected),sourcePixelX:Math.round(bestRejected.region.x*sourceImage.width),sourcePixelY:Math.round(bestRejected.region.y*sourceImage.height),sourcePixelWidth:Math.round(bestRejected.region.width*sourceImage.width),sourcePixelHeight:Math.round(bestRejected.region.height*sourceImage.height),failedChecks:[
        ...(!bestRejected.dHashPass?["dHash"]:[]),...(!bestRejected.averageHashPass?["Average Hash"]:[]),
        ...(!bestRejected.aspectRatioPass?["Aspect ratio"]:[])
      ],candidateDHash:candidateImage.wholeImageHash,regionDHash:bestRejected.region.hash,
      dHashDifferenceBitPositions:Array.from({length:64},(_,index)=>index)
        .filter(index=>candidateImage.wholeImageHash[index]!==bestRejected.region.hash[index])}:undefined,
      selectedCandidate:best?summary(best):undefined,decision:best?"ACCEPT":"REJECT"
    });
    console.info("[M9 crop geometry evidence]",{candidate:candidateImage.file.name,source:sourceImage.file.name,
      totalGeneratedRegions:measured.length,dHashPass:measured.filter(v=>v.dHashPass).length,
      averageHashPass:measured.filter(v=>v.averageHashPass).length,
      aspectRatioPass:measured.filter(v=>v.aspectRatioPass).length,allConditionsPass:candidates.length,
      spatiallyIndependentRegions:independentCandidates.length,decision:independentCandidates.length>=MIN_INDEPENDENT_REGIONS?"ACCEPT":"REJECT"});

    if (independentCandidates.length < MIN_INDEPENDENT_REGIONS) return undefined;
    return { distance: independentCandidates[0].distance, matches: independentCandidates.length };
  };

  const firstInSecond = directionalMatch(second, first);
  const secondInFirst = directionalMatch(first, second);


  // Crop matching is intentionally directional: a crop should match a
  // region of its parent, but the full parent need not match a region of
  // the smaller crop. Two independent descriptors guard each direction.
  if (!firstInSecond && !secondInFirst) return undefined;
  if (!firstInSecond) return secondInFirst;
  if (!secondInFirst) return firstInSecond;
  return firstInSecond.distance <= secondInFirst.distance
    ? firstInSecond
    : secondInFirst;
}

export async function findSimilarPhotos(
  files: File[],
  onError?: SimilarPhotoErrorHandler,
  maxDistance = DEFAULT_SIMILARITY_DISTANCE,
  onDiagnostic?: SimilarPhotoDiagnosticHandler,
): Promise<SimilarPhotoPair[]> {
  if (
    !Number.isInteger(maxDistance) ||
    maxDistance < 0 ||
    maxDistance > 64
  ) {
    throw new Error(
      "Similarity distance must be a whole number between 0 and 64.",
    );
  }

  const hashedFiles: ImageHashSet[] = [];

  for (const file of files) {
    try {
      hashedFiles.push(await calculateImageHashSet(file));
    } catch (error) {
      onError?.(file, error);
    }
  }

  const pairs: SimilarPhotoPair[] = [];

  for (let firstIndex = 0; firstIndex < hashedFiles.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < hashedFiles.length;
      secondIndex += 1
    ) {
      const first = hashedFiles[firstIndex];
      const second = hashedFiles[secondIndex];
      const match = compareHashSets(
        first,
        second,
        maxDistance,
        onDiagnostic,
      );

      if (match) {
        pairs.push({
          first: first.file,
          second: second.file,
          distance: match.distance,
          similarityPercent: Math.round(
            ((64 - match.distance) / 64) * 100,
          ),
        });
      }
    }
  }

  return pairs;
}
