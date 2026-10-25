import { calculateFileHash } from "./fileHash";

export interface DuplicateFileGroup {
hash: string;
files: File[];
totalSize: number;
}

/**

* Groups files with identical SHA-256 hashes.
* Files are processed locally; nothing is uploaded or deleted.
  */
  export async function findExactDuplicates(
  files: File[],
  ): Promise<DuplicateFileGroup[]> {
  if (files.length === 0) {
  return [];
  }

const groups = new Map<string, File[]>();

for (const file of files) {
const hash = await calculateFileHash(file);
const existing = groups.get(hash);

if (existing) {
  existing.push(file);
} else {
  groups.set(hash, [file]);
}

}

return Array.from(groups.entries())
.filter(([, groupedFiles]) => groupedFiles.length > 1)
.map(([hash, groupedFiles]) => ({
hash,
files: groupedFiles,
totalSize: groupedFiles.reduce(
(total, file) => total + file.size,
0,
),
}));
  }
