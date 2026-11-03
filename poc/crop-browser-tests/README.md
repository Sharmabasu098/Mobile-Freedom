# M9 real JPEG browser regression

This browser smoke test creates a deterministic source image in Chromium, crops it through Canvas, encodes the crop using the browser's real JPEG encoder, decodes it using createImageBitmap, and runs the production similar-photo engine against the PNG original.

It deliberately does not mock Canvas, image decoding, JPEG MIME handling, or JPEG compression. The test is diagnostic evidence for one browser-generated JPEG crop scenario, not proof of general real-photo accuracy.
