/**
 * Mobile Freedom
 * M4.1 — Responsive Homepage Foundation
 * M4.2 — Live Category and Search Result Count
 */

import "./style.css";
import { compressImage } from "./tools/image/imageEngine";

type Language = "en" | "hi";
type Category = "all" | "image" | "document" | "utility";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error(
    'Mobile Freedom initialization failed: element "#app" was not found.'
  );
}

const translations = {
  en: {
    tagline: "Useful tools. A little more freedom.",
    description:
      "Everyday tools designed for your phone, with privacy in mind.",
    search: "Search",
    placeholder: "Search available tools...",
    heading: "Explore tools",
    subtitle: "Choose a category or find a tool.",
    all: "All tools",
    image: "Image tools",
    document: "PDF & Documents",
    utility: "Everyday Utilities",
    privacy: "Privacy comes first",
    privacyText:
      "Our goal is to process files locally wherever practical. Each tool will explain its limitations.",
    planned: "Planned — not available yet",
    empty: "No matching tools found. Try another search.",
    results: (count: number) =>
      `${count} ${count === 1 ? "tool" : "tools"} found.`,
    language: "हिन्दी",
    dark: "Dark theme",
    light: "Light theme",
    footer: "Built for mobile. Designed with privacy in mind.",
  },
  hi: {
    tagline: "काम के टूल्स। थोड़ी और आज़ादी।",
    description:
      "आपके मोबाइल के लिए उपयोगी टूल्स, गोपनीयता को ध्यान में रखकर।",
    search: "खोजें",
    placeholder: "उपलब्ध टूल खोजें...",
    heading: "टूल्स देखें",
    subtitle: "श्रेणी चुनें या अपना टूल खोजें।",
    all: "सभी टूल्स",
    image: "इमेज टूल्स",
    document: "PDF और दस्तावेज़",
    utility: "रोज़मर्रा के टूल्स",
    privacy: "गोपनीयता सबसे पहले",
    privacyText:
      "जहाँ संभव होगा, फाइलें ब्राउज़र में ही प्रोसेस करने का लक्ष्य है। हर टूल अपनी सीमाएँ स्पष्ट करेगा।",
    planned: "योजना में — अभी उपलब्ध नहीं",
    empty: "कोई मेल खाता टूल नहीं मिला। दूसरा शब्द आज़माएँ।",
    results: (count: number) => `${count} टूल मिले।`,
    language: "English",
    dark: "डार्क थीम",
    light: "लाइट थीम",
    footer: "मोबाइल के लिए बनाया गया, गोपनीयता को ध्यान में रखकर।",
  },
} as const;

const tools = [
  {
    icon: "🗜️",
    category: "image",
    en: "Image Compressor",
    hi: "इमेज कंप्रेसर",
    descriptionEn: "Reduce image file size.",
    descriptionHi: "तस्वीर का फाइल आकार कम करें।",
    keywords: "compress image photo",
  },
  {
    icon: "🖼️",
    category: "image",
    en: "Image Converter",
    hi: "इमेज कन्वर्टर",
    descriptionEn: "Convert supported image formats.",
    descriptionHi: "समर्थित इमेज फॉर्मेट बदलें।",
    keywords: "convert format jpg png webp",
  },
  {
    icon: "↔️",
    category: "image",
    en: "Image Resizer",
    hi: "इमेज रिसाइज़र",
    descriptionEn: "Change image dimensions.",
    descriptionHi: "तस्वीर का आकार बदलें।",
    keywords: "resize dimensions",
  },
  {
    icon: "📚",
    category: "document",
    en: "PDF Merger",
    hi: "PDF मर्जर",
    descriptionEn: "Combine PDF documents.",
    descriptionHi: "PDF दस्तावेज़ जोड़ें।",
    keywords: "pdf merge combine",
  },
  {
    icon: "✂️",
    category: "document",
    en: "PDF Splitter",
    hi: "PDF स्प्लिटर",
    descriptionEn: "Split PDF documents.",
    descriptionHi: "PDF दस्तावेज़ बाँटें।",
    keywords: "pdf split pages",
  },
  {
    icon: "▦",
    category: "utility",
    en: "QR Code Generator",
    hi: "QR कोड जनरेटर",
    descriptionEn: "Create QR codes from text or links.",
    descriptionHi: "टेक्स्ट या लिंक से QR कोड बनाएँ।",
    keywords: "qr code link",
  },
  {
    icon: "🔐",
    category: "utility",
    en: "Password Generator",
    hi: "पासवर्ड जनरेटर",
    descriptionEn: "Generate secure random passwords.",
    descriptionHi: "सुरक्षित रैंडम पासवर्ड बनाएँ।",
    keywords: "password secure random",
  },
  {
    icon: "⚖️",
    category: "utility",
    en: "Unit Converter",
    hi: "यूनिट कन्वर्टर",
    descriptionEn: "Convert common measurement units.",
    descriptionHi: "माप की इकाइयाँ बदलें।",
    keywords: "unit convert length weight",
  },
  {
    icon: "✍️",
    category: "utility",
    en: "Text Utilities",
    hi: "टेक्स्ट टूल्स",
    descriptionEn: "Useful everyday text tools.",
    descriptionHi: "रोज़मर्रा के उपयोगी टेक्स्ट टूल्स।",
    keywords: "text words characters",
  },
] as const;

