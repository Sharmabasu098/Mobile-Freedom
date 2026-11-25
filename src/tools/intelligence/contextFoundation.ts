export type ContextHistoryItem = {
  scopeId: string;
  text: string;
};

export type ContextFoundationInput = {
  currentMessage: string;
  activeTask?: string | null;
  previousMessage?: string | null;
  isFollowUp?: boolean;
  scopeId?: string | null;
  history?: ContextHistoryItem[];
};

export type ConversationContext = {
  currentMessage: string;
  activeTask: string | null;
  followUpOf: string | null;
  relevantHistory: ContextHistoryItem[];
  needsClarification: boolean;
};

const contextlessFollowUpTerms = new Set([
  "continue",
  "next",
  "do it",
  "go ahead",
  "aage",
  "आगे",
  "अगला",
  "अगले",
  "करो",
  "haan",
  "yes",
]);

/**
 * Build a short-lived, explicitly supplied context snapshot.
 * This helper does not persist conversation data or infer missing task details.
 */
export function buildConversationContext(input: ContextFoundationInput): ConversationContext {
  const currentMessage = input.currentMessage.trim();
  const normalized = currentMessage.toLowerCase();
  const isContextlessFollowUp = contextlessFollowUpTerms.has(normalized);
  const followUpOf = input.isFollowUp && input.previousMessage?.trim()
    ? input.previousMessage.trim()
    : null;
  const relevantHistory = input.scopeId
    ? (input.history ?? []).filter((item) => item.scopeId === input.scopeId)
    : [];

  return {
    currentMessage,
    activeTask: input.activeTask?.trim() || null,
    followUpOf,
    relevantHistory,
    needsClarification: isContextlessFollowUp && !input.activeTask?.trim() && !followUpOf,
  };
}
