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
  it("MSU-T01 rejects saving without explicit approval", () => { const { control, store } = setup(); expect(() => control.save(candidate("Prefer concise answers"))).toThrow(/approval/i); expect(store.list()).toHaveLength(0); });
  it("MSU-T02 saves only after affirmative approval", () => { const { control, store } = setup(); expect(control.save(candidate("Prefer concise answers"), true)).toMatchObject({ value: "Prefer concise answers" }); expect(store.list()).toHaveLength(1); });
  it("MSU-T03 rejects sensitive candidates", () => { const { control, store } = setup(); expect(() => control.save(candidate("My password is secret"), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("MSU-T04 pause state persists", () => { const { control } = setup(); control.pause(); expect(control.isPaused()).toBe(true); });
  it("MSU-T05 candidates while paused are not saved or queued", () => { const { control, store } = setup(); control.pause(); expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow(/paused/i); control.resume(); expect(store.list()).toHaveLength(0); });
  it("MSU-T06 resume enables approved saving", () => { const { control, store } = setup(); control.pause(); control.resume(); expect(control.save(candidate("Prefer concise answers"), true)).toMatchObject({ value: "Prefer concise answers" }); expect(store.list()).toHaveLength(1); });
  it("MSU-T07 review returns records with identifying metadata", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(control.review()[0]).toMatchObject({ id: "id-1", category: "preference", value: "Prefer concise answers", createdAt: 1000 }); });
  it("MSU-T08 correction updates only selected record", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.save(candidate("Mobile Freedom project","project"), true); control.correct("id-1", candidate("Prefer short explanations")); expect(control.review().find(x=>x.id==="id-1")?.value).toBe("Prefer short explanations"); expect(control.review().find(x=>x.id==="id-2")?.value).toBe("Mobile Freedom project"); });
  it("MSU-T09 invalid correction is rejected and original preserved", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(() => control.correct("id-1", {category:"preference",value:"",durable:true})).toThrow(); expect(control.review()[0].value).toBe("Prefer concise answers"); });
  it("MSU-T10 duplicate correction is rejected", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.save(candidate("Mobile Freedom project","project"), true); expect(() => control.correct("id-1", candidate("Mobile Freedom project","project"))).toThrow(/duplicate/i); });
  it("MSU-T11 delete removes only selected memory", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.save(candidate("Mobile Freedom project","project"), true); expect(control.delete("id-1")).toBe(true); expect(control.review().map(x=>x.id)).toEqual(["id-2"]); });
  it("MSU-T12 unknown ID deletion returns false", () => { const { control } = setup(); expect(control.delete("unknown")).toBe(false); });
  it("MSU-T13 delete-all without confirmation is rejected", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(() => control.deleteAll()).toThrow(/confirm/i); expect(control.review()).toHaveLength(1); });
  it("MSU-T14 delete-all with explicit confirmation empties store", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(control.deleteAll(true)).toBe(true); expect(control.review()).toHaveLength(0); });
  it("MSU-T15 retention boundary is inclusive and documented", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(control.review({ now: 1100 })).toHaveLength(1); });
  it("MSU-T16 expired memory is excluded after retention window", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(control.review({ now: 1101 })).toHaveLength(0); });
  it("MSU-T17 malformed storage fails closed", () => { const { adapter, control } = setup(); adapter.value = "{broken"; expect(() => control.review()).toThrow(/malformed/i); expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow(); });
  it("MSU-T18 storage write failure is surfaced", () => { const { adapter, control } = setup(); adapter.failWrites = true; expect(() => control.save(candidate("Prefer concise answers"), true)).toThrow(/storage unavailable/i); });
  it("MSU-T19 paused state blocks memory review/retrieval", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.pause(); expect(control.review()).toHaveLength(0); });
  it("MSU-T20 deleted memories cannot reappear", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.delete("id-1"); expect(control.review()).toHaveLength(0); });
  it("MSU-T21 resume returns only existing, non-expired records", () => { const { control } = setup(); control.save(candidate("Prefer concise answers"), true); control.pause(); control.resume(); expect(control.review()).toHaveLength(1); });
  it("MSU-T22 VF-02.5 storage behavior remains available as regression", () => { const { store, control } = setup(); control.save(candidate("Prefer concise answers"), true); expect(store.list()).toHaveLength(1); expect(store.list()[0]).toMatchObject({ durable: true, schemaVersion: 1 }); });
  it("MSU-T23 sensitive English keyword boundaries are detected", () => { const { control, store } = setup(); for (const value of ["password is secret", "my credit card number", "medical diagnosis"]) { expect(() => control.save(candidate(value), true)).toThrow(/sensitive/i); } expect(store.list()).toHaveLength(0); });
  it("MSU-T24 retention review purges expired records from persistent storage", () => { const { control, store } = setup(); control.save(candidate("Older preference"), true); control.save(candidate("Current project", "project"), true); expect(control.review({ now: 1101 })).toHaveLength(0); expect(store.list()).toHaveLength(0); });
  it("MSU-T25 delete-all uses one atomic write and preserves data on storage failure", () => { const { adapter, control, store } = setup(); control.save(candidate("Keep until clear succeeds"), true); adapter.failWrites = true; expect(() => control.deleteAll(true)).toThrow(/storage unavailable/i); adapter.failWrites = false; expect(store.list()).toHaveLength(1); });
  // SD-01..SD-10: sensitive-data detection regression matrix (test-first).
  it("SD-01 rejects password and passcode variations", () => { const { control, store } = setup(); for (const v of ["password: hunter2", "my passcode is 1234", "login password"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-02 rejects credit-card phrasing", () => { const { control, store } = setup(); for (const v of ["credit card number 4111111111111111", "card details", "card number"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-03 rejects CVV, OTP, PIN", () => { const { control, store } = setup(); for (const v of ["CVV 123", "OTP is 778899", "PIN 4567"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-04 rejects Aadhaar and PAN identifier phrases", () => { const { control, store } = setup(); for (const v of ["Aadhaar number 1234", "PAN number ABCDE1234F", "my Aadhaar details"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-05 rejects bank account and routing identifiers", () => { const { control, store } = setup(); for (const v of ["bank account number 123456789", "account details", "IFSC code ABCD0123456"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-06 rejects sensitive Hindi keywords", () => { const { control, store } = setup(); for (const v of ["मेरा पासवर्ड 1234", "आधार नंबर 1234", "पिन नंबर 1234", "मेरा बैंक खाता"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-07 rejects sensitive Hinglish phrases", () => { const { control, store } = setup(); for (const v of ["mera password 1234 hai", "credit card ka number", "mera Aadhaar number", "bank account details"]) expect(() => control.save(candidate(v), true)).toThrow(/sensitive/i); expect(store.list()).toHaveLength(0); });
  it("SD-08 allows harmless preferences", () => { const { control, store } = setup(); expect(control.save(candidate("Please prefer concise Hindi answers"), true)).toMatchObject({ value: "Please prefer concise Hindi answers" }); expect(store.list()).toHaveLength(1); });
  it("SD-09 allows ordinary project context", () => { const { control, store } = setup(); expect(control.save(candidate("Mobile Freedom milestone planning", "project"), true)).toMatchObject({ value: "Mobile Freedom milestone planning" }); expect(store.list()).toHaveLength(1); });
  it("SD-10 allows harmless text without sensitive identifiers", () => { const { control, store } = setup(); expect(control.save(candidate("I enjoy science articles and history"), true)).toMatchObject({ value: "I enjoy science articles and history" }); expect(store.list()).toHaveLength(1); });
});
