/**
 * M11.1 — Evidence-grounded Storage Assistant foundation.
 *
 * Generates local, deterministic explanations from explicitly supplied current
 * analysis results. No network requests, file mutations, or deletion actions.
 */
import type { StorageDashboardSummary } from "./storageDashboard";
import { validateStorageAssistantContext, safeAssistantFileName } from "./storageAssistantGuards";

export type StorageAssistantLanguage = "en" | "hi";
export type StorageAssistantInsightKind = "summary" | "review" | "notice";

export interface StorageAssistantInsight {
  kind: StorageAssistantInsightKind;
  title: string;
  message: string;
}

export interface StorageAssistantContext {
  summary: StorageDashboardSummary;
  exactDuplicateScanCompleted: boolean;
  similarPhotoScanCompleted?: boolean;
  similarPhotoPairCount?: number;
}

export interface StorageAssistantResponse {
  language: StorageAssistantLanguage;
  insights: StorageAssistantInsight[];
  disclaimer: string;
}

function formatBytes(bytes: number, language: StorageAssistantLanguage): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return language === "en" ? "unavailable" : "उपलब्ध नहीं";
  }
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Produces a small set of explanations/review suggestions from verified context.
 * Every insight is derived from the supplied summary; it does not scan files.
 */
export function generateStorageAssistantResponse(
  context: StorageAssistantContext,
  language: StorageAssistantLanguage = "en",
): StorageAssistantResponse {
  const validation = validateStorageAssistantContext(context);
  if (!validation.valid) {
    return {
      language,
      insights: [{
        kind: "notice",
        title: language === "en" ? "Analysis context needs verification" : "विश्लेषण डेटा की जाँच आवश्यक है",
        message: language === "en"
          ? "Some supplied analysis data is invalid or contradictory. I will not generate storage recommendations from it. Please rerun the relevant analysis."
          : "दिया गया विश्लेषण डेटा अमान्य या आपस में विरोधाभासी है। मैं इसके आधार पर स्टोरेज सुझाव नहीं दूँगा। कृपया संबंधित विश्लेषण फिर से चलाएँ।",
      }],
      disclaimer: language === "en"
        ? "No files were changed or deleted. Invalid context was blocked before insight generation."
        : "कोई फाइल बदली या हटाई नहीं गई। अमान्य डेटा को सुझाव तैयार करने से पहले रोक दिया गया।",
    };
  }
  const { summary } = context;
  const en = language === "en";
  const insights: StorageAssistantInsight[] = [];

  const countValid = Number.isInteger(summary.analyzedFileCount) && summary.analyzedFileCount >= 0;
  const sizeValid = Number.isFinite(summary.totalSize) && summary.totalSize >= 0;

  if (countValid && sizeValid) {
    insights.push({
      kind: "summary",
      title: en ? "Your selected-file overview" : "आपकी चुनी हुई फाइलों का सार",
      message: en
        ? `I have results for ${summary.analyzedFileCount} selected file(s), totaling ${formatBytes(summary.totalSize, language)}. This is only the selected set—not your entire device.`
        : `चुनी गई ${summary.analyzedFileCount} फाइलों का कुल आकार ${formatBytes(summary.totalSize, language)} है। यह केवल चुनी गई फाइलों का डेटा है, पूरे फोन का नहीं।`,
    });
  } else {
    insights.push({
      kind: "notice",
      title: en ? "Storage totals unavailable" : "स्टोरेज कुल उपलब्ध नहीं",
      message: en
        ? "The supplied file-analysis totals are invalid or unavailable, so I will not estimate them."
        : "दिए गए फाइल विश्लेषण के कुल आँकड़े अमान्य या उपलब्ध नहीं हैं, इसलिए मैं अनुमान नहीं लगाऊँगा।",
    });
  }

  const largeFiles = Array.isArray(summary.largeFiles) ? summary.largeFiles : [];
  if (largeFiles.length > 0) {
    const examples = largeFiles.slice(0, 3).map(file => `${safeAssistantFileName(file.name)} (${formatBytes(file.size, language)})`).join(", ");
    insights.push({
      kind: "review",
      title: en ? "Large files worth reviewing" : "बड़ी फाइलें जिन्हें देखना उपयोगी होगा",
      message: en
        ? `${largeFiles.length} file(s) meet the dashboard's large-file threshold. Examples: ${examples}. Review them yourself; size alone does not mean a file is safe to remove.`
        : `${largeFiles.length} फाइलें डैशबोर्ड की बड़ी-फाइल सीमा पर या उससे ऊपर हैं। उदाहरण: ${examples}। उन्हें स्वयं जाँचें—केवल आकार बड़ा होने से फाइल हटाना सुरक्षित नहीं हो जाता।`,
    });
  } else {
    insights.push({
      kind: "summary",
      title: en ? "No large files in this result" : "इस परिणाम में बड़ी फाइलें नहीं",
      message: en
        ? "No files were reported at or above the current large-file threshold."
        : "वर्तमान बड़ी-फाइल सीमा पर या उससे ऊपर कोई फाइल रिपोर्ट नहीं हुई।",
    });
  }

  if (context.exactDuplicateScanCompleted) {
    if (summary.duplicateGroupCount > 0) {
      insights.push({
        kind: "review",
        title: en ? "Exact duplicates found" : "समान सामग्री वाली डुप्लिकेट फाइलें मिलीं",
        message: en
          ? `The exact-duplicate scan reported ${summary.duplicateGroupCount} group(s). Estimated potential savings: ${formatBytes(summary.potentialDuplicateSavings, language)}. This is an estimate only; review each group before deciding what to keep.`
          : `Exact-duplicate scan में ${summary.duplicateGroupCount} समूह मिले। संभावित बचत का अनुमान ${formatBytes(summary.potentialDuplicateSavings, language)} है। यह केवल अनुमान है—किसी फाइल को रखने या हटाने का निर्णय पहले स्वयं जाँचकर लें।`,
      });
    } else {
      insights.push({
        kind: "summary",
        title: en ? "No exact duplicate groups reported" : "कोई exact duplicate समूह रिपोर्ट नहीं हुआ",
        message: en
          ? "The completed exact-duplicate scan did not report duplicate groups in the supplied selection."
          : "पूरे किए गए exact-duplicate scan में चुनी गई फाइलों के बीच कोई डुप्लिकेट समूह रिपोर्ट नहीं हुआ।",
      });
    }
  } else {
    insights.push({
      kind: "notice",
      title: en ? "Exact-duplicate scan is pending" : "Exact-duplicate scan अभी बाकी है",
      message: en
        ? "Potential duplicate savings cannot be assessed until the exact-duplicate scan completes."
        : "Exact-duplicate scan पूरा होने तक संभावित बचत का आकलन नहीं किया जा सकता।",
    });
  }

  if (context.similarPhotoScanCompleted === true) {
    const pairCount = context.similarPhotoPairCount;
    if (pairCount !== undefined && Number.isInteger(pairCount) && pairCount >= 0) {
      insights.push({
        kind: "notice",
        title: en ? "Visually similar photos" : "दृश्य रूप से मिलती-जुलती तस्वीरें",
        message: en
          ? `${pairCount} visually similar photo pair(s) were reported. Similarity does not mean identical content; check each photo before taking action.`
          : `${pairCount} दृश्य रूप से मिलते-जुलते फोटो जोड़े रिपोर्ट हुए। समान दिखना, बिल्कुल एक जैसा होना नहीं है—किसी कार्रवाई से पहले हर फोटो जाँचें।`,
      });
    } else {
      insights.push({
        kind: "notice",
        title: en ? "Similar-photo result unavailable" : "Similar-photo परिणाम उपलब्ध नहीं",
        message: en
          ? "The scan was marked complete but did not provide a valid pair count."
          : "Scan पूरा बताया गया है, लेकिन सही pair count उपलब्ध नहीं है।",
      });
    }
  } else if (context.similarPhotoScanCompleted === false) {
    insights.push({
      kind: "notice",
      title: en ? "Similar-photo scan is pending" : "Similar-photo scan अभी बाकी है",
      message: en
        ? "No visual-similarity conclusion is available yet."
        : "अभी दृश्य समानता का कोई निष्कर्ष उपलब्ध नहीं है।",
    });
  }

  return {
    language,
    insights,
    disclaimer: en
      ? "These are explanations of the supplied analysis only. Nothing has been deleted or changed. Review files yourself and confirm any cleanup action separately."
      : "ये केवल दिए गए विश्लेषण की व्याख्याएँ हैं। कोई फाइल हटाई या बदली नहीं गई है। फाइल स्वयं जाँचें और सफाई की कार्रवाई अलग से पुष्टि करके ही करें।",
  };
}
