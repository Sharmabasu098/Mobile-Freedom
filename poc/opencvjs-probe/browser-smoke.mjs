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
    return text.includes("EXPANDED_BENCHMARK_EXECUTED") ||
      text.includes("EXPANDED_BENCHMARK_REVIEW_REQUIRED") ||
      text.includes("EXPANDED_BENCHMARK_ERROR");
  }, { timeout: 240000 });

  const result = JSON.parse(await page.locator("#output").innerText());
  result.pageErrors = pageErrors;
  await writeFile("browser-probe-results.json", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "browser-probe-screenshot.png", fullPage: true });

  if (pageErrors.length) throw new Error("Browser page errors: " + pageErrors.join("; "));
  if (!(await page.locator("#photoA").count()) ||
      !(await page.locator("#photoB").count()) ||
      !(await page.locator("#photoTruth").count()) ||
      !(await page.locator("#runPhotoValidation").count()) ||
      !(await page.locator("#downloadPhotoReport").count())) {
    throw new Error("Local-only real-photo validation controls are missing.");
  }
  if (await page.locator("#runPhotoValidation").isEnabled()) {
    throw new Error("Local photo validation must remain disabled until two images are selected.");
  }
  if (result.productionAcceptance !== false || result.productionThresholdSelected !== false) {
    throw new Error("Benchmark must remain explicitly non-production and threshold-neutral.");
  }
  if (result.status !== "EXPANDED_BENCHMARK_EXECUTED") {
    throw new Error("Expanded benchmark execution failed: " + (result.error?.message || result.status));
  }
  if (result.summary?.uniqueCases !== 22 ||
      result.summary?.totalEvaluations !== 66 ||
      result.summary?.genuineCropCases !== 15 ||
      result.summary?.unrelatedNegativeControls !== 5 ||
      result.summary?.sameObjectDifferentPhotoHardNegatives !== 2) {
    throw new Error("Expanded benchmark fixture count does not match the registered protocol.");
  }
  if (!Array.isArray(result.exploratoryThresholdSweep) || result.exploratoryThresholdSweep.length !== 24) {
    throw new Error("Expected 24 exploratory threshold configurations for FP/FN analysis.");
  }
  if (result.caseSummary.some(item => item.repeatCount !== 3 || item.pipelineStatuses.length !== 3)) {
    throw new Error("Repeated-run diagnostics are incomplete.");
  }
  console.log("PASS: 22-case, 3-repeat crop/hard-negative benchmark executed with exploratory FP/FN sweep. No M9 acceptance implied.");
} finally {
  await browser.close();
}
