// PNG export of the breadboard canvas (CONTRACTS §10). The app shell finds the element by
// `[data-canvas-svg]` and hands it here.

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
/** Give up rather than hang if the browser never fires load or error on the rasterised SVG. */
const LOAD_TIMEOUT_MS = 10000

/** Intrinsic pixel size of an `<svg>`: measured box, then width/height attributes, then the viewBox. */
function svgSize(svg) {
  const rect = svg.getBoundingClientRect?.()
  if (rect && rect.width > 1 && rect.height > 1) return { width: rect.width, height: rect.height }
  const w = Number(svg.getAttribute('width'))
  const h = Number(svg.getAttribute('height'))
  if (w > 1 && h > 1) return { width: w, height: h }
  const viewBox = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  if (viewBox.length === 4 && viewBox[2] > 1 && viewBox[3] > 1) return { width: viewBox[2], height: viewBox[3] }
  return { width: 800, height: 600 }
}

/**
 * Standalone SVG markup for the canvas: a clone with the interaction-only overlays
 * (`[data-export-hide]`) stripped and explicit namespaces and size, so it can be rasterised.
 *
 * @param {SVGSVGElement} svgElement
 * @returns {{ xml: string, width: number, height: number }}
 */
export function serializeCanvasSvg(svgElement) {
  const { width, height } = svgSize(svgElement)
  const clone = svgElement.cloneNode(true)
  for (const node of clone.querySelectorAll('[data-export-hide]')) node.remove()
  clone.setAttribute('xmlns', SVG_NS)
  clone.setAttribute('xmlns:xlink', XLINK_NS)
  clone.setAttribute('width', String(Math.round(width)))
  clone.setAttribute('height', String(Math.round(height)))
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${Math.round(width)} ${Math.round(height)}`)
  const xml = new XMLSerializer().serializeToString(clone)
  return { xml, width, height }
}

/** Load a data-URL image, rejecting (never hanging) on error or timeout. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let timer = 0
    const cleanup = () => {
      img.onload = null
      img.onerror = null
      if (timer) clearTimeout(timer)
      timer = 0
    }
    img.onload = () => {
      cleanup()
      resolve(img)
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('exportCanvasPng: the canvas SVG could not be rasterised'))
    }
    timer = setTimeout(() => {
      cleanup()
      reject(new Error('exportCanvasPng: timed out rasterising the canvas SVG'))
    }, LOAD_TIMEOUT_MS)
    img.src = url
  })
}

/**
 * Render the canvas SVG to a PNG blob on a white background.
 *
 * @param {SVGSVGElement} svgElement the `[data-canvas-svg]` element
 * @param {number} [scale=2] device-pixel multiplier (2 = retina-sharp)
 * @returns {Promise<Blob>}
 */
export async function exportCanvasPng(svgElement, scale = 2) {
  if (!svgElement || typeof svgElement.cloneNode !== 'function') {
    throw new Error('exportCanvasPng: expected the canvas SVG element')
  }
  const factor = Number.isFinite(scale) && scale > 0 ? Math.min(scale, 8) : 2
  const { xml, width, height } = serializeCanvasSvg(svgElement)
  // encodeURIComponent (not btoa): the board artwork contains '−' and '–', which btoa rejects.
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * factor))
  canvas.height = Math.max(1, Math.round(height * factor))
  const ctx = canvas.getContext?.('2d')
  if (!ctx) throw new Error('exportCanvasPng: 2D canvas is unavailable')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  if (typeof canvas.toBlob !== 'function') throw new Error('exportCanvasPng: canvas.toBlob is unavailable')
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('exportCanvasPng: the PNG blob could not be produced'))
    }, 'image/png')
  })
}

export default exportCanvasPng
