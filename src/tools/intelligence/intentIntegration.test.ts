import { describe, expect, it } from "vitest";
import { resolveIntentRoute } from "./intentIntegration";

describe("VF-01.8 command integration — Test-First routing and safety", () => {
  it("routes a clear image compression command to a tool-opening route only", () => {
    const result = resolveIntentRoute("Please compress image size");
    expect(result).toEqual({ kind: "open-tool", toolId: "image-compress" });
  });

  it("routes clear Hindi commands", () => {
    expect(resolveIntentRoute("फोटो compress करो")).toEqual({
      kind: "open-tool",
      toolId: "image-compress",
    });
  });

  it("routes clear Hinglish commands", () => {
    expect(resolveIntentRoute("Do PDF combine karna hai")).toEqual({
      kind: "open-tool",
      toolId: "pdf-merge",
    });
  });

  it("maps every supported intent to an existing tool id", () => {
    const cases: Array<[string, string]> = [
      ["Please compress image size", "image-compress"],
      ["convert image to png", "image-convert"],
      ["resize this photo", "image-resize"],
      ["merge pdf", "pdf-merge"],
      ["split pdf", "pdf-split"],
      ["generate QR code", "qr-generate"],
      ["generate a strong password", "password-generate"],
      ["unit converter", "unit-convert"],
      ["word count", "text-utilities"],
      ["file analysis", "file-analysis"],
    ];
    for (const [command, toolId] of cases) {
      expect(resolveIntentRoute(command)).toEqual({ kind: "open-tool", toolId });
    }
  });

  it("does not route empty input", () => {
    expect(resolveIntentRoute("")).toEqual({ kind: "clarify" });
    expect(resolveIntentRoute("   \n ")).toEqual({ kind: "clarify" });
  });

  it("does not route unknown input", () => {
    expect(resolveIntentRoute("hello friend")).toEqual({ kind: "clarify" });
  });

  it("asks for clarification when multiple tool intents match", () => {
    expect(resolveIntentRoute("compress image and merge PDF")).toEqual({
      kind: "clarify",
    });
  });

  it("never returns a process, delete, or overwrite action", () => {
    const result = resolveIntentRoute("find duplicate files");
    expect(result.kind).toBe("open-tool");
    if (result.kind === "open-tool") {
      expect(["image-compress", "image-convert", "image-resize", "pdf-merge", "pdf-split", "qr-generate", "password-generate", "unit-convert", "text-utilities", "file-analysis"]).toContain(result.toolId);
    }
  });

  it("does not reuse stale context for an unrelated follow-up", () => {
    expect(resolveIntentRoute("aur kar do", { previousIntent: "image-resize" })).toEqual({
      kind: "clarify",
    });
  });
});
