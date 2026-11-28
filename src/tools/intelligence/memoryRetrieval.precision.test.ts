import { describe, expect, it } from "vitest";
import { retrieveRelevantMemories } from "./memoryRetrieval";
import type { PersistentMemoryRecord } from "./persistentMemoryStorage";

const record = (id: string, category: PersistentMemoryRecord["category"], value: string): PersistentMemoryRecord => ({
  id, category, value, durable: true, createdAt: 1, updatedAt: 1, schemaVersion: 1,
});

describe("VF-02.6-QA — Retrieval precision regression", () => {
  it("QA-01 rejects a memory matched only by a broad single-word overlap", () => {
    const memories = [record("m1", "project", "Mobile Freedom uses a website-first hybrid architecture")];
    expect(retrieveRelevantMemories("architecture of a recipe app", memories)).toEqual([]);
  });

  it("QA-02 rejects a broad synonym match without shared topic context", () => {
    const memories = [record("m1", "project", "Mobile Freedom website-first toolkit")];
    expect(retrieveRelevantMemories("gardening tools for a balcony", memories)).toEqual([]);
  });

  it("QA-03 does not cross-retrieve between distinct project contexts", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom toolkit development workflow"),
      record("m2", "project", "RaceNova arcade racing game rewards and car selection"),
    ];
    const ids = retrieveRelevantMemories("RaceNova racing game car selection", memories).map((m) => m.id);
    expect(ids).toContain("m2");
    expect(ids).not.toContain("m1");
  });

  it("QA-04 still retrieves a clearly matching project memory", () => {
    const memories = [record("m1", "project", "Mobile Freedom toolkit website-first hybrid architecture")];
    expect(retrieveRelevantMemories("Mobile Freedom hybrid architecture", memories).map((m) => m.id)).toContain("m1");
  });

  it("QA-05 returns all clearly relevant memories without duplicates", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom website-first toolkit"),
      record("m2", "instruction", "Keep Mobile Freedom main branch safe"),
      record("m3", "preference", "Prefer step-by-step Mobile Freedom development guidance"),
    ];
    const ids = retrieveRelevantMemories("Continue Mobile Freedom development safely step by step", memories).map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m2");
    expect(ids).toContain("m3");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
