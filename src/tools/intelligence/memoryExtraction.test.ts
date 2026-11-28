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

  it("extracts Hindi project context", () => {
    const result = extractMemoryCandidates("यह project Mobile Freedom है।");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "project", value: expect.stringContaining("Mobile Freedom") }),
    ]));
  });

  it("extracts Hindi durable approval instruction", () => {
    const result = extractMemoryCandidates("PR merge करने से पहले मुझसे अनुमति लेना।");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "instruction" }),
    ]));
  });

  it.each([
    "आज मैं व्यस्त हूँ।",
    "मेरे दोस्त को Java पसंद है।",
    "मान लो मैं एक bakery चलाता हूँ।",
  ])("rejects Hindi temporary, third-party, or hypothetical statements: %s", (input) => {
    expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it("preserves scoped bilingual preference", () => {
    const result = extractMemoryCandidates("Technical details English में, explanation Hindi में देना।");
    const text = result.map((candidate) => candidate.value.toLowerCase()).join(" ");
    expect(result.some((candidate) => candidate.category === "preference")).toBe(true);
    expect(text).toContain("english");
    expect(text).toContain("hindi");
  });

  it("extracts the mixed-language simple and concise preference", () => {
    const result = extractMemoryCandidates("Mujhe simple aur short answers chahiye.");
    expect(result.some((candidate) => candidate.category === "preference" && candidate.durable === true)).toBe(true);
  });

  it("keeps active task distinct from durable project or preference", () => {
    const result = extractMemoryCandidates("I am currently fixing the memory tests.");
    expect(result.every((candidate) => candidate.category !== "preference" && candidate.durable !== true)).toBe(true);
  });

  it("preserves approval constraint in extracted instruction", () => {
    const result = extractMemoryCandidates("Do not merge PRs without my approval.");
    const instruction = result.find((candidate) => candidate.category === "instruction");
    expect(instruction).toBeDefined();
    expect(instruction?.value.toLowerCase()).toContain("approval");
    expect(instruction?.value.toLowerCase()).toContain("merge");
  });

  it("does not save sensitive information even if it is phrased as a durable fact", () => {
    expect(extractMemoryCandidates("Remember my bank account number is 123456789.")).toEqual([]);
  });


  it("extracts a generic project name without a hard-coded project allowlist", () => {
    const result = extractMemoryCandidates("I am working on Project Aurora.");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "project", value: expect.stringContaining("Aurora") }),
    ]));
  });

  it("preserves general and task-scoped preference boundaries for a generic domain", () => {
    const result = extractMemoryCandidates("Generally I prefer concise answers. For travel planning, I prefer detailed itineraries.");
    const preferences = result.filter((candidate) => candidate.category === "preference");
    expect(preferences).toHaveLength(2);
    const combined = preferences.map((candidate) => candidate.value.toLowerCase()).join(" ");
    expect(combined).toContain("concise");
    expect(combined).toContain("travel");
    expect(combined).toContain("detailed");
  });

  it("does not let a scoped preference overwrite a general preference", () => {
    const result = extractMemoryCandidates("Generally I prefer concise answers. For coding, I prefer detailed explanations.");
    const preferences = result.filter((candidate) => candidate.category === "preference");
    expect(preferences).toHaveLength(2);
    const combined = preferences.map((candidate) => candidate.value.toLowerCase()).join(" ");
    expect(combined).toContain("concise");
    expect(combined).toContain("detailed");
  });
  it("does not treat a generic project mention as durable project context", () => {
    const result = extractMemoryCandidates("I am currently fixing the project.");
    expect(result.some((candidate) => candidate.category === "project")).toBe(false);
  });

});

