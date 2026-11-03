import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#status").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#status")?.textContent === "WASM runtime ready" ||
          document.querySelector("#status")?.textContent === "WASM load failed",
    { timeout: 90000 }
  );

  const runtimeStatus = await page.locator("#status").innerText();
  if (runtimeStatus !== "WASM runtime ready") {
    throw new Error("Browser WASM runtime did not become ready. " + await page.locator("#output").innerText());
  }

  await page.locator("#run").click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#output")?.textContent || "";
    return text.includes("RUNTIME_PIPELINE_PASS") || text.includes("RUNTIME_PIPELINE_ERROR");
  }, { timeout: 90000 });

  const outputText = await page.locator("#output").innerText();
  const result = JSON.parse(outputText);
  result.pageErrors = pageErrors;
  await writeFile("browser-probe-results.json", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "browser-probe-screenshot.png", fullPage: true });

  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join("; "));
  if (result.status !== "RUNTIME_PIPELINE_PASS") {
    throw new Error("OpenCV pipeline smoke test failed: " + (result.error?.message || result.status));
  }
  if (result.productionAcceptance !== false) {
    throw new Error("Probe must remain explicitly non-production.");
  }
  console.log("PASS: browser WASM + ORB + KNN/Lowe + RANSAC smoke test. This is not M9 acceptance.");
} finally {
  await browser.close();
}
