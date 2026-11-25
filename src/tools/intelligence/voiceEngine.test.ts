import { describe, expect, it } from "vitest";
import {
  normalizeVoiceTranscript,
  isVoiceTranscriptUsable,
  normalizeSpeechText,
  isSpeechTextUsable,
} from "./voiceEngine";

describe("VF-01.7 voice input normalization", () => {
  it("trims and collapses whitespace in recognized speech", () => {
    expect(normalizeVoiceTranscript("  resize   this   photo  ")).toBe(
      "resize this photo"
    );
  });

  it("preserves Hindi and Hinglish words while normalizing spacing", () => {
    expect(normalizeVoiceTranscript("  फोटो   compress   कर दो  ")).toBe(
      "फोटो compress कर दो"
    );
  });

  it("rejects empty or whitespace-only transcripts", () => {
    expect(isVoiceTranscriptUsable("")).toBe(false);
    expect(isVoiceTranscriptUsable("   \n  ")).toBe(false);
    expect(isVoiceTranscriptUsable("compress photo")).toBe(true);
  });
});

describe("VF-01.7 voice output text guards", () => {
  it("trims and collapses whitespace before speech", () => {
    expect(normalizeSpeechText("  Your   file   is   ready.  ")).toBe(
      "Your file is ready."
    );
  });

  it("rejects empty or whitespace-only speech text", () => {
    expect(isSpeechTextUsable("")).toBe(false);
    expect(isSpeechTextUsable("   \n  ")).toBe(false);
    expect(isSpeechTextUsable("Done")).toBe(true);
  });
});
