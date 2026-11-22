import { describe, expect, it } from "vitest";
import { analyzeStorageTrend } from "./storageTrendAnalysis";
import type { StorageSnapshot } from "./storageSnapshot";

function snapshot(id: string, recordedAt: string, usedBytes: number, freeBytes: number, totalBytes = usedBytes + freeBytes): StorageSnapshot {
  return { id, recordedAt, totalBytes, usedBytes, freeBytes, source: "user-provided" };
}

describe("M12.3 storage trend analysis", () => {
  it("requires at least two snapshots", () => {
    expect(analyzeStorageTrend([])).toMatchObject({ success: false, reason: "insufficient-history" });
    expect(analyzeStorageTrend([snapshot("one", "2026-11-22T10:00:00Z", 60, 40)])).toMatchObject({
      success: false, reason: "insufficient-history",
    });
  });

  it("calculates increase and time-based rate from chronological endpoints", () => {
    const result = analyzeStorageTrend([
      snapshot("later", "2026-11-23T10:00:00Z", 80, 20),
      snapshot("earlier", "2026-11-22T10:00:00Z", 60, 40),
    ]);
    expect(result).toMatchObject({
      success: true,
      direction: "increase",
      usedBytesChange: 20,
      freeBytesChange: -20,
      totalBytesChange: 0,
      elapsedMs: 86_400_000,
      usedBytesPerDay: 20,
      snapshotsAnalyzed: 2,
    });
  });

  it("calculates decrease", () => {
    expect(analyzeStorageTrend([
      snapshot("a", "2026-11-22T10:00:00Z", 80, 20),
      snapshot("b", "2026-11-23T10:00:00Z", 50, 50),
    })).toMatchObject({ success: true, direction: "decrease", usedBytesChange: -30, freeBytesChange: 30 });
  });

  it("reports unchanged usage as zero", () => {
    expect(analyzeStorageTrend([
      snapshot("a", "2026-11-22T10:00:00Z", 50, 50),
      snapshot("b", "2026-11-23T10:00:00Z", 50, 50),
    })).toMatchObject({ success: true, direction: "unchanged", usedBytesChange: 0, usedBytesPerDay: 0 });
  });

  it("sorts snapshots by timestamp independent of input order", () => {
    const result = analyzeStorageTrend([
      snapshot("z", "2026-11-24T10:00:00Z", 100, 0),
      snapshot("a", "2026-11-22T10:00:00Z", 40, 60),
      snapshot("m", "2026-11-23T10:00:00Z", 70, 30),
    ]);
    expect(result.firstSnapshot?.id).toBe("a");
    expect(result.latestSnapshot?.id).toBe("z");
    expect(result.snapshotsAnalyzed).toBe(3);
  });

  it("safely rejects malformed non-object runtime records", () => {\n    expect(analyzeStorageTrend([null as unknown as StorageSnapshot, snapshot("b", "2026-11-23T10:00:00Z", 50, 50)])).toMatchObject({\n      success: false, reason: "invalid-snapshot",\n    });\n  });\n\n  it("rejects invalid snapshots and duplicate IDs", () => {
    expect(analyzeStorageTrend([
      snapshot("a", "2026-11-22T10:00:00Z", 40, 60),
      { ...snapshot("b", "2026-11-23T10:00:00Z", 50, 50), freeBytes: 49 },
    ])).toMatchObject({ success: false, reason: "invalid-snapshot" });

    expect(analyzeStorageTrend([
      snapshot("same", "2026-11-22T10:00:00Z", 40, 60),
      snapshot("same", "2026-11-23T10:00:00Z", 50, 50),
    ])).toMatchObject({ success: false, reason: "duplicate-snapshot-id" });
  });

  it("handles same timestamp comparison without inventing a daily rate", () => {
    const result = analyzeStorageTrend([
      snapshot("a", "2026-11-22T10:00:00Z", 40, 60),
      snapshot("b", "2026-11-22T10:00:00Z", 50, 50),
    ]);
    expect(result).toMatchObject({ success: true, usedBytesChange: 10, elapsedMs: 0 });
    expect(result).not.toHaveProperty("usedBytesPerDay");
  });

  it("returns deterministic results for identical inputs", () => {
    const input = [
      snapshot("a", "2026-11-22T10:00:00Z", 40, 60),
      snapshot("b", "2026-11-23T10:00:00Z", 50, 50),
    ];
    expect(analyzeStorageTrend(input)).toEqual(analyzeStorageTrend(input));
  });
});
