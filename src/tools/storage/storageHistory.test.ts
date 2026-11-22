import { describe, expect, it, vi } from "vitest";
import {
  createStorageHistoryStore,
  createBrowserStorageHistoryStore,
  DEFAULT_STORAGE_HISTORY_CAPACITY,
  STORAGE_HISTORY_KEY,
  type StorageHistoryStorage,
} from "./storageHistory";
import type { StorageSnapshot } from "./storageSnapshot";

class MemoryStorage implements StorageHistoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  seed(key: string, value: string) { this.values.set(key, value); }
  has(key: string) { return this.values.has(key); }
}

function snapshot(id: string, recordedAt: string): StorageSnapshot {
  return {
    id,
    recordedAt,
    totalBytes: 1000,
    usedBytes: 600,
    freeBytes: 400,
    source: "user-provided",
  };
}

describe("M12.2 storage history", () => {
  it("uses a bounded default retention capacity", () => {
    expect(DEFAULT_STORAGE_HISTORY_CAPACITY).toBe(100);
  });

  it("adds and returns snapshots in chronological order", () => {
    const store = createStorageHistoryStore(new MemoryStorage());
    const later = snapshot("b", "2026-11-22T11:00:00Z");
    const earlier = snapshot("a", "2026-11-22T10:00:00Z");
    expect(store.addSnapshot(later).success).toBe(true);
    expect(store.addSnapshot(earlier).history.map((item) => item.id)).toEqual(["a", "b"]);
    expect(store.getHistory().history.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("orders equal timestamps deterministically by id", () => {
    const store = createStorageHistoryStore(new MemoryStorage());
    store.addSnapshot(snapshot("z", "2026-11-22T10:00:00Z"));
    store.addSnapshot(snapshot("a", "2026-11-22T10:00:00Z"));
    expect(store.getHistory().history.map((item) => item.id)).toEqual(["a", "z"]);
  });

  it("rejects invalid snapshots", () => {
    const store = createStorageHistoryStore(new MemoryStorage());
    const invalid = { ...snapshot("bad", "2026-11-22T10:00:00Z"), freeBytes: 0 };
    expect(store.addSnapshot(invalid).reason).toBe("invalid-snapshot");
  });

  it("rejects duplicate identifiers", () => {
    const store = createStorageHistoryStore(new MemoryStorage());
    const item = snapshot("same", "2026-11-22T10:00:00Z");
    store.addSnapshot(item);
    expect(store.addSnapshot(item).reason).toBe("duplicate-id");
  });

  it("retains the newest entries and removes oldest deterministically", () => {
    const store = createStorageHistoryStore(new MemoryStorage(), 2);
    store.addSnapshot(snapshot("1", "2026-11-22T10:00:00Z"));
    store.addSnapshot(snapshot("2", "2026-11-22T11:00:00Z"));
    store.addSnapshot(snapshot("3", "2026-11-22T12:00:00Z"));
    expect(store.getHistory().history.map((item) => item.id)).toEqual(["2", "3"]);
  });

  it("does not trust malformed stored JSON", () => {
    const storage = new MemoryStorage();
    storage.seed(STORAGE_HISTORY_KEY, "{broken");
    expect(createStorageHistoryStore(storage).getHistory()).toMatchObject({
      success: false,
      history: [],
      reason: "malformed-history",
    });
  });


  it("does not trust invalid records or duplicate IDs in persisted history", () => {
    const storage = new MemoryStorage();
    storage.seed(STORAGE_HISTORY_KEY, JSON.stringify([
      snapshot("dup", "2026-11-22T10:00:00Z"),
      snapshot("dup", "2026-11-22T11:00:00Z"),
    ]));
    expect(createStorageHistoryStore(storage).getHistory()).toMatchObject({
      success: false,
      history: [],
      reason: "malformed-history",
    });
  });

  it("clears only the dedicated history key", () => {
    const storage = new MemoryStorage();
    storage.seed(STORAGE_HISTORY_KEY, JSON.stringify([snapshot("1", "2026-11-22T10:00:00Z")]));
    storage.seed("unrelated-key", "keep");
    const result = createStorageHistoryStore(storage).clearHistory();
    expect(result.success).toBe(true);
    expect(storage.has(STORAGE_HISTORY_KEY)).toBe(false);
    expect(storage.getItem("unrelated-key")).toBe("keep");
  });

  it("rejects invalid capacity", () => {
    expect(() => createStorageHistoryStore(new MemoryStorage(), 0)).toThrow();
  });

  it("reports storage read failures safely", () => {
    const storage: StorageHistoryStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(createStorageHistoryStore(storage).getHistory()).toMatchObject({
      success: false, history: [], reason: "storage-error",
    });
  });

  it("reports clear failures safely", () => {
    const storage: StorageHistoryStorage = {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(createStorageHistoryStore(storage).clearHistory()).toMatchObject({
      success: false, history: [], reason: "storage-error",
    });
  });

  it("uses the browser localStorage adapter", () => {
    const backing = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: backing });
    try {
      const store = createBrowserStorageHistoryStore();
      const result = store.addSnapshot(snapshot("browser", "2026-11-22T10:00:00Z"));
      expect(result.success).toBe(true);
      expect(backing.getItem(STORAGE_HISTORY_KEY)).not.toBeNull();
      expect(store.getHistory().history.map((item) => item.id)).toEqual(["browser"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("handles storage write failures without losing the prior in-memory result", () =>;
    const storage: StorageHistoryStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => undefined,
    };
    expect(createStorageHistoryStore(storage).addSnapshot(snapshot("1", "2026-11-22T10:00:00Z"))).toMatchObject({
      success: false,
      history: [],
      reason: "storage-error",
    });
  });
});
