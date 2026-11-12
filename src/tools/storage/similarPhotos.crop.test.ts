import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  calculateImageDifferenceHash,
  findSimilarPhotos,
  type SimilarPhotoDirectionalDiagnostic,
} from "./similarPhotos";

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
  outputWidth = 9,
  outputHeight = 8,
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      // drawImage accepts fractional source rectangles. Sample each output
      // pixel by its center, then clamp the absolute integer source coordinate
      // so edge-aligned crops never produce a partial/out-of-range RGBA read.
      const absoluteX = Math.max(0, Math.min(
        raster.width - 1,
        Math.floor(sourceX + (x + 0.5) * sourceWidth / outputWidth),
      ));
      const absoluteY = Math.max(0, Math.min(
        raster.height - 1,
        Math.floor(sourceY + (y + 0.5) * sourceHeight / outputHeight),
      ));
      const from = (absoluteY * raster.width + absoluteX) * 4;
      const to = (y * outputWidth + x) * 4;
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
  const portraitCrop = cropRaster(original, 24, 4, 48, 64);
  const landscapeCrop = cropRaster(original, 8, 18, 80, 36);
  const moderateCrop = cropRaster(original, 8, 6, 80, 60);
  const smallResolutionCrop = resizeRaster(centralCrop, 36, 27);
  const highResolutionCrop = resizeRaster(centralCrop, 288, 216);

  return {
    "01_original_scene.png": original,
    "02_crop_25_percent.png": centralCrop,
    "03_crop_50_percent.png": halfCrop,
    "04_crop_left_edge.png": leftCrop,
    "05_crop_right_edge.png": rightCrop,
    "06_resized_crop.png": resizeRaster(centralCrop, 144, 108),
    "07_compressed_crop.jpg": centralCrop,
    "08_brightness_crop.png": cropRaster(original, 12, 9, 72, 54, 0.78),
    "09_unrelated_scene.png": createScene(0x91a7b2c3),
    "10_tiny_detail_crop.png": tinyDetail,
    "19_portrait_crop.png": portraitCrop,
    "20_landscape_crop.png": landscapeCrop,
    "21_moderate_crop.png": moderateCrop,
    "22_small_resolution_crop.png": smallResolutionCrop,
    "23_high_resolution_crop.png": highResolutionCrop,
    // Off-center 65% crop, matching the supplied REAL-02 crop geometry.
    "28_real02_geometry_crop.png": cropRaster(original, 21, 9, 62, 47),
  };
}

/**
 * Browser API mock that preserves actual raster geometry: createImageBitmap
 * resolves each fixture raster, drawImage scales that raster to the
 * production 9×8 canvas, and getImageData returns those sampled pixels.
 */

async function expectPositiveCrop(fileA: string, fileB: string): Promise<void> {
  mockImageDecoding();
  const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
  const errors: Array<{ file: File; error: unknown }> = [];
  const result = await findSimilarPhotos(
    [createImageFile(fileA), createImageFile(fileB)],
    (file, error) => errors.push({ file, error }),
    undefined,
    diagnostic => diagnostics.push(diagnostic),
  );
  if (result.length !== 1 || errors.length > 0) {
    console.error("[M9 POSITIVE CROP DIAGNOSTIC]", JSON.stringify({
      files: [fileA, fileB],
      pairs: result.length,
      errors: errors.map(item => ({ file: item.file.name, error: String(item.error) })),
      directions: diagnostics.map(d => ({
        candidate: d.candidate, source: d.source, thresholds: d.thresholds,
        dHashPass: d.dHashPass, averageHashPass: d.averageHashPass,
        aspectRatioPass: d.aspectRatioPass, pixelPass: d.pixelPass,
        allConditionsPass: d.allConditionsPass,
        independentRegionCount: d.independentRegionCount,
        bestRejectedCandidate: d.bestRejectedCandidate, decision: d.decision,
      })),
    }));
  }
  expect(errors).toHaveLength(0);
  expect(result).toHaveLength(1);

  const acceptedDirections = diagnostics.filter(item => item.decision === "ACCEPT");
  expect(acceptedDirections.length).toBeGreaterThan(0);
  expect(acceptedDirections.every(item =>
    item.independentRegionCount >= item.thresholds.minimumIndependentRegions &&
    item.selectedCandidate !== undefined &&
    item.selectedCandidate.spatialTileMatches >= item.thresholds.minimumSpatialTiles &&
    item.selectedCandidate.spatialTileRows === 2 &&
    item.selectedCandidate.spatialTileColumns >= 2
  )).toBe(true);
}

