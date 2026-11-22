/**
 * M12.3 — Pure storage trend analysis.
 * Uses explicitly supplied validated snapshots only. No monitoring, scanning, or file mutation.
 */
import { validateStorageSnapshot, type StorageSnapshot } from "./storageSnapshot";

export type StorageTrendDirection = "increase" | "decrease" | "unchanged";

export type StorageTrendFailure =
  | "insufficient-history"
  | "invalid-snapshot"
  | "duplicate-snapshot-id";

export interface StorageTrendResult {
  success: boolean;
  snapshotsAnalyzed: number;
  direction?: StorageTrendDirection;
  firstSnapshot?: StorageSnapshot;
  latestSnapshot?: StorageSnapshot;
  usedBytesChange?: number;
  freeBytesChange?: number;
  totalBytesChange?: number;
  elapsedMs?: number;
  usedBytesPerDay?: number;
  reason?: StorageTrendFailure;
}

function isValidSnapshotRecord(value: unknown): value is StorageSnapshot {\n  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;\n  return validateStorageSnapshot(value as StorageSnapshot).valid;\n}\n\nfunction compareChronologically(a: StorageSnapshot, b: StorageSnapshot): number {
  const timeDifference = Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
  return timeDifference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Analyze a caller-provided set of snapshots. Minimum two valid snapshots are required. */
export function analyzeStorageTrend(snapshots: readonly StorageSnapshot[]): StorageTrendResult {
  if (!Array.isArray(snapshots) || snapshots.length < 2) {
    return { success: false, snapshotsAnalyzed: 0, reason: "insufficient-history" };
  }

  if (!snapshots.every(isValidSnapshotRecord)) {
    return { success: false, snapshotsAnalyzed: 0, reason: "invalid-snapshot" };
  }

  const ids = new Set<string>();
  for (const snapshot of snapshots) {
    if (ids.has(snapshot.id)) {
      return { success: false, snapshotsAnalyzed: 0, reason: "duplicate-snapshot-id" };
    }
    ids.add(snapshot.id);
  }

  const ordered = [...snapshots].sort(compareChronologically);
  const firstSnapshot = ordered[0];
  const latestSnapshot = ordered[ordered.length - 1];
  const usedBytesChange = latestSnapshot.usedBytes - firstSnapshot.usedBytes;
  const freeBytesChange = latestSnapshot.freeBytes - firstSnapshot.freeBytes;
  const totalBytesChange = latestSnapshot.totalBytes - firstSnapshot.totalBytes;
  const elapsedMs = Date.parse(latestSnapshot.recordedAt) - Date.parse(firstSnapshot.recordedAt);

  const direction: StorageTrendDirection =
    usedBytesChange > 0 ? "increase" : usedBytesChange < 0 ? "decrease" : "unchanged";

  return {
    success: true,
    snapshotsAnalyzed: ordered.length,
    direction,
    firstSnapshot,
    latestSnapshot,
    usedBytesChange,
    freeBytesChange,
    totalBytesChange,
    elapsedMs,
    // A zero-duration range has a valid comparison but no meaningful rate.
    ...(elapsedMs > 0 ? { usedBytesPerDay: (usedBytesChange * 86_400_000) / elapsedMs } : {}),
  };
}
