import { describe, expect, it } from "vitest";
import { understandIntent } from "./intentEngine";

describe("VF-01 deterministic intent understanding", () => {
  it("routes a Hinglish PDF merge request", () => {
    const result = understandIntent("Meri do PDF ek saath merge karni hain");
    expect(result.intent).toBe("pdf-merge");
    expect(result.suggestedTool).toBe("PDF Merger");
  });

  it("routes Hindi storage help conservatively", () => {
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

  it("does not perform actions; returns only a recommendation", () => {
    const result = understandIntent("Generate a strong password");
    expect(result.intent).toBe("password-generate");
    expect(result.suggestedTool).toBe("Password Generator");
  });
});