function mockImageDecoding(fixtures = createFixtures()): void {
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
          canvas.width,
          canvas.height,
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


/**
 * Two independently generated scenes with the same whole-image dHash.
 * Values at the exact 9×8 whole-image sampling coordinates are identical,
 * while pixels between those anchors use opposite deterministic patterns.
 * This creates a controlled dHash collision without making one image a
 * crop, resize, or edit of the other.
 */
function createWholeImageDHashCollisionFixtures(): Record<string, Raster> {
  const width = SOURCE_WIDTH;
  const height = SOURCE_HEIGHT;
  const anchorX = Array.from({ length: 9 }, (_, x) =>
    Math.floor(x * width / 9),
  );
  const anchorY = Array.from({ length: 8 }, (_, y) =>
    Math.floor(y * height / 8),
  );

  const build = (reverse: boolean): Raster => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const anchors = new Set(anchorX);
    for (let y = 0; y < height; y += 1) {
      const row = anchorY.indexOf(y);
      for (let x = 0; x < width; x += 1) {
        const leftAnchor = anchorX.reduce((best, value) =>
          value <= x && value > best ? value : best, 0);
        const rightAnchor = anchorX.find(value => value > x) ?? width - 1;
        const segment = Math.max(1, rightAnchor - leftAnchor);
        const offset = x - leftAnchor;
        const phase = (row < 0 ? y : row) * 29 + anchorX.indexOf(leftAnchor) * 17;
        const wave = Math.round((offset / segment) * 180);
        const value = anchors.has(x)
          ? 35 + ((row < 0 ? y : row) * 23) % 180
          : Math.max(0, Math.min(255,
              35 + ((row < 0 ? y : row) * 23) % 180 +
              (reverse ? 180 - wave : wave) * (phase % 2 === 0 ? 1 : -1),
            ));
        const index = (y * width + x) * 4;
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
        pixels[index + 3] = 255;
      }
    }
    return { width, height, pixels };
  };

  return {
    "11_collision_scene_a.png": build(false),
    "12_collision_scene_b.png": build(true),
  };
}

/**
 * Adds the same compact, high-contrast synthetic logo to unrelated scenes.
 * The logo is deliberately small relative to the full image.
 */
