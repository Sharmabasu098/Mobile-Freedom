import { describe, expect, it } from "vitest";
import { buildConversationContext } from "./contextFoundation";

describe("VF-02.1 Context Foundation", () => {
  it("AC-01 preserves the current user message as the current context", () => {
    const result = buildConversationContext({ currentMessage: "resize this image" });
    expect(result.currentMessage).toBe("resize this image");
  });

  it("AC-02 carries an explicitly supplied active task", () => {
    const result = buildConversationContext({
      currentMessage: "continue",
      activeTask: "Image Resizer acceptance",
    });
    expect(result.activeTask).toBe("Image Resizer acceptance");
  });

  it("AC-03 links a follow-up only when explicitly marked and a prior message is supplied", () => {
    const result = buildConversationContext({
      currentMessage: "do the next step",
      previousMessage: "Image Resizer opened",
      isFollowUp: true,
    });
    expect(result.followUpOf).toBe("Image Resizer opened");
  });

  it("AC-04 isolates context by task scope and does not include unrelated task history", () => {
    const result = buildConversationContext({
      currentMessage: "continue",
      activeTask: "VF-02.1",
      scopeId: "vf02",
      history: [
        { scopeId: "vf02", text: "Context Foundation" },
        { scopeId: "racenova", text: "RaceNova car selection" },
      ],
    });
    expect(result.relevantHistory.map((item) => item.text)).toEqual(["Context Foundation"]);
  });

  it("AC-05 marks contextless follow-ups as needing clarification", () => {
    const result = buildConversationContext({ currentMessage: "continue" });
    expect(result.needsClarification).toBe(true);
  });

  it("AC-06 does not invent task or follow-up details", () => {
    const result = buildConversationContext({ currentMessage: "hello" });
    expect(result.activeTask).toBeNull();
    expect(result.followUpOf).toBeNull();
    expect(result.relevantHistory).toEqual([]);
  });

  it("AC-07 returns an ephemeral context object and does not persist it", () => {
    const input = { currentMessage: "test", activeTask: "VF-02.1" };
    const result = buildConversationContext(input);
    expect(result).toBeDefined();
    expect(input).toEqual({ currentMessage: "test", activeTask: "VF-02.1" });
  });
});
