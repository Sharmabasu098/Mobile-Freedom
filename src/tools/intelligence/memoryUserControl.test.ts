import { describe, expect, it } from "vitest";
import { MemoryUserControl } from "./memoryUserControl";
import { PersistentMemoryStore, type MemoryStorageAdapter } from "./persistentMemoryStorage";
import type { MemoryCandidate } from "./memoryExtraction";

class Adapter implements MemoryStorageAdapter {
  value: string | null = null;
  failWrites = false;
  getItem() { return this.value; }
  setItem(_key: string, value: string) {
    if (this.failWrites) throw new Error("storage unavailable");
    this.value = value;
  }
}
const candidate = (value: string, category: MemoryCandidate["category"] = "preference"): MemoryCandidate =>
  ({ category, value, durable: true });
function setup() {
  const adapter = new Adapter();
  const store = new PersistentMemoryStore(adapter, { idFactory: (() => { let n=0; return () => "id-"+(++n); })(), clock: () => 1000 });
  const control = new MemoryUserControl(store, { clock: () => 1000, retentionMs: 100 });
  return { adapter, store, control };
}

describe("VF-02.7 Memory Safety & User Control — test-first", () => {
  it("MSU-T01 rejects saving without explicit approval", () => {
    const { control, store } = setup();
    expect(() => control.save(candidate("Prefer concise answers"))).toThrow(/approval/i);
    expect(store.list()).toHaveLength(0);
  });
  it("MSU-T02 saves only after affirmative approval", () => {
    const { control, store } = setup();
    expect(control.save(candidate("Prefer concise answers"), true)).toMatchObject({ value: "Prefer concise answers" });
    expect(store.list()).toHaveLength(1);
  });
  it("MSU-T03 rejects sensitive candidates", () => {
    const { control, store } = setup();
    expect(() => control.save(candidate("My password is secret"), true)).toThrow(/sensitive/i);
    expect(store.list()).toHaveLength(0);
  });
  it("MSU-T04 pause state persists", () => {
    const { control } = setup();
    control.pause();
    expect(control.isPaused()).toBe(true);
  });
  it("MSU-T05 candidates while paused are not saved or queued", () => {
    const { control, store } = setup();
    control.pause();
    expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow(/paused/i);
    control.resume();
    expect(store.list()).toHaveLength(0);
  });
  it("MSU-T06 resume enables approved saving", () => {
    const { control, store } = setup();
    control.pause(); control.resume();
    expect(control.save(candidate("Prefer concise answers"), true)).toMatchObject({ value: "Prefer concise answers" });
    expect(store.list()).toHaveLength(1);
  });
  it("MSU-T07 review returns records with identifying metadata", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(control.review()[0]).toMatchObject({ id: "id-1", category: "preference", value: "Prefer concise answers", createdAt: 1000 });
  });
  it("MSU-T08 correction updates only selected record", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.save(candidate("Mobile Freedom project"), true, "project");
    control.correct("id-1", candidate("Prefer short explanations"));
    expect(control.review().find(x=>x.id==="id-1")?.value).toBe("Prefer short explanations");
    expect(control.review().find(x=>x.id==="id-2")?.value).toBe("Mobile Freedom project");
  });
  it("MSU-T09 invalid correction is rejected and original preserved", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(() => control.correct("id-1", {category:"preference",value:"",durable:true})).toThrow();
    expect(control.review()[0].value).toBe("Prefer concise answers");
  });
  it("MSU-T10 duplicate correction is rejected", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.save(candidate("Mobile Freedom project","project"), true);
    expect(() => control.correct("id-1", candidate("Mobile Freedom project","project"))).toThrow(/duplicate/i);
  });
  it("MSU-T11 delete removes only selected memory", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.save(candidate("Mobile Freedom project","project"), true);
    expect(control.delete("id-1")).toBe(true);
    expect(control.review().map(x=>x.id)).toEqual(["id-2"]);
  });
  it("MSU-T12 unknown ID deletion returns false", () => {
    const { control } = setup();
    expect(control.delete("unknown")).toBe(false);
  });
  it("MSU-T13 delete-all without confirmation is rejected", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(() => control.deleteAll()).toThrow(/confirm/i);
    expect(control.review()).toHaveLength(1);
  });
  it("MSU-T14 delete-all with explicit confirmation empties store", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(control.deleteAll(true)).toBe(true);
    expect(control.review()).toHaveLength(0);
  });
  it("MSU-T15 retention boundary is inclusive and documented", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(control.review({ now: 1100 })).toHaveLength(1);
  });
  it("MSU-T16 expired memory is excluded after retention window", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(control.review({ now: 1101 })).toHaveLength(0);
  });
  it("MSU-T17 malformed storage fails closed", () => {
    const { adapter, control } = setup();
    adapter.value = "{broken";
    expect(() => control.review()).toThrow(/malformed/i);
    expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow();
  });
  it("MSU-T18 storage write failure is surfaced", () => {
    const { adapter, control } = setup();
    adapter.failWrites = true;
    expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow(/storage unavailable/i);
  });
  it("MSU-T19 paused state blocks memory review/retrieval", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.pause();
    expect(control.review()).toHaveLength(0);
  });
  it("MSU-T20 deleted memories cannot reappear", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.delete("id-1");
    expect(control.review()).toHaveLength(0);
  });
  it("MSU-T21 resume returns only existing, non-expired records", () => {
    const { control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    control.pause(); control.resume();
    expect(control.review()).toHaveLength(1);
  });
  it("MSU-T22 VF-02.5 storage behavior remains available as regression", () => {
    const { store, control } = setup();
    control.save(candidate("Prefer concise answers"), true);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({ durable: true, schemaVersion: 1 });
  });
});
