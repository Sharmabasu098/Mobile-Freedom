import { chromium } from "playwright";

const baseURL = process.env.M9_CROP_BASE_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const { findSimilarPhotos } = await import("/src/tools/storage/similarPhotos.ts");
    const width = 320;
    const height = 240;
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const context = source.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");

    const image = context.createImageData(width, height);
    let state = 0x4d394d39;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const noise = (state >>> 24) - 128;
        const shape = Math.sin(x / 19) * 38 + Math.cos(y / 17) * 31 +
          (x > 65 && x < 255 && y > 45 && y < 195 ? 42 : 0);
        const value = Math.max(0, Math.min(255, Math.round(126 + shape + noise * 0.16)));
        const offset = (y * width + x) * 4;
        image.data[offset] = value;
        image.data[offset + 1] = value;
        image.data[offset + 2] = value;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    const crop = document.createElement("canvas");
    crop.width = 240;
    crop.height = 180;
    const cropContext = crop.getContext("2d");
    if (!cropContext) throw new Error("Crop canvas context unavailable");
    cropContext.drawImage(source, 40, 30, 240, 180, 0, 0, 240, 180);

    const toBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas encoding returned null")), type, quality);
    });

    // Exercise actual browser JPEG encoding and decoding, not a mocked raster.
    const originalBlob = await toBlob(source, "image/png");
    const jpegBlob = await toBlob(crop, "image/jpeg", 0.88);
    if (jpegBlob.type !== "image/jpeg" || jpegBlob.size === 0) {
      throw new Error("Browser did not produce a non-empty JPEG");
    }

    const originalFile = new File([originalBlob], "browser-original.png", { type: "image/png" });
    const jpegFile = new File([jpegBlob], "browser-real-jpeg-crop.jpg", { type: "image/jpeg" });
    const decodedOriginal = await createImageBitmap(originalFile);
    const decodedJpeg = await createImageBitmap(jpegFile);
    const decodeDimensions = {
      original: [decodedOriginal.width, decodedOriginal.height],
      jpeg: [decodedJpeg.width, decodedJpeg.height],
    };
    decodedOriginal.close();
    decodedJpeg.close();

    const errors = [];
    const pairs = await findSimilarPhotos([originalFile, jpegFile], (file, error) => {
      errors.push({ name: file.name, message: String(error) });
    });

    return {
      originalBytes: originalBlob.size,
      jpegBytes: jpegBlob.size,
      jpegMime: jpegBlob.type,
      decodeDimensions,
      errors,
      similarPairCount: pairs.length,
      matchDistance: pairs[0]?.distance ?? null,
      similarityPercent: pairs[0]?.similarityPercent ?? null,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length !== 0) throw new Error("One or more images failed to decode in the engine");
  if (result.jpegMime !== "image/jpeg" || result.jpegBytes <= 0) throw new Error("JPEG encode verification failed");
  if (result.decodeDimensions.jpeg[0] !== 240 || result.decodeDimensions.jpeg[1] !== 180) throw new Error("JPEG decode dimensions mismatch");
  if (result.similarPairCount !== 1) throw new Error(`Expected one genuine JPEG crop candidate, got ${result.similarPairCount}`);
} finally {
  await browser.close();
}
