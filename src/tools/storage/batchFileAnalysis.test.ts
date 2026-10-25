import { describe, expect, it } from "vitest";
import { analyzeFilesInBatches } from "./batchFileAnalysis";

function makeFile(name: string, content: string): File {
  return new File([content], name, {
    type: "text/plain",
  });
}

describe("M8.5 Batch File Analysis", () => {
  it("processes all files in batches", () => {
    const files = [
      makeFile("a.txt", "aaa"),
      makeFile("b.txt", "bbbb"),
      makeFile("c.txt", "ccccc"),
      makeFile("d.txt", "dddddd"),
      makeFile("e.txt", "eeeeeee"),
    ];

    const results = analyzeFilesInBatches(files, 2);

    expect(results).toHaveLength(5);
    expect(results.map((file) => file.name)).toEqual([
      "a.txt",
      "b.txt",
      "c.txt",
      "d.txt",
      "e.txt",
    ]);
  });

  it("returns an empty array when no files are selected", () => {
    expect(analyzeFilesInBatches([])).toEqual([]);
  });

  it("processes files when batch size is one", () => {
    const files = [
      makeFile("a.txt", "a"),
      makeFile("b.txt", "bb"),
    ];

    expect(analyzeFilesInBatches(files, 1)).toHaveLength(2);
  });

  it("rejects a zero batch size", () => {
    expect(() => analyzeFilesInBatches([], 0)).toThrow(
      "Batch size must be a positive integer.",
    );
  });

  it("rejects a negative batch size", () => {
    expect(() => analyzeFilesInBatches([], -1)).toThrow(
      "Batch size must be a positive integer.",
    );
  });

  it("rejects a fractional batch size", () => {
    expect(() => analyzeFilesInBatches([], 1.5)).toThrow(
      "Batch size must be a positive integer.",
    );
  });
});
