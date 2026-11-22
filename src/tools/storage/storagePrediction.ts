/**
 * M12.4 — Deterministic storage prediction from explicit validated history.
 * No monitoring, scanning, filesystem access, or mutation.
 */
import { validateStorageSnapshot, type StorageSnapshot } from "./storageSnapshot";
import type { StorageHistoryResult } from "./storageHistory";

export const STORAGE_PREDICTION_HORIZONS = [7, 14, 30] as const;
export type StoragePredictionHorizon = (typeof STORAGE_PREDICTION_HORIZONS)[number];
export type StoragePredictionFailure =
  | "insufficient-history"
  | "invalid-snapshot"
  | "duplicate-snapshot-id"
  | "zero-or-invalid-interval"
  | "invalid-horizon"
  | "excessive-noise"
  | "unsafe-result"
  | "history-unavailable";

export interface StoragePredictionResult {
  success: boolean;
  horizonDays: number;
  snapshotsAnalyzed: number;
  method: "robust-median-daily-growth";
  estimatedUsedBytes?: number;
  medianDailyGrowthBytes?: number;
  capacityStable?: boolean;
  estimatedFreeBytes?: number;
  limitations: string[];
  reason?: StoragePredictionFailure;
  historyFailure?: StorageHistoryResult["reason"];
}

const DAY_MS = 86_400_000;
const MIN_SNAPSHOTS = 7;
const MIN_SPAN_MS = 7 * DAY_MS;

function isSnapshot(value: unknown): value is StorageSnapshot {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    validateStorageSnapshot(value as StorageSnapshot).valid;
}
function chronological(a: StorageSnapshot, b: StorageSnapshot): number {
  const delta = Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
  return delta || a.id.localeCompare(b.id);
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function fail(reason: StoragePredictionFailure, horizonDays: number, snapshotsAnalyzed = 0): StoragePredictionResult {
  return {
    success: false, reason, horizonDays, snapshotsAnalyzed,
    method: "robust-median-daily-growth",
    limitations: ["Prediction withheld because the available history is unsuitable."],
  };
}

/** Predict used storage from a validated snapshot series. Only 7, 14, and 30 day horizons are supported. */
export function predictStorageUsage(
  snapshots: readonly StorageSnapshot[],
  horizonDays: number,
): StoragePredictionResult {
  if (!STORAGE_PREDICTION_HORIZONS.some((h) => h === horizonDays)) return fail("invalid-horizon", horizonDays);
  if (!Array.isArray(snapshots) || snapshots.length < MIN_SNAPSHOTS) return fail("insufficient-history", horizonDays);
  if (!snapshots.every(isSnapshot)) return fail("invalid-snapshot", horizonDays);
  const ids = new Set<string>();
  for (const s of snapshots) {
    if (ids.has(s.id)) return fail("duplicate-snapshot-id", horizonDays);
    ids.add(s.id);
  }
  const ordered = [...snapshots].sort(chronological);
  const startMs = Date.parse(ordered[0].recordedAt);
  const endMs = Date.parse(ordered[ordered.length - 1].recordedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs - startMs < MIN_SPAN_MS) {
    return fail("insufficient-history", horizonDays, ordered.length);
  }
  const dailyRates: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const elapsed = Date.parse(ordered[i].recordedAt) - Date.parse(ordered[i - 1].recordedAt);
    if (!Number.isFinite(elapsed) || elapsed <= 0) return fail("zero-or-invalid-interval", horizonDays, ordered.length);
    const rate = ((ordered[i].usedBytes - ordered[i - 1].usedBytes) * DAY_MS) / elapsed;
    if (!Number.isFinite(rate)) return fail("unsafe-result", horizonDays, ordered.length);
    dailyRates.push(rate);
  }
  const growth = median(dailyRates);
  const deviations = dailyRates.map((rate) => Math.abs(rate - growth));
  const mad = median(deviations);
  // Conservative guard: reject a highly volatile history when its robust spread
  // exceeds three times the median rate magnitude (with a 1-byte/day floor).
  if (!Number.isFinite(mad) || mad > 3 * Math.max(Math.abs(growth), 1)) {
    return fail("excessive-noise", horizonDays, ordered.length);
  }
  const projectedDelta = growth * horizonDays;
  const estimated = ordered[ordered.length - 1].usedBytes + projectedDelta;
  if (!Number.isFinite(projectedDelta) || !Number.isFinite(estimated) || !Number.isSafeInteger(Math.round(estimated)) || estimated < 0) {
    return fail("unsafe-result", horizonDays, ordered.length);
  }
  const latest = ordered[ordered.length - 1];
  const capacityStable = ordered.every((s) => s.totalBytes === latest.totalBytes);
  const roundedEstimate = Math.round(estimated);
  const limitations = [
    "Estimate is based only on explicitly recorded snapshots; it is not device monitoring.",
    "Median daily growth is projected linearly and real usage may change.",
    "No confidence interval is provided.",
  ];
  return {
    success: true, horizonDays, snapshotsAnalyzed: ordered.length,
    method: "robust-median-daily-growth",
    estimatedUsedBytes: roundedEstimate,
    medianDailyGrowthBytes: growth,
    capacityStable,
    ...(capacityStable && Number.isSafeInteger(latest.totalBytes) && latest.totalBytes >= roundedEstimate
      ? { estimatedFreeBytes: latest.totalBytes - roundedEstimate }
      : {}),
    limitations,
  };
}

/** M12.2 integration: read explicit stored history, then forecast. */
export function predictStorageHistory(
  historyStore: { getHistory(): StorageHistoryResult },
  horizonDays: number,
): StoragePredictionResult {
  let result: StorageHistoryResult;
  try { result = historyStore.getHistory(); }
  catch { return { ...fail("history-unavailable", horizonDays), historyFailure: "storage-error" }; }
  if (!result.success) return { ...fail("history-unavailable", horizonDays), historyFailure: result.reason };
  return predictStorageUsage(result.history, horizonDays);
}
