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
