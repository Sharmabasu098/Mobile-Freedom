/**
 * Mobile Freedom — M8.1 File Analysis Engine
 *
 * Analyzes user-selected files locally in the browser.
 * This module does not upload or delete files.
 */

export interface FileAnalysisResult {
  name: string;
  size: number;
  type: string;
  extension: string;
  lastModified: number;
}

export interface FileAnalysisOptions {
  largeFileThreshold?: number;
}

/**
 * Returns a readable file extension.
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Analyzes one selected file.
 */
export function analyzeFile(
  file: File,
): FileAnalysisResult {
  if (file.size < 0) {
    throw new Error("Invalid file size.");
  }

  return {
    name: file.name,
    size: file.size,
    type: file.type || "unknown",
    extension: getFileExtension(file.name),
    lastModified: file.lastModified,
  };
}

/**
 * Analyzes multiple selected files.
 */
export function analyzeFiles(
  files: File[],
): FileAnalysisResult[] {
  return files.map((file) => analyzeFile(file));
}

/**
 * Returns files larger than the selected threshold.
 * Default threshold: 100 MB.
 */
export function findLargeFiles(
  files: File[],
  options: FileAnalysisOptions = {},
): FileAnalysisResult[] {
  const threshold =
    options.largeFileThreshold ?? 100 * 1024 * 1024;

  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("File size threshold must be valid.");
  }

  return analyzeFiles(files).filter(
    (file) => file.size >= threshold,
  );
}

/**
 * Calculates the total size of selected files.
 */
export function calculateTotalSize(
  files: File[],
): number {
  return files.reduce(
    (total, file) => total + file.size,
    0,
  );
}
