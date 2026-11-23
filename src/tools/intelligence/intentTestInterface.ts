import { understandIntent } from "./intentEngine";

export function openIntentTestInterface(home: HTMLElement, language: "en" | "hi"): void {
  document.getElementById("intent-test-screen")?.remove();
  const en = language === "en";
  const screen = document.createElement("section");
  screen.id = "intent-test-screen";
  screen.className = "section";
  screen.innerHTML = `
    <div class="container"><article class="tool-card intent-test-card">
      <h2>${en ? "VF-01 — Real Intent Test" : "VF-01 — वास्तविक इंटेंट टेस्ट"}</h2>
      <p>${en ? "Test the existing intent engine with your own Hindi, Hinglish, or English message. No tool is executed." : "अपने हिंदी, हिंग्लिश या अंग्रेज़ी संदेश से मौजूदा intent engine जाँचें। कोई tool execute नहीं होता।"}</p>
      <button class="control-button" id="intent-test-back" type="button">${en ? "← Back" : "← वापस"}</button>
      <label for="intent-test-input"><strong>${en ? "Your message" : "आपका संदेश"}</strong></label>
      <textarea id="intent-test-input" rows="4" placeholder="${en ? "e.g. Mere phone me storage kam hai, kya karun?" : "जैसे: मेरे फोन में स्टोरेज कम है, क्या करूँ?"}"></textarea>
      <button class="control-button intent-test-run" id="intent-test-run" type="button">${en ? "Analyze message" : "संदेश का विश्लेषण करें"}</button>
      <p id="intent-test-status" role="status" aria-live="polite"></p>
      <div id="intent-test-results" hidden>
        <h3>${en ? "Actual engine result" : "वास्तविक Engine परिणाम"}</h3>
        <div class="intent-test-result-grid">
          <div><small>Intent</small><strong id="intent-test-intent"></strong></div>
          <div><small>${en ? "Suggested Tool" : "सुझाया गया Tool"}</small><strong id="intent-test-tool"></strong></div>
          <div><small>${en ? "Confidence" : "विश्वास स्तर"}</small><strong id="intent-test-confidence"></strong></div>
          <div><small>${en ? "Clarification needed" : "स्पष्टीकरण आवश्यक"}</small><strong id="intent-test-clarification"></strong></div>
        </div>
        <h4>${en ? "Matched Terms" : "मिले हुए शब्द"}</h4><p id="intent-test-matched"></p>
      </div>
      <h3>${en ? "False-positive test cases" : "False-positive परीक्षण"}</h3>
      <div class="intent-test-examples">
        <button type="button" data-intent-example="generic">storage</button>
        <button type="button" data-intent-example="merge">Can you merge these things?</button>
        <button type="button" data-intent-example="multi">Compress image and merge PDF</button>
        <button type="button" data-intent-example="unrelated">Hello friend</button>
      </div>
      <p class="storage-dashboard-trust-note">${en ? "Safety: this screen only classifies text. It does not open tools, modify files, or send messages." : "सुरक्षा: यह स्क्रीन केवल text classify करती है। कोई tool नहीं खोलती, फाइल नहीं बदलती और संदेश नहीं भेजती।"}</p>
    </article></div>`;
  home.hidden = true;
  home.after(screen);
  const input = screen.querySelector<HTMLTextAreaElement>("#intent-test-input");
  const run = screen.querySelector<HTMLButtonElement>("#intent-test-run");
  const back = screen.querySelector<HTMLButtonElement>("#intent-test-back");
  const status = screen.querySelector<HTMLParagraphElement>("#intent-test-status");
  const results = screen.querySelector<HTMLDivElement>("#intent-test-results");
  if (!input || !run || !back || !status || !results) {
    screen.remove(); home.hidden = false;
    throw new Error("Intent Test Interface initialization failed.");
  }
  function analyze(): void {
    const result = understandIntent(input.value);
    screen.querySelector("#intent-test-intent")!.textContent = result.intent;
    screen.querySelector("#intent-test-tool")!.textContent = result.suggestedTool ?? (en ? "None" : "कोई नहीं");
    screen.querySelector("#intent-test-confidence")!.textContent = result.confidence;
    screen.querySelector("#intent-test-clarification")!.textContent = result.needsClarification ? (en ? "Yes" : "हाँ") : (en ? "No" : "नहीं");
    screen.querySelector("#intent-test-matched")!.textContent = result.matchedTerms.length ? result.matchedTerms.join(", ") : (en ? "No matched terms" : "कोई matched term नहीं");
    results.hidden = false;
    status.textContent = en ? "Analysis complete — actual engine output." : "विश्लेषण पूरा — वास्तविक engine परिणाम।";
  }
  run.addEventListener("click", analyze);
  input.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") analyze();
  });
  const examples: Record<string, string> = {
    generic: "storage",
    merge: "Can you merge these things?",
    multi: "Compress image and merge PDF",
    unrelated: "Hello friend",
  };
  screen.querySelectorAll<HTMLButtonElement>("[data-intent-example]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = examples[button.dataset["intentExample"] ?? ""] ?? "";
      analyze();
    });
  });
  back.addEventListener("click", () => {
    screen.remove();
    home.hidden = false;
    home.scrollIntoView({ behavior: "auto", block: "start" });
  });
  screen.scrollIntoView({ behavior: "auto", block: "start" });
}
