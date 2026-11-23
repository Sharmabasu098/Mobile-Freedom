export type IntelligenceIntent =
  | "image-compress" | "image-convert" | "image-resize"
  | "pdf-merge" | "pdf-split" | "qr-generate" | "password-generate"
  | "unit-convert" | "text-utilities" | "file-analysis"
  | "greeting" | "general-help" | "multi-intent" | "unknown";

export type IntentMatch = {
  intent: IntelligenceIntent;
  confidence: "high" | "medium" | "low";
  matchedTerms: string[];
  needsClarification: boolean;
  suggestedTool: string | null;
};

type IntentRule = { intent: IntelligenceIntent; tool: string; terms: string[] };

// Match only relatively specific phrases. Generic words such as "storage", "merge",
// "size", or "slow" intentionally do not trigger a tool on their own.
const intentRules: IntentRule[] = [
  { intent: "image-compress", tool: "Image Compressor", terms: ["compress image", "image compression", "photo compress", "फोटो का size कम", "फोटो छोटी", "इमेज छोटी", "छवि छोटी", "image size कम"] },
  { intent: "image-convert", tool: "Image Converter", terms: ["convert image", "image format", "jpg to png", "png to jpg", "फोटो format", "इमेज convert", "फोटो का format बदल"] },
  { intent: "image-resize", tool: "Image Resizer", terms: ["resize image", "image dimensions", "photo resize", "फोटो का आकार बदल", "इमेज resize", "फोटो का size बदल"] },
  { intent: "pdf-merge", tool: "PDF Merger", terms: ["merge pdf", "combine pdf", "join pdf", "pdf merge", "pdf ek saath", "pdf ek sath", "pdf एक साथ", "pdf जोड़", "pdf जोड़", "pdf मिलाकर", "दो pdf जोड़", "दो pdf मिला"] },
  { intent: "pdf-split", tool: "PDF Splitter", terms: ["split pdf", "separate pdf", "pdf अलग", "pdf के पेज अलग", "pdf बांट", "pdf बाँट", "pdf split"] },
  { intent: "qr-generate", tool: "QR Code Generator", terms: ["qr code", "क्यूआर कोड", "qr बनाना", "qr generate"] },
  { intent: "password-generate", tool: "Password Generator", terms: ["generate password", "strong password", "password बनाना", "पासवर्ड बनाना", "पासवर्ड generate"] },
  { intent: "unit-convert", tool: "Unit Converter", terms: ["convert units", "unit converter", "किलोमीटर से मील", "मीटर से फीट", "kg to", "cm to", "inch to", "units convert"] },
  { intent: "text-utilities", tool: "Text Utilities", terms: ["word count", "character count", "uppercase", "lowercase", "text format", "शब्द गिनना", "अक्षर गिनना", "text बदलना"] },
  { intent: "file-analysis", tool: "File Analysis", terms: ["storage कम है", "storage कम हो गई", "space कम है", "disk space कम", "file analysis", "large files", "duplicate files", "duplicate photos", "फाइल बड़ी", "जगह खाली करना", "स्टोरेज कम", "फोन की storage", "फोन में जगह कम", "phone storage full", "storage full", "phone memory full", "phone me storage kam", "mere phone me storage kam", "phone mein storage kam", "mere phone mein storage kam", "storage kam hai", "storage kam ho gaya", "storage kam ho gayi"] },
];

const greetingTerms = ["hello friend", "hello", "hi friend", "hi", "hey friend", "hey", "namaste", "नमस्ते", "नमस्कार", "राम राम", "सलाम"];

export function understandIntent(input: string): IntentMatch {
  const text = input.trim().toLocaleLowerCase();
  if (!text) return { intent: "unknown", confidence: "low", matchedTerms: [], needsClarification: true, suggestedTool: null };

  const greeting = greetingTerms.find(term => text === term || (term.length > 3 && text.startsWith(term + " ")));
  if (greeting) {
    return { intent: "greeting", confidence: "high", matchedTerms: [greeting], needsClarification: false, suggestedTool: null };
  }

  const matches = intentRules
    .map(rule => ({ rule, terms: rule.terms.filter(term => text.includes(term.toLocaleLowerCase())) }))
    .filter(item => item.terms.length > 0);

  // Multiple distinct tool matches are explicitly reported as multi-intent;
  // no tool is selected or executed without the user clarifying.
  if (matches.length > 1) {
    return {
      intent: "multi-intent",
      confidence: "medium",
      matchedTerms: matches.flatMap(item => item.terms),
      needsClarification: true,
      suggestedTool: null,
    };
  }

  if (matches.length === 0) {
    const helpTerms = ["help", "मदद", "समस्या", "problem", "क्या कर", "कैसे कर"];
    const matched = helpTerms.filter(term => text.includes(term));
    return {
      intent: matched.length ? "general-help" : "unknown",
      confidence: "low",
      matchedTerms: matched,
      needsClarification: true,
      suggestedTool: null,
    };
  }

  const best = matches[0];
  return {
    intent: best.rule.intent,
    confidence: best.terms.some(term => term.length >= 10) ? "high" : "medium",
    matchedTerms: best.terms,
    needsClarification: false,
    suggestedTool: best.rule.tool,
  };
}
