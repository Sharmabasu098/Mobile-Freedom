import { describe, expect, it } from "vitest";
import { resolveIntentRoute } from "./intentIntegration";

describe("VF-01.8 command integration — Test-First routing and safety", () => {
  it("routes a clear image compression command to a tool-opening route only", () => {
    expect(resolveIntentRoute("Please compress image size")).toEqual({ kind: "open-tool", toolId: "image-compress" });
  });

  it("routes clear Hindi commands", () => {
    expect(resolveIntentRoute("फोटो compress करो")).toEqual({ kind: "open-tool", toolId: "image-compress" });
  });

  it("routes clear Hinglish commands", () => {
    expect(resolveIntentRoute("Do PDF combine karna hai")).toEqual({ kind: "open-tool", toolId: "pdf-merge" });
  });

  it("maps every supported intent to an existing tool id", () => {
    const cases: Array<[string, string]> = [
      ["Please compress image size", "image-compress"], ["convert image to png", "image-convert"],
      ["resize this photo", "image-resize"], ["merge pdf", "pdf-merge"],
      ["split pdf", "pdf-split"], ["generate QR code", "qr-generate"],
      ["generate a strong password", "password-generate"], ["unit converter", "unit-convert"],
      ["word count", "text-utilities"], ["file analysis", "file-analysis"],
    ];
    for (const [command, toolId] of cases) expect(resolveIntentRoute(command)).toEqual({ kind: "open-tool", toolId });
  });

  it("does not route empty input", () => {
    expect(resolveIntentRoute("")).toEqual({ kind: "clarify" });
    expect(resolveIntentRoute("   \n ")).toEqual({ kind: "clarify" });
  });

  it("does not route unknown input", () => {
    expect(resolveIntentRoute("hello friend")).toEqual({ kind: "clarify" });
  });

  it("asks for clarification when multiple tool intents match", () => {
    expect(resolveIntentRoute("compress image and merge PDF")).toEqual({ kind: "clarify" });
  });

  it("never returns a process, delete, or overwrite action", () => {
    const result = resolveIntentRoute("find duplicate files");
    expect(result.kind).toBe("open-tool");
    if (result.kind === "open-tool") {
      expect(["image-compress", "image-convert", "image-resize", "pdf-merge", "pdf-split", "qr-generate", "password-generate", "unit-convert", "text-utilities", "file-analysis"]).toContain(result.toolId);
    }
  });

  it("does not reuse stale context for an unrelated follow-up", () => {
    expect(resolveIntentRoute("aur kar do", { previousIntent: "image-resize" })).toEqual({ kind: "clarify" });
  });
});

describe("VF-02.1 targeted context-resolution integration", () => {
  it.each(["aur kar do", "next step", "wahi aage karo", "ab kya?"])(
    "clarifies contextless follow-up '%s'",
    (message) => expect(resolveIntentRoute(message)).toEqual({ kind: "clarify" }),
  );

  it("resolves compatible image-resize follow-up from explicit prior intent", () => {
    expect(resolveIntentRoute("aur chhota karo", { previousIntent: "image-resize", isFollowUp: true, previousMessage: "resize photo" }))
      .toEqual({ kind: "open-tool", toolId: "image-resize" });
  });

  it("does not reuse incompatible context", () => {
    expect(resolveIntentRoute("aur chhota karo", { previousIntent: "pdf-merge", isFollowUp: true, previousMessage: "merge PDF" }))
      .toEqual({ kind: "clarify" });
  });

  it("explicit new intent overrides prior context", () => {
    expect(resolveIntentRoute("merge pdf", { previousIntent: "image-resize", isFollowUp: true, previousMessage: "resize image" }))
      .toEqual({ kind: "open-tool", toolId: "pdf-merge" });
  });

  it("clarifies when a message contains multiple tool intents even with context", () => {
    expect(resolveIntentRoute("compress image and merge PDF", { previousIntent: "image-resize" }))
      .toEqual({ kind: "clarify" });
  });

  it("resolves follow-up from history in the matching scope", () => {
    expect(resolveIntentRoute("aur chhota karo", { scopeId: "conversation-1", history: [{ scopeId: "conversation-1", text: "resize photo" }] }))
      .toEqual({ kind: "open-tool", toolId: "image-resize" });
  });

  it("ignores history from a different scope", () => {
    expect(resolveIntentRoute("aur chhota karo", { scopeId: "conversation-1", history: [{ scopeId: "conversation-2", text: "resize photo" }] }))
      .toEqual({ kind: "clarify" });
  });

  it("explicit previous intent takes precedence over scoped history", () => {
    expect(resolveIntentRoute("aur chhota karo", { previousIntent: "image-resize", scopeId: "conversation-1", history: [{ scopeId: "conversation-1", text: "compress image" }] }))
      .toEqual({ kind: "open-tool", toolId: "image-resize" });
  });
});
