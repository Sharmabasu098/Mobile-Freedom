import { describe, expect, it } from "vitest";

import { calculateFileHash } from "./fileHash";

function makeFile(
name: string,
content: string,
): File {
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

const firstHash = await calculateFileHash(first);
const secondHash = await calculateFileHash(second);

expect(firstHash).toBe(secondHash);

});

it("returns different hashes for different content", async () => {
const first = makeFile("first.txt", "content-one");
const second = makeFile("second.txt", "content-two");

const firstHash = await calculateFileHash(first);
const secondHash = await calculateFileHash(second);

expect(firstHash).not.toBe(secondHash);

});

it("hashes an empty file successfully", async () => {
const file = makeFile("empty.txt", "");

const hash = await calculateFileHash(file);

expect(hash).toMatch(/^[a-f0-9]{64}$/);

});
});
