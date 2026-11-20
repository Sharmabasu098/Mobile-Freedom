import { describe, expect, it } from "vitest";
import { summarizeStorage } from "./storageDashboard";
import type { FileAnalysisResult } from "./fileAnalysis";
import type { DuplicateFileGroup } from "./findDuplicates";

const file = (name: string, size: number, type = "unknown", extension = ""): FileAnalysisResult => ({
  name, size, type, extension, lastModified: 0,
});

describe("M10.1 storage dashboard aggregation", () => {
  it("calculates total size and file counts by type", () => {
    const summary = summarizeStorage([
      file("a.jpg", 100, "image/jpeg", "jpg"),
      file("b.jpg", 300, "image/jpeg", "jpg"),
      file("notes", 50, "unknown"),
    ]);
    expect(summary.analyzedFileCount).toBe(3);
    expect(summary.totalSize).toBe(450);
    expect(summary.byType).toEqual([
      { type: "image/jpeg", fileCount: 2, totalSize: 400, percentage: (400 / 450) * 100 },
      { type: "unknown", fileCount: 1, totalSize: 50, percentage: (50 / 450) * 100 },
    ]);
  });

  it("uses extension for unknown MIME and preserves extensionless unknowns", () => {
    const summary = summarizeStorage([
      file("clip", 10, "unknown"),
      file("archive.ZIP", 20, "unknown", "ZIP"),
    ]);
    expect(summary.byType.map((item) => item.type)).toEqual([".zip", "unknown"]);
  });

  it("lists large files at threshold and sorts size descending with stable name tie-break", () => {
    const files = [
      file("z.bin", 100, "application/octet-stream"),
      file("b.bin", 200, "application/octet-stream"),
      file("a.bin", 200, "application/octet-stream"),
      file("small.bin", 99, "application/octet-stream"),
    ];
    const summary = summarizeStorage(files, [], { largeFileThreshold: 100 });
    expect(summary.largeFiles.map((item) => item.name)).toEqual(["a.bin", "b.bin", "z.bin"]);
    expect(summary.largeFileThreshold).toBe(100);
  });

  it("sums only supplied duplicate-group potential savings", () => {
    const groups = [
      { hash: "1", files: [] as File[], totalSize: 500, potentialSavings: 300 },
      { hash: "2", files: [] as File[], totalSize: 200, potentialSavings: 150 },
    ] satisfies DuplicateFileGroup[];
    const summary = summarizeStorage([file("x", 700)], groups);
    expect(summary.duplicateGroupCount).toBe(2);
    expect(summary.potentialDuplicateSavings).toBe(450);
  });

  it("does not report potential duplicate savings for empty or missing groups", () => {
    expect(summarizeStorage([]).potentialDuplicateSavings).toBe(0);
    expect(summarizeStorage([file("x", 1)]).potentialDuplicateSavings).toBe(0);
  });

  it("returns safe empty-data percentages", () => {
    const summary = summarizeStorage([]);
    expect(summary.totalSize).toBe(0);
    expect(summary.byType).toEqual([]);
    expect(summary.largeFiles).toEqual([]);
  });

  it("rejects invalid large-file thresholds", () => {
    expect(() => summarizeStorage([], [], { largeFileThreshold: -1 })).toThrow();
    expect(() => summarizeStorage([], [], { largeFileThreshold: Infinity })).toThrow();
  });
});


describe("M10.2 file-type intelligence categories", () => {
  it("aggregates image, video, document and other categories and percentages", () => {
    const summary = summarizeStorage([
      file("photo.jpg", 100, "image/jpeg", "jpg"),
      file("movie.mp4", 300, "video/mp4", "mp4"),
      file("report.pdf", 50, "application/pdf", "pdf"),
      file("payload.bin", 50, "application/octet-stream", "bin"),
    ]);
    expect(summary.byCategory).toEqual([
      { category: "images", fileCount: 1, totalSize: 100, percentage: 20 },
      { category: "videos", fileCount: 1, totalSize: 300, percentage: 60 },
      { category: "documents", fileCount: 1, totalSize: 50, percentage: 10 },
      { category: "other", fileCount: 1, totalSize: 50, percentage: 10 },
    ]);
  });

  it("classifies extensions when MIME type is unavailable and retains unknowns", () => {
    const summary = summarizeStorage([
      file("scan.HEIC", 10, "unknown", "heic"),
      file("notes.TXT", 20, "unknown", "txt"),
      file("mystery", 30, "unknown", ""),
      file("bundle.7z", 40, "unknown", "7z"),
      file("song.flac", 50, "unknown", "flac"),
    ]);
    expect(summary.byCategory.map((item) => item.category)).toEqual(["images", "documents", "audio", "archives", "unknown"]);
    expect(summary.byCategory.reduce((sum, item) => sum + item.fileCount, 0)).toBe(5);
    expect(summary.byCategory.reduce((sum, item) => sum + item.totalSize, 0)).toBe(150);
  });


  it("keeps zero-byte files in category counts with safe percentages", () => {
    const summary = summarizeStorage([
      file("empty.jpg", 0, "image/jpeg", "jpg"),
      file("empty.pdf", 0, "application/pdf", "pdf"),
    ]);
    expect(summary.byCategory).toEqual([
      { category: "images", fileCount: 1, totalSize: 0, percentage: 0 },
      { category: "documents", fileCount: 1, totalSize: 0, percentage: 0 },
    ]);
  });
});


