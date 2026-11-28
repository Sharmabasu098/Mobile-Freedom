import { describe, expect, it } from "vitest";
import { extractMemoryCandidates } from "./memoryExtraction";
import { PersistentMemoryStore, type MemoryStorageAdapter } from "./persistentMemoryStorage";

class FakeAdapter implements MemoryStorageAdapter {
  data: string | null = null;
  writes = 0;
  failRead = false;
  failWrite = false;
  getItem() { if (this.failRead) throw new Error("read failed"); return this.data; }
  setItem(_key: string, value: string) { if (this.failWrite) throw new Error("quota/write failed"); this.data = value; this.writes += 1; }
}

const candidate = (value = "I prefer concise answers.") => ({
  category: "preference" as const,
  value,
  durable: true,
});

describe("VF-02.5 Persistent Memory Storage — locked PM test matrix", () => {
  it("PM-01 refuses save without explicit approval and performs no write", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter);
    expect(() => store.save(candidate(), false)).toThrow();
    expect(adapter.writes).toBe(0);
    expect(adapter.data).toBeNull();
  });

  it("PM-02 saves approved safe candidate with stable identity and metadata", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter, { idFactory: () => "mem-1", clock: () => 100 });
    const record = store.save(candidate(), true);
    expect(record).toMatchObject({ id: "mem-1", category: "preference", value: "I prefer concise answers.", createdAt: 100, updatedAt: 100, schemaVersion: 1 });
    expect(store.list()).toContainEqual(record);
  });

  it("PM-03 keeps saved records after store re-instantiation", () => {
    const adapter = new FakeAdapter();
    const first = new PersistentMemoryStore(adapter, { idFactory: () => "mem-1", clock: () => 100 });
    first.save(candidate(), true);
    const second = new PersistentMemoryStore(adapter);
    expect(second.list()).toHaveLength(1);
    expect(second.list()[0].id).toBe("mem-1");
  });

  it("PM-04 returns deterministic listing of only persisted records", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter, { idFactory: (() => { let n = 0; return () => `mem-${++n}` })(), clock: () => 100 });
    store.save(candidate("I prefer concise answers."), true);
    store.save({ category: "project", value: "Mobile Freedom", durable: true }, true);
    expect(store.list().map((r) => r.id)).toEqual(["mem-1", "mem-2"]);
    expect(store.list()).toEqual(store.list());
  });

  it("PM-05 treats normalized duplicate saves as idempotent", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter, { idFactory: () => "mem-1", clock: () => 100 });
    const one = store.save(candidate("  I prefer   concise answers. "), true);
    const two = store.save(candidate("i prefer concise answers."), true);
    expect(store.list()).toHaveLength(1);
    expect(two.id).toBe(one.id);
  });

  it("PM-06 updates only the selected record, preserving ID and createdAt", () => {
    const adapter = new FakeAdapter();
    let now = 100;
    let id = 0;
    const store = new PersistentMemoryStore(adapter, { idFactory: () => `mem-${++id}`, clock: () => now });
    const first = store.save(candidate(), true);
    const other = store.save({ category: "project", value: "Mobile Freedom", durable: true }, true);
    now = 200;
    const updated = store.update(first.id, candidate("I prefer detailed answers."));
    expect(updated).toMatchObject({ id: first.id, createdAt: first.createdAt, updatedAt: 200, value: "I prefer detailed answers." });
    expect(store.list()).toContainEqual(other);
  });

  it("PM-07 deletes only the requested record", () => {
    const adapter = new FakeAdapter();
    let id = 0;
    const store = new PersistentMemoryStore(adapter, { idFactory: () => `mem-${++id}` });
    const first = store.save(candidate(), true);
    const other = store.save({ category: "project", value: "Mobile Freedom", durable: true }, true);
    expect(store.delete(first.id)).toBe(true);
    expect(store.list()).toEqual([other]);
  });

  it("PM-08 rejects sensitive candidates at the storage boundary even when approved", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter);
    expect(() => store.save({ category: "instruction", value: "Remember my password is secret-123", durable: true }, true)).toThrow();
    expect(adapter.writes).toBe(0);
  });

  it("PM-09 extraction remains side-effect free", () => {
    const adapter = new FakeAdapter();
    const store = new PersistentMemoryStore(adapter);
    extractMemoryCandidates("I prefer concise answers.");
    expect(adapter.writes).toBe(0);
    expect(adapter.data).toBeNull();
  });

  it("PM-10 surfaces malformed and unsupported-schema data without rewriting original bytes", () => {
    const malformed = new FakeAdapter();
    malformed.data = "{not valid json";
    const malformedStore = new PersistentMemoryStore(malformed);
    expect(() => malformedStore.list()).toThrow();
    expect(malformed.data).toBe("{not valid json");
    const unsupported = new FakeAdapter();
    unsupported.data = JSON.stringify({ schemaVersion: 999, records: [] });
    const unsupportedStore = new PersistentMemoryStore(unsupported);
    expect(() => unsupportedStore.list()).toThrow();
    expect(unsupported.data).toContain("999");
  });

  it("PM-11 surfaces adapter read and write failures without false success", () => {
    const readAdapter = new FakeAdapter();
    readAdapter.failRead = true;
    expect(() => new PersistentMemoryStore(readAdapter).list()).toThrow();
    const writeAdapter = new FakeAdapter();
    writeAdapter.failWrite = true;
    const store = new PersistentMemoryStore(writeAdapter, { idFactory: () => "mem-1" });
    expect(() => store.save(candidate(), true)).toThrow();
    expect(writeAdapter.data).toBeNull();
  });

  it("PM-12 reads schema version 1 and safely rejects unknown versions", () => {
    const supported = new FakeAdapter();
    supported.data = JSON.stringify({ schemaVersion: 1, records: [] });
    expect(new PersistentMemoryStore(supported).list()).toEqual([]);
    const unsupported = new FakeAdapter();
    unsupported.data = JSON.stringify({ schemaVersion: 2, records: [] });
    expect(() => new PersistentMemoryStore(unsupported).list()).toThrow();
    expect(unsupported.data).toContain("2");
  });
});
