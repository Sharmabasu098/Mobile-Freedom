import { describe, expect, it } from "vitest";
import { buildStorageDashboardSummary } from "./storageDashboard";

function result(
  name: string,
  size: number,
  type: string,
  extension = name.split(".").pop() ?? "",
) {
  return { name, size, type, extension, lastModified: 0 };
}

describe("buildStorageDashboardSummary", () => {
  it("returns zero totals and all categories for an empty selection", () => {
    const summary = buildStorageDashboardSummary({ analyzedFiles: [] });

    expect(summary.analyzedFileCount).toBe(0);
    expect(summary.totalAnalyzedBytes).toBe(0);
    expect(summary.categories).toHaveLength(5);
    expect(summary.largeFileCount).toBe(0);
    expect(summary.largestFiles).toEqual([]);
  });

  it("aggregates file counts and sizes by MIME type and document extension", () => {
    const summary = buildStorageDashboardSummary({
      analyzedFiles: [
        result("photo.jpg", 100, "image/jpeg"),
        result("clip.mp4", 200, "video/mp4"),
        result("voice.mp3", 300, "", "mp3"),
        result("report.pdf", 400, "application/pdf"),
        result("mystery.bin", 500, "application/octet-stream"),
      ],
    });

    expect(summary.totalAnalyzedBytes).toBe(1500);
    expect(summary.categories).toEqual([
      { category: "images", fileCount: 1, totalBytes: 100 },
      { category: "videos", fileCount: 1, totalBytes: 200 },
      { category: "audio", fileCount: 1, totalBytes: 300 },
      { category: "documents", fileCount: 1, totalBytes: 400 },
      { category: "other", fileCount: 1, totalBytes: 500 },
    ]);
  });

  it("uses an inclusive large-file threshold and returns only the ten largest", () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      result(`file-${index}.bin`, (index + 1) * 100, "application/octet-stream"),
    );
    const summary = buildStorageDashboardSummary({
      analyzedFiles: files,
      largeFileThresholdBytes: 300,
    });

    expect(summary.largeFileCount).toBe(10);
    expect(summary.largeFileTotalBytes).toBe(7500);
    expect(summary.largestFiles).toHaveLength(10);
    expect(summary.largestFiles[0].size).toBe(1200);
    expect(summary.largestFiles[9].size).toBe(300);
  });

  it("keeps exact duplicate savings separate from visually similar pairs", () => {
    const first = new File(["same"], "copy-a.jpg", { type: "image/jpeg" });
    const second = new File(["same"], "copy-b.jpg", { type: "image/jpeg" });
    const summary = buildStorageDashboardSummary({
      analyzedFiles: [
        result("copy-a.jpg", 4, "image/jpeg"),
        result("copy-b.jpg", 4, "image/jpeg"),
        result("crop.jpg", 3, "image/jpeg"),
      ],
      duplicateGroups: [{
        hash: "sha256",
        files: [first, second],
        totalSize: 8,
        potentialSavings: 4,
      }],
      similarPairs: [{
        first,
        second: new File(["crop"], "crop.jpg", { type: "image/jpeg" }),
        distance: 4,
        similarityPercent: 94,
      }],
    });

    expect(summary.exactDuplicateGroupCount).toBe(1);
    expect(summary.exactDuplicateFileCount).toBe(2);
    expect(summary.estimatedDuplicateSavingsBytes).toBe(4);
    expect(summary.visuallySimilarPairCount).toBe(1);
  });

  it("reports duplicate and similarity failures separately", () => {
    const failedDuplicate = new File(["x"], "hash-failed.jpg");
    const failedSimilar = new File(["x"], "decode-failed.jpg");
    const summary = buildStorageDashboardSummary({
      analyzedFiles: [result("ok.txt", 1, "text/plain")],
      duplicateFailures: [failedDuplicate],
      similarFailures: [failedSimilar],
    });

    expect(summary.duplicateFailureCount).toBe(1);
    expect(summary.similarPhotoFailureCount).toBe(1);
  });

  it("rejects invalid thresholds and invalid file sizes", () => {
    expect(() => buildStorageDashboardSummary({
      analyzedFiles: [],
      largeFileThresholdBytes: -1,
    })).toThrow("Large-file threshold");

    expect(() => buildStorageDashboardSummary({
      analyzedFiles: [result("bad.bin", -1, "application/octet-stream")],
    })).toThrow("file sizes");
  });
});
