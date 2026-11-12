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
const REGION_WIDTH_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.8, 5 / 6, 0.9, 0.95] as const;
const REGION_HEIGHT_SCALES = [0.3, 0.4, 0.45, 0.5, 0.6, 0.65, 0.75, 0.78, 0.8, 5 / 6, 0.9, 0.95] as const;
const REGION_GRID_STEPS = 8;

const SUPPORTED_SIMILARITY_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface SimilarPhotoDirectionalDiagnostic {
 candidate:string; source:string; totalGeneratedRegions:number;
 thresholds:{dHash:number;averageHash:number;aspectRatioErrorPercent:number;normalizedPixelMae:number;lowResolutionFallbackPixelMae:number;lowResolutionFallbackMaxHashDistance:number;spatialFallbackDHash:number;spatialFallbackPixelMae:number;minimumIndependentRegions:number;spatialTileMae:number;minimumSpatialTiles:number};
 dHashPass:number;dHashFail:number;averageHashPass:number;averageHashFail:number;
 aspectRatioPass:number;aspectRatioFail:number;pixelPass:number;pixelFail:number;
 spatialTilePass:number;spatialTileFail:number;allConditionsPass:number;independentRegionCount:number;
 bestRejectedCandidate?:{x:number;y:number;width:number;height:number;sourcePixelX:number;sourcePixelY:number;sourcePixelWidth:number;sourcePixelHeight:number;dHashDistance:number;averageHashDistance:number;aspectRatioErrorPercent:number;failedChecks:string[];candidateDHash:string;regionDHash:string;dHashDifferenceBitPositions:number[]};
 selectedCandidate?:{x:number;y:number;width:number;height:number;dHashDistance:number;averageHashDistance:number;normalizedPixelMae:number;spatialTileMatches:number;spatialTileRows:number;spatialTileColumns:number;aspectRatioErrorPercent:number};
 alignmentVerification?:{attemptedCandidates:number;translationOffsetsPercent:number[];scaleXOffsetsPercent:number[];scaleYOffsetsPercent:number[];maximumPixelMae:number;selectedPixelMae?:number;matchingTiles?:number;decision:"ACCEPT"|"REJECT"|"NOT_RUN"};
 decision:"ACCEPT"|"REJECT";
 earlyRejectionReason?:"IMAGE_AREA_RATIO_BELOW_MINIMUM";
 imageAreaRatio?:number;
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

/**
 * Measures evidence distributed inside one candidate crop, rather than
 * requiring multiple overlapping parent windows to match the same crop.
 * The 3x2 tiles cover the complete 9x8 descriptor; at least four tiles
 * across both axes must agree. A tiny repeated logo cannot satisfy this
 * spatial-coverage gate by itself.
 */
function measureSpatialTileEvidence(
  first: number[],
  second: number[],
  maxTileMae: number,
  minimumMatchingTiles: number,
): {
  matchingTiles: number;
  coveredRows: number;
  coveredColumns: number;
  passes: boolean;
} {
  const TILE_WIDTH = 3;
  const TILE_HEIGHT = 4;
  const matchingRows = new Set<number>();
  const matchingColumns = new Set<number>();
  let matchingTiles = 0;
  for (let tileY = 0; tileY < 2; tileY += 1) {
    for (let tileX = 0; tileX < 3; tileX += 1) {
      let total = 0;
      for (let y = 0; y < TILE_HEIGHT; y += 1) {
        for (let x = 0; x < TILE_WIDTH; x += 1) {
          const index = (tileY * TILE_HEIGHT + y) * HASH_WIDTH + tileX * TILE_WIDTH + x;
          total += Math.abs(first[index] - second[index]);
        }
      }
      if (total / (TILE_WIDTH * TILE_HEIGHT) <= maxTileMae) {
        matchingTiles += 1;
        matchingRows.add(tileY);
        matchingColumns.add(tileX);
      }
    }
  }
  return {
    matchingTiles,
    coveredRows: matchingRows.size,
    coveredColumns: matchingColumns.size,
    passes: matchingTiles >= minimumMatchingTiles && matchingRows.size === 2 && matchingColumns.size >= 2,
  };
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
    // Use high-quality interpolation for downsampling so the production
    // descriptors preserve fine crop detail consistently across browsers.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

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
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

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
 * A crop may match one aligned region of its parent in either direction.
 * Overlapping parent windows are deduplicated, while spatial independence
 * is established within the selected region by distributed 3×2 tile evidence.
 * A whole-image hash match alone is never sufficient. This remains a
 * heuristic and is not proof of identity.
 */
const ALIGNMENT_SAMPLE_SIZE = 48;
const ALIGNMENT_MAX_PIXEL_MAE = 0.065;
const ALIGNMENT_MAX_TILE_MAE = 0.20;
// Wider bounded recovery for real photographs whose crop geometry falls
// between the coarse region-grid scales/positions. Five translation samples
// cover ±8% of the parent image; three independent scale samples cover ±6%
// of each proposed region dimension. Keep the candidate budget bounded for
// mobile browsers.
const ALIGNMENT_TRANSLATION_OFFSETS = [-0.06, -0.03, 0, 0.03, 0.06] as const;
const ALIGNMENT_SCALE_X_OFFSETS = [-0.12, -0.06, 0, 0.06, 0.12] as const;
const ALIGNMENT_SCALE_Y_OFFSETS = [-0.12, -0.06, 0, 0.06, 0.12] as const;
const ALIGNMENT_MAX_CANDIDATES = 16;

function readNormalizedAlignmentPixels(
  context: CanvasRenderingContext2D,
): number[] {
  const data = context.getImageData(0, 0, ALIGNMENT_SAMPLE_SIZE, ALIGNMENT_SAMPLE_SIZE).data;
  const grayscale: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    grayscale.push(
      0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2],
    );
  }
  return normalizePixels(grayscale);
}

