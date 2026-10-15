/**
 * Mobile Freedom
 * M4.1 — Responsive Homepage Foundation
 * M4.2 — Live Category and Search Result Count
 */

import "./style.css";

import {
  compressImage,
  SUPPORTED_IMAGE_TYPES,
} from "./tools/image/imageEngine";

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
