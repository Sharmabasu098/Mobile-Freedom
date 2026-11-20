import { describe, expect, it } from "vitest";
import type { StorageDashboardSummary } from "./storageDashboard";
import { renderStorageDashboard } from "./storageDashboardView";

const summary: StorageDashboardSummary = {
  analyzedFileCount: 2,
  totalSize: 1536,
  byType: [],
  byCategory: [
    { category: "images", fileCount: 1, totalSize: 1024, percentage: 66.666 },
    { category: "unknown", fileCount: 1, totalSize: 512, percentage: 33.333 },
  ],
  largeFiles: [{ name: "big photo.jpg", size: 1024, type: "image/jpeg", extension: "jpg", lastModified: 0 }],
  largestFiles: [{ name: "big photo.jpg", size: 1024, type: "image/jpeg", extension: "jpg", lastModified: 0 }],
  largestFilesLimit: 10,
  largeFileThreshold: 100,
  duplicateGroupCount: 0,
  potentialDuplicateSavings: 0,
};

describe("M10.5 storage dashboard view", () => {
  it("renders analyzed totals and an explicit selected-files context", () => {
    const html = renderStorageDashboard(summary, "en");
    expect(html).toContain("1.5 KB");
    expect(html).toContain("2 files analyzed");
    expect(html).toContain("files you selected");
  });

  it("shows potential savings as unchecked until exact duplicate scan completes", () => {
    const html = renderStorageDashboard(summary, "en", false);
    expect(html).toContain("Not checked");
    expect(html).toContain("Exact duplicates only");
  });

  it("shows savings after duplicate scan and retains the safety note", () => {
    const html = renderStorageDashboard(summary, "en", true);
    expect(html).toContain("0 B");
    expect(html).toContain("No files have been deleted");
  });

  it("renders categories, largest files, and large-file section", () => {
    const html = renderStorageDashboard(summary, "hi");
    expect(html).toContain("तस्वीरें");
    expect(html).toContain("सबसे बड़ी फाइलें");
    expect(html).toContain("बड़ी फाइलें");
    expect(html).toContain("big photo.jpg");
  });

  it("escapes filenames to prevent HTML injection", () => {
    const unsafe = { ...summary, largestFiles: [{ ...summary.largestFiles[0], name: "<script>alert(1)</script>" }] };
    const html = renderStorageDashboard(unsafe, "en");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an empty-state message when lists are empty", () => {
    const empty = { ...summary, analyzedFileCount: 0, totalSize: 0, byCategory: [], largestFiles: [], largeFiles: [] };
    const html = renderStorageDashboard(empty, "en");
    expect(html).toContain("No analyzed files yet.");
    expect(html).toContain("No files meet the large-file threshold.");
  });
});
