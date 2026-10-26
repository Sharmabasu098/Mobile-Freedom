import { describe, expect, it, vi } from "vitest";

import {
  calculateFileHash,
  MAX_HASH_FILE_SIZE_BYTES,
} from "./fileHash";

function makeFile(name: string, content: string): File {
  return new File([content], name, {
    type: "text/plain",
  });
}

describe("M8.4.2 SHA-256 File Hashing", () => {
  it("returns a 64-character hexadecimal SHA-256 hash", async () => {
    const file = makeFile("sample.txt", "hello world");
    const hash = await calculateFileHash(file);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash for identical content with different names", async () => {
    const first = makeFile("first.txt", "duplicate-content");
    const second = makeFile("second.txt", "duplicate-content");

    await expect(calculateFileHash(first)).resolves.toBe(
      await calculateFileHash(second),
    );
  });

  it("returns different hashes for different content", async () => {
    const first = makeFile("first.txt", "content-one");
    const second = makeFile("second.txt", "content-two");

    expect(await calculateFileHash(first)).not.toBe(
      await calculateFileHash(second),
    );
  });

  it("hashes an empty file successfully", async () => {
    const file = makeFile("empty.txt", "");
    const hash = await calculateFileHash(file);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash regardless of file name and MIME type", async () => {
    const first = new File(["same-content"], "first.txt", {
      type: "text/plain",
    });

    const second = new File(["same-content"], "second.bin", {
      type: "application/octet-stream",
    });

    expect(await calculateFileHash(first)).toBe(
      await calculateFileHash(second),
    );
  });
});

describe("M8.6.4 SHA-256 Memory Safety", () => {
  it("sets the maximum hashing size to 50 MiB", () => {
    expect(MAX_HASH_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });

  it("rejects files above the limit without reading their contents", async () => {
    const file = makeFile("large.bin", "");

    Object.defineProperty(file, "size", {
      value: MAX_HASH_FILE_SIZE_BYTES + 1,
    });

    const readSpy = vi.spyOn(file, "arrayBuffer");

    await expect(calculateFileHash(file)).rejects.toThrow(
      "File is too large to hash safely. Maximum supported size is 50 MiB.",
    );

    expect(readSpy).not.toHaveBeenCalled();
    readSpy.mockRestore();
  });

  it("accepts a file exactly at the limit without allocating large content", async () => {
    const file = makeFile("boundary.bin", "");

    Object.defineProperty(file, "size", {
      value: MAX_HASH_FILE_SIZE_BYTES,
    });

    const readSpy = vi
      .spyOn(file, "arrayBuffer")
      .mockResolvedValue(new ArrayBuffer(0));

    const hash = await calculateFileHash(file);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(readSpy).toHaveBeenCalledTimes(1);

    readSpy.mockRestore();
  });
});
