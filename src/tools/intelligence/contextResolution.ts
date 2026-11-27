import { understandIntent, type IntelligenceIntent } from "./intentEngine";

export type ContextResolutionSource = "explicit" | "active-task" | "previous-message" | "history" | null;
export type ContextResolutionResult = {
  status: "resolved" | "clarify";
  intent: IntelligenceIntent | null;
  toolId: string | null;
  source: ContextResolutionSource;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type ContextResolutionRecord = {
  scopeId: string;
  intent: IntelligenceIntent | string;
  toolId: string;
  updatedAt: number;
};

export type ContextResolutionInput = {
  message: string;
  scopeId: string;
  now: number;
  activeTask?: ContextResolutionRecord | null;
  previousContext?: ContextResolutionRecord | null;
  history?: ContextResolutionRecord[];
  activeStep?: string | null;
};

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const toolIntents: Partial<Record<IntelligenceIntent, string>> = {
  "image-compress": "image-compress", "image-convert": "image-convert",
  "image-resize": "image-resize", "pdf-merge": "pdf-merge",
  "pdf-split": "pdf-split", "qr-generate": "qr-generate",
  "password-generate": "password-generate", "unit-convert": "unit-convert",
  "text-utilities": "text-utilities", "file-analysis": "file-analysis",
};
const clarify = (reason: string): ContextResolutionResult => ({
  status: "clarify", intent: null, toolId: null, source: null, confidence: "low", reason,
});
function normalize(text: string): string {
  return text.trim().toLocaleLowerCase().replace(/[.!?।,]+/g, " ").replace(/\s+/g, " ").trim();
}
function isFresh(record: ContextResolutionRecord, now: number): boolean {
  return Number.isFinite(record.updatedAt) && record.updatedAt <= now && now - record.updatedAt <= STALE_AFTER_MS;
}
function isFollowUp(text: string): boolean {
  return /\b(wahi|wahi tool|isko|iske saath|pichhla wala|previous|continue|carry on|go ahead|proceed|next step|ab aage|aage karo)\b|(?:वही|इसको|इसके साथ|पिछला वाला|अब आगे|आगे करो|अगला कदम)/i.test(text)
    || /\b(?:aur|thoda)\s+(?:chhota|chota|smaller|compress)\b/i.test(text)
    || /^(?:aur|और)\s+(?:karo|kar|करो|कर)$/i.test(text)
    || /\b(?:make|do)\s+(?:it|this)\s+smaller\b/i.test(text);
}
function compatibleFollowUp(message: string, intent: IntelligenceIntent): boolean {
  const text = normalize(message);
  // Keep ASCII word-boundary matching for English/Hinglish tokens, but match
  // Devanagari words directly because JavaScript \b is not Unicode-aware.
  const englishReference = /\b(?:wahi|isko|continue|next|aage)\b/i.test(text);
  const hindiReference = /(?:वही|इसको|आगे)/.test(text);
  const genericContinuation = /^(?:aur|और)\s+(?:karo|kar|करो|कर)$/i.test(text);
  if (intent === "image-resize") return /(?:aur|thoda|और)\s*(?:chhota|chota|छोटा|smaller)/i.test(text) || englishReference || hindiReference || genericContinuation;
  if (intent === "image-compress") return /compress|compressed|कम|और|aur/i.test(text) || englishReference || /(?:इसके साथ|आगे|वही|इसको)/.test(text) || genericContinuation;
  if (intent === "pdf-split") return /continue|next|aage|page|पेज/i.test(text) || /(?:आगे|वही|इसको)/.test(text) || genericContinuation;
  if (intent === "pdf-merge") return /continue|next|aage|add/i.test(text) || /(?:आगे|वही|इसको|जोड़)/.test(text) || genericContinuation;
  return /\b(?:wahi|isko|pichhla|previous|continue|next|aage)\b/i.test(text) || /(?:आगे|वही|इसको|पिछला)/.test(text) || genericContinuation;
}
function candidate(record: ContextResolutionRecord | null | undefined, scopeId: string, now: number) {
  if (!record || record.scopeId !== scopeId || !isFresh(record, now)) return null;
  const intent = record.intent as IntelligenceIntent;
  const toolId = toolIntents[intent];
  return toolId && toolId === record.toolId ? { intent, toolId } : null;
}
/** Resolves tool-routing context only. It never executes an action. */
export function resolveConversationContext(input: ContextResolutionInput): ContextResolutionResult {
  const message = input.message.trim();
  if (!message || !input.scopeId.trim()) return clarify("Empty message or missing scope.");

  const explicit = understandIntent(message);
  if (explicit.intent !== "unknown" && !explicit.needsClarification && explicit.confidence !== "low") {
    const toolId = toolIntents[explicit.intent];
    if (toolId) return { status: "resolved", intent: explicit.intent, toolId, source: "explicit", confidence: "high", reason: "Explicit request takes priority over prior context." };
  }
  // A generic follow-up can be unknown to the intent engine without being ambiguous.
  // Clarify only when the engine actually detected ambiguous terms or general help.
  if (explicit.needsClarification && (explicit.intent === "general-help" || explicit.matchedTerms.length > 0)) {
    return clarify("The message contains multiple or ambiguous tool intents.");
  }
  if (!isFollowUp(message)) return clarify("No explicit tool intent or recognized context-dependent follow-up.");

  const active = candidate(input.activeTask, input.scopeId, input.now);
  const previous = candidate(input.previousContext, input.scopeId, input.now);
  const historyCandidates = (input.history ?? [])
    .map(record => candidate(record, input.scopeId, input.now))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (active && historyCandidates.some(item => item.intent !== active.intent)) {
    return clarify("Active task and scoped history conflict.");
  }
  const chosen = active ?? previous ?? historyCandidates.at(-1) ?? null;
  if (!chosen) return clarify("No fresh, matching context is available within this scope.");
  if (active && previous && active.intent !== previous.intent) return clarify("Active task and previous-message context conflict.");
  if (!compatibleFollowUp(message, chosen.intent)) return clarify("Follow-up is incompatible with the available task context.");

  const source: ContextResolutionSource = active ? "active-task" : previous ? "previous-message" : "history";
  const reason = source === "active-task" && /^(?:continue|next|ab aage karo|अब आगे करो)$/i.test(normalize(message))
    ? `Workflow continuation resolved for active step ${input.activeStep?.trim() || "unspecified"}.`
    : `Follow-up resolved from fresh ${source} context.`;
  return { status: "resolved", intent: chosen.intent, toolId: chosen.toolId, source, confidence: "medium", reason };
}
