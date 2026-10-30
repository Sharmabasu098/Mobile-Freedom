/**
 * Mobile Freedom — M9 Similar Photo Detection
 *
 * Estimates visual similarity using local perceptual hashing.
 * Images are decoded and analyzed locally in the browser.
 * Files are never uploaded, modified, or deleted by this module.
 */

export const MAX_SIMILARITY_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const DEFAULT_SIMILARITY_DISTANCE = 8;

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;
const REGION_SCALES = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9] as const;
const REGION_GRID_STEPS = 4;
const CROP_HASH_DISTANCE = 12;
const MIN_INDEPENDENT_MATCHES = 2;

const SUPPORTED_SIMILARITY_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

interface ImageHashSet {
  file: File;
  width: number;
  height: number;
  hashes: string[];
}

interface CropMatch {
  distance: number;
  matches: number;
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

function readHash(
  context: CanvasRenderingContext2D,
): string {
  const imageData = context.getImageData(
    0,
    0,
    HASH_WIDTH,
    HASH_HEIGHT,
  );
  const grayscale: number[] = [];

  for (let index = 0; index < imageData.data.length; index += 4) {
    grayscale.push(
      Math.round(
        0.299 * imageData.data[index] +
        0.587 * imageData.data[index + 1] +
        0.114 * imageData.data[index + 2],
      ),
    );
  }

  return calculateDifferenceHashFromPixels(
    grayscale,
    HASH_WIDTH,
    HASH_HEIGHT,
  );
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
 * overlapping region hashes at three scales and three positions
 * per axis. Each region is sampled directly from the decoded bitmap.
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

    const hashes: string[] = [];

    // Whole-image baseline remains part of the descriptor set.
    context.drawImage(bitmap, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    hashes.push(readHash(context));

    // Dense multi-scale windows cover centered and off-center crops.
    // Use independent horizontal/vertical scales so portrait, landscape,
    // and edge-biased crops are represented without a huge canvas.
    for (const widthScale of REGION_SCALES) {
      for (const heightScale of REGION_SCALES) {
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

            hashes.push(readHash(context));
          }
        }
      }
    }

    return { file, width: bitmap.width, height: bitmap.height, hashes };
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
 * Finds similar-photo candidates using bidirectional region matching.
 *
 * A match must be supported by at least two distinct descriptors in
 * each direction. This reduces accidental one-patch matches. It remains
 * a heuristic and is not proof of identity.
 */
function compareHashSets(
  first: ImageHashSet,
  second: ImageHashSet,
  maxDistance: number,
): CropMatch | undefined {
  if (first.hashes[0] === second.hashes[0]) {
    return { distance: 0, matches: 1 };
  }

  // Tiny details are not enough evidence of a shared photograph.
  const smallerArea = Math.min(first.width * first.height, second.width * second.height);
  const largerArea = Math.max(first.width * first.height, second.width * second.height);
  if (smallerArea / largerArea < 0.08) return undefined;

  // Compare each whole-image hash against the other image's multi-scale
  // region hashes. Either input may be the cropped version.
  const bestRegionDistance = (wholeHash: string, regions: string[]) => {
    let best = 65;
    for (const regionHash of regions) {
      best = Math.min(best, calculateHashDistance(wholeHash, regionHash));
    }
    return best;
  };

  const distance = Math.min(
    bestRegionDistance(first.hashes[0], second.hashes),
    bestRegionDistance(second.hashes[0], first.hashes),
  );

  return distance <= Math.max(maxDistance, CROP_HASH_DISTANCE)
    ? { distance, matches: 1 }
    : undefined;
}

export async function findSimilarPhotos(
  files: File[],
  onError?: SimilarPhotoErrorHandler,
  maxDistance = DEFAULT_SIMILARITY_DISTANCE,
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
