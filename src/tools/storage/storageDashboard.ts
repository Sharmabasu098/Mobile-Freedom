/**
 * Mobile Freedom — M10 Storage Intelligence Dashboard aggregation.
 *
 * Pure aggregation over user-selected file analysis results and existing
 * M8/M9 findings. This module does not read, upload, modify, or delete files.
 */

import type { FileAnalysisResult } from "./fileAnalysis";
import type { DuplicateFileGroup } from "./findDuplicates";
import type { SimilarPhotoPair } from "./similarPhotos";

export type StorageCategory =
  | "images"
  | "videos"
  | "audio"
  | "documents"
  | "other";

export interface StorageCategorySummary {
  category: StorageCategory;
  fileCount: number;
  totalBytes: number;
}

export interface StorageDashboardInput {
  analyzedFiles: FileAnalysisResult[];
  largeFileThresholdBytes?: number;
  duplicateGroups?: DuplicateFileGroup[];
  duplicateFailures?: File[];
  similarPairs?: SimilarPhotoPair[];
  similarFailures?: File[];
}

export interface StorageDashboardSummary {
  analyzedFileCount: number;
  analysisFailureCount: number;
  totalAnalyzedBytes: number;
  categories: StorageCategorySummary[];
  largeFileThresholdBytes: number;
  largeFileCount: number;
  largeFileTotalBytes: number;
  largestFiles: FileAnalysisResult[];
  exactDuplicateGroupCount: number;
  exactDuplicateFileCount: number;
  estimatedDuplicateSavingsBytes: number;
  duplicateFailureCount: number;
  visuallySimilarPairCount: number;
  similarPhotoFailureCount: number;
}

const DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "odt", "rtf", "txt",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
]);

const AUDIO_EXTENSIONS = new Set([
  "aac", "flac", "m4a", "mp3", "ogg", "wav", "wma",
]);

function classifyStorageCategory(
  file: Pick<FileAnalysisResult, "type" | "extension">,
): StorageCategory {
  const mime = file.type.toLowerCase();
  const extension = file.extension.toLowerCase();

  if (mime.startsWith("image/")) return "images";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audio";

  if (
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    mime.includes("document") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation") ||
    DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return "documents";
  }

  if (AUDIO_EXTENSIONS.has(extension)) return "audio";

  return "other";
}

export function buildStorageDashboardSummary(
  input: StorageDashboardInput,
): StorageDashboardSummary {
  const threshold = input.largeFileThresholdBytes ?? 100 * 1024 * 1024;

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("Large-file threshold must be a finite non-negative number.");
  }

  const categoryTotals = new Map<StorageCategory, StorageCategorySummary>(
    (["images", "videos", "audio", "documents", "other"] as const).map(
      category => [category, { category, fileCount: 0, totalBytes: 0 }],
    ),
  );

  let totalAnalyzedBytes = 0;
  for (const file of input.analyzedFiles) {
    if (!Number.isFinite(file.size) || file.size < 0) {
      throw new Error("Analyzed file sizes must be finite non-negative numbers.");
    }

    totalAnalyzedBytes += file.size;
    const category = classifyStorageCategory(file);
    const summary = categoryTotals.get(category);
    if (summary) {
      summary.fileCount += 1;
      summary.totalBytes += file.size;
    }
  }

  const largeFiles = input.analyzedFiles
    .filter(file => file.size >= threshold)
    .slice()
    .sort((first, second) =>
      second.size - first.size || first.name.localeCompare(second.name),
    );

  const duplicateGroups = input.duplicateGroups ?? [];
  const duplicateFileNames = new Set<string>();
  let estimatedDuplicateSavingsBytes = 0;

  for (const group of duplicateGroups) {
    if (group.files.length < 2) {
      throw new Error("Exact duplicate groups must contain at least two files.");
    }
    estimatedDuplicateSavingsBytes += group.potentialSavings;
    for (const file of group.files) {
      duplicateFileNames.add(file.name);
    }
  }

  return {
    analyzedFileCount: input.analyzedFiles.length,
    analysisFailureCount: 0,
    totalAnalyzedBytes,
    categories: Array.from(categoryTotals.values()),
    largeFileThresholdBytes: threshold,
    largeFileCount: largeFiles.length,
    largeFileTotalBytes: largeFiles.reduce((sum, file) => sum + file.size, 0),
    largestFiles: largeFiles.slice(0, 10),
    exactDuplicateGroupCount: duplicateGroups.length,
    exactDuplicateFileCount: duplicateFileNames.size,
    estimatedDuplicateSavingsBytes,
    duplicateFailureCount: input.duplicateFailures?.length ?? 0,
    visuallySimilarPairCount: input.similarPairs?.length ?? 0,
    similarPhotoFailureCount: input.similarFailures?.length ?? 0,
  };
}
