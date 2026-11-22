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

  it("requires an ISO timestamp with timezone", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "not-a-date" }).issues).toContain("invalid-timestamp");
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "2026-11-22" }).issues).toContain("invalid-timestamp");
  });

  it("rejects invalid calendar dates and date components", () => {
    const invalidDates = [
      "2026-02-30T10:00:00Z",
      "2026-13-01T10:00:00Z",
      "2026-04-31T10:00:00Z",
      "2026-11-22T24:00:00Z",
      "2026-11-22T10:60:00Z",
      "2026-11-22T10:00:60Z",
      "2026-11-22T10:00:00+14:01",
      "2026-11-22T10:00:00+15:00",
    ];

    for (const recordedAt of invalidDates) {
      expect(validateStorageSnapshot({ ...validSnapshot, recordedAt }).issues, recordedAt).toContain("invalid-timestamp");
    }
  });

  it("accepts leap day only in leap years", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "2024-02-29T12:00:00Z" }).valid).toBe(true);
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "2025-02-29T12:00:00Z" }).issues).toContain("invalid-timestamp");
  });

  it("accepts a valid timezone offset", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, recordedAt: "2026-11-22T15:30:00+05:30" }).valid).toBe(true);
  });

  it("rejects negative, fractional, and unsafe byte values", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, usedBytes: -1 }).issues).toContain("invalid-used-bytes");
    expect(validateStorageSnapshot({ ...validSnapshot, freeBytes: 1.5 }).issues).toContain("invalid-free-bytes");
    expect(validateStorageSnapshot({ ...validSnapshot, totalBytes: Number.MAX_SAFE_INTEGER + 1 }).issues).toContain("invalid-total-bytes");
  });

  it("rejects contradictory storage totals", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, freeBytes: 399 }).issues).toContain("storage-values-do-not-add-up");
  });

  it("rejects unsupported provenance values", () => {
    expect(validateStorageSnapshot({ ...validSnapshot, source: "automatic-monitoring" as StorageSnapshot["source"] }).issues).toContain("invalid-source");
  });
});
