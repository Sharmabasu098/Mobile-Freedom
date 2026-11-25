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

const contextlessFollowUpPatterns = [
  /^(continue|next|do it|go ahead|proceed|carry on|keep going)$/i,
  /^(aage|age|aur|haan|han|yes|ok|okay|theek hai)$/i,
  /^(आगे|अगला|अगले|करो|हाँ|हां|ठीक है|और)$/i,
  /^(?:ठीक है\s+)?(?:आगे|अगला कदम|अगले कदम)$/i,
  /^(?:aur|अौर|और)\s+(?:kar\s+do|kar|karo|कर\s+दो|कर|करो|कर देना)$/i,
  /^(?:next|अगला|अगले)\s+(?:step|कदम)$/i,
  /^(?:wahi|वही)\s+(?:aage|आगे)\s+(?:karo|करो)?$/i,
  /^(?:ab|अब)\s+(?:kya|क्या)(?:\s+karu|\s+करूँ)?$/i,
  /^(?:go|move)\s+(?:on|ahead)$/i,
];

function isContextlessFollowUp(message: string): boolean {
  const normalized = message.trim().toLocaleLowerCase().replace(/[.!?।,]+/g, " ").replace(/\s+/g, " ").trim();
  return contextlessFollowUpPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Build a short-lived, explicitly supplied context snapshot.
 * This helper does not persist conversation data or infer missing task details.
 */
export function buildConversationContext(input: ContextFoundationInput): ConversationContext {
  const currentMessage = input.currentMessage.trim();
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
    needsClarification: isContextlessFollowUp(currentMessage) && !input.activeTask?.trim() && !followUpOf && relevantHistory.length === 0,
  };
}
