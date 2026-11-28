import type { MemoryCandidate } from "./memoryExtraction";
import { PersistentMemoryStore, type PersistentMemoryRecord } from "./persistentMemoryStorage";

export type MemoryReviewOptions = { now?: number };
export type MemoryUserControlOptions = { clock?: () => number; retentionMs?: number };

// Single escaped word boundaries: "\\b" in source represents regex word-boundary syntax.
const sensitivePattern = /\b(?:bank\s+account|account\s+(?:number|details)|password|passcode|medical\s+(?:diagnosis|details)|diagnosis|credit\s+card|card\s+(?:number|details)|cvv|cvc|otp|one\s*time\s*password|pin(?:\s*(?:number|code))?|ssn|social\s*security|aadhaar|aadhar|pan\s*(?:number|card)?|ifsc|routing\s*(?:number|details))\b|बैंक\s*(?:खाता|खाते)|खाता\s*(?:नंबर|संख्या|विवरण)|पासवर्ड|पिन\s*(?:नंबर|संख्या|कोड)?|ओटीपी|आधार\s*(?:नंबर|संख्या|विवरण)?|पैन\s*(?:नंबर|संख्या|कार्ड)?|क्रेडिट\s*कार्ड|कार्ड\s*(?:नंबर|विवरण)|सीवीवी|चिकित्सकीय\s*निदान|मेडिकल\s*विवरण/i;

function validateCandidate(candidate: MemoryCandidate): void {
  if (!candidate || !["preference", "project", "instruction"].includes(candidate.category) ||
      typeof candidate.value !== "string" || !candidate.value.trim() || candidate.durable !== true) {
    throw new Error("Invalid or non-durable memory candidate");
  }
  if (sensitivePattern.test(candidate.value)) throw new Error("Sensitive memory candidates cannot be stored");
}

export class MemoryUserControl {
  private paused = false;
  private readonly clock: () => number;
  private readonly retentionMs: number;

  constructor(private readonly store: PersistentMemoryStore, options: MemoryUserControlOptions = {}) {
    this.clock = options.clock ?? (() => Date.now());
    this.retentionMs = options.retentionMs ?? 365 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(this.retentionMs) || this.retentionMs < 0) {
      throw new Error("Retention duration must be a non-negative finite number");
    }
  }

  save(candidate: MemoryCandidate, approved?: boolean, category?: MemoryCandidate["category"]): PersistentMemoryRecord {
    if (this.paused) throw new Error("Memory is paused");
    if (approved !== true) throw new Error("Explicit approval is required");
    const normalizedCandidate: MemoryCandidate = category ? { ...candidate, category } : candidate;
    validateCandidate(normalizedCandidate);
    return this.store.save(normalizedCandidate, true);
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  isPaused(): boolean { return this.paused; }

  review(options: MemoryReviewOptions = {}): PersistentMemoryRecord[] {
    if (this.paused) return [];
    const now = options.now ?? this.clock();
    if (!Number.isFinite(now)) throw new Error("Review time must be finite");
    const cutoff = now - this.retentionMs;
    this.store.purgeExpired(cutoff);
    return this.store.list();
  }

  correct(id: string, candidate: MemoryCandidate): PersistentMemoryRecord {
    if (this.paused) throw new Error("Memory is paused");
    if (!id || typeof id !== "string") throw new Error("A memory ID is required");
    validateCandidate(candidate);
    return this.store.update(id, candidate);
  }

  delete(id: string): boolean {
    if (this.paused) throw new Error("Memory is paused");
    return this.store.delete(id);
  }

  deleteAll(confirmed?: boolean): boolean {
    if (this.paused) throw new Error("Memory is paused");
    if (confirmed !== true) throw new Error("Explicit confirmation is required to delete all memories");
    this.store.clear();
    return true;
  }
}
