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
