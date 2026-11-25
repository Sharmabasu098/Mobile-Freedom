export type IntelligenceIntent =
  | "image-compress" | "image-convert" | "image-resize"
  | "pdf-merge" | "pdf-split" | "qr-generate" | "password-generate"
  | "unit-convert" | "text-utilities" | "file-analysis"
  | "general-help" | "unknown";

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
  { intent: "image-compress", tool: "Image Compressor", terms: ["compress image", "image compression", "photo compress", "फोटो compress", "फोटो का size कम", "फोटो छोटी", "इमेज छोटी", "छवि छोटी", "image size कम", "image ka size kam"] },
  { intent: "image-convert", tool: "Image Converter", terms: ["convert image", "image format", "jpg to png", "png to jpg", "फोटो format", "इमेज convert", "फोटो का format बदल"] },
  { intent: "image-resize", tool: "Image Resizer", terms: ["resize image", "resize photo", "resize this photo", "image ko resize", "image ko resize kar", "image resize kar do", "image resize karo", "photo ko resize", "photo resize kar do", "image dimensions", "photo resize", "फोटो resize", "फोटो का आकार बदल", "इमेज resize", "फोटो का size बदल", "image ko chhota", "image ko chota", "photo ko chhota", "photo ko chota"] },
  { intent: "pdf-merge", tool: "PDF Merger", terms: ["merge pdf", "combine pdf", "join pdf", "pdf merge", "pdf merge कर", "pdf merge kar", "pdf ek saath", "pdf ek sath", "pdf एक साथ", "pdf जोड़", "pdf जोड़", "pdf मिलाकर", "दो pdf जोड़", "दो pdf मिला", "दो pdf files जोड़", "दो pdf file जोड़", "do pdf combine", "do pdf files jod"] },
  { intent: "pdf-split", tool: "PDF Splitter", terms: ["split pdf", "separate pdf", "pdf अलग", "pdf के पेज अलग", "pdf बांट", "pdf बाँट", "pdf split"] },
  { intent: "qr-generate", tool: "QR Code Generator", terms: ["qr code", "क्यूआर कोड", "qr बनाना", "qr generate", "qr code बना"] },
  { intent: "password-generate", tool: "Password Generator", terms: ["generate password", "strong password", "password बनाना", "पासवर्ड बनाना", "पासवर्ड generate"] },
  { intent: "unit-convert", tool: "Unit Converter", terms: ["convert units", "unit converter", "किलोमीटर से मील", "मीटर से फीट", "kg to", "cm to", "inch to", "units convert"] },
  { intent: "text-utilities", tool: "Text Utilities", terms: ["word count", "character count", "uppercase", "lowercase", "text format", "शब्द गिनना", "अक्षर गिनना", "text बदलना"] },
  { intent: "file-analysis", tool: "File Analysis", terms: ["storage कम है", "storage कम हो गई", "space कम है", "disk space कम", "file analysis", "large files", "duplicate files", "duplicate photos", "फाइल बड़ी", "जगह खाली करना", "स्टोरेज कम", "फोन की storage", "फोन में जगह कम", "phone storage full", "storage full", "phone memory full", "phone me storage kam", "mere phone me storage kam", "phone mein storage kam", "mere phone mein storage kam", "storage kam hai", "storage kam ho gaya", "storage kam ho gayi"] },
];

function normalizeIntentInput(input: string): string {
  return input.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function understandIntent(input: string): IntentMatch {
  const text = normalizeIntentInput(input);
  if (!text) return { intent: "unknown", confidence: "low", matchedTerms: [], needsClarification: true, suggestedTool: null };

  const matches = intentRules
    .map(rule => ({ rule, terms: rule.terms.filter(term => text.includes(term.toLocaleLowerCase())) }))
    .filter(item => item.terms.length > 0);

  // Multiple distinct tool matches are ambiguous: do not choose one automatically.
  if (matches.length > 1) {
    return {
      intent: "unknown",
      confidence: "low",
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


export type IntentContext = { previousIntent?: IntelligenceIntent };

/** Resolve short follow-ups only when a compatible previous intent is available. */
export function understandIntentWithContext(input: string, context?: IntentContext): IntentMatch {
  const direct = understandIntent(input);
  // Explicit new requests always override conversational context.
  if (direct.intent !== "unknown") return direct;

  const text = normalizeIntentInput(input);
  const previous = context?.previousIntent;
  const followUpPhrases = ["aur chhota karo", "aur chota karo", "thoda aur chhota", "thoda aur chota", "make it smaller", "smaller please", "wahi aage karo"];
  const resizeFollowUp = followUpPhrases.some(phrase => text.includes(phrase));
  if (previous === "image-resize" && resizeFollowUp) {
    return { intent: "image-resize", confidence: "medium", matchedTerms: followUpPhrases.filter(phrase => text.includes(phrase)), needsClarification: false, suggestedTool: "Image Resizer" };
  }

  const compressFollowUpPhrases = ["thoda aur compress karo", "aur compress karo", "compress it more", "make it smaller file", "aur compress"];
  const compressFollowUp = compressFollowUpPhrases.some(phrase => text.includes(phrase));
  if (previous === "image-compress" && compressFollowUp) {
    return { intent: "image-compress", confidence: "medium", matchedTerms: compressFollowUpPhrases.filter(phrase => text.includes(phrase)), needsClarification: false, suggestedTool: "Image Compressor" };
  }

  return direct;
}