function createLogoScene(seed: number, x: number, y: number, size: number): Raster {
  const raster = createScene(seed);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const border = row === 0 || column === 0 || row === size - 1 || column === size - 1;
      const diagonal = column === row || column === size - row - 1;
      const value = border ? 245 : diagonal ? 18 : ((row + column) % 2 === 0 ? 210 : 45);
      const px = x + column;
      const py = y + row;
      if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) continue;
      const offset = (py * raster.width + px) * 4;
      raster.pixels[offset] = value;
      raster.pixels[offset + 1] = value;
      raster.pixels[offset + 2] = value;
      raster.pixels[offset + 3] = 255;
    }
  }
  return raster;
}

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

  it("rejects unrelated scenes even when their whole-image dHashes are identical (A7)", async () => {
    const collisionFixtures = createWholeImageDHashCollisionFixtures();
    mockImageDecoding(collisionFixtures);

    const first = createImageFile("11_collision_scene_a.png");
    const second = createImageFile("12_collision_scene_b.png");
    const firstHash = await calculateImageDifferenceHash(first);
    const secondHash = await calculateImageDifferenceHash(second);

    // Mandatory precondition: this test must exercise a real whole-image dHash collision.
    expect(firstHash).toBe(secondHash);

    const errors: Array<{ file: File; error: unknown }> = [];
    const result = await findSimilarPhotos(
      [first, second],
      (file, error) => errors.push({ file, error }),
    );

    expect(errors).toHaveLength(0);
    expect(result).toHaveLength(0);
  });

  it("rejects unrelated scenes containing the same small logo at the same position (HN-02-L1)", async () => {
    const fixtures = {
      "13_logo_scene_a.png": createLogoScene(0x13572468, 42, 30, 10),
      "14_logo_scene_b.png": createLogoScene(0x24681357, 42, 30, 10),
    };
    mockImageDecoding(fixtures);
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [createImageFile("13_logo_scene_a.png"), createImageFile("14_logo_scene_b.png")],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );
    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every(item => item.decision === "REJECT" && item.allConditionsPass === 0)).toBe(true);
  });

  it("rejects unrelated scenes containing the same small logo at different positions (HN-02-L2)", async () => {
    const fixtures = {
      "15_logo_left.png": createLogoScene(0x31415926, 8, 8, 10),
      "16_logo_right.png": createLogoScene(0x27182818, 76, 54, 10),
    };
    mockImageDecoding(fixtures);
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [createImageFile("15_logo_left.png"), createImageFile("16_logo_right.png")],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );
    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every(item => item.decision === "REJECT" && item.allConditionsPass === 0)).toBe(true);
  });

  it("rejects the same small logo embedded in unrelated scenes at a second scale and offset (HN-02-L4)", async () => {
    const fixtures = {
      "24_logo_scene_a.png": createLogoScene(0x76543210, 18, 42, 9),
      "25_logo_scene_b.png": createLogoScene(0x89abcdef, 62, 12, 11),
    };
    mockImageDecoding(fixtures);
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [createImageFile("24_logo_scene_a.png"), createImageFile("25_logo_scene_b.png")],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );
    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every(item => item.decision === "REJECT" && item.allConditionsPass === 0)).toBe(true);
  });

  it("rejects unrelated scenes containing the same logo at different scales (HN-02-L3)", async () => {
    const fixtures = {
      "17_logo_small.png": createLogoScene(0x10293847, 40, 28, 8),
      "18_logo_large.png": createLogoScene(0x56473829, 38, 26, 14),
    };
    mockImageDecoding(fixtures);
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [createImageFile("17_logo_small.png"), createImageFile("18_logo_large.png")],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );
    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every(item => item.decision === "REJECT" && item.allConditionsPass === 0)).toBe(true);
  });

  it("rejects low-resolution unrelated scenes that share a small logo (HN-02-L5)", async () => {
    const fixtures = {
      "26_lowres_logo_scene_a.png": resizeRaster(createLogoScene(0x10203040, 18, 20, 8), 48, 36),
      "27_lowres_logo_scene_b.png": resizeRaster(createLogoScene(0x50607080, 18, 20, 8), 48, 36),
    };
    mockImageDecoding(fixtures);
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [createImageFile("26_lowres_logo_scene_a.png"), createImageFile("27_lowres_logo_scene_b.png")],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );
    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every(item => item.decision === "REJECT" && item.allConditionsPass === 0)).toBe(true);
  });

  it("keeps an unrelated generated scene separate", async () => {
    mockImageDecoding();

    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("09_unrelated_scene.png"),
    ]);

    expect(result).toHaveLength(0);
  });

  it("guards browser False Positive FP-01: original scene vs unrelated control", async () => {
    mockImageDecoding();
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [
        createImageFile("01_original_scene.png"),
        createImageFile("09_unrelated_scene.png"),
      ],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );

    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map(item => item.decision)).toEqual(["REJECT", "REJECT"]);
    expect(diagnostics.every(item => item.allConditionsPass === 0)).toBe(true);
    expect(diagnostics.every(item => item.thresholds.normalizedPixelMae === 0.06)).toBe(true);
    expect(diagnostics.some(item => item.pixelFail > 0)).toBe(true);
  });

  it("guards browser False Positive FP-02: genuine center crop vs unrelated control", async () => {
    mockImageDecoding();
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];
    const result = await findSimilarPhotos(
      [
        createImageFile("02_crop_25_percent.png"),
        createImageFile("09_unrelated_scene.png"),
      ],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );

    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map(item => item.decision)).toEqual(["REJECT", "REJECT"]);
    expect(diagnostics.every(item => item.allConditionsPass === 0)).toBe(true);
    expect(diagnostics.every(item => item.thresholds.normalizedPixelMae === 0.06)).toBe(true);
    expect(diagnostics.some(item => item.pixelFail > 0)).toBe(true);
  });

  it("reports the pair-level area rejection for a tiny detail crop", async () => {
    mockImageDecoding();
    const diagnostics: SimilarPhotoDirectionalDiagnostic[] = [];

    const result = await findSimilarPhotos(
      [
        createImageFile("01_original_scene.png"),
        createImageFile("10_tiny_detail_crop.png"),
      ],
      undefined,
      undefined,
      diagnostic => diagnostics.push(diagnostic),
    );

    expect(result).toHaveLength(0);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map(item => item.earlyRejectionReason)).toEqual([
      "IMAGE_AREA_RATIO_BELOW_MINIMUM",
      "IMAGE_AREA_RATIO_BELOW_MINIMUM",
    ]);
    expect(diagnostics.every(item => item.decision === "REJECT")).toBe(true);
    expect(diagnostics.every(item => item.totalGeneratedRegions === 0)).toBe(true);
    expect(diagnostics.every(item => item.imageAreaRatio === 0.01447)).toBe(true);
  });

  // Positive crop regression cases: these must pass before M9 can advance.
  it("detects the original against a genuine 25% crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "02_crop_25_percent.png");
  });

  it("detects the original against a genuine 50% crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "03_crop_50_percent.png");
  });

  it("detects a genuine left-edge crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "04_crop_left_edge.png");
  });

  it("detects a genuine right-edge crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "05_crop_right_edge.png");
  });

  it("detects a resized genuine crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "06_resized_crop.png");
  });

  it("processes a genuine crop supplied with JPEG MIME type", async () => {
    await expectPositiveCrop("07_compressed_crop.jpg", "01_original_scene.png");
  });

  it("detects a brightness-adjusted genuine crop", async () => {
    await expectPositiveCrop("01_original_scene.png", "08_brightness_crop.png");
  });

  // Crop geometry matrix: each crop is copied from the same parent raster.
  it.each([
    ["portrait crop", "19_portrait_crop.png"],
    ["landscape crop", "20_landscape_crop.png"],
    ["moderate crop", "21_moderate_crop.png"],
    ["small-resolution crop", "22_small_resolution_crop.png"],
    ["high-resolution crop", "23_high_resolution_crop.png"],
  ])("detects a genuine %s", async (_label, cropFile) => {
    await expectPositiveCrop("01_original_scene.png", cropFile);
  });

  it("detects an off-center 65% crop using REAL-02 geometry (R02-GEO)", async () => {
    await expectPositiveCrop("01_original_scene.png", "28_real02_geometry_crop.png");
  });
});
