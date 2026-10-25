/**
 * Mobile Freedom — M8.5 Batch File Analysis
 *
 * Processes selected files in controlled batches.
 * Files remain local; nothing is uploaded or deleted.
 */

import {
  analyzeFiles,
  type FileAnalysisResult,
} from "./fileAnalysis";

/**
 * Analyzes selected files in sequential batches.
 *
 * Batch processing limits the number of file metadata
 * operations performed in each batch.
 */
export function analyzeFilesInBatches(
  files: File[],
  batchSize = 50,
): FileAnalysisResult[] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Batch size must be a positive integer.");
  }

  const results: FileAnalysisResult[] = [];

  for (let start = 0; start < files.length; start += batchSize) {
    const batch = files.slice(start, start + batchSize);

    results.push(...analyzeFiles(batch));
  }

  return results;
}
