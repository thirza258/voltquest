import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { DEFAULT_VISION, EQUALIZERS, HOUGH_SHAPES, MORPH_OPS, VISION_THEMES, VISION_MODES, makeScene, parseVision, validateVision, patchAttention, visionDecision } from '../../engine/vision/model.js'
import { processOpenCv } from '../../engine/vision/opencv.js'
import { loadOpenCv } from './opencvLoader.js'
import { observationFromResult } from './integration.js'
import { useUnsavedBenchWork } from '../sandbox/benchGuard.js'
const VisionIntegration = lazy(() => import('./VisionIntegration.jsx'))
export const VISION_STORAGE_KEY = 'vq.vision.project.v1'
const fieldClass = 'mt-1 block w-full min-w-0 rounded border border-line-strong bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const modeNames = { threshold: 'Grayscale threshold', color: 'HSV color mask', edges: 'Gaussian blur + Canny', morphology: 'Morphology: erode, dilate, open, close', contours: 'Contours and shape analysis', histogram: 'Histogram, equalization and Otsu', perspective: 'Perspective correction', hough: 'Hough lines and circles', template: 'Template matching', attention: 'Vision transformer attention explorer' }
const themeNames = { iot: 'IoT visual sensor', drone: 'Drone landing marker', robotics: 'Robot line tracking', shapes: 'Shapes for contour analysis', lanes: 'Road lanes', document: 'Tilted marker card' }
const morphNames = { open: 'Opening (erode, then dilate)', close: 'Closing (dilate, then erode)', erode: 'Erosion', dilate: 'Dilation' }
const equalizerNames = { none: 'No equalization', global: 'Global histogram equalization', clahe: 'CLAHE (contrast-limited, 8 × 8 tiles)' }
const outputNames = { contours: 'Contours and bounding boxes', perspective: 'Rectified card', hough: 'Detected lines or circles', template: 'Best template match', histogram: 'Equalized image' }
const THRESHOLD_MODES = ['threshold', 'morphology', 'contours', 'perspective']
/** Two small 32-bin histograms, before and after equalization, drawn as bars. */
function Histogram({ label, bins }) {
  const peak = Math.max(1, ...bins)
  return <figure className="min-w-0"><figcaption className="text-xs text-slate-600">{label}</figcaption>
    <svg viewBox="0 0 128 40" role="img" aria-label={label} className="mt-1 h-16 w-full rounded border border-line bg-slate-50" preserveAspectRatio="none">
      {bins.map((count, i) => <rect key={i} x={i * 4 + 0.5} width="3" y={40 - 38 * count / peak} height={38 * count / peak} className="fill-teal-600" />)}
    </svg></figure>
}
function Details({ mode, details }) {
  const { t } = useI18n()
  if (!details) return null
  const box = 'space-y-2 rounded-lg border border-line bg-white p-4 text-sm'
  if (mode === 'morphology') return <div className={box} aria-label={t('Morphology measurements')}><h3 className="font-semibold">{t('Before and after the operation')}</h3>
    <p>{t('Before: {pixels} pixels in {components} connected components.', details.before)}</p><p>{t('After: {pixels} pixels in {components} connected components.', details.after)}</p></div>
  if (mode === 'contours') return <div className={box} aria-label={t('Contour measurements')}><h3 className="font-semibold">{t('{count} contours above the minimum area', { count: details.shapes.length })}</h3>
    {details.shapes.length > 0 && <div className="max-h-48 overflow-auto"><table className="w-full text-left text-xs"><thead className="text-slate-600"><tr><th className="pr-2">{t('Label')}</th><th className="pr-2">{t('Area (px²)')}</th><th className="pr-2">{t('Perimeter (px)')}</th><th className="pr-2">{t('Corners')}</th><th>{t('Circularity')}</th></tr></thead>
      <tbody>{details.shapes.slice(0, 40).map((shape, i) => <tr key={i} className="font-mono"><td className="pr-2 font-sans">{t(shape.label)}</td><td className="pr-2">{shape.area}</td><td className="pr-2">{shape.perimeter}</td><td className="pr-2">{shape.vertices}</td><td>{shape.circularity}</td></tr>)}</tbody></table></div>}</div>
  if (mode === 'histogram') return <div className={box} aria-label={t('Histogram measurements')}><h3 className="font-semibold">{t('Otsu threshold: {value}', { value: details.otsu })}</h3>
    <div className="grid grid-cols-2 gap-3"><Histogram label={t('Before · spread {value}', { value: details.before.spread })} bins={details.before.histogram} /><Histogram label={t('After · spread {value}', { value: details.after.spread })} bins={details.after.histogram} /></div>
    <p className="text-xs text-slate-600">{t('Spread is the standard deviation of gray levels. Otsu picks the threshold that best separates two groups of pixels.')}</p></div>
  if (mode === 'perspective') return <div className={box} aria-label={t('Perspective measurements')}><h3 className="font-semibold">{t(details.found ? 'Card found and rectified' : 'No four-cornered outline found')}</h3>
    {details.found && <p className="font-mono text-xs">{details.corners.map((corner, i) => `${['TL', 'TR', 'BR', 'BL'][i]} (${corner.x}, ${corner.y})`).join(' · ')}</p>}</div>
  if (mode === 'hough') {
    const items = details.lines ?? details.circles
    return <div className={box} aria-label={t('Hough measurements')}><h3 className="font-semibold">{t(details.lines ? '{count} line segments' : '{count} circles', { count: items.length })}</h3>
      <ul className="max-h-40 overflow-auto font-mono text-xs">{details.lines ? details.lines.slice(0, 30).map((line, i) => <li key={i}>({line.x1}, {line.y1}) → ({line.x2}, {line.y2}) · {line.angle}° · {line.length} px</li>)
        : details.circles.map((circle, i) => <li key={i}>({circle.x}, {circle.y}) r {circle.radius} px</li>)}</ul></div>
  }
  if (mode === 'template') return <div className={box} aria-label={t('Template measurements')}><h3 className="font-semibold">{t(details.detected ? 'Match found' : 'No match above the threshold')}</h3>
    <p className="font-mono text-xs">score {details.score} · ({details.location.x}, {details.location.y}) · {details.size} × {details.size} px · {t('threshold')} {details.threshold}</p></div>
  return null
}
function Pixels({ frame, label }) {
  const canvas = useRef(null)
  useEffect(() => {
    if (!frame) return
    const context = canvas.current?.getContext('2d')
    if (context) context.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0)
  }, [frame])
  return <canvas ref={canvas} width="128" height="128" aria-label={label} role="img" className="block aspect-square w-full rounded border border-line bg-slate-100" style={{ imageRendering: 'pixelated' }} />
}
function Slider({ label, value, onChange, ...props }) {
  return <label className="block text-sm">{label} <span className="font-mono text-xs">{value}</span><input aria-label={label} type="range" value={value} onChange={e => onChange(Number(e.target.value))} className="mt-2 block w-full accent-teal-700" {...props} /></label>
}
export default function VisionLab({ initialConfig = DEFAULT_VISION, integrated = false }) {
  const { t } = useI18n()
  const [config, setConfig] = useState(() => validateVision(initialConfig))
  const [processed, setProcessed] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(null)
  const [showIntegration, setShowIntegration] = useState(integrated)
  const [baseline, setBaseline] = useState(() => JSON.stringify(config))
  const fileInput = useRef(null)
  const key = JSON.stringify(config)
  useUnsavedBenchWork(key !== baseline, 'Vision settings')
  const scene = useMemo(() => makeScene(config), [config])
  const attention = useMemo(() => config.mode === 'attention' ? patchAttention(scene, config) : null, [scene, config])
  useEffect(() => {
    if (config.mode === 'attention') return undefined
    let active = true
    loadOpenCv().then(({ cv }) => {
      if (!active) return
      const result = processOpenCv(cv, scene, config)
      setProcessed({ key, result }); setError('')
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [config, scene, key])
  const output = processed?.key === key ? processed.result : null
  const metrics = output?.metrics
  const decision = attention ? visionDecision(config.theme, {}, 'attention') : metrics ? visionDecision(config.theme, metrics, config.mode) : null
  const observation = observationFromResult(output, config.mode)
  function update(patch) { setConfig(previous => validateVision({ ...previous, ...patch })); setNotice(''); setError('') }
  function attempt(fn) { try { fn(); setError('') } catch (e) { setError(e.message) } }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try { if (file.size > 8000) throw new Error('Vision settings files must be smaller than 8 KB.'); setPending(parseVision(await file.text())); setError('') }
    catch (e) { setError(e.message) }
  }
  return <section className="space-y-5" aria-label={t('Computer vision sandbox')}>
    <p className="rounded border border-teal-200 bg-teal-50 p-3 text-sm leading-relaxed text-teal-950">{t('OpenCV 4.12 runs locally on editable synthetic 128 × 128 scenes. The transformer view computes a fixed attention head for learning; it has no trained classifier and does not recognize objects. No camera or cloud service is used.')}</p>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.6fr)]">
      <div className="space-y-4 rounded-lg border border-line bg-white p-4">
        <h2 className="font-semibold">{t('Scene and pipeline')}</h2>
        <label className="block text-sm">{t('Vision theme')}<select className={fieldClass} value={config.theme} onChange={e => update({ theme: e.target.value })}>{VISION_THEMES.map(theme => <option key={theme} value={theme}>{t(themeNames[theme])}</option>)}</select></label>
        <label className="block text-sm">{t('Vision pipeline')}<select className={fieldClass} value={config.mode} onChange={e => update({ mode: e.target.value })}>{VISION_MODES.map(mode => <option key={mode} value={mode}>{t(modeNames[mode])}</option>)}</select></label>
        <Slider label={t('Target horizontal offset (px)')} value={config.offset} min="-40" max="40" step="1" onChange={offset => update({ offset })} />
        <Slider label={t('Scene brightness multiplier')} value={config.brightness} min="0.2" max="1.5" step="0.05" onChange={brightness => update({ brightness })} />
        <Slider label={t('Pixel noise amplitude')} value={config.noise} min="0" max="40" step="1" onChange={noise => update({ noise })} />
        <Slider label={t('Target occlusion fraction')} value={config.occlusion} min="0" max="0.8" step="0.1" onChange={occlusion => update({ occlusion })} />
        <Slider label={t('Contrast')} value={config.contrast} min="0.2" max="1" step="0.05" onChange={contrast => update({ contrast })} />
        <Slider label={t('Salt-and-pepper specks')} value={config.speckle} min="0" max="0.2" step="0.01" onChange={speckle => update({ speckle })} />
        {config.theme === 'document' && <Slider label={t('Card tilt')} value={config.tilt} min="0" max="0.6" step="0.05" onChange={tilt => update({ tilt })} />}
        {config.theme === 'drone' && <Slider label={t('Pad scale')} value={config.scale} min="0.6" max="1.4" step="0.05" onChange={scale => update({ scale })} />}
        {THRESHOLD_MODES.includes(config.mode) && <Slider label={t('Binary threshold')} value={config.threshold} min="0" max="255" step="1" onChange={threshold => update({ threshold })} />}
        {config.mode === 'morphology' && <><label className="block text-sm">{t('Operation')}<select className={fieldClass} value={config.morphOp} onChange={e => update({ morphOp: e.target.value })}>{MORPH_OPS.map(op => <option key={op} value={op}>{t(morphNames[op])}</option>)}</select></label>
          <label className="block text-sm">{t('Kernel size')}<select className={fieldClass} value={config.kernel} onChange={e => update({ kernel: Number(e.target.value) })}>{[3, 5, 7].map(size => <option key={size} value={size}>{size} × {size}</option>)}</select></label>
          <Slider label={t('Iterations')} value={config.iterations} min="1" max="3" step="1" onChange={iterations => update({ iterations })} /></>}
        {['contours', 'perspective'].includes(config.mode) && <><Slider label={t('Minimum contour area (px²)')} value={config.minArea} min="0" max="1000" step="10" onChange={minArea => update({ minArea })} />
          <Slider label={t('Polygon approximation epsilon (× perimeter)')} value={config.epsilon} min="0.01" max="0.1" step="0.01" onChange={epsilon => update({ epsilon })} /></>}
        {config.mode === 'histogram' && <><label className="block text-sm">{t('Equalization')}<select className={fieldClass} value={config.equalize} onChange={e => update({ equalize: e.target.value })}>{EQUALIZERS.map(item => <option key={item} value={item}>{t(equalizerNames[item])}</option>)}</select></label>
          {config.equalize === 'clahe' && <Slider label={t('CLAHE clip limit')} value={config.clipLimit} min="1" max="4" step="0.5" onChange={clipLimit => update({ clipLimit })} />}</>}
        {config.mode === 'hough' && <><label className="block text-sm">{t('Shape to detect')}<select className={fieldClass} value={config.houghShape} onChange={e => update({ houghShape: e.target.value })}>{HOUGH_SHAPES.map(item => <option key={item} value={item}>{t(item === 'lines' ? 'Line segments (HoughLinesP)' : 'Circles (HoughCircles)')}</option>)}</select></label>
          <Slider label={t('Accumulator threshold')} value={config.houghThreshold} min="5" max="100" step="1" onChange={houghThreshold => update({ houghThreshold })} />
          {config.houghShape === 'lines' ? <><Slider label={t('Minimum line length (px)')} value={config.minLineLength} min="5" max="80" step="1" onChange={minLineLength => update({ minLineLength })} /><Slider label={t('Maximum line gap (px)')} value={config.maxLineGap} min="1" max="20" step="1" onChange={maxLineGap => update({ maxLineGap })} /></>
            : <><Slider label={t('Minimum radius (px)')} value={config.minRadius} min="3" max={Math.min(40, config.maxRadius - 1)} step="1" onChange={minRadius => update({ minRadius })} /><Slider label={t('Maximum radius (px)')} value={config.maxRadius} min={Math.max(5, config.minRadius + 1)} max="60" step="1" onChange={maxRadius => update({ maxRadius })} /></>}</>}
        {config.mode === 'template' && <Slider label={t('Match threshold')} value={config.matchThreshold} min="0.2" max="0.99" step="0.01" onChange={matchThreshold => update({ matchThreshold })} />}
        {config.mode === 'color' && <><Slider label={t('Minimum hue (OpenCV 0–179)')} value={config.hueMin} min="0" max={config.hueMax} step="1" onChange={hueMin => update({ hueMin })} /><Slider label={t('Maximum hue (OpenCV 0–179)')} value={config.hueMax} min={config.hueMin} max="179" step="1" onChange={hueMax => update({ hueMax })} /><p className="text-xs text-slate-600">{t('HSV mask also requires saturation ≥ 80 and value ≥ 60. White decorations are excluded.')}</p></>}
        {['edges', 'hough'].includes(config.mode) && <><Slider label={t('Canny low threshold')} value={config.edgeLow} min="0" max={config.edgeHigh} step="1" onChange={edgeLow => update({ edgeLow })} /><Slider label={t('Canny high threshold')} value={config.edgeHigh} min={config.edgeLow} max="255" step="1" onChange={edgeHigh => update({ edgeHigh })} /></>}
        {!['color', 'attention'].includes(config.mode) && <label className="block text-sm">{t('Gaussian kernel')}<select className={fieldClass} value={config.blur} onChange={e => update({ blur: Number(e.target.value) })}>{[0, 3, 5].map(size => <option key={size} value={size}>{size ? `${size} × ${size}` : t('No blur')}</option>)}</select></label>}
        {attention && <><label className="block text-sm">{t('Query patch index')}<select className={fieldClass} value={config.query} onChange={e => update({ query: Number(e.target.value) })}>{attention.tokens.map((_token, index) => <option key={index} value={index}>{index}</option>)}</select></label><label className="block text-sm">{t('Patch size (px)')}<select className={fieldClass} value={config.patchSize} onChange={e => { const patchSize = Number(e.target.value); update({ patchSize, query: Math.min(config.query, (128 / patchSize) ** 2 - 1) }) }}>{[8, 16, 32].map(size => <option key={size} value={size}>{size} × {size}</option>)}</select></label><Slider label={t('Attention temperature')} value={config.temperature} min="0.1" max="3" step="0.1" onChange={temperature => update({ temperature })} /><Slider label={t('Position feature weight')} value={config.positionWeight} min="0" max="1" step="0.1" onChange={positionWeight => update({ positionWeight })} /></>}
      </div>
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-4">
          <figure className="min-w-0"><figcaption className="mb-2 text-sm font-semibold">{t('Source image')}</figcaption><Pixels frame={scene} label={t('Synthetic vision source')} /></figure>
          <figure className="min-w-0"><figcaption className="mb-2 text-sm font-semibold">{t(attention ? 'Patch attention weights' : outputNames[config.mode] ?? 'OpenCV output')}</figcaption>{attention ? <div role="group" aria-label={t('Choose a query patch')} className="grid aspect-square overflow-hidden rounded border border-line" style={{ gridTemplateColumns: `repeat(${128 / config.patchSize}, minmax(0, 1fr))` }}>{attention.weights.map((weight, index) => <button key={index} title={`${index}: ${(weight * 100).toFixed(2)}%`} aria-label={t('Query patch {number}', { number: index })} aria-pressed={config.query === index} className={`min-h-0 min-w-0 border text-[9px] focus:z-10 focus:outline focus:outline-2 focus:outline-amber-600 ${config.query === index ? 'border-amber-500 ring-2 ring-inset ring-amber-500' : 'border-white/20'}`} style={{ background: `rgba(13,148,136,${0.08 + 0.92 * weight / Math.max(...attention.weights)})` }} onClick={() => update({ query: index })}>{attention.weights.length <= 64 ? index : ''}</button>)}</div> : <Pixels frame={output} label={t('OpenCV processed mask')} />}</figure>
        </div>
        {!attention && !output && !error && <p role="status" className="text-sm text-slate-600">{t('Loading local OpenCV and processing the scene…')}</p>}
        {attention ? <div className="space-y-3 rounded-lg border border-line bg-white p-4" aria-label={t('Attention measurements')}>
          <h3 className="font-semibold">{t('Inside one attention head')}</h3><p className="font-mono text-sm">N = {attention.tokens.length} · N² = {attention.pairCount} · d = 5 · Σ weights = {attention.weights.reduce((a, b) => a + b, 0).toFixed(4)}</p>
          <p className="text-sm leading-relaxed text-slate-600">{t('Click a patch to choose its query. Keys contain twice the mean RGB plus weighted x/y coordinates. Q and K use the identity projection; V is mean RGB. Scores are q·k/√5 divided by temperature, then softmax. A trained ViT learns embeddings and projections and adds more layers.')}</p>
          <p className="font-mono text-xs break-words">q[{config.query}] = [{attention.tokens[config.query].embedding.map(v => v.toFixed(3)).join(', ')}]</p><p className="font-mono text-xs">context RGB = [{attention.context.map(v => v.toFixed(3)).join(', ')}]</p>
          <p className="text-xs text-slate-600">{t('The view computes one query row. N² shows how many pairs a full attention matrix would contain. Bright heatmap cells are attention weights, not detection confidence.')}</p>
        </div> : metrics && <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-white p-4 text-sm" aria-label={t('Vision measurements')}>
          <div><dt className="text-slate-500">{t('Selected pixels')}</dt><dd>{metrics.count} / 16384</dd></div><div><dt className="text-slate-500">{t('Mask fraction')}</dt><dd>{(100 * metrics.fraction).toFixed(2)}%</dd></div><div><dt className="text-slate-500">{t('Centroid x / y')}</dt><dd>{metrics.centroid ? `${metrics.centroid.x.toFixed(2)} / ${metrics.centroid.y.toFixed(2)} px` : '—'}</dd></div><div><dt className="text-slate-500">{t('Normalized horizontal error')}</dt><dd>{metrics.errorX?.toFixed(3) ?? '—'}</dd></div><div><dt className="text-slate-500">{t('Synthetic target IoU')}</dt><dd>{metrics.iou == null ? t('Not applicable to edge pixels') : metrics.iou.toFixed(3)}</dd></div>
        </dl>}
        {output && <Details mode={config.mode} details={output.details} />}
        {decision && <div className="rounded-lg border border-line bg-white p-4"><h3 className="font-semibold">{t('Device message preview')}</h3><p className="my-2 text-sm text-slate-600">{t(decision.state)}</p><p className="break-all font-mono text-xs">{decision.topic}</p><pre className="mt-2 whitespace-pre-wrap break-all rounded bg-slate-50 p-3 text-xs">{JSON.stringify(decision.payload, null, 2)}</pre><p className="mt-3 text-xs text-slate-600">{t('This preview uses a centroid rule with a 16-pixel minimum, not a trained detector. Wrong masks can produce wrong commands; compare against the known target and use the integration bench to inspect the response.')}</p></div>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => attempt(() => { if (!writeJson(VISION_STORAGE_KEY, config)) throw new Error('Browser storage is unavailable. Export the project to keep it.'); setBaseline(key); setNotice('Vision settings saved in this browser.') })}>{t('Save vision settings')}</Button>
      <Button size="sm" variant="secondary" onClick={() => attempt(() => setPending(validateVision(readJson(VISION_STORAGE_KEY))))}>{t('Load vision settings')}</Button>
      <Button size="sm" variant="secondary" onClick={() => downloadJson(config, 'voltquest-vision.json')}>{t('Export vision settings')}</Button>
      <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>{t('Import vision settings')}</Button>
      <Button size="sm" variant="secondary" disabled={!output && !attention} onClick={() => downloadJson({ config, metrics: metrics ?? null, attention: attention ? { query: config.query, weights: attention.weights, context: attention.context } : null, observation, decision }, 'voltquest-vision-results.json')}>{t('Export measurements')}</Button>
      <input ref={fileInput} className="hidden" type="file" accept="application/json,.json" aria-label={t('Import vision settings file')} onChange={importFile} />
    </div>
    <p className="text-xs text-slate-600">{t('Settings are saved on this browser only. The three generated scenes are teaching inputs, not real camera feeds. Changing language preserves the scene and current measurements.')}</p>
    {!showIntegration ? <Button variant="secondary" onClick={() => setShowIntegration(true)}>{t('Connect vision to IoT, drone and robot')}</Button> : <Suspense fallback={<p role="status">{t('Loading connected devices…')}</p>}><VisionIntegration observation={observation} /></Suspense>}
    {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{t(error)}</p>}
    <p role="status" className="text-sm text-teal-800">{t(notice)}</p>
    <Modal open={Boolean(pending)} onClose={() => setPending(null)} title={t('Replace vision settings?')} description={t('The current scene and pipeline will be replaced. Save or export the current settings first to keep them.')} footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={() => { setConfig(pending); setBaseline(JSON.stringify(pending)); setPending(null); setNotice('Vision settings loaded.'); setError('') }}>{t('Apply vision settings')}</Button></>} />
  </section>
}
