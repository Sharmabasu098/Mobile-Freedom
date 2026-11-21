/**
 * M10.1/M10.2 — Storage dashboard aggregation and file-type intelligence.
 * Pure calculations over explicitly supplied analyzed files and duplicate groups.
 * Does not inspect device-wide storage, upload, or delete files.
 */
import type { FileAnalysisResult } from "./fileAnalysis";
import type { DuplicateFileGroup } from "./findDuplicates";

export type StorageCategory = "images" | "videos" | "documents" | "audio" | "archives" | "other" | "unknown";

export interface StorageTypeSummary {
  type: string;
  fileCount: number;
  totalSize: number;
  percentage: number;
}

export interface StorageCategorySummary {
  category: StorageCategory;
  fileCount: number;
  totalSize: number;
  percentage: number;
}

export interface StorageDashboardSummary {
  analyzedFileCount: number;
  totalSize: number;
  byType: StorageTypeSummary[];
  byCategory: StorageCategorySummary[];
  largeFiles: FileAnalysisResult[];
  largestFiles: FileAnalysisResult[];
  largestFilesLimit: number;
  largeFileThreshold: number;
  duplicateGroupCount: number;
  potentialDuplicateSavings: number;
}

export interface StorageDashboardOptions {
  largeFileThreshold?: number;
  largestFilesLimit?: number;
}

function getTypeLabel(file: FileAnalysisResult): string {
  if (file.type && file.type !== "unknown") return file.type.toLowerCase();
  return file.extension ? `.${file.extension.toLowerCase()}` : "unknown";
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "avi", "mkv", "webm", "mpeg", "mpg", "3gp", "ts"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "csv", "xls", "xlsx", "ods", "ppt", "pptx", "odp"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "aac", "m4a", "ogg", "flac", "wma", "mid", "midi"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"]);

function classifyFile(file: FileAnalysisResult): StorageCategory {
  const mime = (file.type || "").toLowerCase().split(";")[0].trim();
  const ext = (file.extension || "").toLowerCase().replace(/^\./, "");
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return "images";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "videos";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (mime === "application/zip" || mime.includes("compressed") || ARCHIVE_EXTENSIONS.has(ext)) return "archives";
  if (mime === "unknown" || !mime) {
    if (DOCUMENT_EXTENSIONS.has(ext)) return "documents";
    if (!ext) return "unknown";
  }
  if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("word") || mime.includes("spreadsheet") || mime.includes("presentation")) return "documents";
  if (DOCUMENT_EXTENSIONS.has(ext)) return "documents";
  return "other";
}

const CATEGORY_ORDER: StorageCategory[] = ["images", "videos", "documents", "audio", "archives", "other", "unknown"];

export function summarizeStorage(
  files: FileAnalysisResult[],
  duplicateGroups: DuplicateFileGroup[] = [],
  options: StorageDashboardOptions = {},
): StorageDashboardSummary {
  const threshold = options.largeFileThreshold ?? 100 * 1024 * 1024;
  const largestFilesLimit = options.largestFilesLimit ?? 10;
  if (!Number.isInteger(largestFilesLimit) || largestFilesLimit < 0) {
    throw new Error("Largest-files limit must be a non-negative integer.");
  }
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("Large-file threshold must be a finite non-negative number.");
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const typeMap = new Map<string, { fileCount: number; totalSize: number }>();
  const categoryMap = new Map<StorageCategory, { fileCount: number; totalSize: number }>();

  for (const file of files) {
    const type = getTypeLabel(file);
    const current = typeMap.get(type) ?? { fileCount: 0, totalSize: 0 };
    current.fileCount += 1;
    current.totalSize += file.size;
    typeMap.set(type, current);

    const category = classifyFile(file);
    const categoryTotal = categoryMap.get(category) ?? { fileCount: 0, totalSize: 0 };
    categoryTotal.fileCount += 1;
    categoryTotal.totalSize += file.size;
    categoryMap.set(category, categoryTotal);
  }

  const byType = Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type,
      fileCount: value.fileCount,
      totalSize: value.totalSize,
      percentage: totalSize > 0 ? (value.totalSize / totalSize) * 100 : 0,
    }))
    .sort((a, b) => b.totalSize - a.totalSize || a.type.localeCompare(b.type));

  const byCategory = CATEGORY_ORDER
    .filter((category) => categoryMap.has(category))
    .map((category) => {
      const value = categoryMap.get(category)!;
      return {
        category,
        fileCount: value.fileCount,
        totalSize: value.totalSize,
        percentage: totalSize > 0 ? (value.totalSize / totalSize) * 100 : 0,
      };
    });

  const sortedFiles = [...files].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  const largeFiles = sortedFiles.filter((file) => file.size >= threshold);
  const largestFiles = sortedFiles.slice(0, largestFilesLimit);

  // M10.4: derive potential savings from validated file sizes, never trust
  // cached group totals/savings. Deduplicate groups and reject overlapping
  // file membership to avoid counting the same file across groups.
  const seenHashes = new Set<string>();
  const usedFiles = new Set<File>();
  let duplicateGroupCount = 0;
  let potentialDuplicateSavings = 0;

  for (const group of duplicateGroups) {
    if (!group.hash || seenHashes.has(group.hash)) continue;
    seenHashes.add(group.hash);

    const uniqueFiles = Array.from(new Set(group.files));
    if (uniqueFiles.length < 2) continue;
    if (uniqueFiles.some((file) => !Number.isFinite(file.size) || file.size < 0)) continue;
    if (uniqueFiles.some((file) => usedFiles.has(file))) continue;

    const sizes = uniqueFiles.map((file) => file.size);
    const groupTotal = sizes.reduce((sum, size) => sum + size, 0);
    const retainedSize = Math.max(...sizes);
    const savings = Math.max(0, groupTotal - retainedSize);

    uniqueFiles.forEach((file) => usedFiles.add(file));
    duplicateGroupCount += 1;
    potentialDuplicateSavings += savings;
  }

  return {
    analyzedFileCount: files.length,
    totalSize,
    byType,
    byCategory,
    largeFiles,
    largestFiles,
    largestFilesLimit,
    largeFileThreshold: threshold,
    duplicateGroupCount,
    potentialDuplicateSavings,
  };
}
