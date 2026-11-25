import { buildConversationContext, type ContextHistoryItem } from "./contextFoundation";
import { understandIntent, understandIntentWithContext, type IntelligenceIntent } from "./intentEngine";

export type IntentToolId =
  | "image-compress" | "image-convert" | "image-resize"
  | "pdf-merge" | "pdf-split" | "qr-generate" | "password-generate"
  | "unit-convert" | "text-utilities" | "file-analysis";

export type IntentRoute =
  | { kind: "open-tool"; toolId: IntentToolId }
  | { kind: "clarify" };

const intentToTool: Partial<Record<IntelligenceIntent, IntentToolId>> = {
  "image-compress": "image-compress", "image-convert": "image-convert",
  "image-resize": "image-resize", "pdf-merge": "pdf-merge",
  "pdf-split": "pdf-split", "qr-generate": "qr-generate",
  "password-generate": "password-generate", "unit-convert": "unit-convert",
  "text-utilities": "text-utilities", "file-analysis": "file-analysis",
};

export type IntentResolutionContext = {
  previousIntent?: IntelligenceIntent;
  activeTask?: string | null;
  previousMessage?: string | null;
  isFollowUp?: boolean;
  scopeId?: string | null;
};

/**
 * Resolves a command using the short-lived context snapshot.
 * Explicit new commands take precedence; ambiguous contextless follow-ups fail closed.
 * This only opens a tool route and never executes a tool action.
 */
export function resolveIntentRoute(input: string, context?: IntentResolutionContext): IntentRoute {
  if (!input.trim()) return { kind: "clarify" };

  const snapshot = buildConversationContext({
    currentMessage: input,
    activeTask: context?.activeTask,
    previousMessage: context?.previousMessage,
    isFollowUp: context?.isFollowUp,
    scopeId: context?.scopeId,
    history: context?.history,
  });
  if (snapshot.needsClarification) return { kind: "clarify" };

  const latestHistoryText = snapshot.relevantHistory.at(-1)?.text;
  const historyIntent = latestHistoryText ? understandIntent(latestHistoryText) : undefined;\n  const previousIntent = context?.previousIntent ?? (historyIntent && !historyIntent.needsClarification ? historyIntent.intent : undefined);
  const match = understandIntentWithContext(input, { previousIntent });
  if (match.needsClarification || match.confidence === "low") return { kind: "clarify" };

  const toolId = intentToTool[match.intent];
  if (!toolId) return { kind: "clarify" };
  return { kind: "open-tool", toolId };
}