let language: Language = "en";
let category: Category = "all";
let query = "";
let darkMode = false;

app.innerHTML = `
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="#home">
        <span class="brand-mark" aria-hidden="true">MF</span>
        <span>Mobile Freedom</span>
      </a>
      <div class="header-actions">
        <button class="control-button" id="language" type="button">
          हिन्दी
        </button>
        <button class="control-button" id="theme" type="button">
          Dark theme
        </button>
      </div>
    </div>
  </header>

  <main id="home">
    <section class="hero">
      <div class="container">
        <span class="eyebrow">Private by intention</span>
        <h1 id="hero-title"></h1>
        <p id="hero-description"></p>

        <form class="search-wrap" id="search-form" role="search">
          <label for="search-input" aria-label="Search tools">⌕</label>
          <input id="search-input" type="search" />
          <button type="submit" id="search-button"></button>
        </form>
        <p id="search-status" role="status" aria-live="polite"></p>
      </div>
    </section>

    <section class="section" aria-labelledby="tools-heading">
      <div class="container">
        <div class="section-heading">
          <h2 id="tools-heading"></h2>
          <p id="tools-subtitle"></p>
        </div>

        <nav class="category-list" aria-label="Tool categories">
          <button class="category-button" data-category="all"
            aria-pressed="true" type="button"></button>
          <button class="category-button" data-category="image"
            aria-pressed="false" type="button"></button>
          <button class="category-button" data-category="document"
            aria-pressed="false" type="button"></button>
          <button class="category-button" data-category="utility"
            aria-pressed="false" type="button"></button>
        </nav>

        <div class="tool-grid" id="tool-grid"></div>
        <p class="empty-state" id="empty-state" hidden></p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <aside class="privacy-banner">
          <span aria-hidden="true">🛡️</span>
          <div>
            <strong id="privacy-title"></strong>
            <p id="privacy-text"></p>
          </div>
        </aside>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <span>© <span id="year"></span> Mobile Freedom</span>
      <span id="footer-text"></span>
    </div>
  </footer>
`;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);

  if (!found) {
    throw new Error(`Required UI element "${id}" was not found.`);
  }

  return found as T;
}

function renderTools(): void {
  const filtered = tools.filter((tool) => {
    const categoryMatches =
      category === "all" || tool.category === category;

    const searchable =
      `${tool.en} ${tool.hi} ${tool.descriptionEn} ` +
      `${tool.descriptionHi} ${tool.keywords}`;

    return (
      categoryMatches &&
      searchable.toLowerCase().includes(query.toLowerCase())
    );
  });

  // Update the count whenever search, category, or language changes.
  element<HTMLParagraphElement>("search-status").textContent =
    translations[language].results(filtered.length);

  element<HTMLDivElement>("tool-grid").innerHTML = filtered
    .map(
      (tool) => `
        <article class="tool-card">
          <span class="tool-icon" aria-hidden="true">${tool.icon}</span>
          <h3>${language === "en" ? tool.en : tool.hi}</h3>
          <p>${
            language === "en"
              ? tool.descriptionEn
              : tool.descriptionHi
          }</p>
          ${
  tool.en === "Image Compressor"
    ? `<button class="tool-status compressor-open" type="button" data-open-compressor>
        ${language === "en" ? "Open tool" : "टूल खोलें"}
      </button>`
    : `<span class="tool-status">
        ${translations[language].planned}
      </span>`
          }
        </article>
      `
    )
    .join("");

  const empty = element<HTMLParagraphElement>("empty-state");
  empty.hidden = filtered.length > 0;
  empty.textContent = translations[language].empty;
}

