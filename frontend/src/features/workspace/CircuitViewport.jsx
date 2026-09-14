import { Component, lazy, Suspense, useState } from 'react'
import { BreadboardCanvas } from '../../canvas/BreadboardCanvas.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Button, SegmentedControl } from '../../ui/index.js'
import { WIRE_COLORS } from '../../engine/components/registry.js'

const Circuit3DView = lazy(() => import('../../canvas/three/Circuit3DView.jsx'))

class ViewBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/** Keep the SVG mounted (viewport + PNG export), inert while the optional 3D view is visible. */
export default function CircuitViewport({ allow3D, onAskAI, onToolChange, ...props }) {
  const { t } = useI18n()
  const [view, setView] = useState('2d')
  const [opened, setOpened] = useState(false)
  const three = allow3D && view === '3d'
  const choose = value => { setView(value); if (value === '3d') setOpened(true) }
  const unavailable = <div role="status" className="space-y-3 p-6 text-sm text-slate-600"><p>{t('3D view is unavailable in this browser. You can keep working in 2D.')}</p><Button onClick={() => choose('2d')}>{t('Return to 2D')}</Button></div>
  return <div className="flex h-full min-h-0 flex-col">
    <div className={allow3D ? 'z-10 flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-white p-2' : 'absolute right-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap justify-end gap-2 rounded-lg border border-line bg-white p-1.5'} aria-label={t('Circuit view controls')}>
      {allow3D && <SegmentedControl size="sm" value={three ? '3d' : '2d'} onChange={choose} options={[{ value: '2d', label: '2D' }, { value: '3d', label: '3D' }]} aria-label={t('Circuit view')} />}
      {!three && <SegmentedControl size="sm" value={props.tool} onChange={onToolChange} options={[{ value: 'select', label: 'Select' }, { value: 'wire', label: 'Wire' }]} aria-label={t('Canvas tool')} />}
      <Button size="sm" variant="secondary" onClick={onAskAI}>{t('Ask AI')}</Button>
      {!three && !props.readOnly && <div className="flex flex-wrap gap-1" aria-label={t('Wire palette')}>{WIRE_COLORS.map(color => <button key={color} aria-label={t('{color} wire', { color: t(color) })} aria-pressed={props.wireColor === color} title={t('{color} wire', { color: t(color) })} className={`h-7 w-7 rounded border-2 ${props.wireColor === color ? 'border-brand-600' : 'border-line'}`} style={{ backgroundColor: color }} onClick={() => props.onWireColorChange(color)} />)}</div>}
    </div>
    <div className="relative min-h-0 flex-1">
      <div className="absolute inset-0" style={{ visibility: three ? 'hidden' : 'visible' }} aria-hidden={three || undefined} inert={three ? '' : undefined}>
        <BreadboardCanvas {...props} onToolChange={onToolChange} />
      </div>
      {opened && <div className="absolute inset-0" style={{ visibility: three ? 'visible' : 'hidden' }} aria-hidden={!three || undefined} inert={!three ? '' : undefined}>
        <ViewBoundary fallback={unavailable}><Suspense fallback={<p role="status" className="p-4 text-sm text-slate-600">{t('Loading 3D view…')}</p>}><Circuit3DView doc={props.doc} simState={props.simState} selectedIds={props.selectedIds} onSelect={props.onSelect} active={three} onReturnTo2D={() => choose('2d')} /></Suspense></ViewBoundary>
      </div>}
    </div>
  </div>
}
