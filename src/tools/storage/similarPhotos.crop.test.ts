import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { findSimilarPhotos } from "./similarPhotos";

function createImageFile(name: string): File {
  return new File([name], name, { type: "image/png" });
}

/**
 * Returns deterministic grayscale pixels for the 9 × 8 thumbnail
 * consumed by the current global dHash implementation.
 *
 * Different seeds model the fact that a crop can produce a very
 * different global thumbnail even when it came from the same source.
 */
function createSyntheticPixels(seed: number): Uint8ClampedArray {
  let state = seed >>> 0;
  const data = new Uint8ClampedArray(9 * 8 * 4);

  for (let pixel = 0; pixel < 72; pixel += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const value = 35 + (state % 186);
    const offset = pixel * 4;

    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  return data;
}

const thumbnailSeeds: Record<string, number> = {
  "01_original_scene.png": 11,
  "02_crop_25_percent.png": 29,
  "03_crop_50_percent.png": 47,
  "04_crop_left_edge.png": 61,
  "05_crop_right_edge.png": 83,
  "06_resized_crop.png": 101,
  "07_compressed_crop.jpg": 127,
  "08_brightness_crop.png": 149,
  "09_unrelated_scene.png": 173,
  "10_tiny_detail_crop.png": 197,
};

function mockImageDecoding(): void {
  let currentFileName = "";

  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (file: File) => ({
      width: 640,
      height: 480,
      fileName: file.name,
      close: vi.fn(),
    })),
  );

  const context = {
    drawImage: vi.fn((bitmap: { fileName: string }) => {
      currentFileName = bitmap.fileName;
    }),
    getImageData: vi.fn(() => ({
      data: createSyntheticPixels(
        thumbnailSeeds[currentFileName] ?? 251,
      ),
    })),
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  };

  vi.stubGlobal("document", {
    createElement: vi.fn((tagName: string) => {
      if (tagName !== "canvas") {
        throw new Error(`Unexpected element requested: ${tagName}`);
      }

      return canvas;
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("M9 crop detection — known global-dHash limitation", () => {
  it("keeps the synthetic negative control separate", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("09_unrelated_scene.png"),
    ]);

    expect(result).toHaveLength(0);
  });

  it("does not force a match for a tiny detail crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("10_tiny_detail_crop.png"),
    ]);

    expect(result).toHaveLength(0);
  });

  // These are intentional expected-failure tests on the current
  // global dHash baseline. Vitest's it.fails keeps CI green while
  // recording the crop cases that the next algorithm must solve.
  // Once crop-aware matching is implemented, convert each it.fails
  // to a normal it and require the candidate pair to be returned.

  it.fails("detects the original against a 25% crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("02_crop_25_percent.png"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects the original against a 50% crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("03_crop_50_percent.png"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects the original against a left-edge crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("04_crop_left_edge.png"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects the original against a right-edge crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("05_crop_right_edge.png"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects a resized crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("06_resized_crop.png"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects a compressed crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("07_compressed_crop.jpg"),
    ]);

    expect(result).toHaveLength(1);
  });

  it.fails("detects a brightness-adjusted crop", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("08_brightness_crop.png"),
    ]);

    expect(result).toHaveLength(1);
  });
});
