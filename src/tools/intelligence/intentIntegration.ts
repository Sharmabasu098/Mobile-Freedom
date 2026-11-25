import { understandIntent, type IntelligenceIntent } from "./intentEngine";

export type IntentToolId =
  | "image-compress"
  | "image-convert"
  | "image-resize"
  | "pdf-merge"
  | "pdf-split"
  | "qr-generate"
  | "password-generate"
  | "unit-convert"
  | "text-utilities"
  | "file-analysis";

export type IntentRoute =
  | { kind: "open-tool"; toolId: IntentToolId }
  | { kind: "clarify" };

const intentToTool: Partial<Record<IntelligenceIntent, IntentToolId>> = {
  "image-compress": "image-compress",
  "image-convert": "image-convert",
  "image-resize": "image-resize",
  "pdf-merge": "pdf-merge",
  "pdf-split": "pdf-split",
  "qr-generate": "qr-generate",
  "password-generate": "password-generate",
  "unit-convert": "unit-convert",
  "text-utilities": "text-utilities",
  "file-analysis": "file-analysis",
};

/**
 * Safely resolves a natural-language command to an existing tool-opening route.
 * This intentionally does not execute, process, delete, or overwrite anything.
 * Context is not reused here: short or ambiguous follow-ups must be clarified.
 */
export function resolveIntentRoute(
  input: string,
  _context?: { previousIntent?: IntelligenceIntent },
): IntentRoute {
  if (!input.trim()) return { kind: "clarify" };

  const match = understandIntent(input);
  if (match.needsClarification || match.confidence === "low") {
    return { kind: "clarify" };
  }

  const toolId = intentToTool[match.intent];
  if (!toolId) return { kind: "clarify" };

  return { kind: "open-tool", toolId };
}
