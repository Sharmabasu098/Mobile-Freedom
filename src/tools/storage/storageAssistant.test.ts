import { describe, expect, it } from "vitest";
import { generateStorageAssistantResponse } from "./storageAssistant";
import { summarizeStorage } from "./storageDashboard";
import type { FileAnalysisResult } from "./fileAnalysis";

const file = (name: string, size: number, type = "unknown", extension = ""): FileAnalysisResult => ({
  name, size, type, extension, lastModified: 0,
});

describe("M11.1 evidence-grounded Storage Assistant", () => {
  it("summarizes only supplied selected-file data and discloses scope", () => {
    const summary = summarizeStorage([file("photo.jpg", 2048, "image/jpeg", "jpg")]);
    const response = generateStorageAssistantResponse({
      summary, exactDuplicateScanCompleted: false,
    });
    expect(response.insights[0].message).toContain("1 selected file");
    expect(response.insights[0].message).toContain("2.0 KB");
    expect(response.insights[0].message).toContain("not your entire device");
    expect(response.insights.some(item => item.title.includes("pending"))).toBe(true);
    expect(response.disclaimer).toContain("Nothing has been deleted");
  });

  it("explains large files as review suggestions, not deletion commands", () => {
    const summary = summarizeStorage([
      file("large-video.mp4", 150 * 1024 * 1024, "video/mp4", "mp4"),
    ]);
    const response = generateStorageAssistantResponse({
      summary, exactDuplicateScanCompleted: false,
    });
    const largeInsight = response.insights.find(item => item.title.includes("Large files"));
    expect(largeInsight?.message).toContain("large-video.mp4");
    expect(largeInsight?.message).toContain("does not mean a file is safe to remove");
  });

  it("reports exact duplicate potential savings only after completed scan", () => {
    const summary = summarizeStorage([], [{
      hash: "known-hash",
      files: [{ name: "a.jpg", size: 100 } as File, { name: "b.jpg", size: 100 } as File],
      totalSize: 200,
      potentialSavings: 100,
    }]);
    const response = generateStorageAssistantResponse({
      summary, exactDuplicateScanCompleted: true,
    });
    expect(response.insights.some(item => item.message.includes("100 B"))).toBe(true);
    expect(response.insights.some(item => item.title.includes("Exact duplicates"))).toBe(true);
  });

  it("does not invent duplicate results when the scan is pending", () => {
    const summary = summarizeStorage([]);
    const response = generateStorageAssistantResponse({
      summary, exactDuplicateScanCompleted: false,
    });
    expect(response.insights.some(item => item.title.includes("pending"))).toBe(true);
    expect(response.insights.some(item => item.title.includes("No exact duplicate"))).toBe(false);
  });

  it("keeps visual similarity separate from exact duplicates and supports Hindi", () => {
    const summary = summarizeStorage([]);
    const response = generateStorageAssistantResponse({
      summary,
      exactDuplicateScanCompleted: true,
      similarPhotoScanCompleted: true,
      similarPhotoPairCount: 2,
    }, "hi");
    expect(response.language).toBe("hi");
    expect(response.insights.some(item => item.title.includes("मिलती-जुलती तस्वीरें"))).toBe(true);
    expect(response.insights.some(item => item.message.includes("समान दिखना"))).toBe(true);
  });

  it("blocks invalid totals with a verification notice instead of fabricating a size", () => {
    const summary = { ...summarizeStorage([]), totalSize: Number.NaN };
    const response = generateStorageAssistantResponse({
      summary, exactDuplicateScanCompleted: false,
    });
    expect(response.insights.some(item => item.title.includes("needs verification"))).toBe(true);
    expect(response.insights[0].message).toContain("will not generate storage recommendations");
    expect(response.insights[0].message).not.toContain("NaN");
  });
});
