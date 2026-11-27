import { describe, expect, it } from "vitest";
import { extractMemoryCandidates } from "./memoryExtraction";

describe("VF-02.4.2 Memory Extraction — safety regression", () => {
  it("does not attribute a quoted third-party preference to the user", () => {
    expect(extractMemoryCandidates('My friend said, "I prefer detailed answers."')).toEqual([]);
  });

  it.each([
    "Pretend I am a doctor and I work at a hospital.",
    "In this fictional story, I own a bakery.",
    "For an example, assume I live in Paris.",
  ])("rejects role-play, fictional, and example statements: %s", (input) => {
    expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it.each([
    "Remember my bank account number is 123456789.",
    "Please save my password: example-secret.",
    "Remember my medical diagnosis: example condition.",
  ])("rejects sensitive data even with explicit save language: %s", (input) => {
    expect(extractMemoryCandidates(input)).toEqual([]);
  });

  it("rejects a topic after an explicit do-not-remember request", () => {
    expect(extractMemoryCandidates("Do not remember my medical details. My diagnosis is example condition.")).toEqual([]);
  });

  it("rejects an ambiguous pronoun with no resolvable referent", () => {
    expect(extractMemoryCandidates("Keep that one, it is better.")).toEqual([]);
  });
});
