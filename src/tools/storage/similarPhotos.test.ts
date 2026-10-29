import { afterEach, describe, expect, it, vi } from "vitest";

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
  return new File([content], name, {
    type,
  });
}

function createPixelData(reverse = false): Uint8ClampedArray {
  const data = new Uint8ClampedArray(9 * 8 * 4);

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const pixelIndex = (y * 9 + x) * 4;
      const brightness = reverse
        ? (8 - x) * 28
        : x * 28;

      data[pixelIndex] = brightness;
      data[pixelIndex + 1] = brightness;
      data[pixelIndex + 2] = brightness;
      data[pixelIndex + 3] = 255;
    }
  }

  return data;
}

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

  vi.spyOn(
    HTMLCanvasElement.prototype,
    "getContext",
  ).mockImplementation(
    (() => {
      return {
        drawImage: vi.fn(),

        getImageData: vi.fn(
          (_x: number, _y: number, _width: number, _height: number) => {
            return {
              data: createPixelData(),
            };
          },
        ),
      } as unknown as CanvasRenderingContext2D;
    }) as typeof HTMLCanvasElement.prototype.getContext,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("calculateDifferenceHashFromPixels", () => {
  it("creates a 64-bit hash from 72 grayscale pixels", () => {
    const pixels = Array.from(
      { length: 9 * 8 },
      (_, index) => index % 9,
    );

    const hash = calculateDifferenceHashFromPixels(pixels);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[01]{64}$/);
  });

  it("returns zero bits when adjacent pixels increase", () => {
    const pixels: number[] = [];

    for (let y = 0; y < 8; y += 1) {
      pixels.push(10, 20, 30, 40, 50, 60, 70, 80, 90);
    }

    const hash = calculateDifferenceHashFromPixels(pixels);

    expect(hash).toBe("0".repeat(64));
  });

  it("returns one bits when adjacent pixels decrease", () => {
    const pixels: number[] = [];

    for (let y = 0; y < 8; y += 1) {
      pixels.push(90, 80, 70, 60, 50, 40, 30, 20, 10);
    }

    const hash = calculateDifferenceHashFromPixels(pixels);

    expect(hash).toBe("1".repeat(64));
  });

  it("rejects an incorrect number of pixels", () => {
    expect(() =>
      calculateDifferenceHashFromPixels([1, 2, 3]),
    ).toThrow(/exactly 72 grayscale pixels/i);
  });

  it("rejects incorrect dimensions", () => {
    const pixels = new Array(9 * 8).fill(100);

    expect(() =>
      calculateDifferenceHashFromPixels(pixels, 8, 8),
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
      calculateHashDistance("0".repeat(64), "1".repeat(64)),
    ).toBe(64);
  });

  it("counts differing bits correctly", () => {
    const firstHash = "0".repeat(64);
    const secondHash = "1".repeat(5) + "0".repeat(59);

    expect(
      calculateHashDistance(firstHash, secondHash),
    ).toBe(5);
  });

  it("rejects hashes with an incorrect length", () => {
    expect(() =>
      calculateHashDistance("000", "000"),
    ).toThrow(/exactly 64 binary digits/i);
  });

  it("rejects hashes containing non-binary characters", () => {
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
    const file = createImageFile("empty.png", "image/png", "");

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

  it("rejects images larger than the supported limit", async () => {
    const file = {
      name: "large.png",
      type: "image/png",
      size: MAX_SIMILARITY_FILE_SIZE_BYTES + 1,
    } as File;

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/too large/i);
  });

  it("rejects when browser image decoding is unavailable", async () => {
    vi.stubGlobal("createImageBitmap", undefined);

    const file = createImageFile("photo.png");

    await expect(
      calculateImageDifferenceHash(file),
    ).rejects.toThrow(/not supported by this browser/i);
  });
});

describe("findSimilarPhotos", () => {
  it("returns an empty array when no files are selected", async () => {
    await expect(findSimilarPhotos([])).resolves.toEqual([]);
  });

  it("rejects a negative similarity distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, -1),
    ).rejects.toThrow(/between 0 and 64/i);
  });

  it("rejects a distance greater than 64", async () => {
    await expect(
      findSimilarPhotos([], undefined, 65),
    ).rejects.toThrow(/between 0 and 64/i);
  });

  it("rejects a fractional similarity distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, 2.5),
    ).rejects.toThrow(/whole number/i);
  });

  it("reports unsupported files and continues processing", async () => {
    const unsupported = createImageFile(
      "document.pdf",
      "application/pdf",
    );

    const callback = vi.fn();

    const result = await findSimilarPhotos(
      [unsupported],
      callback,
    );

    expect(result).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      unsupported,
      expect.any(Error),
    );
  });

  it("reports an error for an empty image without stopping other files", async () => {
    const empty = createImageFile("empty.png", "image/png", "");
    const unsupported = createImageFile(
      "document.pdf",
      "application/pdf",
    );

    const callback = vi.fn();

    const result = await findSimilarPhotos(
      [empty, unsupported],
      callback,
    );

    expect(result).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("does not modify the selected files", async () => {
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

  it("uses a configurable maximum distance", async () => {
    await expect(
      findSimilarPhotos([], undefined, 0),
    ).resolves.toEqual([]);

    await expect(
      findSimilarPhotos([], undefined, 64),
    ).resolves.toEqual([]);
  });
});