function render(): void {
  const t = translations[language];

  document.documentElement.lang = language;

  element("hero-title").textContent = t.tagline;
  element("hero-description").textContent = t.description;
  element<HTMLInputElement>("search-input").placeholder = t.placeholder;
  element("search-button").textContent = t.search;
  element("tools-heading").textContent = t.heading;
  element("tools-subtitle").textContent = t.subtitle;
  element("privacy-title").textContent = t.privacy;
  element("privacy-text").textContent = t.privacyText;
  element("footer-text").textContent = t.footer;
  element("language").textContent = t.language;

  element("theme").textContent = darkMode ? t.light : t.dark;

  const labels: Record<Category, string> = {
    all: t.all,
    image: t.image,
    document: t.document,
    utility: t.utility,
  };

  document
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach((button) => {
      const key = button.dataset["category"] as Category;
      button.textContent = labels[key];
      button.setAttribute("aria-pressed", String(category === key));
    });

  renderTools();
}

element("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  query = element<HTMLInputElement>("search-input").value.trim();
  renderTools();
});

element<HTMLInputElement>("search-input").addEventListener("input", () => {
  query = element<HTMLInputElement>("search-input").value.trim();
  renderTools();
});

document
  .querySelectorAll<HTMLButtonElement>("[data-category]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      category = button.dataset["category"] as Category;
      render();
    });
  });

element("language").addEventListener("click", () => {
  language = language === "en" ? "hi" : "en";
  render();
});

element("theme").addEventListener("click", () => {
  darkMode = !darkMode;
  document.documentElement.dataset["theme"] = darkMode ? "dark" : "light";
  render();
});

element("year").textContent = String(new Date().getFullYear());

render();

console.info("Mobile Freedom: M4 homepage initialized.");

// M5.4 — Image Compressor UI Integration

let compressorObjectUrl: string | null = null;

