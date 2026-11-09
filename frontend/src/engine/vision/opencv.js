import { DEFAULT_VISION, IMAGE_SIZE, makeScene, maskMetrics, validateVision } from './model.js'

/** Modes whose mask is a filled region, so intersection-over-union against the scene truth means something. */
const FILLED_MODES = new Set(['threshold', 'color', 'morphology', 'contours', 'histogram', 'perspective', 'template'])
const MORPH = cv => ({ erode: cv.MORPH_ERODE, dilate: cv.MORPH_DILATE, open: cv.MORPH_OPEN, close: cv.MORPH_CLOSE })
/** The template is the drone pad at scale 1, cut from a clean scene: 48 × 48 pixels centred on the pad. */
export const TEMPLATE_SIZE = 48
const TEMPLATE_SCENE = () => makeScene({ ...DEFAULT_VISION, theme: 'drone', mode: 'template' })

const round = (value, digits = 2) => Number(value.toFixed(digits))
function histogram32(data) {
  const bins = new Array(32).fill(0)
  for (const value of data) bins[value >> 3]++
  return bins
}
function spread(data) {
  let sum = 0, squares = 0
  for (const value of data) { sum += value; squares += value * value }
  const mean = sum / data.length
  return round(Math.sqrt(Math.max(0, squares / data.length - mean * mean)))
}
/** Label a contour from its polygon approximation and how close it is to a circle. */
export function classifyShape(vertices, circularity, aspect) {
  if (vertices === 3) return 'triangle'
  // A pixel circle can simplify to four corners, so roundness wins before the corner count.
  if (circularity >= 0.83) return 'circle'
  if (vertices === 4) return aspect > 0.9 && aspect < 1.1 ? 'square' : 'rectangle'
  return 'polygon'
}
/** Order four corners as top-left, top-right, bottom-right, bottom-left by coordinate sums and differences. */
export function orderCorners(points) {
  const bySum = [...points].sort((a, b) => (a.x + a.y) - (b.x + b.y)), byDiff = [...points].sort((a, b) => (a.y - a.x) - (b.y - b.x))
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]]
}

/**
 * Actual OpenCV operations against an injected initialized module. All native Mats, vectors and
 * helper objects are released, including on failure. Every mode returns a binary `mask` (measured
 * by maskMetrics, so device observations keep working) and an RGBA `data` frame to display; modes
 * with more to report add `details`.
 */
