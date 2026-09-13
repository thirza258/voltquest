import { maskMetrics, validateVision } from './model.js'

/** Actual OpenCV operations against an injected initialized module. All native Mats are released. */
export function processOpenCv(cv, scene, input) {
  const config = validateVision(input), allocated = []
  const mat = (...args) => { const value = new cv.Mat(...args); allocated.push(value); return value }
  try {
    const src = mat(scene.height, scene.width, cv.CV_8UC4); src.data.set(scene.data)
    const gray = mat(), work = mat(), out = mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    if (config.blur) cv.GaussianBlur(gray, work, new cv.Size(config.blur, config.blur), 0, 0, cv.BORDER_DEFAULT)
    else gray.copyTo(work)
    if (config.mode === 'color') {
      const rgb = mat(), hsv = mat()
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB); cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
      const low = mat(scene.height, scene.width, hsv.type(), new cv.Scalar(config.hueMin, 80, 60, 0))
      const high = mat(scene.height, scene.width, hsv.type(), new cv.Scalar(config.hueMax, 255, 255, 255))
      cv.inRange(hsv, low, high, out)
    } else if (config.mode === 'edges') cv.Canny(work, out, config.edgeLow, config.edgeHigh, 3, true)
    else cv.threshold(work, out, config.threshold, 255, cv.THRESH_BINARY)
    const mask = new Uint8Array(out.data), data = new Uint8ClampedArray(scene.width * scene.height * 4)
    for (let i = 0; i < mask.length; i++) { data[i * 4] = mask[i]; data[i * 4 + 1] = mask[i]; data[i * 4 + 2] = mask[i]; data[i * 4 + 3] = 255 }
    return { width: scene.width, height: scene.height, data, mask, metrics: maskMetrics(mask, scene.width, scene.height, config.mode === 'edges' ? null : scene.truth) }
  } finally { allocated.reverse().forEach(value => value.delete()) }
}