function openImageCompressor(): void {
  const home = element<HTMLElement>("home");

  // Prevent duplicate compressor screens.
  document.getElementById("image-compressor-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "image-compressor-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">
        <h2 id="compressor-heading">
          ${language === "en" ? "Image Compressor" : "इमेज कंप्रेसर"}
        </h2>

        <p>
          ${
            language === "en"
              ? "Compress your image locally in this browser."
              : "इस ब्राउज़र में ही अपनी इमेज कंप्रेस करें।"
          }
        </p>

        <button
          class="control-button"
          id="compressor-back"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top: 22px;">
          <label for="compressor-file">
            <strong>
              ${language === "en" ? "Choose an image" : "इमेज चुनें"}
            </strong>
          </label>

          <input
            id="compressor-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display:block; width:100%; margin-top:12px;"
          />
        </div>

        <div style="margin-top:22px;">
          <label for="compressor-quality">
            <strong>
              ${language === "en" ? "Image quality" : "इमेज क्वालिटी"}
            </strong>:
            <span id="compressor-quality-value">80%</span>
          </label>

          <input
            id="compressor-quality"
            type="range"
            min="10"
            max="100"
            value="80"
            style="display:block; width:100%; margin-top:12px;"
          />

          <p style="color:var(--muted);">
            ${
              language === "en"
                ? "Lower quality may reduce file size more, but can affect image appearance."
                : "कम क्वालिटी से फाइल छोटी हो सकती है, लेकिन तस्वीर की गुणवत्ता प्रभावित हो सकती है।"
            }
          </p>
        </div>

        <button
          class="control-button"
          id="compressor-run"
          type="button"
          style="margin-top:12px; background:var(--accent); color:white;"
        >
          ${language === "en" ? "Compress Image" : "इमेज कंप्रेस करें"}
        </button>

        <p id="compressor-status" role="status" aria-live="polite"></p>

        <div id="compressor-result" hidden>
          <h3>
            ${language === "en" ? "Compression result" : "कंप्रेशन परिणाम"}
          </h3>

          <p id="compressor-original-size"></p>
          <p id="compressor-output-size"></p>
          <p id="compressor-saved-size"></p>
          <p id="compressor-preview-note"></p>

          <a
            id="compressor-download"
            class="control-button"
            style="display:inline-block; text-decoration:none;"
          >
            ${language === "en" ? "Download compressed image" : "कंप्रेस की गई इमेज डाउनलोड करें"}
          </a>
        </div>
      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const backButton =
    screen.querySelector<HTMLButtonElement>("#compressor-back");

  const fileInput =
    screen.querySelector<HTMLInputElement>("#compressor-file");

  const qualityInput =
    screen.querySelector<HTMLInputElement>("#compressor-quality");

  const qualityValue =
    screen.querySelector<HTMLElement>("#compressor-quality-value");

  const runButton =
    screen.querySelector<HTMLButtonElement>("#compressor-run");

  const status =
    screen.querySelector<HTMLParagraphElement>("#compressor-status");

  const result =
    screen.querySelector<HTMLDivElement>("#compressor-result");

  const download =
    screen.querySelector<HTMLAnchorElement>("#compressor-download");

  if (
    !backButton ||
    !fileInput ||
    !qualityInput ||
    !qualityValue ||
    !runButton ||
    !status ||
    !result ||
    !download
  ) {
    screen.remove();
    home.hidden = false;
    throw new Error("Image Compressor UI initialization failed.");
  }

  function releaseCompressorUrl(): void {
    if (compressorObjectUrl) {
      URL.revokeObjectURL(compressorObjectUrl);
      compressorObjectUrl = null;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  qualityInput.addEventListener("input", () => {
    qualityValue.textContent = `${qualityInput.value}%`;
  });

  fileInput.addEventListener("change", () => {
    releaseCompressorUrl();
    result.hidden = true;
    status.textContent = "";

    const file = fileInput.files?.[0];

    if (!file) {
      return;
    }

    status.textContent =
      language === "en"
        ? `Selected: ${file.name} (${formatFileSize(file.size)})`
        : `चुनी गई फाइल: ${file.name} (${formatFileSize(file.size)})`;
  });

  runButton.addEventListener("click", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      status.textContent =
        language === "en"
          ? "Please choose an image first."
          : "पहले एक इमेज चुनें।";
      return;
    }

    releaseCompressorUrl();
    result.hidden = true;
    runButton.disabled = true;

    status.textContent =
      language === "en"
        ? "Compressing image locally..."
        : "इमेज को ब्राउज़र में कंप्रेस किया जा रहा है...";

    try {
      const compressed = await compressImage(file, {
        quality: Number(qualityInput.value) / 100,
      });

      compressorObjectUrl = URL.createObjectURL(compressed.blob);

      const originalSize = screen.querySelector<HTMLElement>(
        "#compressor-original-size"
      );

      const outputSize = screen.querySelector<HTMLElement>(
        "#compressor-output-size"
      );

      const savedSize = screen.querySelector<HTMLElement>(
        "#compressor-saved-size"
      );

      const previewNote = screen.querySelector<HTMLElement>(
        "#compressor-preview-note"
      );

      if (!originalSize || !outputSize || !savedSize || !previewNote) {
        throw new Error("Compression result UI is incomplete.");
      }

      originalSize.textContent =
        `${language === "en" ? "Original size" : "मूल आकार"}: ` +
        formatFileSize(compressed.originalBytes);

      outputSize.textContent =
        `${language === "en" ? "Compressed size" : "कंप्रेस आकार"}: ` +
        formatFileSize(compressed.outputBytes);

      savedSize.textContent = compressed.sizeReduced
        ? (
            language === "en"
              ? `Saved ${formatFileSize(compressed.bytesSaved)} (${compressed.percentageSaved.toFixed(1)}%).`
              : `${formatFileSize(compressed.bytesSaved)} (${compressed.percentageSaved.toFixed(1)}%) आकार बचा।`
          )
        : (
            language === "en"
              ? "The compressed file is not smaller than the original."
              : "कंप्रेस की गई फाइल मूल फाइल से छोटी नहीं हुई।"
          );

      previewNote.textContent =
        language === "en"
          ? "Output format: WebP. Check the downloaded image before deleting your original."
          : "आउटपुट फॉर्मेट: WebP। मूल इमेज हटाने से पहले डाउनलोड की गई इमेज जाँच लें।";

      download.href = compressorObjectUrl;
      download.download =
        `${file.name.replace(/\.[^.]+$/, "")}-compressed.webp`;

      result.hidden = false;

      status.textContent =
        language === "en"
          ? "Compression completed successfully."
          : "इमेज कंप्रेशन सफलतापूर्वक पूरा हुआ।";
    } catch (error) {
      releaseCompressorUrl();

      status.textContent =
        error instanceof Error
          ? error.message
          : (
              language === "en"
                ? "Image compression failed. Please try another image."
                : "इमेज कंप्रेशन विफल हुआ। दूसरी इमेज आज़माएँ।"
            );
    } finally {
      runButton.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releaseCompressorUrl();
    screen.remove();
    home.hidden = false;
    home.scrollIntoView({ behavior: "auto", block: "start" });
  });

  screen.scrollIntoView({ behavior: "auto", block: "start" });
}

// Open the compressor when its Homepage button is tapped.
document.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest("[data-open-compressor]")) {
    openImageCompressor();
  }
});
