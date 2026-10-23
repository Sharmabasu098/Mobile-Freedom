/**
 * Mobile Freedom
 * M4.1 — Responsive Homepage Foundation
 * M4.2 — Live Category and Search Result Count
 */

import "./style.css";

import {
  compressImage,
  processImage,
} from "./tools/image/imageEngine";
import { mergePdfFiles } from "./tools/pdf/pdfMerger";
import { splitPdfFile } from "./tools/pdf/pdfSplitter";
import QRCode from "qrcode";

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
  : tool.en === "Image Converter"
    ? `<button class="tool-status compressor-open" type="button" data-open-converter>
        ${language === "en" ? "Open tool" : "टूल खोलें"}
      </button>`
   : tool.en === "Image Resizer"
      ? `<button class="tool-status compressor-open" type="button" data-open-resizer>
          ${language === "en" ? "Open tool" : "टूल खोलें"}
        </button>`
   : tool.en === "PDF Merger"
      ? `<button class="tool-status compressor-open" type="button" data-open-pdf-merger>
          ${language === "en" ? "Open tool" : "टूल खोलें"}
        </button>`
  : tool.en === "QR Code Generator"
     ? `<button
        class="tool-status compressor-open"
        type="button"
        data-open-qr-generator
      >
      ${language === "en" ? "Open tool" : "खोलें"}
    </button>`
  : tool.en === "PDF Splitter"
     ? `<button
        class="tool-status compressor-open"
        type="button"
        data-open-pdf-splitter
      >
      ${language === "en" ? "Open tool" : "टूल खोलें"}
    </button>`         
    : tool.en === "Password Generator"
  ? `<button
      class="tool-status compressor-open"
      type="button"
      data-open-password-generator
    >
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

let compressorObjectUrls: string[] = [];

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
              ? "Compress multiple images locally in this browser."
              : "इस ब्राउज़र में ही एक साथ कई इमेज कंप्रेस करें।"
          }
        </p>

        <button
          class="control-button"
          id="compressor-back"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:22px;">
          <label for="compressor-file">
            <strong>
              ${language === "en" ? "Choose images" : "इमेज चुनें"}
            </strong>
          </label>

          <input
            id="compressor-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style="display:block; width:100%; margin-top:12px;"
          />

          <p id="compressor-selection-status" role="status"></p>
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
          ${language === "en" ? "Compress All Images" : "सभी इमेज कंप्रेस करें"}
        </button>

        <p id="compressor-status" role="status" aria-live="polite"></p>

        <div id="compressor-result" hidden>
          <h3>
            ${language === "en" ? "Compression results" : "कंप्रेशन परिणाम"}
          </h3>

          <div id="compressor-results-list"></div>
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

  const selectionStatus =
    screen.querySelector<HTMLParagraphElement>(
      "#compressor-selection-status"
    );

  const runButton =
    screen.querySelector<HTMLButtonElement>("#compressor-run");

  const status =
    screen.querySelector<HTMLParagraphElement>("#compressor-status");

  const result =
    screen.querySelector<HTMLDivElement>("#compressor-result");

  const resultsList =
    screen.querySelector<HTMLDivElement>("#compressor-results-list");

  if (
    !backButton ||
    !fileInput ||
    !qualityInput ||
    !qualityValue ||
    !selectionStatus ||
    !runButton ||
    !status ||
    !result ||
    !resultsList
  ) {
    screen.remove();
    home.hidden = false;
    throw new Error("Image Compressor UI initialization failed.");
  }

  function releaseCompressorUrls(): void {
    for (const url of compressorObjectUrls) {
      URL.revokeObjectURL(url);
    }

    compressorObjectUrls = [];
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

    function createResultCard(fileName: string): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "tool-card";
    card.style.marginTop = "16px";

    const heading = document.createElement("h4");
    heading.textContent = fileName;

    const details = document.createElement("p");

    const downloadLink = document.createElement("a");
    downloadLink.className = "control-button";
    downloadLink.style.display = "inline-block";
    downloadLink.style.textDecoration = "none";
    downloadLink.textContent =
      language === "en"
        ? "Download compressed image"
        : "कंप्रेस की गई इमेज डाउनलोड करें";

    card.append(heading, details, downloadLink);

    if (!resultsList) {
  throw new Error("Compression results list is missing.");
}

resultsList.append(card);

    return card;
     }

  qualityInput.addEventListener("input", () => {
    qualityValue.textContent = `${qualityInput.value}%`;
  });

  fileInput.addEventListener("change", () => {
    releaseCompressorUrls();
    result.hidden = true;
    resultsList.replaceChildren();
    status.textContent = "";

    const files = Array.from(fileInput.files ?? []);

    selectionStatus.textContent =
      language === "en"
        ? `${files.length} image(s) selected.`
        : `${files.length} इमेज चुनी गईं।`;
  });

  runButton.addEventListener("click", async () => {
    const files = Array.from(fileInput.files ?? []);

    if (files.length === 0) {
      status.textContent =
        language === "en"
          ? "Please choose images first."
          : "पहले इमेज चुनें।";
      return;
    }

    releaseCompressorUrls();
    resultsList.replaceChildren();
    result.hidden = true;
    runButton.disabled = true;
    fileInput.disabled = true;

    let successfulCount = 0;
        let failedCount = 0;

    status.textContent =
      language === "en"
        ? `Compressing ${files.length} image(s)...`
        : `${files.length} इमेज कंप्रेस की जा रही हैं...`;

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        const card = createResultCard(file.name);

        const details = card.querySelector<HTMLParagraphElement>("p");
        const downloadLink =
          card.querySelector<HTMLAnchorElement>("a");

        if (!details || !downloadLink) {
          throw new Error("Compression result UI is incomplete.");
        }

                details.textContent =
          language === "en"
            ? `Processing image ${index + 1} of ${files.length}...`
            : `${files.length} में से ${index + 1}वीं इमेज प्रोसेस हो रही है...`;

        try {
          const compressed = await compressImage(file, {
            quality: Number(qualityInput.value) / 100,
          });

          const outputUrl = URL.createObjectURL(compressed.blob);
          compressorObjectUrls.push(outputUrl);

          details.textContent =
            `${language === "en" ? "Original size" : "मूल आकार"}: ` +
            `${formatFileSize(compressed.originalBytes)}\n` +
            `${language === "en" ? "Compressed size" : "कंप्रेस आकार"}: ` +
            `${formatFileSize(compressed.outputBytes)}\n` +
            (
              compressed.sizeReduced
                ? (
                    language === "en"
                      ? `Saved ${formatFileSize(compressed.bytesSaved)} (${compressed.percentageSaved.toFixed(1)}%).`
                      : `${formatFileSize(compressed.bytesSaved)} (${compressed.percentageSaved.toFixed(1)}%) आकार बचा।`
                  )
                : (
                    language === "en"
                      ? "The compressed file is not smaller than the original."
                      : "कंप्रेस की गई फाइल मूल फाइल से छोटी नहीं हुई।"
                  )
            );

          downloadLink.href = outputUrl;
          downloadLink.download =
            `${file.name.replace(/\.[^.]+$/, "")}-compressed.webp`;

          successfulCount++;
        } catch (error) {
          failedCount++;

          details.textContent =
            language === "en"
              ? `Failed: ${
                  error instanceof Error
                    ? error.message
                    : "Image compression failed."
                }`
              : `विफल: ${
                  error instanceof Error
                    ? error.message
                    : "इमेज कंप्रेशन विफल हुआ।"
                }`;

          downloadLink.remove();
        }
      }

      result.hidden = false;

      status.textContent =
        language === "en"
          ? `Finished. ${successfulCount} successful, ${failedCount} failed.`
          : `काम पूरा हुआ। ${successfulCount} सफल, ${failedCount} विफल।`;
    } finally {
      runButton.disabled = false;
      fileInput.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releaseCompressorUrls();
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
    return;
  }

  if (target.closest("[data-open-converter]")) {
    openImageConverter();
    return;
  }

  if (target.closest("[data-open-resizer]")) {
    openImageResizer();
  }

  if (target.closest("[data-open-pdf-merger]")) {
  openPdfMerger();
  }

  if (target.closest("[data-open-pdf-splitter]")) {
  openPdfSplitter();
  return;
  }

  if (target.closest("[data-open-qr-generator]")) {
  openQrGenerator();
  return;
  }

  if (target.closest("[data-open-password-generator]")) {
  openPasswordGenerator();
  return;
  }
});

 // M5.3 — Batch Image Format Converter

let converterObjectUrls: string[] = [];

function openImageConverter(): void {
  const home = element<HTMLElement>("home");

  document.getElementById("image-converter-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "image-converter-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">
        <h2>${language === "en" ? "Image Format Converter" : "इमेज फॉर्मेट कन्वर्टर"}</h2>

        <p>
          ${language === "en"
            ? "Convert multiple images to JPEG, PNG, or WebP locally in your browser."
            : "अपने ब्राउज़र में कई इमेज को JPEG, PNG या WebP में कन्वर्ट करें।"}
        </p>

        <button id="converter-back" class="control-button" type="button">
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="converter-file">
            ${language === "en" ? "Choose images" : "इमेज चुनें"}
          </label>
          <input
            id="converter-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style="display:block;width:100%;margin-top:10px"
          />
          <p id="converter-selection" role="status"></p>
        </div>

        <div style="margin-top:20px">
          <label for="converter-format">
            ${language === "en" ? "Output format" : "आउटपुट फॉर्मेट"}
          </label>
          <select id="converter-format" style="display:block;width:100%;margin-top:10px">
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
          </select>
        </div>

        <div style="margin-top:20px">
          <label for="converter-quality">
            ${language === "en" ? "Quality (for JPEG/WebP)" : "क्वालिटी (JPEG/WebP के लिए)"}
            <span id="converter-quality-value">80%</span>
          </label>
          <input
            id="converter-quality"
            type="range"
            min="10"
            max="100"
            value="80"
            style="display:block;width:100%;margin-top:10px"
          />
        </div>

        <button
          id="converter-run"
          class="control-button"
          type="button"
          style="margin-top:20px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Convert All Images" : "सभी इमेज कन्वर्ट करें"}
        </button>

        <p id="converter-status" role="status" aria-live="polite"></p>

        <div id="converter-result" hidden>
          <h3>${language === "en" ? "Conversion Results" : "कन्वर्ज़न परिणाम"}</h3>
          <div id="converter-results-list"></div>
        </div>
      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const fileInput =
    screen.querySelector<HTMLInputElement>("#converter-file");
  const formatInput =
    screen.querySelector<HTMLSelectElement>("#converter-format");
  const qualityInput =
    screen.querySelector<HTMLInputElement>("#converter-quality");
  const qualityValue =
    screen.querySelector<HTMLElement>("#converter-quality-value");
  const selection =
    screen.querySelector<HTMLParagraphElement>("#converter-selection");
  const runButton =
    screen.querySelector<HTMLButtonElement>("#converter-run");
  const backButton =
    screen.querySelector<HTMLButtonElement>("#converter-back");
  const status =
    screen.querySelector<HTMLParagraphElement>("#converter-status");
  const result =
    screen.querySelector<HTMLDivElement>("#converter-result");
  const resultsList =
    screen.querySelector<HTMLDivElement>("#converter-results-list");

  if (
    !fileInput || !formatInput || !qualityInput || !qualityValue ||
    !selection || !runButton || !backButton || !status ||
    !result || !resultsList
  ) {
    screen.remove();
    home.hidden = false;
    throw new Error("Image Converter UI initialization failed.");
  }

  function releaseConverterUrls(): void {
    converterObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    converterObjectUrls = [];
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  qualityInput.addEventListener("input", () => {
    qualityValue.textContent = `${qualityInput.value}%`;
  });

  formatInput.addEventListener("change", () => {
    qualityInput.disabled = formatInput.value === "image/png";
  });

  qualityInput.disabled = formatInput.value === "image/png";

  fileInput.addEventListener("change", () => {
    releaseConverterUrls();
    resultsList.replaceChildren();
    result.hidden = true;
    status.textContent = "";

    const files = Array.from(fileInput.files ?? []);

    selection.textContent = files.length
      ? (language === "en"
          ? `${files.length} image(s) selected.`
          : `${files.length} इमेज चुनी गईं।`)
      : "";
  });

  runButton.addEventListener("click", async () => {
    const files = Array.from(fileInput.files ?? []);

    if (files.length === 0) {
      status.textContent = language === "en"
        ? "Please choose images first."
        : "पहले इमेज चुनें।";
      return;
    }

    releaseConverterUrls();
    resultsList.replaceChildren();
    result.hidden = true;
    runButton.disabled = true;
    fileInput.disabled = true;
    formatInput.disabled = true;
    qualityInput.disabled = true;

    let succeeded = 0;
    let failed = 0;

    const format = formatInput.value as
      "image/jpeg" | "image/png" | "image/webp";

    const extension = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[format];

    status.textContent = language === "en"
      ? `Converting ${files.length} image(s)...`
      : `${files.length} इमेज कन्वर्ट हो रही हैं...`;

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        const card = document.createElement("div");
        card.className = "tool-card";
        card.style.marginTop = "12px";

        const heading = document.createElement("h4");
        heading.textContent = file.name;

        const progress = document.createElement("p");
        progress.textContent = language === "en"
          ? `Processing ${index + 1} of ${files.length}...`
          : `${files.length} में से ${index + 1}वीं इमेज प्रोसेस हो रही है...`;

        const details = document.createElement("p");

        card.append(heading, progress, details);
        resultsList.append(card);

        try {
          const converted = await processImage(file, {
            format,
            quality: Number(qualityInput.value) / 100,
          });

          const url = URL.createObjectURL(converted.blob);
          converterObjectUrls.push(url);

          const download = document.createElement("a");
          download.className = "control-button";
          download.style.display = "inline-block";
          download.style.textDecoration = "none";
          download.href = url;
          download.download =
            `${file.name.replace(/\.[^.]+$/, "")}-converted.${extension}`;
          download.textContent = language === "en"
            ? "Download converted image"
            : "कन्वर्ट की गई इमेज डाउनलोड करें";

          details.textContent =
            `${extension.toUpperCase()} · ${formatBytes(converted.outputBytes)} · ` +
            `${converted.width} × ${converted.height}`;

          card.append(download);
          progress.textContent = language === "en"
            ? "Completed successfully"
            : "सफलतापूर्वक पूरा हुआ";

          succeeded++;
        } catch (error) {
          progress.textContent = language === "en"
            ? "Conversion failed"
            : "कन्वर्ज़न विफल हुआ";

          details.textContent = error instanceof Error
            ? error.message
            : (language === "en"
                ? "Could not convert this image."
                : "इस इमेज को कन्वर्ट नहीं किया जा सका।");

          failed++;
        }
      }

      result.hidden = false;

      status.textContent = language === "en"
        ? `Finished. ${succeeded} successful, ${failed} failed.`
        : `पूरा हुआ। ${succeeded} सफल, ${failed} विफल।`;
    } finally {
      runButton.disabled = false;
      fileInput.disabled = false;
      formatInput.disabled = false;
      qualityInput.disabled = formatInput.value === "image/png";
    }
  });

  backButton.addEventListener("click", () => {
    releaseConverterUrls();
    screen.remove();
    home.hidden = false;
    home.scrollIntoView({ behavior: "auto", block: "start" });
  });

  screen.scrollIntoView({ behavior: "auto", block: "start" });
}


 // M5.5 — Batch Image Resizer

let resizerObjectUrls: string[] = [];

function openImageResizer(): void {
  const home = element<HTMLElement>("home");

  document.getElementById("image-resizer-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "image-resizer-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">
        <h2>${language === "en" ? "Image Resizer" : "इमेज रिसाइज़र"}</h2>

        <p>
          ${language === "en"
            ? "Resize multiple images locally in your browser."
            : "अपने ब्राउज़र में ही एक साथ कई इमेज का आकार बदलें।"}
        </p>

        <button id="resizer-back" class="control-button" type="button">
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="resizer-file">
            ${language === "en" ? "Choose images" : "इमेज चुनें"}
          </label>
          <input
            id="resizer-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style="display:block;width:100%;margin-top:10px"
          />
          <p id="resizer-selection" role="status"></p>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px">
          <label for="resizer-width">
            ${language === "en" ? "Width (px)" : "चौड़ाई (px)"}
            <input
              id="resizer-width"
              type="number"
              min="1"
              step="1"
              style="display:block;width:100%;margin-top:8px"
            />
          </label>

          <label for="resizer-height">
            ${language === "en" ? "Height (px)" : "ऊँचाई (px)"}
            <input
              id="resizer-height"
              type="number"
              min="1"
              step="1"
              style="display:block;width:100%;margin-top:8px"
            />
          </label>
        </div>

        <label style="display:block;margin-top:16px">
          <input id="resizer-ratio" type="checkbox" checked />
          ${language === "en" ? "Keep aspect ratio" : "अनुपात बनाए रखें"}
        </label>

        <button
          id="resizer-run"
          class="control-button"
          type="button"
          style="margin-top:18px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Resize All Images" : "सभी इमेज का आकार बदलें"}
        </button>

        <p id="resizer-status" role="status" aria-live="polite"></p>

        <div id="resizer-result" hidden>
          <h3>${language === "en" ? "Resize Results" : "रिसाइज़ परिणाम"}</h3>
          <div id="resizer-results-list"></div>
        </div>
      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const fileInput =
    screen.querySelector<HTMLInputElement>("#resizer-file");
  const widthInput =
    screen.querySelector<HTMLInputElement>("#resizer-width");
  const heightInput =
    screen.querySelector<HTMLInputElement>("#resizer-height");
  const ratioInput =
    screen.querySelector<HTMLInputElement>("#resizer-ratio");
  const runButton =
    screen.querySelector<HTMLButtonElement>("#resizer-run");
  const backButton =
    screen.querySelector<HTMLButtonElement>("#resizer-back");
  const selection =
    screen.querySelector<HTMLParagraphElement>("#resizer-selection");
  const status =
    screen.querySelector<HTMLParagraphElement>("#resizer-status");
  const result =
    screen.querySelector<HTMLDivElement>("#resizer-result");
  const resultsList =
    screen.querySelector<HTMLDivElement>("#resizer-results-list");

  if (
    !fileInput || !widthInput || !heightInput || !ratioInput ||
    !runButton || !backButton || !selection || !status ||
    !result || !resultsList
  ) {
    screen.remove();
    home.hidden = false;
    throw new Error("Image Resizer UI initialization failed.");
  }

  // Revoke every generated image URL when results are cleared.
  function releaseResizerUrls(): void {
    for (const url of resizerObjectUrls) {
      URL.revokeObjectURL(url);
    }

    resizerObjectUrls = [];
  }

  function formatResizerBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // The last edited dimension determines the resize direction
  // when aspect ratio is kept.
  let resizeBy: "width" | "height" = "width";

  fileInput.addEventListener("change", async () => {
    releaseResizerUrls();
    resultsList.replaceChildren();
    result.hidden = true;
    status.textContent = "";

    const files = Array.from(fileInput.files ?? []);

    selection.textContent = files.length
      ? (language === "en"
          ? `${files.length} image(s) selected.`
          : `${files.length} इमेज चुनी गईं।`)
      : "";

    if (files.length === 0) {
      widthInput.value = "";
      heightInput.value = "";
      return;
    }

    // Use the first image to initialize the dimension fields.
    try {
      const bitmap = await createImageBitmap(files[0]);

      const originalWidth = bitmap.width;
      const originalHeight = bitmap.height;

      bitmap.close();

      widthInput.value = String(originalWidth);
      heightInput.value = String(originalHeight);

      resizeBy = "width";
    } catch {
      status.textContent = language === "en"
        ? "Could not read the first image. Please choose a supported image."
        : "पहली इमेज पढ़ी नहीं जा सकी। समर्थित इमेज चुनें।";
    }
  });

  widthInput.addEventListener("input", () => {
    resizeBy = "width";
  });

  heightInput.addEventListener("input", () => {
    resizeBy = "height";
  });

  runButton.addEventListener("click", async () => {
    const files = Array.from(fileInput.files ?? []);

    const targetWidth = Number(widthInput.value);
    const targetHeight = Number(heightInput.value);

    if (files.length === 0) {
      status.textContent = language === "en"
        ? "Please choose images first."
        : "पहले इमेज चुनें।";
      return;
    }

    if (
      !Number.isSafeInteger(targetWidth) || targetWidth < 1 ||
      !Number.isSafeInteger(targetHeight) || targetHeight < 1
    ) {
      status.textContent = language === "en"
        ? "Enter valid positive whole numbers for width and height."
        : "चौड़ाई और ऊँचाई के लिए सही सकारात्मक पूर्णांक दर्ज करें।";
      return;
    }

    releaseResizerUrls();
    resultsList.replaceChildren();
    result.hidden = true;

    runButton.disabled = true;
    fileInput.disabled = true;
    widthInput.disabled = true;
    heightInput.disabled = true;
    ratioInput.disabled = true;

    let succeeded = 0;
    let failed = 0;

    status.textContent = language === "en"
      ? `Resizing ${files.length} image(s)...`
      : `${files.length} इमेज का आकार बदला जा रहा है...`;

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];

        const card = document.createElement("div");
        card.className = "tool-card";
        card.style.marginTop = "12px";

        const heading = document.createElement("h4");
        heading.textContent = file.name;

        const progress = document.createElement("p");
        progress.textContent = language === "en"
          ? `Processing ${index + 1} of ${files.length}...`
          : `${files.length} में से ${index + 1}वीं इमेज प्रोसेस हो रही है...`;

        const details = document.createElement("p");

        card.append(heading, progress, details);
        resultsList.append(card);

        try {
          // Each image has its own original dimensions.
          const bitmap = await createImageBitmap(file);

          const originalWidth = bitmap.width;
          const originalHeight = bitmap.height;

          bitmap.close();

          let width = targetWidth;
          let height = targetHeight;

          if (ratioInput.checked) {
            if (resizeBy === "width") {
              height = Math.max(
                1,
                Math.round(targetWidth * originalHeight / originalWidth)
              );
            } else {
              width = Math.max(
                1,
                Math.round(targetHeight * originalWidth / originalHeight)
              );
            }
          }

          const resized = await processImage(file, {
            width,
            height,
          });

          const outputUrl = URL.createObjectURL(resized.blob);
          resizerObjectUrls.push(outputUrl);

          const extensions: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
          };

          const extension = extensions[resized.format];

          if (!extension) {
            URL.revokeObjectURL(outputUrl);
            resizerObjectUrls = resizerObjectUrls.filter(
              (url) => url !== outputUrl
            );
            throw new Error("Unsupported output image format.");
          }

          const download = document.createElement("a");
          download.className = "control-button";
          download.style.display = "inline-block";
          download.style.textDecoration = "none";
          download.href = outputUrl;
          download.download =
            `${file.name.replace(/\.[^.]+$/, "")}-resized.${extension}`;
          download.textContent = language === "en"
            ? "Download resized image"
            : "बदली हुई इमेज डाउनलोड करें";

          details.textContent =
            `${language === "en" ? "Output dimensions" : "आउटपुट आकार"}: ` +
            `${resized.width} × ${resized.height} · ` +
            formatResizerBytes(resized.outputBytes);

          card.append(download);

          progress.textContent = language === "en"
            ? "Completed successfully"
            : "सफलतापूर्वक पूरा हुआ";

          succeeded++;
        } catch (error) {
          progress.textContent = language === "en"
            ? "Resize failed"
            : "रिसाइज़ विफल हुआ";

          details.textContent = error instanceof Error
            ? error.message
            : (language === "en"
                ? "Could not resize this image."
                : "इस इमेज का आकार नहीं बदला जा सका।");

          failed++;
        }
      }

      result.hidden = false;

      status.textContent = language === "en"
        ? `Finished. ${succeeded} successful, ${failed} failed.`
        : `काम पूरा हुआ। ${succeeded} सफल, ${failed} विफल।`;
    } finally {
      runButton.disabled = false;
      fileInput.disabled = false;
      widthInput.disabled = false;
      heightInput.disabled = false;
      ratioInput.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releaseResizerUrls();
    screen.remove();
    home.hidden = false;
    home.scrollIntoView({ behavior: "auto", block: "start" });
  });

  screen.scrollIntoView({ behavior: "auto", block: "start" });
}

// M5.6 — PDF Merger UI Integration

let pdfMergerObjectUrl: string | null = null;

function openPdfMerger(): void {
  const home = element<HTMLElement>("home");

  // Prevent duplicate PDF Merger screens.
  document.getElementById("pdf-merger-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "pdf-merger-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">

        <h2>
          ${language === "en" ? "PDF Merger" : "PDF मर्जर"}
        </h2>

        <p>
          ${
            language === "en"
              ? "Merge multiple PDF files locally in your browser."
              : "अपने ब्राउज़र में ही कई PDF फाइलों को जोड़ें।"
          }
        </p>

        <button
          id="pdf-merger-back"
          class="control-button"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="pdf-merger-files">
            ${
              language === "en"
                ? "Choose PDF files (at least 2)"
                : "PDF फाइलें चुनें (कम से कम 2)"
            }
          </label>

          <input
            id="pdf-merger-files"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            style="display:block;width:100%;margin-top:10px"
          />

          <p id="pdf-merger-selection" role="status"></p>
        </div>

        <button
          id="pdf-merger-run"
          class="control-button"
          type="button"
          style="margin-top:20px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Merge PDF Files" : "PDF फाइलें जोड़ें"}
        </button>

        <p
          id="pdf-merger-status"
          role="status"
          aria-live="polite"
        ></p>

        <div id="pdf-merger-result" hidden>
          <h3>
            ${language === "en" ? "Merge Result" : "मर्ज परिणाम"}
          </h3>

          <a
            id="pdf-merger-download"
            class="control-button"
            style="display:inline-block;text-decoration:none"
            download="merged.pdf"
          >
            ${language === "en" ? "Download Merged PDF" : "मर्ज की गई PDF डाउनलोड करें"}
          </a>
        </div>

      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const fileInput =
    screen.querySelector<HTMLInputElement>("#pdf-merger-files");

  const selection =
    screen.querySelector<HTMLParagraphElement>("#pdf-merger-selection");

  const runButton =
    screen.querySelector<HTMLButtonElement>("#pdf-merger-run");

  const backButton =
    screen.querySelector<HTMLButtonElement>("#pdf-merger-back");

  const status =
    screen.querySelector<HTMLParagraphElement>("#pdf-merger-status");

  const result =
    screen.querySelector<HTMLDivElement>("#pdf-merger-result");

  const downloadLink =
    screen.querySelector<HTMLAnchorElement>("#pdf-merger-download");

  if (
    !fileInput ||
    !selection ||
    !runButton ||
    !backButton ||
    !status ||
    !result ||
    !downloadLink
  ) {
    screen.remove();
    home.hidden = false;

    throw new Error("PDF Merger UI initialization failed.");
  }

  function releasePdfMergerUrl(): void {
  if (pdfMergerObjectUrl) {
    URL.revokeObjectURL(pdfMergerObjectUrl);
    pdfMergerObjectUrl = null;
  }

  if (downloadLink) {
    downloadLink.removeAttribute("href");
  }
  }

  fileInput.addEventListener("change", () => {
    releasePdfMergerUrl();

    result.hidden = true;
    status.textContent = "";

    const files = Array.from(fileInput.files ?? []);

    selection.textContent =
      language === "en"
        ? `${files.length} PDF file(s) selected.`
        : `${files.length} PDF फाइलें चुनी गईं।`;
  });

  runButton.addEventListener("click", async () => {
    const files = Array.from(fileInput.files ?? []);

    if (files.length < 2) {
      status.textContent =
        language === "en"
          ? "Please select at least two PDF files."
          : "कम से कम दो PDF फाइलें चुनें।";

      return;
    }

    // Check the selected file types.
    const invalidFile = files.find(
      (file) =>
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    );

    if (invalidFile) {
      status.textContent =
        language === "en"
          ? `${invalidFile.name} is not a PDF file.`
          : `${invalidFile.name} PDF फाइल नहीं है।`;

      return;
    }

    releasePdfMergerUrl();
    result.hidden = true;

    runButton.disabled = true;
    fileInput.disabled = true;

    status.textContent =
      language === "en"
        ? "Merging PDF files..."
        : "PDF फाइलें जोड़ी जा रही हैं...";

    try {
      // Call the existing PDF merger implementation.
      const mergedBytes = await mergePdfFiles(files);

      // Create a clean ArrayBuffer for the download.
      const pdfBuffer = mergedBytes.buffer.slice(
        mergedBytes.byteOffset,
        mergedBytes.byteOffset + mergedBytes.byteLength
      ) as ArrayBuffer;

      const blob = new Blob(
        [pdfBuffer],
        { type: "application/pdf" }
      );

      pdfMergerObjectUrl = URL.createObjectURL(blob);

      // Ensure the download link exists before setting href.
      if (!downloadLink) {
        throw new Error("PDF download link is missing.");
      }

      downloadLink.href = pdfMergerObjectUrl;

      result.hidden = false;

      status.textContent =
        language === "en"
          ? "PDF files merged successfully."
          : "PDF फाइलें सफलतापूर्वक जुड़ गईं।";
    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : (
              language === "en"
                ? "PDF merging failed."
                : "PDF मर्ज नहीं हो सकी।"
            );
    } finally {
      runButton.disabled = false;
      fileInput.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releasePdfMergerUrl();

    screen.remove();

    home.hidden = false;
    home.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  });

  screen.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}

// M5.7 — PDF Splitter UI Integration

function openPdfSplitter(): void {
  const home = element<HTMLElement>("home");

  // Prevent duplicate PDF Splitter screens.
  document.getElementById("pdf-splitter-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "pdf-splitter-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">

        <h2>
          ${language === "en" ? "PDF Splitter" : "PDF स्प्लिटर"}
        </h2>

        <p>
          ${
            language === "en"
              ? "Split a PDF into separate single-page PDF files locally in your browser."
              : "अपने ब्राउज़र में ही PDF के हर पेज को अलग PDF फाइल में बाँटें।"
          }
        </p>

        <button
          id="pdf-splitter-back"
          class="control-button"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="pdf-splitter-file">
            ${
              language === "en"
                ? "Choose a PDF file"
                : "एक PDF फाइल चुनें"
            }
          </label>

          <input
            id="pdf-splitter-file"
            type="file"
            accept="application/pdf,.pdf"
            style="display:block;width:100%;margin-top:10px"
          />

          <p id="pdf-splitter-selection" role="status"></p>
        </div>

        <button
          id="pdf-splitter-run"
          class="control-button"
          type="button"
          style="margin-top:20px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Split PDF" : "PDF बाँटें"}
        </button>

        <p
          id="pdf-splitter-status"
          role="status"
          aria-live="polite"
        ></p>

        <div id="pdf-splitter-result" hidden>
          <h3>
            ${language === "en" ? "Split Result" : "स्प्लिट परिणाम"}
          </h3>

          <div id="pdf-splitter-downloads"></div>
        </div>

      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const fileInput =
    screen.querySelector<HTMLInputElement>("#pdf-splitter-file");

  const selection =
    screen.querySelector<HTMLParagraphElement>("#pdf-splitter-selection");

  const runButton =
    screen.querySelector<HTMLButtonElement>("#pdf-splitter-run");

  const backButton =
    screen.querySelector<HTMLButtonElement>("#pdf-splitter-back");

  const status =
    screen.querySelector<HTMLParagraphElement>("#pdf-splitter-status");

  const result =
    screen.querySelector<HTMLDivElement>("#pdf-splitter-result");

  const downloads =
    screen.querySelector<HTMLDivElement>("#pdf-splitter-downloads");

  if (
    !fileInput ||
    !selection ||
    !runButton ||
    !backButton ||
    !status ||
    !result ||
    !downloads
  ) {
    screen.remove();
    home.hidden = false;

    throw new Error("PDF Splitter UI initialization failed.");
  }

  // Store generated URLs so they can be released.
  const splitterObjectUrls: string[] = [];

  function releaseSplitterUrls(): void {
    splitterObjectUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    splitterObjectUrls.length = 0;
    document.getElementById("pdf-splitter-downloads")?.replaceChildren();
  }

  fileInput.addEventListener("change", () => {
    releaseSplitterUrls();

    result.hidden = true;
    status.textContent = "";

    const file = fileInput.files?.[0];

    selection.textContent = file
      ? file.name
      : "";

  });

  runButton.addEventListener("click", async () => {
    const file = fileInput.files?.[0];

    if (!file) {
      status.textContent =
        language === "en"
          ? "Please select a PDF file."
          : "कृपया एक PDF फाइल चुनें।";

      return;
    }

    // Check the selected file type.
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      status.textContent =
        language === "en"
          ? "Please select a valid PDF file."
          : "कृपया सही PDF फाइल चुनें।";

      return;
    }

    releaseSplitterUrls();
    result.hidden = true;

    runButton.disabled = true;
    fileInput.disabled = true;

    status.textContent =
      language === "en"
        ? "Splitting PDF..."
        : "PDF बाँटी जा रही है...";

    try {
      // Call the existing PDF Splitter implementation.
      const splitFiles = await splitPdfFile(file);

      if (splitFiles.length === 0) {
        throw new Error(
          language === "en"
            ? "No pages found in the PDF."
            : "PDF में कोई पेज नहीं मिला।"
        );
      }

      // Create one download link for each page.
      splitFiles.forEach((pdfBytes, index) => {
        const pdfBuffer = pdfBytes.buffer.slice(
          pdfBytes.byteOffset,
          pdfBytes.byteOffset + pdfBytes.byteLength
        ) as ArrayBuffer;

        const blob = new Blob(
          [pdfBuffer],
          { type: "application/pdf" }
        );

        const objectUrl = URL.createObjectURL(blob);
        splitterObjectUrls.push(objectUrl);

        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = `split-page-${index + 1}.pdf`;
        link.className = "control-button";
        link.style.display = "block";
        link.style.marginTop = "10px";
        link.style.textDecoration = "none";

        link.textContent =
          language === "en"
            ? `Download Page ${index + 1}`
            : `पेज ${index + 1} डाउनलोड करें`;
       downloads.appendChild(link);
      });

      result.hidden = false;

      status.textContent =
        language === "en"
          ? `PDF split successfully into ${splitFiles.length} page(s).`
          : `PDF सफलतापूर्वक ${splitFiles.length} पेजों में बाँटी गई।`;

    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : (
              language === "en"
                ? "PDF splitting failed."
                : "PDF नहीं बाँटी जा सकी।"
            );

    } finally {
      runButton.disabled = false;
      fileInput.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releaseSplitterUrls();

    screen.remove();

    home.hidden = false;
    home.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  });

  screen.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}

// M7.1 — QR Code Generator UI

function openQrGenerator(): void {
  const home = element<HTMLElement>("home");

  // Prevent duplicate QR Generator screens.
  document.getElementById("qr-generator-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "qr-generator-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">

        <h2>
          ${language === "en" ? "QR Code Generator" : "QR कोड जनरेटर"}
        </h2>

        <p>
          ${
            language === "en"
              ? "Create a QR code from text or a URL locally in your browser."
              : "अपने ब्राउज़र में टेक्स्ट या URL से QR कोड बनाएँ।"
          }
        </p>

        <button
          id="qr-generator-back"
          class="control-button"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="qr-generator-input">
            ${language === "en" ? "Enter text or URL" : "टेक्स्ट या URL लिखें"}
          </label>

          <textarea
            id="qr-generator-input"
            rows="4"
            maxlength="2000"
            style="display:block;width:100%;margin-top:10px"
            placeholder="${language === "en" ? "https://example.com" : "https://example.com"}"
          ></textarea>
        </div>

        <button
          id="qr-generator-run"
          class="control-button"
          type="button"
          style="margin-top:20px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Generate QR Code" : "QR कोड बनाएँ"}
        </button>

        <p id="qr-generator-status" role="status" aria-live="polite"></p>

        <div id="qr-generator-result" hidden style="margin-top:20px">
          <h3>
            ${language === "en" ? "Your QR Code" : "आपका QR कोड"}
          </h3>

          <img
            id="qr-generator-image"
            alt="${language === "en" ? "Generated QR Code" : "बनाया गया QR कोड"}"
            style="display:block;max-width:100%;width:280px;height:auto;margin:15px auto"
          />

          <a
            id="qr-generator-download"
            class="control-button"
            download="mobile-freedom-qr.png"
            style="display:block;text-align:center;text-decoration:none"
          >
            ${language === "en" ? "Download QR Code" : "QR कोड डाउनलोड करें"}
          </a>
        </div>

      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const input =
    screen.querySelector<HTMLTextAreaElement>("#qr-generator-input");

  const runButton =
    screen.querySelector<HTMLButtonElement>("#qr-generator-run");

  const backButton =
    screen.querySelector<HTMLButtonElement>("#qr-generator-back");

  const status =
    screen.querySelector<HTMLParagraphElement>("#qr-generator-status");

  const result =
    screen.querySelector<HTMLDivElement>("#qr-generator-result");

  const qrImage =
    screen.querySelector<HTMLImageElement>("#qr-generator-image");

  const download =
    screen.querySelector<HTMLAnchorElement>("#qr-generator-download");

  if (
    !input ||
    !runButton ||
    !backButton ||
    !status ||
    !result ||
    !qrImage ||
    !download
  ) {
    screen.remove();
    home.hidden = false;

    throw new Error("QR Generator UI initialization failed.");
  }

  let qrObjectUrl: string | null = null;

  function releaseQrUrl(): void {
    if (qrObjectUrl) {
      URL.revokeObjectURL(qrObjectUrl);
      qrObjectUrl = null;
    }

    document.getElementById("qr-generator-image")?.removeAttribute("src");
    document.getElementById("qr-generator-download")?.removeAttribute("href");
  }

  runButton.addEventListener("click", async () => {
    const value = input.value.trim();

    if (!value) {
      status.textContent =
        language === "en"
          ? "Please enter text or a URL."
          : "कृपया टेक्स्ट या URL लिखें।";

      return;
    }

    releaseQrUrl();
    result.hidden = true;

    runButton.disabled = true;

    status.textContent =
      language === "en"
        ? "Generating QR Code..."
        : "QR कोड बनाया जा रहा है...";

    try {
      const dataUrl = await QRCode.toDataURL(value, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 400,
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      qrObjectUrl = URL.createObjectURL(blob);

      document.getElementById("qr-generator-image")?.setAttribute("src", qrObjectUrl);
      document.getElementById("qr-generator-download")?.setAttribute("href", qrObjectUrl);

      result.hidden = false;

      status.textContent =
        language === "en"
          ? "QR Code generated successfully."
          : "QR कोड सफलतापूर्वक बन गया।";

    } catch (error) {
      status.textContent =
        error instanceof Error
          ? error.message
          : (
              language === "en"
                ? "QR Code generation failed."
                : "QR कोड नहीं बन सका।"
            );

    } finally {
      runButton.disabled = false;
    }
  });

  backButton.addEventListener("click", () => {
    releaseQrUrl();
    screen.remove();

    home.hidden = false;

    home.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  });

  screen.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}

// M7.2 — Password Generator UI

function openPasswordGenerator(): void {
  const home = element<HTMLElement>("home");

  // Prevent duplicate Password Generator screens.
  document.getElementById("password-generator-screen")?.remove();

  const screen = document.createElement("section");
  screen.id = "password-generator-screen";
  screen.className = "section";

  screen.innerHTML = `
    <div class="container">
      <div class="tool-card">

        <h2>
          ${
            language === "en"
              ? "Password Generator"
              : "पासवर्ड जनरेटर"
          }
        </h2>

        <p>
          ${
            language === "en"
              ? "Generate a strong password locally in your browser."
              : "अपने ब्राउज़र में सुरक्षित पासवर्ड बनाएँ।"
          }
        </p>

        <button
          id="password-generator-back"
          class="control-button"
          type="button"
        >
          ${language === "en" ? "← Back" : "← वापस जाएँ"}
        </button>

        <div style="margin-top:20px">
          <label for="password-generator-length">
            ${language === "en" ? "Password Length" : "पासवर्ड की लंबाई"}
          </label>

          <input
            id="password-generator-length"
            type="number"
            min="8"
            max="64"
            value="16"
            style="display:block;width:100%;margin-top:10px"
          />
        </div>

        <div style="margin-top:20px">
          <label>
            <input
              id="password-generator-uppercase"
              type="checkbox"
              checked
            />
            ${language === "en" ? "Uppercase (A-Z)" : "बड़े अक्षर (A-Z)"}
          </label>
        </div>

        <div style="margin-top:10px">
          <label>
            <input
              id="password-generator-lowercase"
              type="checkbox"
              checked
            />
            ${language === "en" ? "Lowercase (a-z)" : "छोटे अक्षर (a-z)"}
          </label>
        </div>

        <div style="margin-top:10px">
          <label>
            <input
              id="password-generator-numbers"
              type="checkbox"
              checked
            />
            ${language === "en" ? "Numbers (0-9)" : "अंक (0-9)"}
          </label>
        </div>

        <div style="margin-top:10px">
          <label>
            <input
              id="password-generator-symbols"
              type="checkbox"
              checked
            />
            ${language === "en" ? "Symbols (!@#$)" : "विशेष चिन्ह (!@#$)"}
          </label>
        </div>

        <button
          id="password-generator-run"
          class="control-button"
          type="button"
          style="margin-top:20px;background:var(--accent);color:white"
        >
          ${language === "en" ? "Generate Password" : "पासवर्ड बनाएँ"}
        </button>

        <p
          id="password-generator-status"
          role="status"
          aria-live="polite"
        ></p>

        <div id="password-generator-result" hidden style="margin-top:20px">

          <label for="password-generator-output">
            ${language === "en" ? "Generated Password" : "बनाया गया पासवर्ड"}
          </label>

          <input
            id="password-generator-output"
            type="text"
            readonly
            autocomplete="off"
            style="display:block;width:100%;margin-top:10px"
          />

          <button
            id="password-generator-copy"
            class="control-button"
            type="button"
            style="margin-top:15px"
          >
            ${language === "en" ? "Copy Password" : "पासवर्ड कॉपी करें"}
          </button>

        </div>

      </div>
    </div>
  `;

  home.hidden = true;
  home.after(screen);

  const lengthInput =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-length"
    );

  const uppercaseInput =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-uppercase"
    );

  const lowercaseInput =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-lowercase"
    );

  const numbersInput =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-numbers"
    );

  const symbolsInput =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-symbols"
    );

  const runButton =
    screen.querySelector<HTMLButtonElement>(
      "#password-generator-run"
    );

  const backButton =
    screen.querySelector<HTMLButtonElement>(
      "#password-generator-back"
    );

  const copyButton =
    screen.querySelector<HTMLButtonElement>(
      "#password-generator-copy"
    );

  const status =
    screen.querySelector<HTMLParagraphElement>(
      "#password-generator-status"
    );

  const result =
    screen.querySelector<HTMLDivElement>(
      "#password-generator-result"
    );

  const output =
    screen.querySelector<HTMLInputElement>(
      "#password-generator-output"
    );

  if (
    !lengthInput ||
    !uppercaseInput ||
    !lowercaseInput ||
    !numbersInput ||
    !symbolsInput ||
    !runButton ||
    !backButton ||
    !copyButton ||
    !status ||
    !result ||
    !output
  ) {
    screen.remove();
    home.hidden = false;

    throw new Error(
      "Password Generator UI initialization failed."
    );
  }

  runButton.addEventListener("click", () => {
    const length = Number(lengthInput.value);

    if (
      !Number.isInteger(length) ||
      length < 8 ||
      length > 64
    ) {
      status.textContent =
        language === "en"
          ? "Password length must be between 8 and 64."
          : "पासवर्ड की लंबाई 8 से 64 के बीच रखें।";

      return;
    }

    let characters = "";

    if (uppercaseInput.checked) {
      characters += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    }

    if (lowercaseInput.checked) {
      characters += "abcdefghijklmnopqrstuvwxyz";
    }

    if (numbersInput.checked) {
      characters += "0123456789";
    }

    if (symbolsInput.checked) {
      characters += "!@#$%^&*()-_=+[]{}?";
    }

    if (!characters) {
      status.textContent =
        language === "en"
          ? "Please select at least one character option."
          : "कम से कम एक character option चुनें।";

      return;
    }

    let password = "";

const randomBuffer = new Uint32Array(1);

const maxValidValue =
  Math.floor(0x100000000 / characters.length) *
  characters.length;

for (let i = 0; i < length; i++) {
  let randomValue: number;

  do {
    crypto.getRandomValues(randomBuffer);
    randomValue = randomBuffer[0];
  } while (randomValue >= maxValidValue);

  const index = randomValue % characters.length;

  password += characters[index];
}

    output.value = password;
    result.hidden = false;

    status.textContent =
      language === "en"
        ? "Password generated successfully."
        : "पासवर्ड सफलतापूर्वक बन गया।";
  });

  copyButton.addEventListener("click", async () => {
    if (!output.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output.value);

      status.textContent =
        language === "en"
          ? "Password copied successfully."
          : "पासवर्ड कॉपी हो गया।";
    } catch {
      output.focus();
      output.select();

      status.textContent =
        language === "en"
          ? "Copy was blocked. Select the password and copy it manually."
          : "कॉपी नहीं हो सका। पासवर्ड चुनकर मैन्युअल कॉपी करें।";
    }
  });

  backButton.addEventListener("click", () => {
    screen.remove();
    home.hidden = false;

    home.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  });

  screen.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}
