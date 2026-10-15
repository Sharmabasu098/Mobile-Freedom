import { describe, expect, it, vi } from "vitest";

import {
  processImage,
  validateImageFile,
  SUPPORTED_IMAGE_TYPES,
} from "./imageEngine";

function makeFile(
  name: string,
  type: string,
  content = "image-data",
): File {
  return new File([content], name, { type });
}

describe("Image Engine — file validation", () => {
  it("supports the declared image formats", () => {
    expect(SUPPORTED_IMAGE_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
  });

  it("accepts a valid JPEG image file", () => {
    const file = makeFile("photo.jpg", "image/jpeg");

    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts a valid PNG image file", () => {
    const file = makeFile("photo.png", "image/png");

    expect(validateImageFile(file)).toBeNull();
  });

  it("accepts a valid WebP image file", () => {
    const file = makeFile("photo.webp", "image/webp");

    expect(validateImageFile(file)).toBeNull();
  });

  it("rejects an unsupported file type", () => {
    const file = makeFile("document.pdf", "application/pdf");

    expect(validateImageFile(file)).toContain(
      "Unsupported image format",
    );
  });

  it("rejects an empty file", () => {
    const file = makeFile("empty.jpg", "image/jpeg", "");

    expect(validateImageFile(file)).toBe(
      "The selected file is empty.",
    );
  });
});

describe("Image Engine — error handling", () => {
  it("rejects unsupported files before browser processing", async () => {
    const file = makeFile("document.pdf", "application/pdf");

    await expect(processImage(file)).rejects.toThrow(
      "Unsupported image format",
    );
  });

  it("rejects empty files before browser processing", async () => {
    const file = makeFile("empty.png", "image/png", "");

    await expect(processImage(file)).rejects.toThrow(
      "The selected file is empty.",
    );
  });
});

describe("Image Engine — actual processing behavior", () => {
  function setupBrowserMocks(
    options: {
      width?: number;
      height?: number;
      outputBlob?: Blob;
    } = {},
  ) {
    const bitmap = {
      width: options.width ?? 800,
      height: options.height ?? 600,
      close: vi.fn(),
    };

    const context = {
      drawImage: vi.fn(),
    };

    const outputBlob =
      options.outputBlob ??
      new Blob(["processed-image"], {
        type: "image/webp",
      });

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn(
        (
          callback: BlobCallback,
          type?: string,
        ) => {
          const result = new Blob(
            ["processed-image"],
            { type: type ?? outputBlob.type },
          );

          callback(result);
        },
      ),
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(bitmap),
    );

    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    return { bitmap, canvas, context };
  }

  it("processes an image and reports output details", async () => {
    setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");
    const result = await processImage(file);

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.format).toBe("image/png");
    expect(result.originalBytes).toBe(file.size);
    expect(result.outputBytes).toBeGreaterThan(0);
  });

  it("resizes an image to requested dimensions", async () => {
    const { canvas } = setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");

    const result = await processImage(file, {
      width: 400,
      height: 300,
    });

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("preserves aspect ratio when only width is supplied", async () => {
    setupBrowserMocks({
      width: 800,
      height: 600,
    });

    const file = makeFile("photo.png", "image/png");

    const result = await processImage(file, {
      width: 400,
    });

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it("supports requesting a different output format", async () => {
    setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");

    const result = await processImage(file, {
      format: "image/webp",
      quality: 0.7,
    });

    expect(result.format).toBe("image/webp");
    expect(result.blob.type).toBe("image/webp");
  });

  it("rejects invalid image dimensions", async () => {
    setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");

    await expect(
      processImage(file, { width: 0 }),
    ).rejects.toThrow(
      "Image dimensions must be positive whole numbers.",
    );
  });

  it("rejects invalid quality values", async () => {
    setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");

    await expect(
      processImage(file, { quality: 2 }),
    ).rejects.toThrow(
      "Image quality must be between 0 and 1.",
    );
  });

  it("closes the image bitmap after processing", async () => {
    const { bitmap } = setupBrowserMocks();

    const file = makeFile("photo.png", "image/png");

    await processImage(file);

    expect(bitmap.close).toHaveBeenCalledOnce();
  });
});

describe("Image Engine — robustness and cleanup", () => {
  function setupFailureMocks(
    failure: "no-context" | "no-blob" | "draw-error",
  ) {
    const bitmap = {
      width: 800,
      height: 600,
      close: vi.fn(),
    };

    const context = {
      drawImage: vi.fn(() => {
        if (failure === "draw-error") {
          throw new Error("Canvas drawing failed.");
        }
      }),
    };

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() =>
        failure === "no-context" ? null : context,
      ),
      toBlob: vi.fn((callback: BlobCallback) => {
        callback(
          failure === "no-blob"
            ? null
            : new Blob(["processed"], {
                type: "image/png",
              }),
        );
      }),
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue(bitmap),
    );

    vi.stubGlobal("document", {
      createElement: vi.fn(() => canvas),
    });

    return { bitmap, canvas };
  }

  it("reports an error when Canvas context is unavailable", async () => {
    const { bitmap, canvas } = setupFailureMocks("no-context");

    const file = makeFile("photo.png", "image/png");

    await expect(processImage(file)).rejects.toThrow(
      "Image processing is not supported by this browser.",
    );

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("reports an error when Canvas cannot create an output image", async () => {
    const { bitmap, canvas } = setupFailureMocks("no-blob");

    const file = makeFile("photo.png", "image/png");

    await expect(processImage(file)).rejects.toThrow(
      "Could not create the processed image.",
    );

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("cleans up resources when drawing fails", async () => {
    const { bitmap, canvas } = setupFailureMocks("draw-error");

    const file = makeFile("photo.png", "image/png");

    await expect(processImage(file)).rejects.toThrow(
      "Canvas drawing failed.",
    );

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});
