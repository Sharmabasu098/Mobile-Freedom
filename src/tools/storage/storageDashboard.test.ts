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
