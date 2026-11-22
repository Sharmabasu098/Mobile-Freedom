import { describe, expect, it } from "vitest";
import { resetStorageAssistantEvidence, isCurrentStorageAssistantSelection } from "./storageAssistantSession";

describe("M11.5 safety regression — selection evidence reset", () => {
  it("clears old file, duplicate, and similar-photo evidence when selection changes", () => {
    const previous = {
      analyzedFiles: [{ name: "old-a.jpg" }, { name: "old-b.jpg" }],
      duplicateGroups: [{ files: ["old-a.jpg", "old-b.jpg"] }],
      duplicateScanCompleted: true,
      similarPhotoScanCompleted: true,
      similarPhotoPairCount: 1,
    };
    const reset = resetStorageAssistantEvidence(previous);
    expect(reset.analyzedFiles).toEqual([]);
    expect(reset.duplicateGroups).toEqual([]);
    expect(reset.duplicateScanCompleted).toBe(false);
    expect(reset.similarPhotoScanCompleted).toBe(false);
    expect(reset.similarPhotoPairCount).toBeUndefined();
  });

  it("clears stale completion flags even when prior results are empty", () => {
    const previous = {
      analyzedFiles: [{ name: "old.jpg" }],
      duplicateGroups: [],
      duplicateScanCompleted: true,
      similarPhotoScanCompleted: false,
      similarPhotoPairCount: undefined as number | undefined,
    };
    const reset = resetStorageAssistantEvidence(previous);
    expect(reset.duplicateScanCompleted).toBe(false);
    expect(reset.similarPhotoScanCompleted).toBe(false);
    expect(reset.analyzedFiles).toHaveLength(0);
  });
});


describe("M11.5 async selection safety", () => {
  it("accepts results only for the current selection generation", () => {
    expect(isCurrentStorageAssistantSelection(4, 4)).toBe(true);
    expect(isCurrentStorageAssistantSelection(4, 5)).toBe(false);
  });
});

describe("M11.5-SR1 async selection safety regression", () => {
  it("rejects a delayed scan result after selection changes", async () => {
    let currentSelectionVersion = 1;
    let displayedDuplicateGroups: string[] = [];
    const scanStartedAtVersion = currentSelectionVersion;
    let resolveScan!: (groups: string[]) => void;
    const scanPromise = new Promise<string[]>((resolve) => { resolveScan = resolve; });
    currentSelectionVersion += 1;
    displayedDuplicateGroups = [];
    resolveScan(["old-selection-group"]);
    const staleGroups = await scanPromise;
    if (isCurrentStorageAssistantSelection(scanStartedAtVersion, currentSelectionVersion)) {
      displayedDuplicateGroups = staleGroups;
    }
    expect(currentSelectionVersion).toBe(2);
    expect(displayedDuplicateGroups).toEqual([]);
  });

  it("accepts a delayed result when selection generation remains current", async () => {
    const currentSelectionVersion = 7;
    const scanStartedAtVersion = currentSelectionVersion;
    const groups = await Promise.resolve(["current-selection-group"]);
    let displayedDuplicateGroups: string[] = [];
    if (isCurrentStorageAssistantSelection(scanStartedAtVersion, currentSelectionVersion)) {
      displayedDuplicateGroups = groups;
    }
    expect(displayedDuplicateGroups).toEqual(["current-selection-group"]);
  });
});
