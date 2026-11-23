import { describe, expect, it } from "vitest";
import { understandIntent } from "./intentEngine";

describe("VF-01 deterministic intent understanding and false-positive guards", () => {
  it("routes a specific Hinglish PDF merge request", () => {
    const result = understandIntent("Meri do PDF ek saath merge karni hain");
    expect(result.intent).toBe("pdf-merge");
    expect(result.suggestedTool).toBe("PDF Merger");
    expect(result.needsClarification).toBe(false);
  });

  it("routes explicit Hindi storage cleanup intent", () => {
    const result = understandIntent("Mere phone me storage kam hai, kya karun?");
    expect(result.intent).toBe("file-analysis");
    expect(result.suggestedTool).toBe("File Analysis");
  });

  it("recognizes English image compression", () => {
    expect(understandIntent("Please compress image size").intent).toBe("image-compress");
  });

  it("asks clarification for empty or unrelated input", () => {
    expect(understandIntent("").needsClarification).toBe(true);
    expect(understandIntent("hello friend").intent).toBe("unknown");
    expect(understandIntent("hello friend").needsClarification).toBe(true);
  });

  it("does not route generic storage mentions", () => {
    for (const message of ["Tell me about storage", "storage", "My phone is slow", "I have a problem"]) {
      const result = understandIntent(message);
      expect(result.suggestedTool).toBe(null);
      expect(result.needsClarification).toBe(true);
    }
  });

  it("does not route generic merge without PDF context", () => {
    const result = understandIntent("Can you merge these things?");
    expect(result.intent).toBe("unknown");
    expect(result.suggestedTool).toBe(null);
    expect(result.needsClarification).toBe(true);
  });

  it("returns clarification instead of selecting when multiple tools match", () => {
    const result = understandIntent("Compress image and merge PDF");
    expect(result.intent).toBe("unknown");
    expect(result.suggestedTool).toBe(null);
    expect(result.needsClarification).toBe(true);
  });

  it("recognizes explicit password generation but never executes it", () => {
    const result = understandIntent("Generate a strong password");
    expect(result.intent).toBe("password-generate");
    expect(result.suggestedTool).toBe("Password Generator");
  });
});
