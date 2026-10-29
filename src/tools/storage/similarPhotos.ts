/**
 * Mobile Freedom — M9 Similar Photo Detection
 *
 * Estimates visual similarity using difference hashing (dHash).
 * Image processing happens locally in the browser.
 * Files are never uploaded or deleted by this module.
 */

export const MAX_SIMILARITY_FILE_SIZE_BYTES =
  20 * 1024 * 1024;

export const DEFAULT_SIMILARITY_DISTANCE = 8;

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

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

/**
 * Calculates a 64-bit difference hash from grayscale pixels.
 *
 * The input must contain 9 × 8 = 72 grayscale pixel values.
 * Each row compares adjacent pixels, producing 64 bits.
 */
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
      const left = pixels[y * width + x];
      const right = pixels[y * width + x + 1];

      hash += left > right ? "1" : "0";
    }
  }

  return hash;
}

/**
 * Calculates the number of differing bits between two hashes.
 */
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

/**
 * Converts an image file to a perceptual hash.
 *
 * The image is decoded and reduced to a tiny 9 × 8 canvas.
 * Only local browser APIs are used.
 */
export async function calculateImageDifferenceHash(
  file: File,
): Promise<string> {
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

  if (typeof createImageBitmap !== "function") {
    throw new Error(
      "Image decoding is not supported by this browser.",
    );
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

    context.drawImage(
      bitmap,
      0,
      0,
      HASH_WIDTH,
      HASH_HEIGHT,
    );

    const imageData = context.getImageData(
      0,
      0,
      HASH_WIDTH,
      HASH_HEIGHT,
    );

    const grayscale: number[] = [];

    for (
      let index = 0;
      index < imageData.data.length;
      index += 4
    ) {
      const red = imageData.data[index];
      const green = imageData.data[index + 1];
      const blue = imageData.data[index + 2];

      grayscale.push(
        Math.round(
          0.299 * red +
            0.587 * green +
            0.114 * blue,
        ),
      );
    }

    return calculateDifferenceHashFromPixels(
      grayscale,
      HASH_WIDTH,
      HASH_HEIGHT,
    );
  } finally {
    bitmap.close();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

/**
 * Finds candidate pairs of visually similar photos.
 *
 * A lower Hamming distance means the perceptual hashes are
 * more similar. This is an estimate, not proof of identity.
 *
 * If a file cannot be processed, its error is reported and
 * processing continues with the remaining files.
 */
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

  const hashedFiles: Array<{
    file: File;
    hash: string;
  }> = [];

  for (const file of files) {
    try {
      const hash = await calculateImageDifferenceHash(file);

      hashedFiles.push({
        file,
        hash,
      });
    } catch (error) {
      onError?.(file, error);
    }
  }

  const pairs: SimilarPhotoPair[] = [];

  for (
    let firstIndex = 0;
    firstIndex < hashedFiles.length;
    firstIndex += 1
  ) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < hashedFiles.length;
      secondIndex += 1
    ) {
      const first = hashedFiles[firstIndex];
      const second = hashedFiles[secondIndex];

      const distance = calculateHashDistance(
        first.hash,
        second.hash,
      );

      if (distance <= maxDistance) {
        pairs.push({
          first: first.file,
          second: second.file,
          distance,
          similarityPercent: Math.round(
            ((64 - distance) / 64) * 100,
          ),
        });
      }
    }
  }

  return pairs;
}
