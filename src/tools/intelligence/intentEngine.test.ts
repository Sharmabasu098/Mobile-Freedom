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
  it("understands Hindi and Hinglish image compression variations", () => {
    for (const message of ["फोटो compress करो", "Photo compress karna hai", "Image ka size kam karo"]) {
      const result = understandIntent(message);
      expect(result.intent).toBe("image-compress");
      expect(result.suggestedTool).toBe("Image Compressor");
      expect(result.needsClarification).toBe(false);
    }
  });

  it("understands mixed Hindi-English PDF merge requests", () => {
    for (const message of ["PDF merge कर दो", "दो PDF files जोड़ दो", "Do PDF combine karna hai"]) {
      const result = understandIntent(message);
      expect(result.intent).toBe("pdf-merge");
      expect(result.suggestedTool).toBe("PDF Merger");
      expect(result.needsClarification).toBe(false);
    }
  });

  it("understands Hindi and Hinglish image resizing variations", () => {
    for (const message of ["फोटो resize करना है", "Resize this photo", "Image ko chhota karna hai"]) {
      const result = understandIntent(message);
      expect(result.intent).toBe("image-resize");
      expect(result.suggestedTool).toBe("Image Resizer");
      expect(result.needsClarification).toBe(false);
    }
  });

  it("understands Hindi QR generation request", () => {
    const result = understandIntent("QR code बना दो");
    expect(result.intent).toBe("qr-generate");
    expect(result.suggestedTool).toBe("QR Code Generator");
    expect(result.needsClarification).toBe(false);
  });

  it("keeps unrelated mixed-language phrases from false-routing", () => {
    for (const message of ["photo aur PDF ke baare mein batao", "size kam kaise hota hai"]) {
      const result = understandIntent(message);
      expect(result.suggestedTool).toBe(null);
      expect(result.needsClarification).toBe(true);
    }
  });

});
