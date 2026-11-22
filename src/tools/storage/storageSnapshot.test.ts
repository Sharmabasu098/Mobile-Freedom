import { describe, expect, it } from "vitest";
import { validateStorageSnapshot, type StorageSnapshot } from "./storageSnapshot";

const validSnapshot: StorageSnapshot = {
  id: "snapshot-001",
  recordedAt: "2026-11-22T10:00:00.000Z",
  totalBytes: 1000,
  usedBytes: 600,
  freeBytes: 400,
  source: "user-provided",
};

describe("validateStorageSnapshot", () => {
  it("accepts a complete, internally consistent snapshot", () => {
    expect(validateStorageSnapshot(validSnapshot)).toEqual({ valid: true, issues: [] });
  });

  it("rejects empty identifiers", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, id: " " }).issues).toContain("invalid-id");
  });

  it("rejects invalid timestamps", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "not-a-date" }).issues).toContain("invalid-timestamp");
  });

  it("rejects negative or non-integer byte values", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, usedBytes: -1 }).issues).toContain("invalid-used-bytes");
    expect(validateStorageSnapshot({ ...validSnapshot, freeBytes: 1.5 }).issues).toContain("invalid-free-bytes");
  });

  it("rejects contradictory storage totals", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, freeBytes: 399 }).issues).toContain("storage-values-do-not-add-up");
  });

  it("rejects unsupported provenance values", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, source: "automatic-monitoring" as StorageSnapshot["source"] }).issues).toContain("invalid-source");
  });
});
