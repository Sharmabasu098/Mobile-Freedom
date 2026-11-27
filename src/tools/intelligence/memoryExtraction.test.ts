import { describe, expect, it } from "vitest";
import { extractMemoryCandidates } from "./memoryExtraction";

describe("VF-02.4.2 Memory Extraction — test-first contract", () => {
  it.each([
    ["I prefer concise answers.", "preference"],
    ["मुझे छोटे जवाब पसंद हैं।", "preference"],
    ["Mujhe simple aur short answers chahiye.", "preference"],
    ["Technical details English में, explanation Hindi में देना।", "preference"],
  ])("extracts durable preference from %s", (input, category) => {
    const candidates = extractMemoryCandidates(input);
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ category, durable: true }),
    ]));
  });

  it("extracts project context without inventing details", () => {
    expect(extractMemoryCandidates("I am working on Mobile Freedom.")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "project", value: expect.stringContaining("Mobile Freedom") })]),
    );
  });

  it("does not promote active task into durable memory", () => {
    const result = extractMemoryCandidates("I am currently fixing the memory tests.");
    expect(result.every((candidate) => candidate.durable !== true)).toBe(true);
  });

  it("extracts durable instruction", () => {
    expect(extractMemoryCandidates("Do not merge PRs without my approval.")).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "instruction" })]),
    );
  });

  it.each([
    "Today I am busy.",
    "Translate this sentence.",
    "That one is better.",
    "Imagine I own a bakery.",
    "My friend says he likes Java.",
    "आज मैं व्यस्त हूँ।",
    "मेरे दोस्त को Java पसंद है।",
    "मान लो मैं एक bakery चलाता हूँ।",
    "   ",
  ])("rejects transient, ambiguous, hypothetical, third-party, or empty input: %s", (input) => {
    expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it("deduplicates repeated preference wording", () => {
    const result = extractMemoryCandidates("I prefer concise answers. I like short replies.");
    expect(result.filter((candidate) => candidate.category === "preference")).toHaveLength(1);
  });

  it("keeps project facts scoped and separate", () => {
    const result = extractMemoryCandidates("Mobile Freedom is my toolkit project. RaceNova is my racing game project.");
    expect(result.filter((candidate) => candidate.category === "project")).toHaveLength(2);
    expect(result.map((candidate) => candidate.value).join(" ")).toContain("Mobile Freedom");
    expect(result.map((candidate) => candidate.value).join(" ")).toContain("RaceNova");
  });

  it("does not extract sensitive personal information without explicit save authorization", () => {
    expect(extractMemoryCandidates("My bank account number is 123456789.")).toEqual([]);
  });

  it("respects explicit do-not-remember instruction", () => {
    expect(extractMemoryCandidates("Do not remember that I mentioned my medical details.")).toEqual([]);
  });

  it("returns no candidates for insufficient evidence", () => {
    expect(extractMemoryCandidates("Maybe that could be useful someday.")).toEqual([]);
  });

  it("extracts multiple categories separately", () => {
    const result = extractMemoryCandidates("Mobile Freedom is my project. Do not merge PRs without my approval.");
    expect(result.some((candidate) => candidate.category === "project")).toBe(true);
    expect(result.some((candidate) => candidate.category === "instruction")).toBe(true);
  });
  it("resolves contradictory durable preferences deterministically to the latest statement", () => {
    const result = extractMemoryCandidates("I prefer detailed answers. From now on, I prefer concise answers.");
    const preferences = result.filter((candidate) => candidate.category === "preference");
    expect(preferences).toHaveLength(1);
    expect(preferences[0].value.toLowerCase()).toContain("concise");
  });

  it("preserves a context-specific preference alongside a general preference", () => {
    const result = extractMemoryCandidates("Generally I prefer concise answers. For coding explanations, I prefer detailed step-by-step answers.");
    const preferences = result.filter((candidate) => candidate.category === "preference");
    expect(preferences.length).toBeGreaterThanOrEqual(2);
    expect(preferences.map((candidate) => candidate.value.toLowerCase()).join(" "))
      .toContain("coding");
    expect(preferences.map((candidate) => candidate.value.toLowerCase()).join(" "))
      .toContain("concise");
  });

  it.each([
    "Haha, that was funny!",
    "That is ridiculous 😂",
    "This is just a quick reaction.",
  ])("rejects low-value casual reactions: %s", (input) => {
    expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it("extracts an explicitly requested durable non-sensitive fact", () => {
    const result = extractMemoryCandidates("Please remember that my project is called Mobile Freedom.");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "project" }),
    ]));
  });

  it("recognizes explicit preference updates without discarding unrelated preferences", () => {
    const result = extractMemoryCandidates("From now on, use Hindi for explanations. I still prefer concise answers.");
    expect(result.some((candidate) => candidate.category === "preference" && candidate.value.toLowerCase().includes("hindi"))).toBe(true);
    expect(result.some((candidate) => candidate.category === "preference" && candidate.value.toLowerCase().includes("concise"))).toBe(true);
  });

});