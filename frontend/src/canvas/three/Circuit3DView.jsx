import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize, Minus, Plus } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'
import { Button, IconButton } from '../../ui/index.js'
import { getDef } from '../../engine/components/registry.js'
import { createCircuitViewer } from './viewer.js'

export default function Circuit3DView({ doc, simState, selectedIds, onSelect, active = true, onReturnTo2D }) {
  const { t } = useI18n()
  const host = useRef(null), viewer = useRef(null), select = useRef(onSelect)
  select.current = onSelect
  const [unavailable, setUnavailable] = useState(false)
  const helpId = useId()
  useEffect(() => {
    let instance
    try {
      instance = createCircuitViewer(host.current, { onSelect: ids => select.current?.(ids), onUnavailable: () => setUnavailable(true) })
      viewer.current = instance
    } catch { setUnavailable(true) }
    return () => { instance?.dispose(); viewer.current = null }
  }, [])
  useEffect(() => { viewer.current?.update(doc, simState, selectedIds) }, [doc, simState, selectedIds])
  useEffect(() => { viewer.current?.setActive(active && !unavailable) }, [active, unavailable])
  const orbit = (x, y) => viewer.current?.orbit(x * Math.PI / 12, y * Math.PI / 12)
  function keyboard(event) {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (arrows[event.key]) orbit(...arrows[event.key])
    else if (['+', '='].includes(event.key)) viewer.current?.zoom(0.8)
    else if (event.key === '-') viewer.current?.zoom(1.25)
    else if (['f', 'F', '0'].includes(event.key)) viewer.current?.fit()
    else return
    event.preventDefault(); event.stopPropagation()
  }
  return <div className="flex h-full min-h-0 flex-col bg-surface-page" data-circuit-3d>
    <div className="relative min-h-0 flex-1">
      <div ref={host} role="application" tabIndex={active && !unavailable ? 0 : -1} aria-label={t('3D circuit view')} aria-describedby={helpId} onKeyDown={keyboard} className="absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500" />
      {unavailable && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-page p-6 text-center text-sm text-slate-600"><p>{t('3D view is unavailable in this browser. You can keep working in 2D.')}</p><Button variant="secondary" onClick={onReturnTo2D}>{t('Return to 2D')}</Button></div>}
    </div>
    <div className="shrink-0 space-y-2 border-t border-line bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-1" aria-label={t('3D camera controls')}>
        <IconButton icon={<ArrowLeft size={16} />} label={t('Orbit left')} onClick={() => orbit(-1, 0)} disabled={unavailable} />
        <IconButton icon={<ArrowRight size={16} />} label={t('Orbit right')} onClick={() => orbit(1, 0)} disabled={unavailable} />
        <IconButton icon={<ArrowUp size={16} />} label={t('Tilt up')} onClick={() => orbit(0, -1)} disabled={unavailable} />
        <IconButton icon={<ArrowDown size={16} />} label={t('Tilt down')} onClick={() => orbit(0, 1)} disabled={unavailable} />
        <IconButton icon={<Minus size={16} />} label={t('Zoom out')} onClick={() => viewer.current?.zoom(1.25)} disabled={unavailable} />
        <IconButton icon={<Plus size={16} />} label={t('Zoom in')} onClick={() => viewer.current?.zoom(0.8)} disabled={unavailable} />
        <IconButton icon={<Maximize size={16} />} label={t('Fit circuit')} onClick={() => viewer.current?.fit()} disabled={unavailable} />
        <Button size="sm" variant="secondary" onClick={() => viewer.current?.fit(true)} disabled={unavailable}>{t('Top view')}</Button>
      </div>
      <select className="w-full min-w-0 rounded border border-line bg-white p-1.5 text-xs" aria-label={t('Inspect a 3D part')} value={doc.components.some(c => c.id === selectedIds?.[0]) ? selectedIds[0] : ''} onChange={event => onSelect(event.target.value ? [event.target.value] : [])}>
        <option value="">{t('Select a part to inspect…')}</option>
        {doc.components.map((part, index) => <option key={part.id} value={part.id}>{index + 1}. {t(getDef(part.type)?.name ?? part.type)}</option>)}
      </select>
      <p id={helpId} className="text-xs leading-relaxed text-slate-600">{t('Drag to orbit · Scroll or pinch to zoom · Right-drag or two fingers to pan. Select a part for live values and controls. Build and wire in 2D.')}</p>
    </div>
  </div>
}
