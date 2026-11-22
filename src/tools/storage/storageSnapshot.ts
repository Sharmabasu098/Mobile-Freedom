/**
 * M12.1 — Storage snapshot data model.
 * Represents explicitly supplied storage measurements only; it does not monitor
 * device storage or collect data in the background.
 */

export type StorageSnapshotSource = "user-provided" | "browser-derived";

export interface StorageSnapshot {
  /** Stable identifier assigned by the caller. */
  id: string;
  /** ISO-8601 timestamp when this measurement was recorded. */
  recordedAt: string;
  /** All byte values are non-negative integers. */
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  /** Provenance must remain visible; do not imply device-wide monitoring. */
  source: StorageSnapshotSource;
}

export type StorageSnapshotValidationIssue =
  | "invalid-id"
  | "invalid-timestamp"
  | "invalid-total-bytes"
  | "invalid-used-bytes"
  | "invalid-free-bytes"
  | "storage-values-do-not-add-up"
  | "invalid-source";

export interface StorageSnapshotValidationResult {
  valid: boolean;
  issues: StorageSnapshotValidationIssue[];
}

/** Fail closed on invalid, incomplete, or contradictory snapshot values. */
export function validateStorageSnapshot(
  snapshot: StorageSnapshot,
): StorageSnapshotValidationResult {
  const issues: StorageSnapshotValidationIssue[] = [];

  if (typeof snapshot.id !== "string" || snapshot.id.trim().length === 0) {
    issues.push("invalid-id");
  }

  if (
    typeof snapshot.recordedAt !== "string" ||
    Number.isNaN(Date.parse(snapshot.recordedAt))
  ) {
    issues.push("invalid-timestamp");
  }

  if (!Number.isSafeInteger(snapshot.totalBytes) || snapshot.totalBytes < 0) {
    issues.push("invalid-total-bytes");
  }

  if (!Number.isSafeInteger(snapshot.usedBytes) || snapshot.usedBytes < 0) {
    issues.push("invalid-used-bytes");
  }

  if (!Number.isSafeInteger(snapshot.freeBytes) || snapshot.freeBytes < 0) {
    issues.push("invalid-free-bytes");
  }

  if (
    Number.isSafeInteger(snapshot.totalBytes) &&
    Number.isSafeInteger(snapshot.usedBytes) &&
    Number.isSafeInteger(snapshot.freeBytes) &&
    snapshot.totalBytes !== snapshot.usedBytes + snapshot.freeBytes
  ) {
    issues.push("storage-values-do-not-add-up");
  }

  if (snapshot.source !== "user-provided" && snapshot.source !== "browser-derived") {
    issues.push("invalid-source");
  }

  return { valid: issues.length === 0, issues };
}
