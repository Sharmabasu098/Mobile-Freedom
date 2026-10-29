import { calculateFileHash } from "./fileHash";

export interface DuplicateFileGroup {
  hash: string;
  files: File[];
  totalSize: number;
  potentialSavings: number;
}

export type DuplicateHashErrorHandler = (
  file: File,
  error: unknown,
) => void;

/**
 * Groups files with identical SHA-256 hashes.
 *
 * Files are processed locally. Nothing is uploaded or deleted.
 * If hashing one file fails, processing continues with the others.
 */
export async function findExactDuplicates(
  files: File[],
  onHashError?: DuplicateHashErrorHandler,
): Promise<DuplicateFileGroup[]> {
  if (files.length === 0) {
    return [];
  }

  const groups = new Map<string, File[]>();

  for (const file of files) {
    let hash: string;

    try {
      hash = await calculateFileHash(file);
    } catch (error) {
      if (onHashError) {
        onHashError(file, error);
      }
      continue;
    }

    const existing = groups.get(hash);

    if (existing) {
      existing.push(file);
    } else {
      groups.set(hash, [file]);
    }
  }

    return Array.from(groups.entries())
    .filter(([, groupedFiles]) => groupedFiles.length > 1)
    .map(([hash, groupedFiles]) => {
      const totalSize = groupedFiles.reduce(
        (total, file) => total + file.size,
        0,
      );

      const largestFileSize = Math.max(
        ...groupedFiles.map((file) => file.size),
      );

      return {
        hash,
        files: groupedFiles,
        totalSize,
        potentialSavings: totalSize - largestFileSize,
      };
    });
