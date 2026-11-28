import { describe, expect, it } from "vitest";
import { PersistentMemoryStore, type MemoryStorageAdapter } from "./persistentMemoryStorage";

class MemoryAdapter implements MemoryStorageAdapter {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}

describe("VF-02.5 Persistent Memory Storage regression", () => {
  it("requires explicit approval before saving", () => {
    const store = new PersistentMemoryStore(new MemoryAdapter(), { idFactory: () => "id-1", clock: () => 10 });
    expect(() => store.save({ category: "preference", value: "Prefer concise explanations", durable: true }, false)).toThrow(/approval/i);
    expect(store.list()).toEqual([]);
  });

  it("saves an approved durable record and returns valid metadata", () => {
    const store = new PersistentMemoryStore(new MemoryAdapter(), { idFactory: () => "id-1", clock: () => 10 });
    const record = store.save({ category: "preference", value: "Prefer concise explanations", durable: true }, true);
    expect(record).toMatchObject({ id: "id-1", category: "preference", value: "Prefer concise explanations", durable: true, createdAt: 10, updatedAt: 10, schemaVersion: 1 });
  });

  it("deduplicates identical records without creating another entry", () => {
    const store = new PersistentMemoryStore(new MemoryAdapter(), { idFactory: () => "id-1", clock: () => 10 });
    store.save({ category: "project", value: "Mobile Freedom workflow", durable: true }, true);
    const duplicate = store.save({ category: "project", value: "Mobile Freedom workflow", durable: true }, true);
    expect(store.list()).toHaveLength(1);
    expect(duplicate.id).toBe("id-1");
  });

  it("updates an existing record and rejects duplicate updates", () => {
    let nextId = 0;
    const store = new PersistentMemoryStore(new MemoryAdapter(), { idFactory: () => "id-" + ++nextId, clock: () => 10 });
    store.save({ category: "project", value: "Mobile Freedom workflow", durable: true }, true);
    store.save({ category: "project", value: "RaceNova game workflow", durable: true }, true);
    expect(store.update("id-1", { category: "project", value: "Mobile Freedom safe workflow", durable: true })).toMatchObject({ id: "id-1", updatedAt: 10 });
    expect(() => store.update("id-1", { category: "project", value: "RaceNova game workflow", durable: true })).toThrow(/duplicate/i);
  });

  it("deletes only the selected record", () => {
    const store = new PersistentMemoryStore(new MemoryAdapter(), { idFactory: (() => { let n = 0; return () => "id-" + ++n; })(), clock: () => 10 });
    store.save({ category: "project", value: "Mobile Freedom workflow", durable: true }, true);
    store.save({ category: "project", value: "RaceNova game workflow", durable: true }, true);
    expect(store.delete("id-1")).toBe(true);
    expect(store.list().map((r) => r.id)).toEqual(["id-2"]);
    expect(store.delete("missing")).toBe(false);
  });

  it("rejects sensitive memory candidates and malformed persisted data", () => {
    const adapter = new MemoryAdapter();
    const store = new PersistentMemoryStore(adapter);
    expect(() => store.save({ category: "instruction", value: "My password is secret", durable: true }, true)).toThrow(/sensitive/i);
    adapter.value = "{bad json";
    expect(() => store.list()).toThrow(/malformed/i);
  });
});