describe("M10.3 large-file intelligence", () => {
  it("returns largest analyzed files in deterministic order and limits the list", () => {
    const summary = summarizeStorage([
      file("z.bin", 50, "application/octet-stream"),
      file("c.bin", 300, "application/octet-stream"),
      file("b.bin", 300, "application/octet-stream"),
      file("a.bin", 500, "application/octet-stream"),
    ], [], { largestFilesLimit: 3 });
    expect(summary.largestFiles.map((item) => item.name)).toEqual(["a.bin", "b.bin", "c.bin"]);
    expect(summary.largestFilesLimit).toBe(3);
  });


  it("keeps the threshold large-file list separate from the top-largest list", () => {
    const summary = summarizeStorage([
      file("one.dat", 100, "application/octet-stream"),
      file("two.dat", 90, "application/octet-stream"),
      file("three.dat", 80, "application/octet-stream"),
    ], [], { largeFileThreshold: 90, largestFilesLimit: 2 });
    expect(summary.largeFiles.map((item) => item.name)).toEqual(["one.dat", "two.dat"]);
    expect(summary.largestFiles.map((item) => item.name)).toEqual(["one.dat", "two.dat"]);
  });


  it("allows a zero largest-files limit and rejects invalid limits", () => {
    expect(summarizeStorage([file("x", 1)], [], { largestFilesLimit: 0 }).largestFiles).toEqual([]);
    expect(() => summarizeStorage([], [], { largestFilesLimit: -1 })).toThrow();
    expect(() => summarizeStorage([], [], { largestFilesLimit: 1.5 })).toThrow();
  });
});


describe("M10.4 duplicate potential savings acceptance tests", () => {
  const duplicateGroup = (hash: string, sizes: number[], potentialSavings = -999): DuplicateFileGroup => {
    const groupFiles = sizes.map((size, index) => ({ name: `dup-${index}.bin`, size } as File));
    return { hash, files: groupFiles, totalSize: sizes.reduce((sum, size) => sum + size, 0), potentialSavings };
  };

  it("recalculates savings from actual file sizes instead of trusting the supplied value", () => {
    expect(summarizeStorage([], [duplicateGroup("hash-a", [10, 10], 0)]).potentialDuplicateSavings).toBe(10);
  });

  it("calculates savings by retaining the largest file in a group", () => {
    expect(summarizeStorage([], [duplicateGroup("hash-a", [5, 10, 15], 1)]).potentialDuplicateSavings).toBe(20);
  });

  it("sums independent duplicate groups correctly", () => {
    expect(summarizeStorage([], [duplicateGroup("hash-a", [10, 10]), duplicateGroup("hash-b", [7, 7, 7])]).potentialDuplicateSavings).toBe(24);
  });

  it("ignores groups with fewer than two files", () => {
    const summary = summarizeStorage([], [duplicateGroup("single", [50])]);
    expect(summary.duplicateGroupCount).toBe(0);
    expect(summary.potentialDuplicateSavings).toBe(0);
  });

  it("handles zero-byte duplicate files safely", () => {
    expect(summarizeStorage([], [duplicateGroup("zero", [0, 0, 0])]).potentialDuplicateSavings).toBe(0);
  });

  it("excludes a group containing an invalid file size", () => {
    expect(summarizeStorage([], [duplicateGroup("invalid", [10, Number.NaN])]).potentialDuplicateSavings).toBe(0);
  });

  it("does not count the same hash group twice", () => {
    const group = duplicateGroup("same-hash", [10, 10]);
    const summary = summarizeStorage([], [group, group]);
    expect(summary.potentialDuplicateSavings).toBe(10);
    expect(summary.duplicateGroupCount).toBe(1);
  });

  it("prevents the same file object from being counted in overlapping groups", () => {
    const shared = { name: "shared.bin", size: 10 } as File;
    const groupA: DuplicateFileGroup = { hash: "a", files: [shared, { name: "a.bin", size: 10 } as File], totalSize: 20, potentialSavings: 10 };
    const groupB: DuplicateFileGroup = { hash: "b", files: [shared, { name: "b.bin", size: 10 } as File], totalSize: 20, potentialSavings: 10 };
    expect(summarizeStorage([], [groupA, groupB]).potentialDuplicateSavings).toBe(10);
  });
});
