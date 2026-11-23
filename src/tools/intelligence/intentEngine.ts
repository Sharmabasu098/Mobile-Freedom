export type IntelligenceIntent =
  | "image-compress"
  | "image-convert"
  | "image-resize"
  | "pdf-merge"
  | "pdf-split"
  | "qr-generate"
  | "password-generate"
  | "unit-convert"
  | "text-utilities"
  | "file-analysis"
  | "general-help"
  | "unknown";

export type IntentMatch = {
  intent: IntelligenceIntent;
  confidence: "high" | "medium" | "low";
  matchedTerms: string[];
  needsClarification: boolean;
  suggestedTool: string | null;
};

/**
 * VF-01 foundation: deterministic, privacy-friendly intent routing.
 * This module only classifies text; it never opens tools or changes files.
 */
const intentRules: Array<{ intent: IntelligenceIntent; tool: string; terms: string[] }> = [
  { intent: "image-compress", tool: "Image Compressor", terms: ["compress image", "image compression", "photo compress", " तस्वीर छोटी", "फोटो छोटी", "इमेज छोटी", "फोटो का size कम", "image size कम", "छवि छोटी"] },
  { intent: "image-convert", tool: "Image Converter", terms: ["convert image", "image format", "jpg to png", "png to jpg", "फोटो format", "इमेज convert", "फोटो बदल"] },
  { intent: "image-resize", tool: "Image Resizer", terms: ["resize image", "image dimensions", "photo resize", "फोटो का आकार", "इमेज resize", "फोटो का size बदल"] },
  { intent: "pdf-merge", tool: "PDF Merger", terms: ["merge pdf", "combine pdf", "join pdf", "pdf जोड़", "pdf जोड़", "pdf मिल", "pdf एक साथ"] },
  { intent: "pdf-split", tool: "PDF Splitter", terms: ["split pdf", "separate pdf", "pdf अलग", "pdf के पेज अलग", "pdf बांट", "pdf बाँट"] },
  { intent: "qr-generate", tool: "QR Code Generator", terms: ["qr code", "qr बन", "क्यूआर", "क्यू r"] },
  { intent: "password-generate", tool: "Password Generator", terms: ["generate password", "strong password", "password बन", "पासवर्ड बन", "पासवर्ड generate"] },
  { intent: "unit-convert", tool: "Unit Converter", terms: ["convert units", "unit converter", "किलोमीटर से", "मीटर से", "kg to", "cm to", "inch to", "units convert"] },
  { intent: "text-utilities", tool: "Text Utilities", terms: ["text tool", "word count", "character count", "uppercase", "lowercase", "text format", "शब्द गिन", "अक्षर गिन", "text बदल"] },
  { intent: "file-analysis", tool: "File Analysis", terms: ["storage कम", "space कम", "disk space", "file analysis", "large files", "duplicate files", "duplicate photos", "फाइल बड़ी", "जगह खाली", "स्टोरेज", "storage", "फोन धीमा", "फोन slow"] },
];

export function understandIntent(input: string): IntentMatch {
  const text = input.trim().toLocaleLowerCase();
  if (!text) {
    return { intent: "unknown", confidence: "low", matchedTerms: [], needsClarification: true, suggestedTool: null };
  }

  const matches = intentRules
    .map(rule => ({ rule, terms: rule.terms.filter(term => text.includes(term.toLocaleLowerCase())) }))
    .filter(item => item.terms.length > 0)
    .sort((a, b) => Math.max(...b.terms.map(term => term.length)) - Math.max(...a.terms.map(term => term.length)));

  if (matches.length === 0) {
    const helpTerms = ["help", "मदद", "समस्या", "problem", "क्या कर", "कैसे कर"];
    const hasGeneralHelp = helpTerms.some(term => text.includes(term));
    return {
      intent: hasGeneralHelp ? "general-help" : "unknown",
      confidence: "low",
      matchedTerms: hasGeneralHelp ? helpTerms.filter(term => text.includes(term)) : [],
      needsClarification: true,
      suggestedTool: null,
    };
  }

  const best = matches[0];
  return {
    intent: best.rule.intent,
    confidence: best.terms.some(term => term.length >= 8) ? "high" : "medium",
    matchedTerms: best.terms,
    needsClarification: matches.length > 1,
    suggestedTool: best.rule.tool,
  };
}
