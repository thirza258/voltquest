import { useRef } from 'react'

export default function ResizeHandle({ side, value, onChange }) {
  const gesture = useRef(null)
  const maximum = () => Math.max(220, Math.floor(window.innerWidth / 2))
  const update = next => onChange(Math.min(maximum(), Math.max(220, next)))
  return <div role="separator" aria-label={`Resize ${side} panel`} aria-orientation="vertical" aria-valuemin={220} aria-valuemax={maximum()} aria-valuenow={value} tabIndex={0} className="hidden w-1.5 shrink-0 cursor-col-resize bg-surface-sunken hover:bg-brand-100 focus:bg-brand-200 focus:outline-none xl:block" style={{ touchAction: 'none' }} onPointerDown={e => { gesture.current = { x: e.clientX, value }; e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => { if (gesture.current) update(gesture.current.value + (e.clientX - gesture.current.x) * (side === 'left' ? 1 : -1)) }} onPointerUp={() => { gesture.current = null }} onPointerCancel={() => { gesture.current = null }} onLostPointerCapture={() => { gesture.current = null }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); update(value + (e.key === 'ArrowRight' ? 20 : -20) * (side === 'left' ? 1 : -1)) } }} />
}
