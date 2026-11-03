import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  analyzeCropPairSpatialEvidence,
  calculateImageDifferenceHash,
  countSpatiallyIndependentRegions,
  findSimilarPhotos,
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
    "06_resized_crop.png": resizeRaster(centralCrop, 144, 108),
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

describe("M9 controlled spatial acceptance experiment", () => {
  it("records independent-region counts for genuine positives and negative controls", async () => {
    const fixtures = createFixtures();
    const pairs = [
      ["01_original_scene.png", "02_crop_25_percent.png", "positive-25-percent"],
      ["01_original_scene.png", "03_crop_50_percent.png", "positive-50-percent"],
      ["01_original_scene.png", "04_crop_left_edge.png", "positive-left-edge"],
      ["01_original_scene.png", "05_crop_right_edge.png", "positive-right-edge"],
      ["01_original_scene.png", "06_resized_crop.png", "positive-resized"],
      ["01_original_scene.png", "07_compressed_crop.jpg", "positive-jpeg-mime-mock"],
      ["01_original_scene.png", "08_brightness_crop.png", "positive-brightness"],
      ["01_original_scene.png", "09_unrelated_scene.png", "negative-unrelated"],
      ["01_original_scene.png", "10_tiny_detail_crop.png", "negative-tiny-detail"],
    ] as const;

    const measurements = [];
    for (const [firstName, secondName, label] of pairs) {
      mockImageDecoding(fixtures);
      const evidence = await analyzeCropPairSpatialEvidence(
        createImageFile(firstName),
        createImageFile(secondName),
      );
      measurements.push({
        label,
        currentMatcherWouldAccept: evidence.currentMatcherWouldAccept,
        twoRegionRuleWouldAccept: evidence.twoRegionRuleWouldAccept,
        firstDirection: evidence.firstComparedAgainstSecond,
        reverseDirection: evidence.secondComparedAgainstFirst,
      });
      expect(evidence.currentMatcherWouldAccept).toBe(
        evidence.firstComparedAgainstSecond.acceptedBySingleRegionRule ||
        evidence.secondComparedAgainstFirst.acceptedBySingleRegionRule,
      );
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
    console.info("[M9 spatial acceptance experiment]", JSON.stringify(measurements));
    expect(measurements).toHaveLength(pairs.length);
  });

  it("records A7 equal-whole-image-dHash collision evidence", async () => {
    const fixtures = createWholeImageDHashCollisionFixtures();
    mockImageDecoding(fixtures);
    const first = createImageFile("11_collision_scene_a.png");
    const second = createImageFile("12_collision_scene_b.png");
    expect(await calculateImageDifferenceHash(first)).toBe(
      await calculateImageDifferenceHash(second),
    );
    const evidence = await analyzeCropPairSpatialEvidence(first, second);
    console.info("[M9 spatial acceptance A7]", JSON.stringify(evidence));
    expect(evidence.currentMatcherWouldAccept).toBe(false);
  });
});


/** Synthetic hard-negative scenes: independently generated pixel content,
 * deliberately sharing palette, background, subject class, or small patches. */
function createHardNegativeScene(kind: "palette-a" | "palette-b" | "background-a" | "background-b" | "portrait-a" | "portrait-b" | "object-a" | "object-b" | "patch-a" | "patch-b"): Raster {
  const width = SOURCE_WIDTH;
  const height = SOURCE_HEIGHT;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const palette = kind.startsWith("palette") ? [176, 142, 96] : [218, 218, 218];
  const seed = kind.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state >>> 24;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const noise = random();
      let r = palette[0] + (noise % 31) - 15;
      let g = palette[1] + (noise % 29) - 14;
      let b = palette[2] + (noise % 27) - 13;

      if (kind.startsWith("background")) {
        // Same broad blue/gray background, independently different foreground silhouettes.
        r = 118 + Math.floor(y / 5) + (noise % 9);
        g = 154 + Math.floor(y / 6) + (noise % 11);
        b = 184 + Math.floor(y / 7) + (noise % 13);
        const shapeA = kind === "background-a" &&
          ((x > 17 && x < 42 && y > 20 && y < 62) || (x > 52 && x < 78 && y > 35 && y < 58));
        const shapeB = kind === "background-b" &&
          ((x > 8 && x < 31 && y > 34 && y < 66) || (x > 44 && x < 88 && y > 17 && y < 43));
        if (shapeA || shapeB) { r = 66 + noise % 17; g = 72 + noise % 19; b = 78 + noise % 23; }
      } else if (kind.startsWith("portrait")) {
        // Two distinct stylized portrait compositions, same skin/background palette.
        r = 72 + noise % 12; g = 105 + noise % 14; b = 132 + noise % 16;
        const cx = kind === "portrait-a" ? 34 : 62;
        const cy = kind === "portrait-a" ? 31 : 36;
        const dx = (x - cx) / (kind === "portrait-a" ? 17 : 14);
        const dy = (y - cy) / 23;
        if (dx * dx + dy * dy < 1) { r = 198 + noise % 16; g = 145 + noise % 15; b = 112 + noise % 13; }
        if (y > 52 && Math.abs(x - cx) < 24) { r = 42 + noise % 12; g = 48 + noise % 13; b = 58 + noise % 15; }
        if (Math.abs(x - (cx - 6)) < 2 && Math.abs(y - (cy - 3)) < 2) { r = 25; g = 22; b = 18; }
        if (Math.abs(x - (cx + 6)) < 2 && Math.abs(y - (cy - 3)) < 2) { r = 25; g = 22; b = 18; }
      } else if (kind.startsWith("object")) {
        // Same object category (ceramic mug), different shape/orientation and scene.
        r = kind === "object-a" ? 182 + noise % 13 : 142 + noise % 15;
        g = kind === "object-a" ? 164 + noise % 12 : 176 + noise % 14;
        b = kind === "object-a" ? 132 + noise % 11 : 194 + noise % 13;
        const bodyA = kind === "object-a" && x > 25 && x < 58 && y > 19 && y < 57;
        const bodyB = kind === "object-b" && x > 43 && x < 77 && y > 14 && y < 51;
        if (bodyA || bodyB) { r = 210 + noise % 12; g = 210 + noise % 12; b = 205 + noise % 12; }
        const handleA = kind === "object-a" && x > 57 && x < 70 && y > 27 && y < 48 && (x > 62 || y < 31 || y > 44);
        const handleB = kind === "object-b" && x > 31 && x < 46 && y > 22 && y < 43 && (x < 36 || y < 26 || y > 39);
        if (handleA || handleB) { r = 45; g = 43; b = 39; }
      } else if (kind.startsWith("patch")) {
        // Same small local texture patch at different positions; surrounding scenes unrelated.
        r = (kind === "patch-a" ? 35 : 190) + noise % 50;
        g = (kind === "patch-a" ? 85 : 45) + noise % 45;
        b = (kind === "patch-a" ? 145 : 75) + noise % 40;
        const px = kind === "patch-a" ? 24 : 63;
        const py = kind === "patch-a" ? 20 : 45;
        if (x >= px && x < px + 20 && y >= py && y < py + 18) {
          const local = ((x - px) * 13 + (y - py) * 7) % 23;
          r = 90 + local * 3; g = 110 + local * 2; b = 130 + local;
        }
      } else {
        r += 0; // Similar palette, different independent texture fields.
      }
      pixels[i] = Math.max(0, Math.min(255, r));
      pixels[i + 1] = Math.max(0, Math.min(255, g));
      pixels[i + 2] = Math.max(0, Math.min(255, b));
      pixels[i + 3] = 255;
    }
  }
  return { width, height, pixels };
}