export function processOpenCv(cv, scene, input) {
  const config = validateVision(input), allocated = []
  const keep = value => { allocated.push(value); return value }
  const mat = (...args) => keep(new cv.Mat(...args))
  const size = IMAGE_SIZE
  try {
    const src = mat(scene.height, scene.width, cv.CV_8UC4); src.data.set(scene.data)
    const gray = mat(), work = mat(), out = mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    if (config.blur) cv.GaussianBlur(gray, work, new cv.Size(config.blur, config.blur), 0, 0, cv.BORDER_DEFAULT)
    else gray.copyTo(work)
    let frame = null, details = null
    const overlay = () => { const copy = mat(); src.copyTo(copy); return copy }
    const binary = () => { const bin = mat(); cv.threshold(work, bin, config.threshold, 255, cv.THRESH_BINARY); return bin }
    const components = image => { const labels = mat(), stats = mat(), centroids = mat(); return cv.connectedComponentsWithStats(image, labels, stats, centroids, 8, cv.CV_32S) - 1 }
    const count = image => cv.countNonZero(image)

    if (config.mode === 'color') {
      const rgb = mat(), hsv = mat()
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB); cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)
      const low = mat(scene.height, scene.width, hsv.type(), new cv.Scalar(config.hueMin, 80, 60, 0))
      const high = mat(scene.height, scene.width, hsv.type(), new cv.Scalar(config.hueMax, 255, 255, 255))
      cv.inRange(hsv, low, high, out)
    } else if (config.mode === 'edges') cv.Canny(work, out, config.edgeLow, config.edgeHigh, 3, true)
    else if (config.mode === 'morphology') {
      const before = binary(), kernel = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(config.kernel, config.kernel)))
      cv.morphologyEx(before, out, MORPH(cv)[config.morphOp], kernel, new cv.Point(-1, -1), config.iterations, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue())
      details = { before: { pixels: count(before), components: components(before) }, after: { pixels: count(out), components: components(out) } }
    } else if (config.mode === 'contours' || config.mode === 'perspective') {
      const bin = binary(), contours = keep(new cv.MatVector()), hierarchy = mat(), view = overlay()
      cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      out.create(size, size, cv.CV_8UC1); out.setTo(new cv.Scalar(0))
      const found = []
      for (let i = 0; i < contours.size(); i++) {
        const contour = keep(contours.get(i)), area = cv.contourArea(contour)
        if (area < config.minArea) continue
        const perimeter = cv.arcLength(contour, true), approx = mat()
        cv.approxPolyDP(contour, approx, config.epsilon * perimeter, true)
        const rect = cv.boundingRect(contour)
        found.push({ index: i, area, perimeter, vertices: approx.rows, rect, corners: Array.from({ length: approx.rows }, (_v, k) => ({ x: approx.data32S[2 * k], y: approx.data32S[2 * k + 1] })) })
      }
      found.sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y)
      if (config.mode === 'contours') {
        for (const item of found) {
          cv.drawContours(out, contours, item.index, new cv.Scalar(255), -1)
          cv.drawContours(view, contours, item.index, new cv.Scalar(255, 64, 64, 255), 2)
          cv.rectangle(view, new cv.Point(item.rect.x, item.rect.y), new cv.Point(item.rect.x + item.rect.width - 1, item.rect.y + item.rect.height - 1), new cv.Scalar(56, 189, 248, 255), 1)
        }
        frame = view
        details = { shapes: found.map(({ area, perimeter, vertices, rect }) => {
          const circularity = perimeter ? 4 * Math.PI * area / perimeter ** 2 : 0
          return { label: classifyShape(vertices, circularity, rect.width / rect.height), area: round(area, 1), perimeter: round(perimeter, 1), vertices, circularity: round(circularity, 3), rect }
        }) }
      } else {
        // The largest outline with four polygon corners is the card; warp it onto the full frame.
        const card = [...found].sort((a, b) => b.area - a.area).find(item => item.vertices === 4)
        if (card) {
          cv.drawContours(out, contours, card.index, new cv.Scalar(255), -1)
          const corners = orderCorners(card.corners)
          const from = keep(cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap(point => [point.x, point.y])))
          const to = keep(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, size - 1, 0, size - 1, size - 1, 0, size - 1]))
          const transform = keep(cv.getPerspectiveTransform(from, to)), warped = mat()
          cv.warpPerspective(src, warped, transform, new cv.Size(size, size), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255))
          frame = warped
          details = { found: true, corners, area: round(card.area, 1) }
        } else details = { found: false, corners: [], outlines: found.length }
      }
    } else if (config.mode === 'histogram') {
      const equalized = mat()
      if (config.equalize === 'global') cv.equalizeHist(work, equalized)
      else if (config.equalize === 'clahe') { const clahe = keep(new cv.CLAHE(config.clipLimit, new cv.Size(8, 8))); clahe.apply(work, equalized) }
      else work.copyTo(equalized)
      const otsu = cv.threshold(equalized, out, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU)
      const view = mat(); cv.cvtColor(equalized, view, cv.COLOR_GRAY2RGBA)
      frame = view
      details = { otsu, before: { histogram: histogram32(work.data), spread: spread(work.data) }, after: { histogram: histogram32(equalized.data), spread: spread(equalized.data) } }
    } else if (config.mode === 'hough') {
      const edges = mat(), view = overlay()
      cv.Canny(work, edges, config.edgeLow, config.edgeHigh, 3, true)
      out.create(size, size, cv.CV_8UC1); out.setTo(new cv.Scalar(0))
      if (config.houghShape === 'lines') {
        const lines = mat()
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, config.houghThreshold, config.minLineLength, config.maxLineGap)
        const found = []
        for (let i = 0; i < lines.rows; i++) {
          const [x1, y1, x2, y2] = lines.data32S.slice(i * 4, i * 4 + 4)
          cv.line(out, new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Scalar(255), 3)
          cv.line(view, new cv.Point(x1, y1), new cv.Point(x2, y2), new cv.Scalar(255, 64, 64, 255), 2)
          found.push({ x1, y1, x2, y2, angle: round(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, 1), length: round(Math.hypot(x2 - x1, y2 - y1), 1) })
        }
        details = { lines: found.sort((a, b) => a.x1 - b.x1 || a.y1 - b.y1) }
      } else {
        const circles = mat()
        cv.HoughCircles(work, circles, cv.HOUGH_GRADIENT, 1, 20, Math.max(1, config.edgeHigh), config.houghThreshold, config.minRadius, config.maxRadius)
        const found = []
        for (let i = 0; i < circles.cols; i++) {
          const [x, y, r] = circles.data32F.slice(i * 3, i * 3 + 3)
          cv.circle(out, new cv.Point(Math.round(x), Math.round(y)), Math.round(r), new cv.Scalar(255), -1)
          cv.circle(view, new cv.Point(Math.round(x), Math.round(y)), Math.round(r), new cv.Scalar(255, 64, 64, 255), 2)
          found.push({ x: round(x, 1), y: round(y, 1), radius: round(r, 1) })
        }
        details = { circles: found.sort((a, b) => a.x - b.x) }
      }
      frame = view
    } else if (config.mode === 'template') {
      const reference = TEMPLATE_SCENE(), full = mat(size, size, cv.CV_8UC4); full.data.set(reference.data)
      const offset = (size - TEMPLATE_SIZE) / 2, patch = keep(full.roi(new cv.Rect(offset, offset, TEMPLATE_SIZE, TEMPLATE_SIZE))), template = mat(), scores = mat(), view = overlay()
      cv.cvtColor(patch, template, cv.COLOR_RGBA2GRAY)
      cv.matchTemplate(work, template, scores, cv.TM_CCOEFF_NORMED)
      const { maxVal, maxLoc } = cv.minMaxLoc(scores)
      const detected = maxVal >= config.matchThreshold
      out.create(size, size, cv.CV_8UC1); out.setTo(new cv.Scalar(0))
      const corner = new cv.Point(maxLoc.x, maxLoc.y), far = new cv.Point(maxLoc.x + TEMPLATE_SIZE - 1, maxLoc.y + TEMPLATE_SIZE - 1)
      if (detected) cv.rectangle(out, corner, far, new cv.Scalar(255), -1)
      cv.rectangle(view, corner, far, detected ? new cv.Scalar(34, 197, 94, 255) : new cv.Scalar(239, 68, 68, 255), 2)
      frame = view
      details = { score: round(maxVal, 3), location: { x: maxLoc.x, y: maxLoc.y }, size: TEMPLATE_SIZE, detected, threshold: config.matchThreshold }
    } else cv.threshold(work, out, config.threshold, 255, cv.THRESH_BINARY)

    const mask = new Uint8Array(out.data)
    let data
    if (frame) data = new Uint8ClampedArray(frame.data)
    else {
      data = new Uint8ClampedArray(scene.width * scene.height * 4)
      for (let i = 0; i < mask.length; i++) { data[i * 4] = mask[i]; data[i * 4 + 1] = mask[i]; data[i * 4 + 2] = mask[i]; data[i * 4 + 3] = 255 }
    }
    const metrics = maskMetrics(mask, scene.width, scene.height, FILLED_MODES.has(config.mode) || (config.mode === 'hough' && config.houghShape === 'circles') ? scene.truth : null)
    return { width: scene.width, height: scene.height, data, mask, metrics, details }
  } finally { allocated.reverse().forEach(value => value.delete()) }
}
