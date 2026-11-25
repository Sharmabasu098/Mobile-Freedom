import { describe, expect, it } from "vitest";
import { buildConversationContext } from "./contextFoundation";

describe("VF-02.1 Context Foundation targeted gap regressions", () => {
  it.each(["continue", "next step", "aur kar do", "wahi aage karo", "ab kya?", "ठीक है, आगे", "हाँ"])(
    "marks contextless follow-up '%s' for clarification",
    (message) => {
      const result = buildConversationContext({ currentMessage: message });
      expect(result.needsClarification).toBe(true);
      expect(result.activeTask).toBeNull();
      expect(result.followUpOf).toBeNull();
    },
  );

  it("does not require clarification when explicit active task is supplied", () => {
    expect(buildConversationContext({ currentMessage: "next step", activeTask: "Image Resizer" }).needsClarification).toBe(false);
  });

  it("does not require clarification when explicit follow-up linkage is supplied", () => {
    expect(buildConversationContext({ currentMessage: "aur kar do", isFollowUp: true, previousMessage: "resize image" }).needsClarification).toBe(false);
  });
});
