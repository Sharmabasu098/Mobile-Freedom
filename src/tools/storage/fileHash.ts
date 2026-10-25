/**

* Mobile Freedom — M8.4.1 File Hashing
* 
* Generates SHA-256 hashes for exact duplicate detection.
* File content is processed locally in the browser.
* This module does not upload or delete files.
  */

/**

* Returns the SHA-256 hash of a selected file as a lowercase hex string.
  */
  export async function calculateFileHash(file: File): Promise<string> {
  if (!(file instanceof Blob)) {
  throw new Error("A valid file is required.");
  }

if (!globalThis.crypto?.subtle) {
throw new Error("SHA-256 hashing is not supported in this browser context.");
}

const content = await file.arrayBuffer();
const digest = await globalThis.crypto.subtle.digest("SHA-256", content);

return Array.from(new Uint8Array(digest))
.map((byte) => byte.toString(16).padStart(2, "0"))
.join("");
  }