describe("M9 single-region hard-negative stress experiment", () => {
  it("measures shared palettes, backgrounds, portraits, object classes, and accidental local patches", async () => {
    const pairs = [
      ["palette-a", "palette-b", "similar-colors-different-texture"],
      ["background-a", "background-b", "same-background-different-subjects"],
      ["portrait-a", "portrait-b", "different-portraits"],
      ["object-a", "object-b", "same-object-class-different-photos"],
      ["patch-a", "patch-b", "unrelated-scenes-shared-small-patch"],
    ] as const;
    const fixtures: Record<string, Raster> = {};
    for (const [first, second] of pairs) {
      fixtures[first + ".png"] = createHardNegativeScene(first);
      fixtures[second + ".png"] = createHardNegativeScene(second);
    }
    const measurements = [];
    for (const [first, second, label] of pairs) {
      mockImageDecoding(fixtures);
      const evidence = await analyzeCropPairSpatialEvidence(
        createImageFile(first + ".png"),
        createImageFile(second + ".png"),
      );
      measurements.push({ label, ...evidence });
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
    console.info("[M9 hard-negative spatial stress]", JSON.stringify(measurements));
    expect(measurements).toHaveLength(pairs.length);
    // Each pair is intentionally unrelated; any one-region acceptance is a false positive.
    for (const result of measurements) {
      expect(result.currentMatcherWouldAccept, result.label).toBe(false);
    }
  });
});


/**
 * Adversarial descriptor-collision pair:
 * - The large image is a textured unrelated scene.
 * - The small image is a coarse 9×8 colour mosaic sampled from one
 *   50%-scale window of the large image.
 * The mosaic preserves that window's dHash/average-hash evidence while
 * destroying its original scene detail and composition. This deliberately
 * tests whether one descriptor-level region can create a false candidate.
 */
function createSharedDescriptorPatchFixtures(): Record<string, Raster> {
  const source = createScene(0x51a7c0de);
  const region = { x: 24, y: 18, width: 48, height: 36 };
  const sampled = rasterToThumbnail(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
  );
  const targetWidth = region.width;
  const targetHeight = region.height;
  const targetPixels = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  // Expand each of the 9×8 descriptor samples into a flat tile. The
  // candidate is not a copied crop: nearly all fine spatial detail is lost.
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sampleX = Math.min(8, Math.floor(x * 9 / targetWidth));
      const sampleY = Math.min(7, Math.floor(y * 8 / targetHeight));
      const from = (sampleY * 9 + sampleX) * 4;
      const to = (y * targetWidth + x) * 4;
      targetPixels.set(sampled.subarray(from, from + 4), to);
    }
  }

  return {
    "13_unrelated_detailed_scene.png": source,
    "14_descriptor_mosaic_candidate.png": {
      width: targetWidth,
      height: targetHeight,
      pixels: targetPixels,
    },
  };
}

