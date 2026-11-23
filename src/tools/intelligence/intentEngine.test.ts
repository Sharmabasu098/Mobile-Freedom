import { describe, expect, it } from "vitest";
import { understandIntent } from "./intentEngine";

describe("VF-01 deterministic intent understanding and false-positive guards", () => {
  it("routes a specific Hinglish PDF merge request", () => {
    const result = understandIntent("Meri do PDF ek saath merge karni hain");
    expect(result.intent).toBe("pdf-merge");
    expect(result.suggestedTool).toBe("PDF Merger");
    expect(result.needsClarification).toBe(false);
  });

  it("routes both observed phone-storage phrases to File Analysis", () => {
    for (const message of [
      "Mere phone ka storage kam ho gaya hai",
      "Mere phone me storage kam hai, kya karun?",
    ]) {
      const result = understandIntent(message);
      expect(result.intent).toBe("file-analysis");
      expect(result.suggestedTool).toBe("File Analysis");
      expect(result.needsClarification).toBe(false);
    }
  });

  it("recognizes English image compression", () => {
    expect(understandIntent("Please compress image size").intent).toBe("image-compress");
  });

  it("recognizes greetings without suggesting or executing a tool", () => {
    for (const message of ["Hello friend", "Hi", "Hey there", "नमस्ते"]) {
      const result = understandIntent(message);
      expect(result.intent).toBe("greeting");
      expect(result.suggestedTool).toBe(null);
      expect(result.needsClarification).toBe(false);
    }
  });

  it("does not let a greeting suppress a single tool intent", () => {
    const result = understandIntent("Hello, compress image");
    expect(result.intent).toBe("image-compress");
    expect(result.suggestedTool).toBe("Image Compressor");
    expect(result.needsClarification).toBe(false);
  });

  it("preserves multi-intent when the message also begins with a greeting", () => {
    const result = understandIntent("Hello, compress image and merge PDF");
    expect(result.intent).toBe("multi-intent");
    expect(result.suggestedTool).toBe(null);
    expect(result.needsClarification).toBe(true);
  });

  it("asks clarification for empty or unrelated input", () => {
    expect(understandIntent("").needsClarification).toBe(true);
    expect(understandIntent("random unrelated sentence").intent).toBe("unknown");
    expect(understandIntent("random unrelated sentence").needsClarification).toBe(true);
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

  it("explicitly identifies multiple intents without selecting a tool", () => {
    const result = understandIntent("Compress image and merge PDF");
    expect(result.intent).toBe("multi-intent");
    expect(result.suggestedTool).toBe(null);
    expect(result.needsClarification).toBe(true);
    expect(result.matchedTerms).toContain("compress image");
    expect(result.matchedTerms).toContain("merge pdf");
  });

  it("recognizes explicit password generation but never executes it", () => {
    const result = understandIntent("Generate a strong password");
    expect(result.intent).toBe("password-generate");
    expect(result.suggestedTool).toBe("Password Generator");
  });
});
