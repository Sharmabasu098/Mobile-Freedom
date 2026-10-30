import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { findSimilarPhotos } from "./similarPhotos";

const SOURCE_WIDTH = 96;
const SOURCE_HEIGHT = 72;

type Raster = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

function createImageFile(name: string): File {
  return new File([name], name, {
    type: name.endsWith(".jpg") ? "image/jpeg" : "image/png",
  });
}

/**
 * Deterministic textured scene. Every pixel is generated from its
 * absolute source coordinate, so a crop is copied from the real
 * parent raster rather than assigned an unrelated thumbnail seed.
 */
function createScene(seed: number): Raster {
  const pixels = new Uint8ClampedArray(
    SOURCE_WIDTH * SOURCE_HEIGHT * 4,
  );

  let state = seed >>> 0;
  const noise = new Uint8Array(SOURCE_WIDTH * SOURCE_HEIGHT);

  for (let index = 0; index < noise.length; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    noise[index] = state >>> 24;
  }

  for (let y = 0; y < SOURCE_HEIGHT; y += 1) {
    for (let x = 0; x < SOURCE_WIDTH; x += 1) {
      const index = (y * SOURCE_WIDTH + x) * 4;
      const texture = noise[y * SOURCE_WIDTH + x];
      const broadShape =
        Math.sin(x / 8) * 34 +
        Math.cos(y / 7) * 28 +
        (x > 20 && x < 74 && y > 14 && y < 59 ? 48 : 0);
      const value = Math.max(
        0,
        Math.min(255, Math.round(112 + broadShape + (texture - 128) * 0.38)),
      );

      pixels[index] = value;
      pixels[index + 1] = value;
      pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
  }

  return { width: SOURCE_WIDTH, height: SOURCE_HEIGHT, pixels };
}

/** Copy a genuine rectangular region from the source raster. */
function cropRaster(
  source: Raster,
  x: number,
  y: number,
  width: number,
  height: number,
  brightness = 1,
): Raster {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const sourceOffset =
        ((y + row) * source.width + x + column) * 4;
      const targetOffset = (row * width + column) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[targetOffset + channel] = Math.max(
          0,
          Math.min(255, Math.round(source.pixels[sourceOffset + channel] * brightness)),
        );
      }
      pixels[targetOffset + 3] = 255;
    }
  }

  return { width, height, pixels };
}

function resizeRaster(source: Raster, width: number, height: number): Raster {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x * source.width / width));
      const sourceY = Math.min(source.height - 1, Math.floor(y * source.height / height));
      const from = (sourceY * source.width + sourceX) * 4;
      const to = (y * width + x) * 4;
      pixels.set(source.pixels.subarray(from, from + 4), to);
    }
  }

  return { width, height, pixels };
}

function rasterToThumbnail(
  raster: Raster,
  sourceX = 0,
  sourceY = 0,
  sourceWidth = raster.width,
  sourceHeight = raster.height,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(9 * 8 * 4);

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const localX = Math.min(
        sourceWidth - 1,
        Math.floor(x * sourceWidth / 9),
      );
      const localY = Math.min(
        sourceHeight - 1,
        Math.floor(y * sourceHeight / 8),
      );
      const from = (
        (sourceY + localY) * raster.width + sourceX + localX
      ) * 4;
      const to = (y * 9 + x) * 4;
      output.set(raster.pixels.subarray(from, from + 4), to);
    }
  }

  return output;
}

function createFixtures(): Record<string, Raster> {
  const original = createScene(0x4d394d39);
  const centralCrop = cropRaster(original, 12, 9, 72, 54);
  const halfCrop = cropRaster(original, 24, 18, 48, 36);
  const leftCrop = cropRaster(original, 0, 8, 58, 56);
  const rightCrop = cropRaster(original, 38, 8, 58, 56);
  const tinyDetail = cropRaster(original, 43, 30, 10, 10);

  return {
    "01_original_scene.png": original,
    "02_crop_25_percent.png": centralCrop,
    "03_crop_50_percent.png": halfCrop,
    "04_crop_left_edge.png": leftCrop,
    "05_crop_right_edge.png": rightCrop,
    "06_resized_crop.png": resizeRaster(centralCrop, 120, 90),
    "07_compressed_crop.jpg": centralCrop,
    "08_brightness_crop.png": cropRaster(original, 12, 9, 72, 54, 0.78),
    "09_unrelated_scene.png": createScene(0x91a7b2c3),
    "10_tiny_detail_crop.png": tinyDetail,
  };
}

/**
 * Browser API mock that preserves actual raster geometry: createImageBitmap
 * resolves each fixture raster, drawImage scales that raster to the
 * production 9×8 canvas, and getImageData returns those sampled pixels.
 */
function mockImageDecoding(): void {
  const fixtures = createFixtures();
  let activeRaster: Raster | undefined;
  let activeRegion = { x: 0, y: 0, width: 0, height: 0 };

  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (file: File) => {
      const raster = fixtures[file.name];
      if (!raster) {
        throw new Error(`Missing pixel fixture for ${file.name}`);
      }

      return {
        width: raster.width,
        height: raster.height,
        raster,
        close: vi.fn(),
      };
    }),
  );

  const context = {
    drawImage: vi.fn((...args: unknown[]) => {
      const bitmap = args[0] as { raster: Raster };
      activeRaster = bitmap.raster;

      if (args.length === 9) {
        activeRegion = {
          x: Number(args[1]),
          y: Number(args[2]),
          width: Number(args[3]),
          height: Number(args[4]),
        };
      } else {
        activeRegion = {
          x: 0,
          y: 0,
          width: activeRaster.width,
          height: activeRaster.height,
        };
      }
    }),
    getImageData: vi.fn(() => {
      if (!activeRaster) {
        throw new Error("drawImage must run before getImageData");
      }
      return {
        data: rasterToThumbnail(
          activeRaster,
          activeRegion.x,
          activeRegion.y,
          activeRegion.width,
          activeRegion.height,
        ),
      };
    }),
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

describe("M9 crop detection — real pixel-geometry fixtures", () => {
  it("builds crop fixtures from copied regions of the same source raster", () => {
    const fixtures = createFixtures();
    const original = fixtures["01_original_scene.png"];
    const crop = fixtures["02_crop_25_percent.png"];

    expect(original.width).toBe(SOURCE_WIDTH);
    expect(original.height).toBe(SOURCE_HEIGHT);
    expect(crop.width).toBe(72);
    expect(crop.height).toBe(54);

    // The crop's top-left pixel must equal the corresponding source pixel.
    expect(Array.from(crop.pixels.slice(0, 4))).toEqual(
      Array.from(original.pixels.slice((9 * SOURCE_WIDTH + 12) * 4, (9 * SOURCE_WIDTH + 12) * 4 + 4)),
    );
  });

  it("keeps an unrelated generated scene separate", async () => {
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

  // These expected failures document the current global-dHash limitation.
  // Once crop-aware matching is implemented, replace it.fails with it.
  it.fails("detects the original against a genuine 25% crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("02_crop_25_percent.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("detects the original against a genuine 50% crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("03_crop_50_percent.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("detects a genuine left-edge crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("04_crop_left_edge.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("detects a genuine right-edge crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("05_crop_right_edge.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("detects a resized genuine crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("06_resized_crop.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("processes a genuine crop supplied with JPEG MIME type", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("07_compressed_crop.jpg"),
    ]);
    expect(result).toHaveLength(1);
  });

  it.fails("detects a brightness-adjusted genuine crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("08_brightness_crop.png"),
    ]);
    expect(result).toHaveLength(1);
  });
});
