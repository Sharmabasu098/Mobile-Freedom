import { describe, expect, it } from "vitest";
import { createShortTermMemory } from "./shortTermMemory";

describe("VF-02.2 Short-Term Memory", () => {
  it("tracks active task, step, file, tool, problem, progress, and next action", () => {
    let clock = 100;
    const memory = createShortTermMemory(() => clock++);
    const state = memory.update("conversation-A", {
      activeTask: "Implement short-term memory",
      activeStep: "Add scoped state API",
      currentFile: "src/tools/intelligence/shortTermMemory.ts",
      currentComponent: "ShortTermMemory",
      selectedTool: "GitHub contents API",
      toolPurpose: "Create isolated branch implementation",
      latestProblem: "No working-state API existed",
      progress: "State shape and API added",
      pendingAction: "Add focused tests",
      nextStep: "Run targeted and regression tests",
    });

    expect(state).toMatchObject({
      scopeId: "conversation-A",
      activeTask: "Implement short-term memory",
      activeStep: "Add scoped state API",
      currentFile: "src/tools/intelligence/shortTermMemory.ts",
      currentComponent: "ShortTermMemory",
      selectedTool: "GitHub contents API",
      toolPurpose: "Create isolated branch implementation",
      latestProblem: "No working-state API existed",
      progress: "State shape and API added",
      pendingAction: "Add focused tests",
      nextStep: "Run targeted and regression tests",
      updatedAt: 101,
    });
  });

  it("keeps state isolated by scope", () => {
    const memory = createShortTermMemory(() => 1);
    memory.update("A", { activeTask: "Task A" });
    memory.update("B", { activeTask: "Task B" });
    expect(memory.get("A")?.activeTask).toBe("Task A");
    expect(memory.get("B")?.activeTask).toBe("Task B");
  });

  it("updates only supplied fields and preserves current task state", () => {
    const memory = createShortTermMemory(() => 1);
    memory.update("A", { activeTask: "Task", currentFile: "file.ts", progress: "Started" });
    const updated = memory.update("A", { progress: "Tests written", nextStep: "Run tests" });
    expect(updated).toMatchObject({ activeTask: "Task", currentFile: "file.ts", progress: "Tests written", nextStep: "Run tests" });
  });

  it("returns defensive copies so callers cannot mutate stored state", () => {
    const memory = createShortTermMemory(() => 1);
    const returned = memory.update("A", { activeTask: "Task" });
    if (returned) returned.activeTask = "Changed externally";
    expect(memory.get("A")?.activeTask).toBe("Task");
  });

  it("clears one scope without affecting others", () => {
    const memory = createShortTermMemory(() => 1);
    memory.update("A", { activeTask: "Task A" });
    memory.update("B", { activeTask: "Task B" });
    expect(memory.clear("A")).toBe(true);
    expect(memory.get("A")).toBeNull();
    expect(memory.get("B")?.activeTask).toBe("Task B");
    expect(memory.clear("missing")).toBe(false);
  });

  it("rejects blank scope IDs and supports clearAll", () => {
    const memory = createShortTermMemory(() => 1);
    expect(memory.get(" ")).toBeNull();
    expect(memory.update(" ", { activeTask: "Unsafe scope" })).toBeNull();
    memory.update("A", { activeTask: "Task" });
    memory.clearAll();
    expect(memory.get("A")).toBeNull();
  });
});
