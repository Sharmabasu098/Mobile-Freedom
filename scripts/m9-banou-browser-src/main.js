const button = document.querySelector('#run')
const status = document.querySelector('#status')

button.addEventListener('click', async () => {
  button.disabled = true
  status.textContent = 'LOADING'
  try {
    // The package and its WASM runtime must not be requested until user action.
    const cvModule = await import('@banou/opencv-wasm')
    const cv = await cvModule.initOpenCV()
    if (!cv) throw new Error('OpenCV runtime did not initialize')

    const image = new cvModule.Mat(128, 128, cvModule.CV_8UC1)
    const mask = new cvModule.Mat()
    const keypoints = new cvModule.KeyPointVector()
    const descriptors = new cvModule.Mat()
    const orb = cvModule.ORB_create(300)
    try {
      const pixels = image.data
      for (let y = 0; y < 128; y += 1) {
        for (let x = 0; x < 128; x += 1) {
          pixels[y * 128 + x] = (x * 17 + y * 31 + ((x * y) % 97)) % 256
        }
      }
      for (let y = 16; y < 112; y += 24) {
        for (let x = 16; x < 112; x += 24) {
          for (let d = -4; d <= 4; d += 1) {
            pixels[(y - 4) * 128 + x + d] = 255
            pixels[(y + 4) * 128 + x + d] = 255
            pixels[(y + d) * 128 + x - 4] = 255
            pixels[(y + d) * 128 + x + 4] = 255
          }
        }
      }
      orb.detectAndCompute(image, mask, keypoints, descriptors)
      if (keypoints.size() < 4 || descriptors.empty()) {
        throw new Error('ORB did not produce sufficient browser descriptors')
      }
      status.textContent = JSON.stringify({
        result: 'BROWSER_ORB_PASS',
        keypoints: keypoints.size(),
        descriptorRows: descriptors.rows,
        descriptorColumns: descriptors.cols,
        runtime: 'initialized'
      })
      document.documentElement.dataset.result = 'pass'
    } finally {
      orb.delete()
      descriptors.delete()
      keypoints.delete()
      mask.delete()
      image.delete()
    }
  } catch (error) {
    status.textContent = 'BROWSER_POC_FAIL: ' + (error?.stack ?? String(error))
    document.documentElement.dataset.result = 'fail'
    throw error
  } finally {
    button.disabled = false
  }
})
