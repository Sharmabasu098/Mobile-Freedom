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
