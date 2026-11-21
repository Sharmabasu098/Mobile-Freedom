/**
 * M11.2 — Context & Safety Guards
 *
 * Validates assistant context before insight generation. This module is
 * intentionally fail-closed: invalid or contradictory context is not passed
 * through as trusted assistant input.
 */
import type { StorageAssistantContext } from "./storageAssistant";

export type StorageAssistantContextIssue =
  | "invalid-file-count"
  | "invalid-total-size"
  | "invalid-duplicate-count"
  | "invalid-duplicate-savings"
  | "invalid-large-file-entry"
  | "invalid-similar-photo-count"
  | "similar-photo-count-without-completed-scan"
  | "duplicate-results-without-completed-scan"
  | "duplicate-results-impossible-for-file-count"
  | "duplicate-savings-exceeds-total"
  | "large-file-count-exceeds-analyzed"
  | "invalid-large-file-name"
  | "similar-photo-count-exceeds-possible-pairs";

export interface StorageAssistantContextValidation {
  valid: boolean;
  issues: StorageAssistantContextIssue[];
}

/** Validates fields the assistant uses for factual claims. */
export function validateStorageAssistantContext(
  context: StorageAssistantContext,
): StorageAssistantContextValidation {
  const issues: StorageAssistantContextIssue[] = [];
  const summary = context?.summary;

  if (!summary || !Number.isInteger(summary.analyzedFileCount) || summary.analyzedFileCount < 0) {
    issues.push("invalid-file-count");
  }
  if (!summary || !Number.isFinite(summary.totalSize) || summary.totalSize < 0) {
    issues.push("invalid-total-size");
  }
  if (!summary || !Number.isInteger(summary.duplicateGroupCount) || summary.duplicateGroupCount < 0) {
    issues.push("invalid-duplicate-count");
  }
  if (!summary || !Number.isFinite(summary.potentialDuplicateSavings) || summary.potentialDuplicateSavings < 0) {
    issues.push("invalid-duplicate-savings");
  }

  if (!summary || !Array.isArray(summary.largeFiles) || summary.largeFiles.some((file) =>
    !file || typeof file.name !== "string" || !Number.isFinite(file.size) || file.size < 0
  )) {
    issues.push("invalid-large-file-entry");
  }

  if (summary && Number.isInteger(summary.analyzedFileCount) && summary.analyzedFileCount >= 0 && Number.isInteger(summary.duplicateGroupCount) && summary.duplicateGroupCount > 0 && summary.analyzedFileCount < 2) {
    issues.push("duplicate-results-impossible-for-file-count");
  }
  if (summary && Number.isFinite(summary.totalSize) && summary.totalSize >= 0 && Number.isFinite(summary.potentialDuplicateSavings) && summary.potentialDuplicateSavings > summary.totalSize) {
    issues.push("duplicate-savings-exceeds-total");
  }
  if (summary && Array.isArray(summary.largeFiles) && Number.isInteger(summary.analyzedFileCount) && summary.analyzedFileCount >= 0 && summary.largeFiles.length > summary.analyzedFileCount) {
    issues.push("large-file-count-exceeds-analyzed");
  }
  if (summary && Array.isArray(summary.largeFiles) && summary.largeFiles.some(file => typeof file?.name === "string" && safeAssistantFileName(file.name).trim().length === 0)) {
    issues.push("invalid-large-file-name");
  }
  if (context?.exactDuplicateScanCompleted !== true && summary && (summary.duplicateGroupCount > 0 || summary.potentialDuplicateSavings > 0)) {
    issues.push("duplicate-results-without-completed-scan");
  }

  const pairCount = context?.similarPhotoPairCount;
  if (context?.similarPhotoScanCompleted === true &&
      (pairCount === undefined || !Number.isInteger(pairCount) || pairCount < 0)) {
    issues.push("invalid-similar-photo-count");
  }
  if (context?.similarPhotoScanCompleted === true && typeof pairCount === "number" && Number.isInteger(pairCount) && pairCount >= 0 && summary && Number.isInteger(summary.analyzedFileCount) && summary.analyzedFileCount >= 0) {
    const maxPairs = summary.analyzedFileCount * (summary.analyzedFileCount - 1) / 2;
    if (pairCount > maxPairs) issues.push("similar-photo-count-exceeds-possible-pairs");
  }
  if (context?.similarPhotoScanCompleted !== true && pairCount !== undefined) {
    issues.push("similar-photo-count-without-completed-scan");
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Safe, display-oriented name normalization. Prevents control characters and
 * bounds untrusted filenames included in assistant messages.
 */
export function safeAssistantFileName(name: string, maxLength = 120): string {
  return name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

/** Returns whether the assistant may make claims from this context. */
export function canGenerateStorageAssistantInsights(context: StorageAssistantContext): boolean {
  return validateStorageAssistantContext(context).valid;
}
