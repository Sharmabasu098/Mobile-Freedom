/**
 * Mobile Freedom — M5 Image Tools Engine
 * Browser-local image validation and processing.
 * Images are processed locally; this module does not upload files.
 */

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageType =
  (typeof SUPPORTED_IMAGE_TYPES)[number];

export type ImageOutputFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  format?: ImageOutputFormat;
  quality?: number;
}

export interface ImageProcessResult {
  blob: Blob;
  width: number;
  height: number;
  format: ImageOutputFormat;
  originalBytes: number;
  outputBytes: number;
}

export function validateImageFile(file: File): string | null {
  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  if (
    !SUPPORTED_IMAGE_TYPES.includes(
      file.type as SupportedImageType,
    )
  ) {
    return "Unsupported image format. Choose a JPEG, PNG, or WebP image.";
  }

  return null;
}

export async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const error = validateImageFile(file);

  if (error) {
    throw new Error(error);
  }

  const bitmap = await createImageBitmap(file);

  try {
    return {
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

function getOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  requestedWidth?: number,
  requestedHeight?: number,
): { width: number; height: number } {
  if (
    requestedWidth === undefined &&
    requestedHeight === undefined
  ) {
    return {
      width: sourceWidth,
      height: sourceHeight,
    };
  }

  if (
    (requestedWidth !== undefined &&
      (!Number.isInteger(requestedWidth) ||
        requestedWidth < 1)) ||
    (requestedHeight !== undefined &&
      (!Number.isInteger(requestedHeight) ||
        requestedHeight < 1))
  ) {
    throw new Error(
      "Image dimensions must be positive whole numbers.",
    );
  }

  if (
    requestedWidth !== undefined &&
    requestedHeight !== undefined
  ) {
    return {
      width: requestedWidth,
      height: requestedHeight,
    };
  }

  if (requestedWidth !== undefined) {
    return {
      width: requestedWidth,
      height: Math.max(
        1,
        Math.round(
          (sourceHeight * requestedWidth) / sourceWidth,
        ),
      ),
    };
  }

  const height = requestedHeight as number;

  return {
    width: Math.max(
      1,
      Math.round((sourceWidth * height) / sourceHeight),
    ),
    height,
  };
}

/**
 * Processes an image locally using browser image APIs and Canvas.
 */
export async function processImage(
  file: File,
  options: ImageProcessOptions = {},
): Promise<ImageProcessResult> {
  const error = validateImageFile(file);

  if (error) {
    throw new Error(error);
  }

  const bitmap = await createImageBitmap(file);
  let canvas: HTMLCanvasElement | undefined;

  try {
    const dimensions = getOutputDimensions(
      bitmap.width,
      bitmap.height,
      options.width,
      options.height,
    );

    const format: ImageOutputFormat =
      options.format ??
      (SUPPORTED_IMAGE_TYPES.includes(
        file.type as SupportedImageType,
      )
        ? (file.type as ImageOutputFormat)
        : "image/png");

    const quality = options.quality ?? 0.85;

    if (
      !Number.isFinite(quality) ||
      quality < 0 ||
      quality > 1
    ) {
      throw new Error(
        "Image quality must be between 0 and 1.",
      );
    }

    canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Image processing is not supported by this browser.",
      );
    }

    context.drawImage(
      bitmap,
      0,
      0,
      dimensions.width,
      dimensions.height,
    );

    const blob = await new Promise<Blob>(
      (resolve, reject) => {
        canvas!.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(
                new Error(
                  "Could not create the processed image.",
                ),
              );
            }
          },
          format,
          quality,
        );
      },
    );

    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      format,
      originalBytes: file.size,
      outputBytes: blob.size,
    };
  } finally {
    bitmap.close();

    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
