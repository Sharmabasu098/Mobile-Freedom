import { describe, expect, it } from "vitest";
import { findExactDuplicates } from "./findDuplicates";

function makeFile(name: string, content: string): File {
  return new File([content], name, {
    type: "text/plain",
  });
}

describe("M8.4.3 Exact Duplicate Detection", () => {
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

  it("finds only the matching files among multiple files", async () => {
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

  it("does not modify or delete the original files", async () => {
    const first = makeFile("first.txt", "same");
    const second = makeFile("second.txt", "same");

    const originalFiles = [first, second];
    const result = await findExactDuplicates(originalFiles);

    expect(originalFiles).toHaveLength(2);
    expect(originalFiles).toContain(first);
    expect(originalFiles).toContain(second);
    expect(result[0].files).toHaveLength(2);
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
  });
});