function measureHighResolutionAlignmentTiles(
  first: number[],
  second: number[],
): { matchingTiles: number; passes: boolean } {
  const tileWidth = ALIGNMENT_SAMPLE_SIZE / 3;
  const tileHeight = ALIGNMENT_SAMPLE_SIZE / 2;
  let matchingTiles = 0;
  for (let tileY = 0; tileY < 2; tileY += 1) {
    for (let tileX = 0; tileX < 3; tileX += 1) {
      let total = 0;
      for (let y = 0; y < tileHeight; y += 1) {
        for (let x = 0; x < tileWidth; x += 1) {
          const index = (tileY * tileHeight + y) * ALIGNMENT_SAMPLE_SIZE + tileX * tileWidth + x;
          total += Math.abs(first[index] - second[index]);
        }
      }
      if (total / (tileWidth * tileHeight) <= ALIGNMENT_MAX_TILE_MAE) {
        matchingTiles += 1;
      }
    }
  }
  return { matchingTiles, passes: matchingTiles === 6 };
}

/**
 * Bounded second-stage verification. The coarse 9×8 matcher only proposes
 * a geographically diverse proposal set; this stage re-decodes the pair and
 * tests geometry-relative scale and position offsets around each proposed
 * region at 48×48 resolution. Independent X/Y scale search adapts to the
 * proposed crop geometry instead of relying only on fixed global scales.
 * Acceptance requires full-frame pixel agreement and all six spatial tiles,
 * so a compact repeated logo cannot independently pass.
 */
