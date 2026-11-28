import type { MemoryCandidate } from "./memoryExtraction";

export type PersistentMemoryRecord = MemoryCandidate & {
  id: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
};

export interface MemoryStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type StoreData = { schemaVersion: 1; records: PersistentMemoryRecord[] };
type StoreOptions = { idFactory?: () => string; clock?: () => number };

const STORAGE_KEY = "mobile-freedom:persistent-memory";
const sensitivePattern = /\b(bank account|account number|password|passcode|medical diagnosis|diagnosis|medical details|credit card|ssn|social security)\b|बैंक खाते|खाता नंबर|पासवर्ड|चिकित्सकीय निदान|मेडिकल विवरण/i;

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
function validateCandidate(candidate: MemoryCandidate): void {
  if (!candidate || !["preference", "project", "instruction"].includes(candidate.category) ||
      typeof candidate.value !== "string" || !candidate.value.trim() || candidate.durable !== true) {
    throw new Error("Invalid or non-durable memory candidate");
  }
  if (sensitivePattern.test(candidate.value)) throw new Error("Sensitive memory candidates cannot be stored");
}
function validateRecord(value: unknown): value is PersistentMemoryRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r['id'] === "string" && r['id'].length > 0 &&
    ["preference", "project", "instruction"].includes(String(r['category'])) &&
    typeof r['value'] === "string" && r['value'].trim().length > 0 &&
    typeof r['createdAt'] === "number" && Number.isFinite(r['createdAt']) &&
    typeof r['updatedAt'] === "number" && Number.isFinite(r['updatedAt']) &&
    r['schemaVersion'] === 1 && r['durable'] === true;
}

export class PersistentMemoryStore {
  private readonly idFactory: () => string;
  private readonly clock: () => number;

  constructor(private readonly adapter: MemoryStorageAdapter, options: StoreOptions = {}) {
    this.idFactory = options.idFactory ?? (() => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
      return `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    });
    this.clock = options.clock ?? (() => Date.now());
  }

  private read(): StoreData {
    const raw = this.adapter.getItem(STORAGE_KEY);
    if (raw === null) return { schemaVersion: 1, records: [] };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("Persistent memory data is malformed"); }
    if (!parsed || typeof parsed !== "object" || (parsed as any).schemaVersion !== 1 ||
        !Array.isArray((parsed as any).records) || !(parsed as any).records.every(validateRecord)) {
      throw new Error("Persistent memory data has an unsupported schema or invalid records");
    }
    return parsed as StoreData;
  }

  private write(data: StoreData): void {
    this.adapter.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  list(): PersistentMemoryRecord[] {
    return this.read().records.slice().sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  }

  save(candidate: MemoryCandidate, approved: boolean): PersistentMemoryRecord {
    if (approved !== true) throw new Error("Explicit approval is required to save memory");
    validateCandidate(candidate);
    const data = this.read();
    const key = normalize(candidate.value);
    const duplicate = data.records.find(r => r['category'] === candidate.category && normalize(r['value']) === key);
    if (duplicate) return duplicate;
    const now = this.clock();
    const record: PersistentMemoryRecord = {
      id: this.idFactory(), category: candidate.category, value: candidate.value.trim(), durable: true,
      createdAt: now, updatedAt: now, schemaVersion: 1,
    };
    data.records.push(record);
    this.write(data);
    return record;
  }

  update(id: string, candidate: MemoryCandidate): PersistentMemoryRecord {
    validateCandidate(candidate);
    const data = this.read();
    const index = data.records.findIndex(r => r['id'] === id);
    if (index < 0) throw new Error("Persistent memory record not found");
    const existing = data.records[index];
    const duplicate = data.records.find(r => r['id'] !== id && r['category'] === candidate.category && normalize(r['value']) === normalize(candidate.value));
    if (duplicate) throw new Error("Updated memory would duplicate another record");
    const updated: PersistentMemoryRecord = { ...existing, category: candidate.category, value: candidate.value.trim(), updatedAt: this.clock(), durable: true };
    data.records[index] = updated;
    this.write(data);
    return updated;
  }

  delete(id: string): boolean {
    const data = this.read();
    const next = data.records.filter(r => r['id'] !== id);
    if (next.length === data.records.length) return false;
    data.records = next;
    this.write(data);
    return true;
  }

  /** Atomically clears the record set with one storage write. */
  clear(): void {
    this.write({ schemaVersion: 1, records: [] });
  }

  /** Purges expired records in one write; if the write fails, the original data remains. */
  purgeExpired(cutoff: number): number {
    if (!Number.isFinite(cutoff)) throw new Error("Expiry cutoff must be finite");
    const data = this.read();
    const next = data.records.filter(record => record.createdAt >= cutoff);
    const removed = data.records.length - next.length;
    if (removed > 0) this.write({ schemaVersion: 1, records: next });
    return removed;
  }
}
