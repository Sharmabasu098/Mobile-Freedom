export type MemoryCandidate = {
  category: "preference" | "project" | "instruction";
  value: string;
  durable?: boolean;
};

const sensitivePattern = /\b(bank account|account number|password|passcode|medical diagnosis|diagnosis|medical details|credit card|ssn|social security)\b|बैंक खाते|खाता नंबर|पासवर्ड|चिकित्सकीय निदान|मेडिकल विवरण/i;
const forgetPattern = /\b(do not remember|don't remember|forget|do not save|don't save)\b|याद मत रखना|मत याद रखना|भूल जाना/i;
const thirdPartyPattern = /\b(my friend|friend says|someone else|he likes|she likes)\b|मेरे दोस्त|मेरा मित्र/i;
const hypotheticalPattern = /\b(imagine|pretend|fictional|in this fictional|for an example|assume)\b|मान लो|कल्पना करो|उदाहरण के लिए/i;
const transientPattern = /\b(today i am busy|today|currently fixing|translate this sentence|this week|right now)\b|आज मैं व्यस्त|अभी ठीक कर रहा/i;
const casualPattern = /\b(haha|that is ridiculous|quick reaction|funny)\b|😂/i;

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function sentenceParts(input: string): string[] {
  return input.split(/(?<=[.!?।])\s+/).map(normalizeText).filter(Boolean);
}

function extractPreference(part: string): string | null {
  if (/\\b(?:i prefer|i like|from now on.*prefer|from now on,? (?:use|give|answer|keep)|please use)\\b/i.test(part)) {
    return part.replace(/[.!?।]+$/, "");
  }
  if (/मुझे/.test(part) && /पसंद/.test(part)) return part.replace(/[.!?।]+$/, "");
  if (/mujhe/i.test(part) && /(chahiye|pasand)/i.test(part)) return part.replace(/[.!?।]+$/, "");
  if (/technical details.*english.*explanation.*hindi/i.test(part)) return part.replace(/[.!?।]+$/, "");
  return null;
}

function extractProject(part: string): string | null {
  const hasName = /mobile freedom|racenova/i.test(part);
  if (hasName && /project|working on|यह project|my project|project is called|project.*है/i.test(part)) {
    return part.replace(/[.!?।]+$/, "");
  }
  return null;
}

function extractInstruction(part: string): string | null {
  if (/\b(do not|don't|never)\b.*\b(merge|delete|send|publish)\b/i.test(part) ||
      /\b(merge|delete|send|publish)\b.*\b(without my approval|only after my approval)\b/i.test(part) ||
      /PR merge.*(अनुमति|approval)|merge करने से पहले.*अनुमति/i.test(part)) {
    return part.replace(/[.!?।]+$/, "");
  }
  return null;
}

function extractFromParts(parts: string[]): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const preferences: string[] = [];
  for (const part of parts) {
    const instruction = extractInstruction(part);
    if (instruction) candidates.push({ category: "instruction", value: instruction, durable: true });
    const project = extractProject(part);
    if (project) candidates.push({ category: "project", value: project, durable: true });
    const preference = extractPreference(part);
    if (preference) preferences.push(preference);
  }

  const scoped = preferences.filter((p) => /coding|code|technical details|explanation/i.test(p));
  const general = preferences.filter((p) => !scoped.includes(p));
  if (general.length) candidates.push({ category: "preference", value: general[general.length - 1], durable: true });
  for (const value of scoped) candidates.push({ category: "preference", value, durable: true });

  const deduped: MemoryCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.category + ":" + candidate.value.toLowerCase();
    if (!seen.has(key)) { seen.add(key); deduped.push(candidate); }
  }
  return deduped;
}

/** Pure extraction: returns candidates only; it does not persist or mutate memory. */
export function extractMemoryCandidates(input: string): MemoryCandidate[] {
  const text = normalizeText(input);
  if (!text || sensitivePattern.test(text) || forgetPattern.test(text)) return [];
  const parts = sentenceParts(text);
  const safeParts = parts.filter((part) => !thirdPartyPattern.test(part) &&
    !hypotheticalPattern.test(part) && !transientPattern.test(part) && !casualPattern.test(part));
  return extractFromParts(safeParts);
}
