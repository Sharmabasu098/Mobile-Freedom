/**
 * M12.1 — Storage snapshot data model.
 * Represents explicitly supplied storage measurements only; it does not monitor
 * device storage or collect data in the background.
 */

export type StorageSnapshotSource = "user-provided" | "browser-derived";

export interface StorageSnapshot {
  /** Stable identifier assigned by the caller. */
  id: string;
  /** ISO-8601 timestamp with an explicit timezone. */
  recordedAt: string;
  /** All byte values are non-negative safe integers. */
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

/**
 * Validate timestamp structure and calendar/time components before Date.parse.
 * Date.parse alone can normalize invalid dates (for example, February 30).
 */
function isValidIsoTimestampWithTimezone(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, timezone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;

  if (timezone !== "Z") {
    const offsetHours = Number(offsetHourText);
    const offsetMinutes = Number(offsetMinuteText);
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) {
      return false;
    }
  }

  return !Number.isNaN(Date.parse(value));
}

/** Fail closed on invalid, incomplete, or contradictory snapshot values. */
export function validateStorageSnapshot(
  snapshot: StorageSnapshot,
): StorageSnapshotValidationResult {
  const issues: StorageSnapshotValidationIssue[] = [];

  if (typeof snapshot.id !== "string" || snapshot.id.trim().length === 0) {
    issues.push("invalid-id");
  }

  if (!isValidIsoTimestampWithTimezone(snapshot.recordedAt)) {
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
