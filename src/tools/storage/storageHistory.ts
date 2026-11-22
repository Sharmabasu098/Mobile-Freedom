/**
 * M12.2 — Storage history persistence.
 * Stores only explicitly supplied, validated snapshots in one dedicated key.
 * This module does not monitor devices, scan files, calculate trends, or mutate files.
 */
import { validateStorageSnapshot, type StorageSnapshot } from "./storageSnapshot";

export const STORAGE_HISTORY_KEY = "mobile-freedom-storage-history-v1";
export const DEFAULT_STORAGE_HISTORY_CAPACITY = 100;

export interface StorageHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type StorageHistoryFailure =
  | "invalid-snapshot"
  | "duplicate-id"
  | "malformed-history"
  | "storage-error"
  | "invalid-capacity";

export interface StorageHistoryResult {
  success: boolean;
  history: StorageSnapshot[];
  reason?: StorageHistoryFailure;
}

function isSnapshotRecord(value: unknown): value is StorageSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return validateStorageSnapshot(value as StorageSnapshot).valid;
}

function chronological(a: StorageSnapshot, b: StorageSnapshot): number {
  const timeDifference = Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
  return timeDifference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function createStorageHistoryStore(
  storage: StorageHistoryStorage,
  capacity = DEFAULT_STORAGE_HISTORY_CAPACITY,
) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new RangeError("Storage history capacity must be a positive safe integer.");
  }

  function readHistory(): StorageHistoryResult {
    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_HISTORY_KEY);
    } catch {
      return { success: false, history: [], reason: "storage-error" };
    }
    if (raw === null) return { success: true, history: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, history: [], reason: "malformed-history" };
    }

    if (!Array.isArray(parsed) || !parsed.every(isSnapshotRecord)) {
      return { success: false, history: [], reason: "malformed-history" };
    }

    const ids = new Set<string>();
    for (const snapshot of parsed) {
      if (ids.has(snapshot.id)) {
        return { success: false, history: [], reason: "malformed-history" };
      }
      ids.add(snapshot.id);
    }

    const history = [...parsed].sort(chronological).slice(-capacity);
    return { success: true, history };
  }

  function getHistory(): StorageHistoryResult {
    return readHistory();
  }

  function addSnapshot(snapshot: StorageSnapshot): StorageHistoryResult {
    if (!isSnapshotRecord(snapshot)) {
      const current = readHistory();
      return { success: false, history: current.history, reason: "invalid-snapshot" };
    }

    const current = readHistory();
    if (!current.success) return current;
    if (current.history.some((entry) => entry.id === snapshot.id)) {
      return { success: false, history: current.history, reason: "duplicate-id" };
    }

    const next = [...current.history, snapshot].sort(chronological).slice(-capacity);
    try {
      storage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(next));
      return { success: true, history: next };
    } catch {
      return { success: false, history: current.history, reason: "storage-error" };
    }
  }

  function clearHistory(): StorageHistoryResult {
    try {
      storage.removeItem(STORAGE_HISTORY_KEY);
      return { success: true, history: [] };
    } catch {
      return { success: false, history: readHistory().history, reason: "storage-error" };
    }
  }

  return { getHistory, addSnapshot, clearHistory, capacity };
}
