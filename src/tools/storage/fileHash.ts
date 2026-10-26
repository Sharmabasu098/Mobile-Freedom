/**
 * Mobile Freedom — M8.6.4 File Hashing Safety
 *
 * Calculates SHA-256 locally in the browser.
 * Files larger than the configured limit are rejected
 * before their contents are read into memory.
 *
 * This module does not upload or delete files.
 */

export const MAX_HASH_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Returns the SHA-256 hash of a file as lowercase hexadecimal.
 *
 * Files larger than 50 MiB are rejected to reduce memory risk.
 * Web Crypto requires the full content buffer for this implementation.
 */
export async function calculateFileHash(file: File): Promise<string> {
  if (!(file instanceof Blob)) {
    throw new Error("A valid file is required.");
  }

  if (file.size > MAX_HASH_FILE_SIZE_BYTES) {
    throw new Error(
      "File is too large to hash safely. Maximum supported size is 50 MiB.",
    );
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "SHA-256 hashing is not supported in this browser context.",
    );
  }

  const content = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", content);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