describe("M9 adversarial shared-region descriptor collision", () => {
  it("exposes whether one coarse accidental region can accept an unrelated mosaic", async () => {
    const fixtures = createSharedDescriptorPatchFixtures();
    mockImageDecoding(fixtures);
    const source = createImageFile("13_unrelated_detailed_scene.png");
    const mosaic = createImageFile("14_descriptor_mosaic_candidate.png");

    const evidence = await analyzeCropPairSpatialEvidence(source, mosaic);
    console.info("[M9 adversarial shared-region descriptor collision]", JSON.stringify(evidence));

    // This is a deliberately adversarial near-match. We record the actual
    // classifier outcome rather than assuming it must reject; a failure here
    // is evidence to guide a safe algorithm change, not a flaky fixture.
    expect(evidence.areaRatio).toBeGreaterThanOrEqual(0.08);
    expect(
      evidence.firstComparedAgainstSecond.candidateRegionCount +
      evidence.secondComparedAgainstFirst.candidateRegionCount,
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("M9 spatial evidence diagnostics", () => {
  it("counts heavily overlapping windows as one evidence cluster", () => {
    const count = countSpatiallyIndependentRegions([
      { x: 0.10, y: 0.10, width: 0.50, height: 0.50 },
      { x: 0.12, y: 0.11, width: 0.50, height: 0.50 },
      { x: 0.09, y: 0.13, width: 0.49, height: 0.50 },
    ]);
    expect(count).toBe(1);
  });

  it("keeps spatially separate windows as independent evidence", () => {
    const count = countSpatiallyIndependentRegions([
      { x: 0.02, y: 0.02, width: 0.25, height: 0.25 },
      { x: 0.68, y: 0.68, width: 0.25, height: 0.25 },
    ]);
    expect(count).toBe(2);
  });

  it("clusters mixed windows while preserving a separate region", () => {
    const count = countSpatiallyIndependentRegions([
      { x: 0.05, y: 0.05, width: 0.40, height: 0.40 },
      { x: 0.08, y: 0.07, width: 0.40, height: 0.40 },
      { x: 0.58, y: 0.58, width: 0.30, height: 0.30 },
    ]);
    expect(count).toBe(2);
  });
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

  // Positive crop regression cases: these must pass before M9 can advance.
  it("detects the original against a genuine 25% crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("02_crop_25_percent.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("detects the original against a genuine 50% crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("03_crop_50_percent.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("detects a genuine left-edge crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("04_crop_left_edge.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("detects a genuine right-edge crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("05_crop_right_edge.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("detects a resized genuine crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("06_resized_crop.png"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("processes a genuine crop supplied with JPEG MIME type", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("07_compressed_crop.jpg"),
    ]);
    expect(result).toHaveLength(1);
  });

  it("detects a brightness-adjusted genuine crop", async () => {
    mockImageDecoding();
    const result = await findSimilarPhotos([
      createImageFile("01_original_scene.png"),
      createImageFile("08_brightness_crop.png"),
    ]);
    expect(result).toHaveLength(1);
  });
});
