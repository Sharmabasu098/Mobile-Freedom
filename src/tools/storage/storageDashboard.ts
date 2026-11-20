/**
 * M10.1 — Storage Dashboard aggregation foundation.
 * Pure calculations over explicitly supplied file analysis and exact-duplicate groups.
 * Does not inspect device-wide storage, upload, or delete files.
 */
import type { FileAnalysisResult } from "./fileAnalysis";
import type { DuplicateFileGroup } from "./findDuplicates";

export interface StorageTypeSummary {
  type: string;
  fileCount: number;
  totalSize: number;
  percentage: number;
}

export interface StorageDashboardSummary {
  analyzedFileCount: number;
  totalSize: number;
  byType: StorageTypeSummary[];
  largeFiles: FileAnalysisResult[];
  largeFileThreshold: number;
  duplicateGroupCount: number;
  potentialDuplicateSavings: number;
}

export interface StorageDashboardOptions {
  largeFileThreshold?: number;
}

function getTypeLabel(file: FileAnalysisResult): string {
  if (file.type && file.type !== "unknown") return file.type.toLowerCase();
  return file.extension ? `.${file.extension.toLowerCase()}` : "unknown";
}

export function summarizeStorage(
  files: FileAnalysisResult[],
  duplicateGroups: DuplicateFileGroup[] = [],
  options: StorageDashboardOptions = {},
): StorageDashboardSummary {
  const threshold = options.largeFileThreshold ?? 100 * 1024 * 1024;
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("Large-file threshold must be a finite non-negative number.");
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const typeMap = new Map<string, { fileCount: number; totalSize: number }>();

  for (const file of files) {
    const type = getTypeLabel(file);
    const current = typeMap.get(type) ?? { fileCount: 0, totalSize: 0 };
    current.fileCount += 1;
    current.totalSize += file.size;
    typeMap.set(type, current);
  }

  const byType = Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type,
      fileCount: value.fileCount,
      totalSize: value.totalSize,
      percentage: totalSize > 0 ? (value.totalSize / totalSize) * 100 : 0,
    }))
    .sort((a, b) => b.totalSize - a.totalSize || a.type.localeCompare(b.type));

  const largeFiles = files
    .filter((file) => file.size >= threshold)
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));

  const potentialDuplicateSavings = duplicateGroups.reduce(
    (sum, group) => sum + Math.max(0, group.potentialSavings),
    0,
  );

  return {
    analyzedFileCount: files.length,
    totalSize,
    byType,
    largeFiles,
    largeFileThreshold: threshold,
    duplicateGroupCount: duplicateGroups.length,
    potentialDuplicateSavings,
  };
}
