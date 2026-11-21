import { describe, expect, it } from "vitest";
import { summarizeStorage } from "./storageDashboard";
import type { FileAnalysisResult } from "./fileAnalysis";
import {
  canGenerateStorageAssistantInsights,
  safeAssistantFileName,
  validateStorageAssistantContext,
} from "./storageAssistantGuards";
import type { StorageAssistantContext } from "./storageAssistant";

const f: FileAnalysisResult = { name: "photo.jpg", size: 100, type: "image/jpeg", extension: "jpg", lastModified: 0 };
const validContext = (): StorageAssistantContext => ({
  summary: summarizeStorage([f]),
  exactDuplicateScanCompleted: false,
});

describe("M11.2 context & safety guards", () => {
  it("accepts complete, well-formed context", () => {
    const context = validContext();
    expect(validateStorageAssistantContext(context).valid).toBe(true);
    expect(canGenerateStorageAssistantInsights(context)).toBe(true);
  });

  it("rejects negative and non-finite totals", () => {
    const context = validContext();
    context.summary.totalSize = Number.NaN;
    expect(validateStorageAssistantContext(context).issues).toContain("invalid-total-size");
    expect(canGenerateStorageAssistantInsights(context)).toBe(false);
  });

  it("rejects invalid duplicate counts or savings", () => {
    const context = validContext();
    context.summary.duplicateGroupCount = -1;
    context.summary.potentialDuplicateSavings = Infinity;
    const result = validateStorageAssistantContext(context);
    expect(result.issues).toContain("invalid-duplicate-count");
    expect(result.issues).toContain("invalid-duplicate-savings");
  });

  it("requires a valid pair count when similar-photo scan is completed", () => {
    const context = validContext();
    context.similarPhotoScanCompleted = true;
    expect(validateStorageAssistantContext(context).issues).toContain("invalid-similar-photo-count");
    context.similarPhotoPairCount = 0;
    expect(validateStorageAssistantContext(context).valid).toBe(true);
  });

  it("rejects pair count if scan is not completed", () => {
    const context = validContext();
    context.similarPhotoPairCount = 2;
    expect(validateStorageAssistantContext(context).issues).toContain("similar-photo-count-without-completed-scan");
  });

  it("rejects malformed large-file entries", () => {
    const context = validContext();
    context.summary.largeFiles = [{ name: "", size: -4 } as FileAnalysisResult];
    expect(validateStorageAssistantContext(context).issues).toContain("invalid-large-file-entry");
  });

  it("strips control characters and limits displayed filename length", () => {
    expect(safeAssistantFileName("photo\u0000\nname.jpg", 8)).toBe("photonam");
    expect(safeAssistantFileName("very-long-name.jpg", 5)).toBe("very-");
  });
});
