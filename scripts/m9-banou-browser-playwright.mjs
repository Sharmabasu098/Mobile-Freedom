import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.M9_POC_URL ?? 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  const wasmRequests = []
  const externalRequests = []
  page.on('request', request => {
    const url = request.url()
    if (/\.wasm(?:\?|$)/i.test(url)) wasmRequests.push(url)
    if (new URL(url).origin !== new URL(baseUrl).origin) externalRequests.push(url)
  })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  assert.equal(wasmRequests.length, 0, 'WASM must not load before explicit user action')
  assert.equal(await page.locator('#status').textContent(), 'IDLE')

  await page.locator('#run').click()
  await page.waitForFunction(() => document.documentElement.dataset.result === 'pass' ||
    document.documentElement.dataset.result === 'fail', { timeout: 60000 })
  const result = await page.locator('#status').textContent()
  assert.match(result, /BROWSER_ORB_PASS/, result)
  assert.ok(wasmRequests.length >= 1, 'Expected local WASM request after user action')
  assert.equal(externalRequests.length, 0, 'Browser PoC must not contact external origins')
  assert.deepEqual(pageErrors, [], 'Browser page reported runtime errors')
  console.log('BROWSER_LAZY_WASM_PASS', JSON.stringify({
    wasmRequests: wasmRequests.length,
    externalRequests: externalRequests.length,
    result
  }))
} finally {
  await browser.close()
}