describe("VF-02.4.4 Memory Extraction Test Matrix — test-first", () => {
  it("ME-01 accepts durable preferences and rejects temporary preferences", () => {
    expect(extractMemoryCandidates("I prefer concise explanations.").some((c) => c.category === "preference" && c.durable === true)).toBe(true);
    expect(extractMemoryCandidates("Today I prefer tea.")).toEqual([]);
  });

  it("ME-02 accepts an ongoing project and rejects generic project wording", () => {
    expect(extractMemoryCandidates("I am working on Project Aurora.").some((c) => c.category === "project")).toBe(true);
    expect(extractMemoryCandidates("I am currently fixing the project.").some((c) => c.category === "project")).toBe(false);
  });

  it("ME-03 accepts durable future instructions but rejects task-scoped instructions", () => {
    expect(extractMemoryCandidates("Always verify CI before declaring PASS.").some((c) => c.category === "instruction")).toBe(true);
    expect(extractMemoryCandidates("For this task only, answer in one sentence.").some((c) => c.category === "instruction")).toBe(false);
  });

  it("ME-04 filters casual and ordinary question content", () => {
    expect(extractMemoryCandidates("Haha, nice!")).toEqual([]);
    expect(extractMemoryCandidates("What is the capital of Japan?")).toEqual([]);
    expect(extractMemoryCandidates("I prefer step-by-step explanations.").some((c) => c.category === "preference")).toBe(true);
  });

  it("ME-05 rejects sensitive data even when explicitly phrased as a memory request", () => {
    expect(extractMemoryCandidates("Remember my password is fake-example-123.")).toEqual([]);
    expect(extractMemoryCandidates("Save this API token: fake-token-456.")).toEqual([]);
    expect(extractMemoryCandidates("Do not remember my private medical details.")).toEqual([]);
    expect(extractMemoryCandidates("My friend's medical details are confidential.")).toEqual([]);
  });

  it("ME-06 rejects hypothetical, quoted third-party, temporary, and ambiguous statements", () => {
    const inputs = [
      "Imagine I prefer very long answers.",
      "My friend said, 'I prefer Hindi answers.'",
      "For today, use very long replies.",
      "Maybe I like that style.",
    ];
    for (const input of inputs) expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it("ME-07 does not miss clear durable preferences, project context, or instructions in Hindi/Hinglish", () => {
    expect(extractMemoryCandidates("मुझे सरल भाषा में समझाना पसंद है।").some((c) => c.category === "preference")).toBe(true);
    expect(extractMemoryCandidates("Main Mobile Freedom par kaam kar raha hoon.").some((c) => c.category === "project")).toBe(true);
    expect(extractMemoryCandidates("PR merge se pehle meri approval lena.").some((c) => c.category === "instruction")).toBe(true);
  });

  it("ME-08 extracts only durable content from mixed messages", () => {
    const result = extractMemoryCandidates("I am busy today. I prefer concise answers.");
    expect(result.some((c) => c.category === "preference")).toBe(true);
    expect(result.some((c) => c.value.toLowerCase().includes("busy today"))).toBe(false);
  });

  it("ME-09 normalizes whitespace and bilingual inputs without language-specific false positives", () => {
    expect(extractMemoryCandidates("   I   prefer   concise answers.   ").some((c) => c.category === "preference")).toBe(true);
    expect(extractMemoryCandidates("Technical details English में, explanation Hindi में देना।").some((c) => c.category === "preference")).toBe(true);
    expect(extractMemoryCandidates("आज मौसम अच्छा है।")).toEqual([]);
  });

  it("ME-10 suppresses duplicate candidates from repeated durable statements", () => {
    const result = extractMemoryCandidates("I prefer concise answers. I prefer concise answers.");
    expect(result.filter((c) => c.category === "preference")).toHaveLength(1);
  });

  it("ME-11 handles conflicting general preference statements deterministically while preserving scoped preferences", () => {
    const result = extractMemoryCandidates("I prefer detailed answers. From now on, I prefer concise answers. For coding, I prefer detailed explanations.");
    const preferences = result.filter((c) => c.category === "preference");
    expect(preferences.length).toBeGreaterThanOrEqual(2);
    const combined = preferences.map((c) => c.value.toLowerCase()).join(" ");
    expect(combined).toContain("concise");
    expect(combined).toContain("coding");
  });

  it("ME-12 remains extraction-only and returns candidates without persistence side effects", () => {
    const candidates = extractMemoryCandidates("I prefer concise answers.");
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.every((candidate) => typeof candidate.category === "string" && typeof candidate.value === "string")).toBe(true);
  });
});
