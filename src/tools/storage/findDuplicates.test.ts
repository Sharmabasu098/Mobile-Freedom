import { describe, expect, it } from "vitest";
import { findExactDuplicates } from "./findDuplicates";

function makeFile(name: string, content: string): File {
  return new File([content], name, {
    type: "text/plain",
  });
}

describe("M9 Exact Duplicate Detection and Storage Savings", () => {
  it("groups files with identical content", async () => {
    const first = makeFile("first.txt", "same-content");
    const second = makeFile("second.txt", "same-content");

    const result = await findExactDuplicates([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(2);
    expect(result[0].files).toContain(first);
    expect(result[0].files).toContain(second);
  });

  it("does not group files with different content", async () => {
    const first = makeFile("first.txt", "content-one");
    const second = makeFile("second.txt", "content-two");

    const result = await findExactDuplicates([first, second]);

    expect(result).toHaveLength(0);
  });

  it("finds only matching files among multiple files", async () => {
    const first = makeFile("first.txt", "duplicate");
    const second = makeFile("second.txt", "duplicate");
    const third = makeFile("third.txt", "unique");

    const result = await findExactDuplicates([
      first,
      second,
      third,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(2);
    expect(result[0].files).toContain(first);
    expect(result[0].files).toContain(second);
    expect(result[0].files).not.toContain(third);
  });

  it("returns an empty array when no files are provided", async () => {
    const result = await findExactDuplicates([]);

    expect(result).toEqual([]);
  });

  it("calculates the combined size of duplicate files", async () => {
    const first = makeFile("first.txt", "hello");
    const second = makeFile("second.txt", "hello");

    const result = await findExactDuplicates([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0].totalSize).toBe(
      first.size + second.size,
    );
  });

  it("calculates potential savings for two identical files", async () => {
    const first = makeFile("first.txt", "same-content");
    const second = makeFile("second.txt", "same-content");

    const result = await findExactDuplicates([first, second]);

    expect(result).toHaveLength(1);

    expect(result[0].totalSize).toBe(
      first.size + second.size,
    );

    expect(result[0].potentialSavings).toBe(second.size);

    expect(result[0].potentialSavings).toBe(
      result[0].totalSize - first.size,
    );
  });

  it("calculates potential savings for three identical files", async () => {
    const first = makeFile("first.txt", "same-content");
    const second = makeFile("second.txt", "same-content");
    const third = makeFile("third.txt", "same-content");

    const result = await findExactDuplicates([
      first,
      second,
      third,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(3);

    expect(result[0].totalSize).toBe(
      first.size + second.size + third.size,
    );

    expect(result[0].potentialSavings).toBe(
      first.size + second.size,
    );
  });

  it("calculates savings independently for multiple duplicate groups", async () => {
    const first = makeFile("first.txt", "duplicate-one");
    const second = makeFile("second.txt", "duplicate-one");

    const third = makeFile("third.txt", "duplicate-two");
    const fourth = makeFile("fourth.txt", "duplicate-two");

    const unique = makeFile("unique.txt", "unique-content");

    const result = await findExactDuplicates([
      first,
      second,
      third,
      fourth,
      unique,
    ]);

    expect(result).toHaveLength(2);

    const groupOne = result.find(
      (group) => group.files.includes(first),
    );

    const groupTwo = result.find(
      (group) => group.files.includes(third),
    );

    expect(groupOne).toBeDefined();
    expect(groupTwo).toBeDefined();

    expect(groupOne!.potentialSavings).toBe(second.size);
    expect(groupTwo!.potentialSavings).toBe(fourth.size);

    expect(
      result.reduce(
        (total, group) => total + group.potentialSavings,
        0,
      ),
    ).toBe(second.size + fourth.size);
  });

  it("does not report savings when there are no duplicate groups", async () => {
    const first = makeFile("first.txt", "content-one");
    const second = makeFile("second.txt", "content-two");

    const result = await findExactDuplicates([first, second]);

    expect(result).toHaveLength(0);

    const totalPotentialSavings = result.reduce(
      (total, group) => total + group.potentialSavings,
      0,
    );

    expect(totalPotentialSavings).toBe(0);
  });

  it("does not modify or delete the original files", async () => {
    const first = makeFile("first.txt", "same");
    const second = makeFile("second.txt", "same");

    const originalFiles = [first, second];

    const originalSizes = originalFiles.map(
      (file) => file.size,
    );

    const result = await findExactDuplicates(originalFiles);

    expect(originalFiles).toHaveLength(2);
    expect(originalFiles).toContain(first);
    expect(originalFiles).toContain(second);

    expect(result[0].files).toHaveLength(2);

    expect(
      originalFiles.map((file) => file.size),
    ).toEqual(originalSizes);
  });

  it("continues processing files when one file cannot be hashed", async () => {
    const oversized = makeFile("large.bin", "large");

    Object.defineProperty(oversized, "size", {
      value: 50 * 1024 * 1024 + 1,
    });

    const first = makeFile("first.txt", "same-content");
    const second = makeFile("second.txt", "same-content");

    const hashErrors: Array<{
      file: File;
      error: unknown;
    }> = [];

    const result = await findExactDuplicates(
      [oversized, first, second],
      (file, error) => {
        hashErrors.push({ file, error });
      },
    );

    expect(hashErrors).toHaveLength(1);
    expect(hashErrors[0].file).toBe(oversized);
    expect(hashErrors[0].error).toBeInstanceOf(Error);

    expect(result).toHaveLength(1);
    expect(result[0].files).toContain(first);
    expect(result[0].files).toContain(second);
    expect(result[0].files).not.toContain(oversized);

    expect(result[0].potentialSavings).toBe(second.size);
  });
});
