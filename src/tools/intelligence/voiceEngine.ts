/**
 * Pure text guards shared by voice input and output.
 * This module intentionally contains no browser APIs or tool execution.
 */

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeVoiceTranscript(transcript: string): string {
  return normalizeWhitespace(transcript);
}

export function isVoiceTranscriptUsable(transcript: string): boolean {
  return normalizeVoiceTranscript(transcript).length > 0;
}

export function normalizeSpeechText(text: string): string {
  return normalizeWhitespace(text);
}

export function isSpeechTextUsable(text: string): boolean {
  return normalizeSpeechText(text).length > 0;
}