async function verifyAlignedCropCandidates(
  candidateFile: File,
  sourceFile: File,
  sourceWidth: number,
  sourceHeight: number,
  candidates: Array<{ region: RegionHash }>,
): Promise<{ pixelMae: number; matchingTiles: number; region: RegionHash } | undefined> {
  if (typeof createImageBitmap !== "function" || candidates.length === 0) return undefined;
  const [candidateBitmap, sourceBitmap] = await Promise.all([
    createImageBitmap(candidateFile),
    createImageBitmap(sourceFile),
  ]);
  let canvas: HTMLCanvasElement | undefined;
  try {
    canvas = document.createElement("canvas");
    canvas.width = ALIGNMENT_SAMPLE_SIZE;
    canvas.height = ALIGNMENT_SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return undefined;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(candidateBitmap, 0, 0, ALIGNMENT_SAMPLE_SIZE, ALIGNMENT_SAMPLE_SIZE);
    const candidatePixels = readNormalizedAlignmentPixels(context);
    let best: { pixelMae: number; matchingTiles: number; region: RegionHash } | undefined;

    for (const item of candidates.slice(0, ALIGNMENT_MAX_CANDIDATES)) {
      const region = item.region;
      const baseX = region.x * sourceWidth;
      const baseY = region.y * sourceHeight;
      const baseWidth = region.width * sourceWidth;
      const baseHeight = region.height * sourceHeight;
      for (const scaleXOffset of ALIGNMENT_SCALE_X_OFFSETS) {
        for (const scaleYOffset of ALIGNMENT_SCALE_Y_OFFSETS) {
          const sampleWidth = baseWidth * (1 + scaleXOffset);
          const sampleHeight = baseHeight * (1 + scaleYOffset);
          // Reject impossible expanded windows before clamping coordinates.
          // Otherwise a >100% source rectangle can escape the bitmap bounds
          // and produce invalid pixel reads in browsers and regression mocks.
          if (
            sampleWidth <= 0 ||
            sampleHeight <= 0 ||
            sampleWidth > sourceWidth ||
            sampleHeight > sourceHeight
          ) continue;
          for (const translateY of ALIGNMENT_TRANSLATION_OFFSETS) {
            for (const translateX of ALIGNMENT_TRANSLATION_OFFSETS) {
            const sampleX = Math.max(0, Math.min(
              sourceWidth - sampleWidth,
              baseX + translateX * sourceWidth,
            ));
            const sampleY = Math.max(0, Math.min(
              sourceHeight - sampleHeight,
              baseY + translateY * sourceHeight,
            ));
            if (sampleWidth <= 0 || sampleHeight <= 0) continue;
            context.drawImage(
              sourceBitmap,
              sampleX, sampleY, sampleWidth, sampleHeight,
              0, 0, ALIGNMENT_SAMPLE_SIZE, ALIGNMENT_SAMPLE_SIZE,
            );
            const sourcePixels = readNormalizedAlignmentPixels(context);
            const mae = pixelMaeHighResolution(candidatePixels, sourcePixels);
            const tiles = measureHighResolutionAlignmentTiles(candidatePixels, sourcePixels);
            if (
              !best ||
              mae < best.pixelMae ||
              (mae === best.pixelMae && tiles.matchingTiles > best.matchingTiles)
            ) {
              best = { pixelMae: mae, matchingTiles: tiles.matchingTiles, region };
            }
            }
          }
        }
      }
    }
    return best &&
      best.pixelMae <= ALIGNMENT_MAX_PIXEL_MAE &&
      best.matchingTiles === 6
      ? best
      : undefined;
  } finally {
    candidateBitmap.close();
    sourceBitmap.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function pixelMaeHighResolution(first: number[], second: number[]): number {
  let total = 0;
  for (let index = 0; index < first.length; index += 1) {
    total += Math.abs(first[index] - second[index]);
  }
  return total / first.length;
}

async function compareHashSets(
  first: ImageHashSet,
  second: ImageHashSet,
  maxDistance: number,
  onDiagnostic?: SimilarPhotoDiagnosticHandler,
): Promise<CropMatch | undefined> {
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  const largerArea = Math.max(first.width * first.height, second.width * second.height);
  const imageAreaRatio = smallerArea / largerArea;

  const MAX_RELATIVE_ASPECT_ERROR = 0.04;
  // A second, differently constructed descriptor reduces accidental
  // dHash-only matches while remaining tolerant of global brightness shifts.
  const MAX_AVERAGE_HASH_DISTANCE = 12;
  // Normalized samples are bounded to [0.3, 0.7], so their maximum possible
  // MAE is 0.4. The former 0.45 limit could never reject a candidate.
  // 0.06 keeps near-identical genuine crops while rejecting the observed
  // unrelated-photo matches (~0.12 MAE in the real-photo regression pair).
  const MAX_NORMALIZED_PIXEL_MAE = 0.06;
  // A narrowly scoped fallback for genuinely low-resolution inputs. It only
  // applies when the candidate itself is <=48px wide or <=32px high, all six
  // spatial tiles agree, and both hash distances remain within 12.
  const LOW_RESOLUTION_MAX_PIXEL_MAE = 0.09;
  const LOW_RESOLUTION_MAX_HASH_DISTANCE = 12;
  // Strict full-frame evidence fallback for high-detail real photographs.
  // It is intentionally narrower than a generic hash relaxation: the candidate
  // must satisfy both 72-bit average hash, pixel MAE, all six spatial tiles,
  // and aspect ratio. The Nov-12 real-photo regression measured dHash=16,
  // averageHash=7, pixelMAE=0.0625, and 6/6 tiles on a genuine 80% crop.
  const SPATIAL_FALLBACK_MAX_DHASH_DISTANCE = 16;
  const SPATIAL_FALLBACK_MAX_PIXEL_MAE = 0.07;
  // One aligned parent window is expected for a genuine crop. Spatial
  // independence is proven inside that window by the 3x2 tile evidence gate.
  const MIN_INDEPENDENT_REGIONS = 1;
  const MIN_IMAGE_AREA_RATIO = 0.08;
  const SPATIAL_TILE_MAE = 0.22;
  const MINIMUM_SPATIAL_TILES = 4;

  // Pair-level gates must be visible in the same diagnostic stream as
  // directional region failures; otherwise a tiny crop appears to vanish.
  if (imageAreaRatio < MIN_IMAGE_AREA_RATIO) {
    const reportAreaRejection = (
      candidateImage: ImageHashSet,
      sourceImage: ImageHashSet,
    ) => onDiagnostic?.({
      candidate: candidateImage.file.name,
      source: sourceImage.file.name,
      totalGeneratedRegions: 0,
      thresholds: {
        dHash: maxDistance,
        averageHash: MAX_AVERAGE_HASH_DISTANCE,
        aspectRatioErrorPercent: MAX_RELATIVE_ASPECT_ERROR * 100,
        normalizedPixelMae: MAX_NORMALIZED_PIXEL_MAE,
        lowResolutionFallbackPixelMae: LOW_RESOLUTION_MAX_PIXEL_MAE,
        lowResolutionFallbackMaxHashDistance: LOW_RESOLUTION_MAX_HASH_DISTANCE,
        spatialFallbackDHash: SPATIAL_FALLBACK_MAX_DHASH_DISTANCE,
        spatialFallbackPixelMae: SPATIAL_FALLBACK_MAX_PIXEL_MAE,
        minimumIndependentRegions: MIN_INDEPENDENT_REGIONS,
        spatialTileMae: SPATIAL_TILE_MAE,
        minimumSpatialTiles: MINIMUM_SPATIAL_TILES,
      },
      dHashPass: 0, dHashFail: 0,
      averageHashPass: 0, averageHashFail: 0,
      aspectRatioPass: 0, aspectRatioFail: 0,
      pixelPass: 0, pixelFail: 0,
      spatialTilePass: 0, spatialTileFail: 0,
      allConditionsPass: 0,
      independentRegionCount: 0,
      decision: "REJECT",
      earlyRejectionReason: "IMAGE_AREA_RATIO_BELOW_MINIMUM",
      imageAreaRatio: Number(imageAreaRatio.toFixed(5)),
    });

    reportAreaRejection(first, second);
    reportAreaRejection(second, first);
    return undefined;
  }

  const directionalMatch = async (
    candidateImage: ImageHashSet,
    sourceImage: ImageHashSet,
  ): Promise<CropMatch | undefined> => {
    const candidateRegions = sourceImage.regions;
    const candidateAspect = candidateImage.width / candidateImage.height;
    const measured = candidateRegions.map(region => {
      const regionAspect=(region.width*sourceImage.width)/(region.height*sourceImage.height);
      const relativeAspectError=Math.abs(regionAspect-candidateAspect)/candidateAspect;
      const distance=calculateHashDistance(candidateImage.wholeImageHash,region.hash);
      const averageDistance=calculateAverageHashDistance(candidateImage.wholeImageAverageHash,region.averageHash);
      const pixelsDistance=pixelMae(candidateImage.wholeImagePixels,region.pixels);
      const spatialEvidence=measureSpatialTileEvidence(
        candidateImage.wholeImagePixels,
        region.pixels,
        SPATIAL_TILE_MAE,
        MINIMUM_SPATIAL_TILES,
      );
      const aspectRatioPass=relativeAspectError<=MAX_RELATIVE_ASPECT_ERROR;
      const lowResolutionFallbackPass =
        (candidateImage.width <= 48 || candidateImage.height <= 32) &&
        distance <= LOW_RESOLUTION_MAX_HASH_DISTANCE &&
        averageDistance <= LOW_RESOLUTION_MAX_HASH_DISTANCE &&
        pixelsDistance <= LOW_RESOLUTION_MAX_PIXEL_MAE &&
        spatialEvidence.matchingTiles === 6 &&
        aspectRatioPass;
      const strictSpatialFallbackPass =
        distance <= SPATIAL_FALLBACK_MAX_DHASH_DISTANCE &&
        averageDistance <= MAX_AVERAGE_HASH_DISTANCE &&
        pixelsDistance <= SPATIAL_FALLBACK_MAX_PIXEL_MAE &&
        spatialEvidence.matchingTiles === 6 &&
        aspectRatioPass;
      const fallbackPass = lowResolutionFallbackPass || strictSpatialFallbackPass;
      return {region,distance,averageDistance,pixelsDistance,regionAspect,relativeAspectError,spatialEvidence,
        lowResolutionFallbackPass,strictSpatialFallbackPass,
        dHashPass:distance<=maxDistance || fallbackPass,
        averageHashPass:averageDistance<=MAX_AVERAGE_HASH_DISTANCE || fallbackPass,
        aspectRatioPass,
        pixelPass:pixelsDistance<=MAX_NORMALIZED_PIXEL_MAE || fallbackPass,
        spatialTilePass:spatialEvidence.passes};
    });
    const candidates=measured.filter(v=>v.dHashPass&&v.averageHashPass&&v.aspectRatioPass&&v.pixelPass&&v.spatialTilePass)
      .sort((a,b)=>a.distance-b.distance||a.pixelsDistance-b.pixelsDistance||a.relativeAspectError-b.relativeAspectError);
    const rejected=measured.filter(v=>!(v.dHashPass&&v.averageHashPass&&v.aspectRatioPass&&v.pixelPass&&v.spatialTilePass));
    const bestRejected=rejected.map(v=>({...v,rejectionScore:
      Math.max(0,v.distance-maxDistance)/Math.max(1,maxDistance)+
      Math.max(0,v.averageDistance-MAX_AVERAGE_HASH_DISTANCE)/MAX_AVERAGE_HASH_DISTANCE+
      Math.max(0,v.relativeAspectError-MAX_RELATIVE_ASPECT_ERROR)/MAX_RELATIVE_ASPECT_ERROR+
      Math.max(0,v.pixelsDistance-MAX_NORMALIZED_PIXEL_MAE)/MAX_NORMALIZED_PIXEL_MAE
    })).sort((a,b)=>a.rejectionScore-b.rejectionScore)[0];
    const independentCandidates=selectSpatiallyIndependentRegions(candidates);
    let best: typeof measured[number] | undefined = candidates[0];
    // Coarse 9x8 hashes are useful for ranking, but a genuine crop can have
    // a poor score on one descriptor (REAL-02: dHash 13, aHash 20, MAE 0.1227)
    // while its geometry is correct. Build a diverse bounded proposal set:
    // independently retain the strongest candidates for each signal, then
    // deduplicate by region identity before the expensive pixel alignment.
    const eligibleProposals = candidates.length > 0
      ? candidates
      : measured.filter(value => value.aspectRatioPass);
    const proposalRankings = [
      eligibleProposals.slice().sort((a, b) => a.pixelsDistance - b.pixelsDistance),
      eligibleProposals.slice().sort((a, b) => a.distance - b.distance),
      eligibleProposals.slice().sort((a, b) => a.averageDistance - b.averageDistance),
      eligibleProposals.slice().sort((a, b) =>
        (a.pixelsDistance / ALIGNMENT_MAX_PIXEL_MAE) +
        (a.averageDistance / MAX_AVERAGE_HASH_DISTANCE) +
        (a.distance / Math.max(1, maxDistance)) -
        ((b.pixelsDistance / ALIGNMENT_MAX_PIXEL_MAE) +
        (b.averageDistance / MAX_AVERAGE_HASH_DISTANCE) +
        (b.distance / Math.max(1, maxDistance))),
      ),
    ];
    const proposalPool: typeof measured = [];
    const seenProposalRegions = new Set<RegionHash>();
    const proposalsPerRanking = ALIGNMENT_MAX_CANDIDATES / proposalRankings.length;
    for (const ranking of proposalRankings) {
      // Dense multi-scale grids create many near-identical overlapping windows.
      // If we take the first N raw scores, one visually plausible but incorrect
      // patch can occupy the entire alignment budget and hide the true crop.
      // Apply spatial NMS independently to each ranking before taking its quota,
      // so the expensive high-resolution stage receives geographically distinct
      // hypotheses rather than many neighboring variants of one location.
      const spatiallyDiverseRanking = selectSpatiallyIndependentRegions(
        ranking.map(value => ({ region: value.region, value })),
        0.25,
      );
      for (const item of spatiallyDiverseRanking.slice(0, proposalsPerRanking)) {
        const proposal = item.value;
        if (!seenProposalRegions.has(proposal.region)) {
          seenProposalRegions.add(proposal.region);
          proposalPool.push(proposal);
        }
      }
    }
    const alignmentAttempted = proposalPool.length;
    const aligned = await verifyAlignedCropCandidates(
      candidateImage.file,
      sourceImage.file,
      sourceImage.width,
      sourceImage.height,
      proposalPool,
    );
    if (aligned) {
      best = measured.find(value => value.region === aligned.region);
    }
    const summary=(v:typeof measured[number])=>({x:Number(v.region.x.toFixed(4)),y:Number(v.region.y.toFixed(4)),
      width:Number(v.region.width.toFixed(4)),height:Number(v.region.height.toFixed(4)),
      dHashDistance:v.distance,averageHashDistance:v.averageDistance,
      normalizedPixelMae:Number(v.pixelsDistance.toFixed(4)),
      spatialTileMatches:v.spatialEvidence.matchingTiles,
      spatialTileRows:v.spatialEvidence.coveredRows,
      spatialTileColumns:v.spatialEvidence.coveredColumns,
      aspectRatioErrorPercent:Number((v.relativeAspectError*100).toFixed(2))});
    onDiagnostic?.({
      candidate:candidateImage.file.name,source:sourceImage.file.name,totalGeneratedRegions:measured.length,
      thresholds:{dHash:maxDistance,averageHash:MAX_AVERAGE_HASH_DISTANCE,aspectRatioErrorPercent:MAX_RELATIVE_ASPECT_ERROR*100,normalizedPixelMae:MAX_NORMALIZED_PIXEL_MAE,lowResolutionFallbackPixelMae:LOW_RESOLUTION_MAX_PIXEL_MAE,lowResolutionFallbackMaxHashDistance:LOW_RESOLUTION_MAX_HASH_DISTANCE,spatialFallbackDHash:SPATIAL_FALLBACK_MAX_DHASH_DISTANCE,spatialFallbackPixelMae:SPATIAL_FALLBACK_MAX_PIXEL_MAE,minimumIndependentRegions:MIN_INDEPENDENT_REGIONS,spatialTileMae:SPATIAL_TILE_MAE,minimumSpatialTiles:MINIMUM_SPATIAL_TILES},
      dHashPass:measured.filter(v=>v.dHashPass).length,dHashFail:measured.filter(v=>!v.dHashPass).length,
      averageHashPass:measured.filter(v=>v.averageHashPass).length,averageHashFail:measured.filter(v=>!v.averageHashPass).length,
      aspectRatioPass:measured.filter(v=>v.aspectRatioPass).length,aspectRatioFail:measured.filter(v=>!v.aspectRatioPass).length,
      pixelPass:measured.filter(v=>v.pixelPass).length,pixelFail:measured.filter(v=>!v.pixelPass).length,
      spatialTilePass:measured.filter(v=>v.spatialTilePass).length,
      spatialTileFail:measured.filter(v=>!v.spatialTilePass).length,
      allConditionsPass:candidates.length,independentRegionCount:independentCandidates.length,
      bestRejectedCandidate:bestRejected?{...summary(bestRejected),sourcePixelX:Math.round(bestRejected.region.x*sourceImage.width),sourcePixelY:Math.round(bestRejected.region.y*sourceImage.height),sourcePixelWidth:Math.round(bestRejected.region.width*sourceImage.width),sourcePixelHeight:Math.round(bestRejected.region.height*sourceImage.height),failedChecks:[
        ...(!bestRejected.dHashPass?["dHash"]:[]),...(!bestRejected.averageHashPass?["Average Hash"]:[]),
        ...(!bestRejected.aspectRatioPass?["Aspect ratio"]:[]),...(!bestRejected.pixelPass?["Normalized pixel MAE"]:[]),
        ...(!bestRejected.spatialTilePass?["Spatial tile evidence"]:[])
      ],candidateDHash:candidateImage.wholeImageHash,regionDHash:bestRejected.region.hash,
      dHashDifferenceBitPositions:Array.from({length:64},(_,index)=>index)
        .filter(index=>candidateImage.wholeImageHash[index]!==bestRejected.region.hash[index])}:undefined,
      selectedCandidate:best?summary(best):undefined,
      alignmentVerification: alignmentAttempted > 0 ? {
        attemptedCandidates: alignmentAttempted,
        translationOffsetsPercent: [...ALIGNMENT_TRANSLATION_OFFSETS].map(value => value * 100),
        scaleXOffsetsPercent: [...ALIGNMENT_SCALE_X_OFFSETS].map(value => value * 100),
        scaleYOffsetsPercent: [...ALIGNMENT_SCALE_Y_OFFSETS].map(value => value * 100),
        maximumPixelMae: ALIGNMENT_MAX_PIXEL_MAE,
        selectedPixelMae: aligned?.pixelMae,
        matchingTiles: aligned?.matchingTiles,
        decision: aligned || independentCandidates.length>=MIN_INDEPENDENT_REGIONS ? "ACCEPT" : "REJECT",
      } : { attemptedCandidates: 0, translationOffsetsPercent: [], scaleXOffsetsPercent: [], scaleYOffsetsPercent: [], maximumPixelMae: ALIGNMENT_MAX_PIXEL_MAE, decision: "NOT_RUN" },
      // Keep the public diagnostic decision consistent with the actual matcher:
      // either high-resolution alignment or the strict spatial candidate path accepts.
      decision: aligned || independentCandidates.length >= MIN_INDEPENDENT_REGIONS ? "ACCEPT" : "REJECT"
    });
    console.info("[M9 crop geometry evidence]",{candidate:candidateImage.file.name,source:sourceImage.file.name,
      totalGeneratedRegions:measured.length,dHashPass:measured.filter(v=>v.dHashPass).length,
      averageHashPass:measured.filter(v=>v.averageHashPass).length,
      aspectRatioPass:measured.filter(v=>v.aspectRatioPass).length,allConditionsPass:candidates.length,
      spatiallyIndependentRegions:independentCandidates.length,decision:independentCandidates.length>=MIN_INDEPENDENT_REGIONS?"ACCEPT":"REJECT"});

    // A candidate is accepted only when its pixel-level and distributed-tile
    // evidence pass, and its independent-region count meets the diagnostic minimum.
    if (aligned && best) return { distance: best.distance, matches: 1 };
    // Preserve the established strict 9×8 path when its complete hash,
    // pixel, aspect, and distributed-tile gates already pass. Alignment is
    // the bounded recovery path for genuine crops that miss those coarse gates.
    if (!best || independentCandidates.length < MIN_INDEPENDENT_REGIONS) return undefined;
    return { distance: best.distance, matches: independentCandidates.length };
  };

  const firstInSecond = await directionalMatch(second, first);
  const secondInFirst = await directionalMatch(first, second);


  // Crop matching is intentionally directional: a crop should match a
  // region of its parent, but the full parent need not match a region of
  // the smaller crop. Hash, pixel, aspect-ratio, and distributed-tile
  // evidence are evaluated together for each direction.
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
      const match = await compareHashSets(
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
