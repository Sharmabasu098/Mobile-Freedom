import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  calculateDifferenceHashFromPixels,
  calculateHashDistance,
  calculateImageDifferenceHash,
  findSimilarPhotos,
  MAX_SIMILARITY_FILE_SIZE_BYTES,
} from "./similarPhotos";

function createImageFile(
  name: string,
  type = "image/png",
  content = "test image",
): File {
  return new File([content], name, { type });
}

function createPixelData(
  reverse = false,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(9 * 8 * 4);

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const index = (y * 9 + x) * 4;

      const brightness = reverse
        ? (8 - x) * 28
        : x * 28;

      data[index] = brightness;
      data[index + 1] = brightness;
      data[index + 2] = brightness;
      data[index + 3] = 255;
    }
  }

  return data;
}

/**
 * Mocks browser image decoding and canvas processing.
 * These tests verify the algorithm and integration,
 * not the accuracy of real photographs.
 */
function mockImageDecoding(): void {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async (file: File) => ({
      width: 100,
      height: 100,
      source: file,
      close: vi.fn(),
    })),
  );

  const context = {
    drawImage: vi.fn(),

    getImageData: vi.fn(() => ({
      data: createPixelData(),
    })),
  };

  const canvas = document.createElement("canvas");
  const canvasPrototype = Object.getPrototypeOf(canvas);

  vi.spyOn(
    canvasPrototype,
    "getContext",
  ).mockImplementation(
    (() => context) as unknown as
      typeof canvas.getContext,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("calculateDifferenceHashFromPixels", () => {
  it("creates a valid 64-bit binary hash", () => {
    const pixels = Array.from(
      { length: 72 },
      (_, index) => index % 9,
    );

    const hash = calculateDifferenceHashFromPixels(pixels);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[01]{64}$/);
  });

  it("returns zeros when adjacent pixels increase", () => {
    const row = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const pixels = Array.from(
      { length: 8 },
      () => row,
    ).flat();

    expect(calculateDifferenceHashFromPixels(pixels))
      .toBe("0".repeat(64));
  });

  it("returns ones when adjacent pixels decrease", () => {
    const row = [90, 80, 70, 60, 50, 40, 30, 20, 10];
    const pixels = Array.from(
      { length: 8 },
      () => row,
    ).flat();

    expect(calculateDifferenceHashFromPixels(pixels))
      .toBe("1".repeat(64));
  });

  it("rejects an incorrect pixel count", () => {
    expect(() =>
      calculateDifferenceHashFromPixels([1, 2, 3]),
    ).toThrow(/exactly 72 grayscale pixels/i);
  });

  it("rejects incorrect dimensions", () => {
    expect(() =>
      calculateDifferenceHashFromPixels(
        new Array(72).fill(100),
        8,
        8,
      ),
    ).toThrow(/exactly 72 grayscale pixels/i);
  });
});

describe("calculateHashDistance", () => {
  it("returns zero for identical hashes", () => {
    const hash = "0".repeat(64);

    expect(calculateHashDistance(hash, hash)).toBe(0);
  });

  it("returns 64 for completely different hashes", () => {
    expect(
      calculateHashDistance(
        "0".repeat(64),
        "1".repeat(64),
      ),
    ).toBe(64);
  });

  it("counts differing bits correctly", () => {
    const first = "0".repeat(64);
    const second = "1".repeat(5) + "0".repeat(59);

    expect(calculateHashDistance(first, second)).toBe(5);
  });

  it("rejects hashes with an invalid length", () => {
    expect(() =>
      calculateHashDistance("000", "000"),
    ).toThrow(/exactly 64 binary digits/i);
  });

  it("rejects non-binary hash characters", () => {
    expect(() =>
      calculateHashDistance(
        "0".repeat(63) + "x",
        "0".repeat(64),
      ),
    ).toThrow(/exactly 64 binary digits/i);
  });
});

describe("calculateImageDifferenceHash", () => {
  it("rejects an empty image", async () => {
    const file = createImageFile(
      "empty.png",
      "image/png",
      "",
    );

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/empty/i);
  });

  it("rejects unsupported image formats", async () => {
    const file = createImageFile(
      "document.pdf",
      "application/pdf",
    );

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/unsupported image format/i);
  });

  it("rejects images exceeding the size limit", async () => {
    const file = {
      name: "large.png",
      type: "image/png",
      size: MAX_SIMILARITY_FILE_SIZE_BYTES + 1,
    } as File;

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects when image decoding is unavailable", async () => {
    vi.stubGlobal("createImageBitmap", undefined);

    const file = createImageFile("photo.png");

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/not supported by this browser/i);
  });

  it("calculates a hash using mocked browser image APIs", async () => {
    mockImageDecoding();

    const file = createImageFile("photo.png");

    const hash = await calculateImageDifferenceHash(file);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[01]{64}$/);
  });
});

describe("findSimilarPhotos", () => {
  it("returns no pairs when no files are selected", async () => {
    await expect(findSimilarPhotos([])).resolves.toEqual([]);
  });

  it("rejects a negative distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, -1),
    ).rejects.toThrow(/between 0 and 64/i);
  });

  it("rejects a distance greater than 64", async () => {
    await expect(
      findSimilarPhotos([], undefined, 65),
    ).rejects.toThrow(/between 0 and 64/i);
  });

  it("rejects a fractional distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, 2.5),
    ).rejects.toThrow(/whole number/i);
  });

  it("rejects an unsupported file and reports the error", async () => {
    const file = createImageFile(
      "document.pdf",
      "application/pdf",
    );

    const onError = vi.fn();

    const result = await findSimilarPhotos(
      [file],
      onError,
    );

    expect(result).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      file,
      expect.any(Error),
    );
  });

  it("continues processing after an invalid image", async () => {
    mockImageDecoding();

    const invalid = createImageFile(
      "empty.png",
      "image/png",
      "",
    );

    const valid = createImageFile("valid.png");
    const onError = vi.fn();

    const result = await findSimilarPhotos(
      [invalid, valid],
      onError,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      invalid,
      expect.any(Error),
    );

    // One valid image cannot form a pair by itself.
    expect(result).toEqual([]);
  });

  it("detects images with identical perceptual hashes", async () => {
    mockImageDecoding();

    const first = createImageFile("photo-one.png");
    const second = createImageFile("photo-two.png");

    const result = await findSimilarPhotos([
      first,
      second,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].first).toBe(first);
    expect(result[0].second).toBe(second);
    expect(result[0].distance).toBe(0);
    expect(result[0].similarityPercent).toBe(100);
  });

  it("does not report a pair when hashes exceed the threshold", async () => {
    const firstHash = "0".repeat(64);
    const secondHash = "1".repeat(64);

    expect(
      calculateHashDistance(firstHash, secondHash),
    ).toBeGreaterThan(8);
  });

  it("does not modify selected files", async () => {
    mockImageDecoding();

    const first = createImageFile("first.png");
    const second = createImageFile("second.png");

    const originalFirstName = first.name;
    const originalSecondName = second.name;
    const originalFirstSize = first.size;
    const originalSecondSize = second.size;

    await findSimilarPhotos([first, second]);

    expect(first.name).toBe(originalFirstName);
    expect(second.name).toBe(originalSecondName);
    expect(first.size).toBe(originalFirstSize);
    expect(second.size).toBe(originalSecondSize);
  });

  it("accepts the minimum and maximum valid distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, 0),
    ).resolves.toEqual([]);

    await expect(
      findSimilarPhotos([], undefined, 64),
    ).resolves.toEqual([]);
  });
});
