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
  selectedTool?: string | null;
  activeTask?: string | null;
  previousMessage?: string | null;
  isFollowUp?: boolean;
  scopeId?: string | null;
  history?: ContextHistoryItem[];
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
  const historyIntent = latestHistoryText ? understandIntent(latestHistoryText) : undefined;
  const activeTaskIntent = context?.activeTask ? understandIntent(context.activeTask) : undefined;
  const previousMessageIntent = context?.previousMessage ? understandIntent(context.previousMessage) : undefined;
  const selectedToolIntent = context?.selectedTool
    ? (Object.entries(intentToTool).find(([, toolId]) => toolId === context.selectedTool)?.[0] as IntelligenceIntent | undefined)
    : undefined;
  const previousIntent = context?.previousIntent
    ?? selectedToolIntent
    ?? (activeTaskIntent && !activeTaskIntent.needsClarification ? activeTaskIntent.intent : undefined)
    ?? (previousMessageIntent && !previousMessageIntent.needsClarification ? previousMessageIntent.intent : undefined)
    ?? (historyIntent && !historyIntent.needsClarification ? historyIntent.intent : undefined);
  const match = understandIntentWithContext(input, { previousIntent });
  if (match.needsClarification || match.confidence === "low") return { kind: "clarify" };

  const toolId = intentToTool[match.intent];
  if (!toolId) return { kind: "clarify" };
  return { kind: "open-tool", toolId };
}

export type HomepageCommandMemory = {
  get(scopeId: string): { activeTask: string | null; selectedTool: string | null } | null;
  update(scopeId: string, patch: { activeTask: string; activeStep: string; currentFile: string | null; currentComponent: string; selectedTool: string; toolPurpose: string; latestProblem: string | null; progress: string; pendingAction: string; nextStep: string }): unknown;
};


/** The homepage's actual command-resolution + memory-update path, kept pure enough to regression-test. */
export function resolveHomepageCommand(input: string, memory: HomepageCommandMemory, scopeId: string): IntentRoute {
  const previousState = memory.get(scopeId);
  const route = resolveIntentRoute(input, {
    selectedTool: previousState?.selectedTool,
    activeTask: previousState?.activeTask,
    previousMessage: previousState?.activeTask,
    isFollowUp: Boolean(previousState?.activeTask),
    scopeId,
  });
  if (route.kind === "open-tool") {
    memory.update(scopeId, {
      activeTask: input.trim(), activeStep: "Intent resolved and tool route selected",
      currentFile: null, currentComponent: route.toolId, selectedTool: route.toolId,
      toolPurpose: input.trim(), latestProblem: null,
      progress: "Command recognized; selected tool is being opened",
      pendingAction: "Open selected tool",
      nextStep: "Use the selected tool or provide the next command",
    });
  }
  return route;
}
