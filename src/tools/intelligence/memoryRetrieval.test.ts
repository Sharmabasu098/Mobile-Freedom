import { describe, expect, it } from "vitest";
import { retrieveRelevantMemories } from "./memoryRetrieval";
import type { PersistentMemoryRecord } from "./persistentMemoryStorage";

const record = (id: string, category: PersistentMemoryRecord["category"], value: string, createdAt = 1): PersistentMemoryRecord => ({
  id, category, value, durable: true, createdAt, updatedAt: createdAt, schemaVersion: 1,
});

describe("VF-02.6 Memory Retrieval & Relevance — MR test-first matrix", () => {
  it("MR-T01 retrieves an exact-topic memory", () => {
    const memories = [record("m1", "project", "Mobile Freedom uses a website-first hybrid architecture")];
    expect(retrieveRelevantMemories("Mobile Freedom architecture", memories).map((m) => m.id)).toContain("m1");
  });

  it("MR-T02 returns no memories for unrelated candidates", () => {
    const memories = [record("m1", "preference", "I prefer concise cooking recipes")];
    expect(retrieveRelevantMemories("Explain browser storage adapters", memories)).toEqual([]);
  });

  it("MR-T03 excludes unrelated memories alongside an exact match", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom uses a website-first hybrid architecture"),
      record("m2", "preference", "I prefer concise cooking recipes"),
    ];
    const ids = retrieveRelevantMemories("Mobile Freedom architecture", memories).map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).not.toContain("m2");
  });

  it("MR-T04 allows materially related-topic retrieval", () => {
    const memories = [record("m1", "project", "The project is developed mobile-first using Android")];
    expect(retrieveRelevantMemories("Android mobile workflow", memories).map((m) => m.id)).toContain("m1");
  });

  it("MR-T05 selects only memories belonging to the requested project context", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom repository and milestone workflow"),
      record("m2", "project", "RaceNova racing game reward system"),
    ];
    const ids = retrieveRelevantMemories("Mobile Freedom milestone workflow", memories).map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).not.toContain("m2");
  });

  it("MR-T06 does not include a project memory in an unrelated general query", () => {
    const memories = [record("m1", "project", "Mobile Freedom is a mobile-first toolkit project")];
    expect(retrieveRelevantMemories("What is photosynthesis?", memories)).toEqual([]);
  });

  it("MR-T07 includes a preference only when it applies to the current query", () => {
    const memories = [record("m1", "preference", "For coding explanations, give technical details in English and explain in Hindi")];
    expect(retrieveRelevantMemories("Explain this TypeScript code", memories).map((m) => m.id)).toContain("m1");
  });

  it("MR-T08 excludes an irrelevant preference", () => {
    const memories = [record("m1", "preference", "I prefer concise travel itineraries")];
    expect(retrieveRelevantMemories("Review this TypeScript test", memories)).not.toContainEqual(expect.objectContaining({ id: "m1" }));
  });

  it("MR-T09 retrieves an applicable instruction", () => {
    const memories = [record("m1", "instruction", "Never merge a pull request without my explicit approval")];
    expect(retrieveRelevantMemories("Should this PR be merged?", memories).map((m) => m.id)).toContain("m1");
  });

  it("MR-T10 excludes unrelated instructions", () => {
    const memories = [record("m1", "instruction", "Do not publish a release without approval")];
    expect(retrieveRelevantMemories("Convert 3 miles to kilometers", memories)).toEqual([]);
  });

  it("MR-T11 returns multiple relevant memories without losing or duplicating them", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom uses a website-first workflow"),
      record("m2", "instruction", "Keep main branch safe and use isolated branches"),
      record("m3", "preference", "I prefer step-by-step coding help"),
    ];
    const ids = retrieveRelevantMemories("Continue Mobile Freedom development safely", memories).map((m) => m.id);
    expect(ids).toContain("m1");
    expect(ids).toContain("m2");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("MR-T12 de-duplicates repeated records", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom website-first toolkit"),
      record("m2", "project", "Mobile Freedom website-first toolkit"),
    ];
    const results = retrieveRelevantMemories("Mobile Freedom website toolkit", memories);
    expect(results.length).toBe(1);
  });

  it("MR-T13 preserves conflicting memories instead of silently selecting a winner", () => {
    const memories = [
      record("m1", "instruction", "Merge PRs after all checks pass"),
      record("m2", "instruction", "Never merge PRs; keep them open"),
    ];
    const results = retrieveRelevantMemories("PR merge policy", memories);
    expect(results.map((m) => m.id)).toEqual(expect.arrayContaining(["m1", "m2"]));
  });

  it("MR-T14 safely handles an empty memory list", () => {
    expect(retrieveRelevantMemories("Any topic", [])).toEqual([]);
  });

  it("MR-T15 returns the same records and order for identical inputs", () => {
    const memories = [
      record("m2", "project", "Mobile Freedom workflow"),
      record("m1", "instruction", "Keep main branch safe"),
    ];
    const first = retrieveRelevantMemories("Mobile Freedom safe workflow", memories);
    const second = retrieveRelevantMemories("Mobile Freedom safe workflow", memories);
    expect(second).toEqual(first);
  });

  it("MR-T16 retrieval does not mutate input records or array", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom workflow"),
      record("m2", "preference", "I prefer short recipes"),
    ];
    const snapshot = JSON.parse(JSON.stringify(memories));
    retrieveRelevantMemories("Mobile Freedom workflow", memories);
    expect(memories).toEqual(snapshot);
  });

  it("MR-T17 safely ignores malformed records without crashing or leaking unrelated data", () => {
    const memories = [
      record("m1", "project", "Mobile Freedom workflow"),
      { id: "bad", category: "project", value: null } as unknown as PersistentMemoryRecord,
    ];
    expect(() => retrieveRelevantMemories("Mobile Freedom workflow", memories)).not.toThrow();
    expect(retrieveRelevantMemories("Mobile Freedom workflow", memories).map((m) => m.id)).toContain("m1");
  });

  it("MR-T18 normalizes case and whitespace in equivalent queries", () => {
    const memories = [record("m1", "project", "Mobile Freedom website-first workflow")];
    const a = retrieveRelevantMemories("Mobile Freedom workflow", memories);
    const b = retrieveRelevantMemories("  mobile   freedom   WORKFLOW  ", memories);
    expect(b).toEqual(a);
  });
});
