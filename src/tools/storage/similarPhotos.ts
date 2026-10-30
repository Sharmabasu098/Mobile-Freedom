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
const REGION_SCALES = [0.5, 0.65, 0.8] as const;
const REGION_POSITIONS = [0, 0.5, 1] as const;
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

    // Sliding multi-scale windows let a crop match a region of its source.
    for (const scale of REGION_SCALES) {
      const regionWidth = Math.max(1, Math.round(bitmap.width * scale));
      const regionHeight = Math.max(1, Math.round(bitmap.height * scale));
      const maxX = bitmap.width - regionWidth;
      const maxY = bitmap.height - regionHeight;

      for (const yPosition of REGION_POSITIONS) {
        const sourceY = Math.round(maxY * yPosition);

        for (const xPosition of REGION_POSITIONS) {
          const sourceX = Math.round(maxX * xPosition);

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

    return { file, hashes };
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
  first: string[],
  second: string[],
  maxDistance: number,
): CropMatch | undefined {
  // Preserve exact/whole-image perceptual matches even when a flat or
  // low-texture image produces only one unique region descriptor.
  if (first[0] === second[0]) {
    return { distance: 0, matches: 1 };
  }

  const matchedFirst = new Set<number>();
  const matchedSecond = new Set<number>();
  const distances: number[] = [];

  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    let bestDistance = maxDistance + 1;
    let bestSecondIndex = -1;

    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const distance = calculateHashDistance(
        first[firstIndex],
        second[secondIndex],
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestSecondIndex = secondIndex;
      }
    }

    if (bestDistance <= maxDistance && bestSecondIndex >= 0) {
      matchedFirst.add(firstIndex);
      matchedSecond.add(bestSecondIndex);
      distances.push(bestDistance);
    }
  }

  if (
    matchedFirst.size < MIN_INDEPENDENT_MATCHES ||
    matchedSecond.size < MIN_INDEPENDENT_MATCHES
  ) {
    return undefined;
  }

  return {
    distance: Math.round(
      distances.reduce((total, distance) => total + distance, 0) /
      distances.length,
    ),
    matches: Math.min(matchedFirst.size, matchedSecond.size),
  };
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
        first.hashes,
        second.hashes,
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
