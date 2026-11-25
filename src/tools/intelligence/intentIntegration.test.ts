import { describe, expect, it } from "vitest";
import { resolveIntentRoute } from "./intentIntegration";

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
});
