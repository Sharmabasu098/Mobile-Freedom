import type { PersistentMemoryRecord } from "./persistentMemoryStorage";

const stopWords = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "and", "or", "but",
  "to", "of", "in", "on", "at", "for", "from", "with", "by", "as", "it", "this", "that",
  "these", "those", "i", "we", "you", "he", "she", "they", "my", "our", "your", "their",
  "do", "does", "did", "can", "could", "should", "would", "will", "what", "when", "where",
  "why", "how", "explain", "review", "continue", "should", "any", "all", "only"
]);

const synonymGroups = [
  ["mobile", "android", "phone", "mobile-first"],
  ["coding", "code", "typescript", "development", "developer", "programming"],
  ["safe", "safety", "safely", "protect", "protected", "secure", "security"],
  ["workflow", "process", "steps", "step-by-step"],
  ["merge", "merged", "merging", "merge-policy", "pr", "pull-request"],
  ["architecture", "architectural", "design", "structure"],
  ["memory", "memories", "remember", "retrieval"],
  ["travel", "trip", "itinerary", "travel-planning"],
  ["website", "web", "browser", "homepage"],
  ["toolkit", "tools", "utilities", "utility"]
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, " ").replace(/\\s+/g, " ").trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter((t) => t && !stopWords.has(t)));
}

function expand(tokenSet: Set<string>): Set<string> {
  const result = new Set(tokenSet);
  for (const group of synonymGroups) {
    if (group.some((word) => tokenSet.has(word))) group.forEach((word) => result.add(word));
  }
  return result;
}

function validRecord(value: unknown): value is PersistentMemoryRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.id === "string" && r.id.length > 0 &&
    ["preference", "project", "instruction"].includes(String(r.category)) &&
    typeof r.value === "string" && r.value.trim().length > 0 &&
    r.durable === true && r.schemaVersion === 1 &&
    typeof r.createdAt === "number" && Number.isFinite(r.createdAt) &&
    typeof r.updatedAt === "number" && Number.isFinite(r.updatedAt);
}

function isRelevant(queryTokens: Set<string>, memory: PersistentMemoryRecord): boolean {
  const memoryTokens = tokens(memory.value);
  if (!queryTokens.size || !memoryTokens.size) return false;
  const expandedQuery = expand(queryTokens);
  const expandedMemory = expand(memoryTokens);
  let shared = 0;
  for (const token of expandedQuery) if (expandedMemory.has(token)) shared++;
  // Expansion is symmetric, so require at least one original-topic overlap or a shared synonym group.
  const originalOverlap = [...queryTokens].some((token => expandedMemory.has(token))) ||
    [...memoryTokens].some((token => expandedQuery.has(token)));
  return originalOverlap && shared >= 1;
}

/** Conservative, deterministic retrieval. Invalid records are ignored; input is never mutated. */
export function retrieveRelevantMemories(
  query: string,
  memories: readonly PersistentMemoryRecord[],
): PersistentMemoryRecord[] {
  const queryTokens = tokens(typeof query === "string" ? query : "");
  if (!queryTokens.size || !Array.isArray(memories) || memories.length === 0) return [];

  const seen = new Set<string>();
  const results: PersistentMemoryRecord[] = [];
  for (const candidate of memories) {
    if (!validRecord(candidate) || !isRelevant(queryTokens, candidate)) continue;
    const key = candidate.category + ":" + normalize(candidate.value);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(candidate);
  }
  return results;
}
