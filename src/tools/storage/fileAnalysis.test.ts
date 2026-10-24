import { describe, expect, it } from "vitest";

import {
  analyzeFile,
  analyzeFiles,
  findLargeFiles,
  calculateTotalSize,
} from "./fileAnalysis";

function makeFile(
  name: string,
  content = "test-content",
  type = "text/plain",
): File {
  return new File([content], name, {
    type,
    lastModified: 1700000000000,
  });
}

describe("M8.1 File Analysis — basic analysis", () => {
  it("analyzes a file name, size, type and extension", () => {
    const file = makeFile(
      "photo.JPG",
      "image-data",
      "image/jpeg",
    );

    const result = analyzeFile(file);

    expect(result.name).toBe("photo.JPG");
    expect(result.size).toBe(file.size);
    expect(result.type).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(result.lastModified).toBe(1700000000000);
  });

  it("returns an empty extension when a file has no extension", () => {
    const file = makeFile("README");

    expect(analyzeFile(file).extension).toBe("");
  });

  it("returns an empty extension for a hidden file", () => {
    const file = makeFile(".gitignore");

    expect(analyzeFile(file).extension).toBe("");
  });

  it("returns an empty extension when the name ends with a dot", () => {
    const file = makeFile("document.");

    expect(analyzeFile(file).extension).toBe("");
  });

  it("uses unknown when the browser does not provide a file type", () => {
    const file = makeFile("unknown-file", "data", "");

    expect(analyzeFile(file).type).toBe("unknown");
  });
});

describe("M8.1 File Analysis — multiple files", () => {
  it("analyzes multiple selected files", () => {
    const files = [
      makeFile("photo.jpg", "image"),
      makeFile("notes.txt", "notes"),
    ];

    const results = analyzeFiles(files);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("photo.jpg");
    expect(results[1].name).toBe("notes.txt");
  });

  it("returns an empty array for no selected files", () => {
    expect(analyzeFiles([])).toEqual([]);
  });

  it("calculates the combined size of selected files", () => {
    const files = [
      makeFile("a.txt", "12345"),
      makeFile("b.txt", "123"),
    ];

    expect(calculateTotalSize(files)).toBe(8);
  });

  it("returns zero for the total size of no files", () => {
    expect(calculateTotalSize([])).toBe(0);
  });
});

describe("M8.1 File Analysis — large files", () => {
  it("finds files at or above the default 100 MB threshold", () => {
  const smallFile = makeFile("small.txt", "small");

  const largeFile = new File(
    [new Uint8Array(100 * 1024 * 1024)],
    "large.bin",
    { type: "application/octet-stream" },
  );

  const files = [smallFile, largeFile];

  const results = findLargeFiles(files);

  expect(results.map((file) => file.name)).toEqual([
    "large.bin",
  ]);
});
  it("finds files at a custom threshold", () => {
    const files = [
      makeFile("small.txt", "1234"),
      makeFile("large.txt", "1234567890"),
    ];

    const results = findLargeFiles(files, {
      largeFileThreshold: 5,
    });

    expect(results.map((file) => file.name)).toEqual([
      "large.txt",
    ]);
  });
  it("includes a file exactly equal to the threshold", () => {
  const files = [
    makeFile("exact.txt", "12345"),
    makeFile("below.txt", "1234"),
  ];

  const results = findLargeFiles(files, {
    largeFileThreshold: 5,
  });

  expect(results.map((file) => file.name)).toEqual([
    "exact.txt",
  ]);
});

  it("returns an empty array when no file meets the threshold", () => {
    const files = [
      makeFile("a.txt", "123"),
      makeFile("b.txt", "12"),
    ];

    expect(
      findLargeFiles(files, {
        largeFileThreshold: 10,
      }),
    ).toEqual([]);
  });

  it("returns an empty array when no files are selected", () => {
    expect(findLargeFiles([])).toEqual([]);
  });

  it("rejects a negative threshold", () => {
    expect(() =>
      findLargeFiles([], {
        largeFileThreshold: -1,
      }),
    ).toThrow("File size threshold must be valid.");
  });

  it("rejects a non-finite threshold", () => {
    expect(() =>
      findLargeFiles([], {
        largeFileThreshold: Number.POSITIVE_INFINITY,
      }),
    ).toThrow("File size threshold must be valid.");
  });
});
