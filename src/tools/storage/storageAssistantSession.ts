/** M11.5 — Clear all evidence tied to the previous file selection. */
export interface StorageAssistantEvidenceState<TFiles extends unknown[], TGroups extends unknown[]> {
  analyzedFiles: TFiles;
  duplicateGroups: TGroups;
  duplicateScanCompleted: boolean;
  similarPhotoScanCompleted: boolean;
  similarPhotoPairCount?: number;
}

export function resetStorageAssistantEvidence<TFiles extends unknown[], TGroups extends unknown[]>(
  _previous: StorageAssistantEvidenceState<TFiles, TGroups>,
): StorageAssistantEvidenceState<TFiles, TGroups> {
  return {
    analyzedFiles: [] as unknown as TFiles,
    duplicateGroups: [] as unknown as TGroups,
    duplicateScanCompleted: false,
    similarPhotoScanCompleted: false,
    similarPhotoPairCount: undefined,
  };
}
/** Reject async scan results produced for a superseded file selection. */
export function isCurrentStorageAssistantSelection(scanVersion: number, currentVersion: number): boolean {
  return scanVersion === currentVersion;
}
