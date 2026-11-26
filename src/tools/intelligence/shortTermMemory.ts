export type ShortTermMemoryState = {
  scopeId: string;
  activeTask: string | null;
  activeStep: string | null;
  currentFile: string | null;
  currentComponent: string | null;
  selectedTool: string | null;
  toolPurpose: string | null;
  latestProblem: string | null;
  progress: string | null;
  pendingAction: string | null;
  nextStep: string | null;
  updatedAt: number;
};

export type ShortTermMemoryPatch = Partial<Omit<ShortTermMemoryState, "scopeId" | "updatedAt">>;

const emptyState = (scopeId: string, now: number): ShortTermMemoryState => ({
  scopeId, activeTask: null, activeStep: null, currentFile: null, currentComponent: null,
  selectedTool: null, toolPurpose: null, latestProblem: null, progress: null,
  pendingAction: null, nextStep: null, updatedAt: now,
});

/**
 * VF-02.2 short-lived task state. Memory is isolated by scope and held only
 * in this manager instance; it does not persist to disk or external storage.
 */
export function createShortTermMemory(now: () => number = Date.now) {
  const states = new Map<string, ShortTermMemoryState>();

  return {
    get(scopeId: string): ShortTermMemoryState | null {
      if (!scopeId.trim()) return null;
      const state = states.get(scopeId);
      return state ? { ...state } : null;
    },
    update(scopeId: string, patch: ShortTermMemoryPatch): ShortTermMemoryState | null {
      if (!scopeId.trim()) return null;
      const previous = states.get(scopeId) ?? emptyState(scopeId, now());
      const next = { ...previous, ...patch, scopeId, updatedAt: now() };
      states.set(scopeId, next);
      return { ...next };
    },
    clear(scopeId: string): boolean {
      if (!scopeId.trim()) return false;
      return states.delete(scopeId);
    },
    clearAll(): void {
      states.clear();
    },
  };
}
