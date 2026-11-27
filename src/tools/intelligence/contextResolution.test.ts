import { describe, expect, it } from "vitest";
import { resolveConversationContext } from "./contextResolution";

const NOW = 1_000_000;
const fresh = (scopeId: string, intent: string, toolId: string, updatedAt = NOW) => ({
  scopeId, intent, toolId, updatedAt,
});

describe("VF-02.3 Context Resolution Engine — AC-01 to AC-10 test-first", () => {
  it("AC-01: explicit new intent overrides previous task/tool context", () => {
    const result = resolveConversationContext({
      message: "merge PDF",
      scopeId: "A",
      now: NOW,
      activeTask: fresh("A", "image-resize", "image-resize"),
      previousMessage: "resize photo",
      history: [fresh("A", "image-resize", "image-resize")],
    });
    expect(result).toMatchObject({ status: "resolved", intent: "pdf-merge", toolId: "pdf-merge", source: "explicit", confidence: "high" });
  });

  it.each(["wahi", "वही", "wahi tool kholo"])("AC-02: resolves relevant 'wahi' follow-up (%s) from reliable active context", (message) => {
    const result = resolveConversationContext({
      message, scopeId: "A", now: NOW,
      activeTask: fresh("A", "image-resize", "image-resize"),
    });
    expect(result).toMatchObject({ status: "resolved", toolId: "image-resize", source: "active-task" });
  });

  it.each(["isko karo", "इसको करो", "iske saath"])("AC-03: resolves 'isko' reference in current active task (%s)", (message) => {
    const result = resolveConversationContext({
      message, scopeId: "A", now: NOW,
      activeTask: fresh("A", "image-compress", "image-compress"),
    });
    expect(result).toMatchObject({ status: "resolved", toolId: "image-compress", source: "active-task" });
  });

  it.each(["pichhla wala", "पिछला वाला"])("AC-04: resolves previous selection only when scoped previous context is reliable (%s)", (message) => {
    const result = resolveConversationContext({
      message, scopeId: "A", now: NOW,
      previousContext: fresh("A", "qr-generate", "qr-generate"),
    });
    expect(result).toMatchObject({ status: "resolved", toolId: "qr-generate", source: "previous-message" });
  });

  it.each(["ab aage karo", "अब आगे करो", "continue"])("AC-05: resolves next-step follow-up from an active workflow (%s)", (message) => {
    const result = resolveConversationContext({
      message, scopeId: "A", now: NOW,
      activeTask: fresh("A", "pdf-split", "pdf-split"),
      activeStep: "choose-pages",
    });
    expect(result).toMatchObject({ status: "resolved", toolId: "pdf-split", source: "active-task" });
  });

  it("AC-06: incompatible follow-up does not open a wrong tool and asks clarification", () => {
    const result = resolveConversationContext({
      message: "aur chhota karo", scopeId: "A", now: NOW,
      activeTask: fresh("A", "pdf-merge", "pdf-merge"),
    });
    expect(result).toMatchObject({ status: "clarify", intent: null, toolId: null, confidence: "low" });
  });

  it("AC-07: context from another scope is ignored", () => {
    const result = resolveConversationContext({
      message: "aur chhota karo", scopeId: "A", now: NOW,
      activeTask: fresh("B", "image-resize", "image-resize"),
      history: [fresh("B", "image-resize", "image-resize")],
    });
    expect(result).toMatchObject({ status: "clarify", intent: null, toolId: null });
  });

  it("AC-08: conflicting memory and history context safely clarifies", () => {
    const result = resolveConversationContext({
      message: "wahi aage karo", scopeId: "A", now: NOW,
      activeTask: fresh("A", "image-resize", "image-resize"),
      history: [fresh("A", "pdf-merge", "pdf-merge")],
    });
    expect(result).toMatchObject({ status: "clarify", intent: null, toolId: null, confidence: "low" });
  });

  it("AC-09: missing or stale context does not guess a tool", () => {
    const missing = resolveConversationContext({ message: "aur karo", scopeId: "A", now: NOW });
    const stale = resolveConversationContext({
      message: "aur karo", scopeId: "A", now: NOW,
      activeTask: fresh("A", "image-resize", "image-resize", NOW - 86_400_001),
    });
    expect(missing).toMatchObject({ status: "clarify", intent: null, toolId: null });
    expect(stale).toMatchObject({ status: "clarify", intent: null, toolId: null });
  });

  it("AC-10: VF-02.2 regression — resize photo then 'aur chhota karo' remains on Image Resizer", () => {
    const first = resolveConversationContext({ message: "resize photo", scopeId: "A", now: NOW });
    expect(first).toMatchObject({ status: "resolved", intent: "image-resize", toolId: "image-resize", source: "explicit" });

    const followUp = resolveConversationContext({
      message: "aur chhota karo", scopeId: "A", now: NOW,
      activeTask: fresh("A", "image-resize", "image-resize"),
      previousContext: fresh("A", "image-resize", "image-resize"),
    });
    expect(followUp).toMatchObject({ status: "resolved", toolId: "image-resize" });
  });
});
