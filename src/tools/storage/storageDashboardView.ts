import type { StorageDashboardSummary } from "./storageDashboard";

export type DashboardLanguage = "en" | "hi";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function formatBytes(bytes: number, language: DashboardLanguage): string {
  if (!Number.isFinite(bytes) || bytes < 0) return language === "en" ? "Unavailable" : "उपलब्ध नहीं";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const CATEGORY_LABELS: Record<DashboardLanguage, Record<string, string>> = {
  en: { images: "Images", videos: "Videos", documents: "Documents", audio: "Audio", archives: "Archives", other: "Other", unknown: "Unknown" },
  hi: { images: "तस्वीरें", videos: "वीडियो", documents: "दस्तावेज़", audio: "ऑडियो", archives: "आर्काइव", other: "अन्य", unknown: "अज्ञात" },
};

export function renderStorageDashboard(
  summary: StorageDashboardSummary,
  language: DashboardLanguage,
  duplicateScanCompleted = false,
): string {
  const en = language === "en";
  const categories = summary.byCategory.map((item) => `
    <div class="storage-category-row">
      <div class="storage-category-main">
        <span class="storage-category-name">${escapeHtml(CATEGORY_LABELS[language][item.category] ?? item.category)}</span>
        <span class="storage-category-meta">${item.fileCount} ${en ? "files" : "फाइलें"} · ${formatBytes(item.totalSize, language)}</span>
      </div>
      <div class="storage-category-track" role="img" aria-label="${item.percentage.toFixed(1)}%">
        <span style="width:${Math.max(0, Math.min(100, item.percentage))}%"></span>
      </div>
      <span class="storage-category-percent">${item.percentage.toFixed(1)}%</span>
    </div>`).join("");

  const largest = summary.largestFiles.length
    ? summary.largestFiles.map((file, index) => `
      <li class="storage-file-row">
        <span class="storage-file-rank">${index + 1}</span>
        <span class="storage-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="storage-file-size">${formatBytes(file.size, language)}</span>
      </li>`).join("")
    : `<p class="storage-empty">${en ? "No analyzed files yet." : "अभी कोई विश्लेषित फाइल नहीं है।"}</p>`;

  const large = summary.largeFiles.length
    ? summary.largeFiles.map((file) => `
      <li class="storage-file-row">
        <span class="storage-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="storage-file-size">${formatBytes(file.size, language)}</span>
      </li>`).join("")
    : `<p class="storage-empty">${en ? "No files meet the large-file threshold." : "बड़ी फाइल की सीमा में कोई फाइल नहीं मिली।"}</p>`;

  const savingsValue = duplicateScanCompleted
    ? formatBytes(summary.potentialDuplicateSavings, language)
    : (en ? "Not checked" : "जाँच बाकी");

  return `
    <section class="storage-dashboard" aria-labelledby="storage-dashboard-title">
      <div class="storage-dashboard-header">
        <div>
          <span class="storage-dashboard-eyebrow">${en ? "STORAGE INTELLIGENCE" : "स्टोरेज इंटेलिजेंस"}</span>
          <h3 id="storage-dashboard-title">${en ? "Your analysis overview" : "आपके विश्लेषण का सार"}</h3>
          <p>${en ? "Insights from files you selected—not your entire device." : "आपकी चुनी हुई फाइलों का विश्लेषण—पूरे फोन का नहीं।"}</p>
        </div>
        <button class="storage-dashboard-toggle" type="button" data-storage-dashboard-toggle aria-expanded="true" aria-controls="storage-dashboard-content">${en ? "Hide dashboard details" : "डैशबोर्ड विवरण छिपाएँ"}</button>
      </div>
      <div id="storage-dashboard-content">
      <div class="storage-metrics-grid">
        <article class="storage-metric-card storage-metric-primary">
          <span>${en ? "Analyzed storage" : "विश्लेषित आकार"}</span>
          <strong>${formatBytes(summary.totalSize, language)}</strong>
          <small>${summary.analyzedFileCount} ${en ? "files analyzed" : "फाइलों का विश्लेषण"}</small>
        </article>
        <article class="storage-metric-card">
          <span>${en ? "Potential savings" : "संभावित बचत"}</span>
          <strong>${savingsValue}</strong>
          <small>${en ? "Exact duplicates only" : "केवल exact duplicates"}</small>
        </article>
        <article class="storage-metric-card">
          <span>${en ? "Large files" : "बड़ी फाइलें"}</span>
          <strong>${summary.largeFiles.length}</strong>
          <small>${en ? "At your selected threshold" : "आपकी चुनी सीमा के अनुसार"}</small>
        </article>
        <article class="storage-metric-card">
          <span>${en ? "File categories" : "फाइल श्रेणियाँ"}</span>
          <strong>${summary.byCategory.length}</strong>
          <small>${en ? "Types represented" : "मौजूद श्रेणियाँ"}</small>
        </article>
      </div>
      <div class="storage-dashboard-grid">
        <section class="storage-dashboard-panel">
          <h4>${en ? "File type breakdown" : "फाइल प्रकार का विवरण"}</h4>
          ${categories || `<p class="storage-empty">${en ? "No category data available." : "श्रेणी डेटा उपलब्ध नहीं।"}</p>`}
        </section>
        <section class="storage-dashboard-panel">
          <h4>${en ? "Largest files" : "सबसे बड़ी फाइलें"}</h4>
          <ol class="storage-file-list">${largest}</ol>
        </section>
        <section class="storage-dashboard-panel storage-dashboard-panel-wide">
          <h4>${en ? "Large files" : "बड़ी फाइलें"}</h4>
          <ul class="storage-file-list">${large}</ul>
        </section>
      </div>
      <p class="storage-dashboard-trust-note">🛡️ ${en
        ? "Potential savings are estimates. No files have been deleted and no device-wide storage is claimed."
        : "संभावित बचत केवल अनुमान है। कोई फाइल डिलीट नहीं हुई और पूरे डिवाइस का storage नहीं मापा गया है।"}</p>
      </div>
    </section>`;
}


// M12 UI — explicitly recorded storage history, trend, and advisory prediction.
import type { StorageHistoryResult } from "./storageHistory";
import type { StorageTrendResult } from "./storageTrendAnalysis";
import type { StoragePredictionResult } from "./storagePrediction";

function m12Bytes(bytes: number, language: DashboardLanguage): string {
  if (!Number.isFinite(bytes) || bytes < 0) return language === "en" ? "Unavailable" : "उपलब्ध नहीं";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes, index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function renderStorageHistoryPanel(
  history: StorageHistoryResult,
  trend: StorageTrendResult,
  predictions: StoragePredictionResult[],
  language: DashboardLanguage,
): string {
  const en = language === "en";
  const historyRows = history.success && history.history.length
    ? [...history.history].reverse().slice(0, 8).map((s) => `<li class="m12-history-row"><span>${escapeHtml(new Date(s.recordedAt).toLocaleString())}</span><strong>${m12Bytes(s.usedBytes, language)} / ${m12Bytes(s.totalBytes, language)}</strong><small>${en ? "Free" : "खाली"}: ${m12Bytes(s.freeBytes, language)}</small></li>`).join("")
    : `<p class="storage-empty">${en ? "No snapshots recorded yet. Add a measurement below." : "अभी कोई snapshot दर्ज नहीं है। नीचे माप दर्ज करें।"}</p>`;
  const trendText = trend.success
    ? `<div class="m12-trend-summary"><strong>${en ? "Usage trend" : "उपयोग का रुझान"}: ${trend.direction === "increase" ? (en ? "Increasing" : "बढ़ रहा है") : trend.direction === "decrease" ? (en ? "Decreasing" : "घट रहा है") : (en ? "Unchanged" : "स्थिर")}</strong><p>${en ? "Used storage change" : "उपयोग में बदलाव"}: ${trend.usedBytesChange! >= 0 ? "+" : "−"}${m12Bytes(Math.abs(trend.usedBytesChange!), language)}</p><small>${en ? "Compared across" : "तुलना की गई"} ${trend.snapshotsAnalyzed} ${en ? "snapshots" : "snapshots"} · ${(trend.elapsedMs! / 86400000).toFixed(1)} ${en ? "days" : "दिन"}</small></div>`
    : `<p class="storage-empty">${en ? "Trend requires at least two valid dated snapshots." : "Trend के लिए कम से कम 2 सही तारीख वाले snapshots चाहिए।"}</p>`;
  const predictionCards = predictions.map((p) => p.success
    ? `<article class="m12-prediction-card"><span>${p.horizonDays}-${en ? "day estimate" : "दिन अनुमान"}</span><strong>${m12Bytes(p.estimatedUsedBytes!, language)}</strong><small>${en ? "Estimated used storage" : "अनुमानित इस्तेमाल"}${p.estimatedFreeBytes !== undefined ? ` · ${en ? "Free" : "खाली"} ${m12Bytes(p.estimatedFreeBytes, language)}` : ""}</small></article>`
    : `<article class="m12-prediction-card"><span>${p.horizonDays}-${en ? "day estimate" : "दिन अनुमान"}</span><strong>${en ? "Not available" : "उपलब्ध नहीं"}</strong><small>${en ? "More history is needed (7 snapshots over at least 7 days)." : "अधिक इतिहास चाहिए (कम से कम 7 दिनों में 7 snapshots)।"}</small></article>`).join("");
  const warning = history.success && history.history.length
    ? (() => { const latest = history.history[history.history.length - 1]; const percent = latest.totalBytes ? latest.freeBytes / latest.totalBytes * 100 : 0; return percent < 10 ? `<p class="m12-low-warning" role="status">⚠️ ${en ? "Low free space in your recorded measurement" : "आपके दर्ज माप में खाली स्थान कम है"} (${percent.toFixed(1)}%). ${en ? "This is not live device monitoring." : "यह लाइव डिवाइस निगरानी नहीं है।"}</p>` : ""; })()
    : "";
  return `<section class="m12-history-panel" aria-labelledby="m12-history-title"><h4 id="m12-history-title">${en ? "Storage history & trend" : "स्टोरेज इतिहास और रुझान"}</h4><p class="m12-panel-intro">${en ? "Record storage measurements yourself. The browser does not monitor your device." : "स्टोरेज माप स्वयं दर्ज करें। ब्राउज़र आपके डिवाइस की निगरानी नहीं करता।"}</p><div class="m12-snapshot-form"><label>${en ? "Total capacity (MB)" : "कुल क्षमता (MB)"}<input id="m12-total-mb" type="number" min="1" step="1" inputmode="decimal" placeholder="e.g. 128000" /></label><label>${en ? "Used storage (MB)" : "इस्तेमाल (MB)"}<input id="m12-used-mb" type="number" min="0" step="1" inputmode="decimal" placeholder="e.g. 64000" /></label><button id="m12-record-snapshot" type="button" class="control-button">${en ? "Record snapshot" : "माप दर्ज करें"}</button><p id="m12-snapshot-status" role="status" aria-live="polite"></p></div>${warning}<div class="m12-trend-block"><h5>${en ? "Trend" : "रुझान"}</h5>${trendText}</div><div class="m12-prediction-block"><h5>${en ? "Storage estimates" : "स्टोरेज अनुमान"}</h5><div class="m12-prediction-grid">${predictionCards}</div><p class="storage-dashboard-trust-note">${en ? "Estimates extrapolate recorded usage; they are not guaranteed forecasts. No confidence interval is provided, and actual usage may change." : "अनुमान दर्ज उपयोग पर आधारित हैं; निश्चित भविष्यवाणी नहीं। Confidence interval उपलब्ध नहीं है और वास्तविक उपयोग बदल सकता है।"}</p></div><div class="m12-history-block"><h5>${en ? "Recent snapshots" : "हाल के snapshots"}</h5><ul class="m12-history-list">${historyRows}</ul></div><p class="storage-dashboard-trust-note">🛡️ ${en ? "Low-storage warning uses your recorded measurement only—not live device storage. Nothing is deleted." : "कम स्टोरेज चेतावनी केवल आपके दर्ज माप पर आधारित है—लाइव फोन स्टोरेज नहीं। कोई फाइल डिलीट नहीं होती।"}</p></section>`;
}
