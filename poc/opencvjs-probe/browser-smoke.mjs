import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));

try {
  await page.goto("http://127.0.0.1:5174/", { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#status").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => ["WASM runtime ready", "WASM load failed"].includes(document.querySelector("#status")?.textContent),
    { timeout: 90000 }
  );
  if (await page.locator("#status").innerText() !== "WASM runtime ready") {
    throw new Error("Browser WASM runtime did not become ready. " + await page.locator("#output").innerText());
  }

  await page.locator("#run").click();
  await page.waitForFunction(() => {
    const text = document.querySelector("#output")?.textContent || "";
    return text.includes("CROP_BENCHMARK_EXECUTED") ||
      text.includes("CROP_BENCHMARK_REVIEW_REQUIRED") ||
      text.includes("CROP_BENCHMARK_ERROR");
  }, { timeout: 120000 });

  const result = JSON.parse(await page.locator("#output").innerText());
  result.pageErrors = pageErrors;
  await writeFile("browser-probe-results.json", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "browser-probe-screenshot.png", fullPage: true });

  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join("; "));
  if (result.productionAcceptance !== false || result.accuracyThresholdsApplied !== false) {
    throw new Error("Benchmark must remain explicitly non-production and threshold-neutral.");
  }
  if (result.status !== "CROP_BENCHMARK_EXECUTED") {
    throw new Error("Crop benchmark did not execute cleanly: " + (result.error?.message || result.status));
  }
  if (result.summary?.totalCases !== 4 ||
      result.summary?.genuineCropCases !== 3 ||
      result.summary?.negativeControlCases !== 1) {
    throw new Error("Expected exactly three crop cases and one unrelated negative control.");
  }
  if (result.cases.some(item => !item.orb || !item.matching || !item.ransac || !item.spatialCoverage)) {
    throw new Error("One or more cases are missing required diagnostics.");
  }
  console.log("PASS: deterministic 50/65/80% genuine crops + unrelated control benchmark executed. No M9 acceptance implied.");
} finally {
  await browser.close();
}
