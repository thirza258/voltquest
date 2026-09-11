import { memo, useCallback, useRef } from 'react'
import { PITCH } from '../../engine/components/breadboard.js'
import { CrackOverlay } from '../effects/CrackOverlay.jsx'

/**
 * Shared primitives for component renderers. Every renderer is mounted by the canvas at
 * `<g transform="translate(Ox,Oy) rotate(rot)">` and draws pin i at (dx·PITCH, dy·PITCH) — see CONTRACTS §4.2/§10.
 */

/** @typedef RendererProps
 *  { comp, def, state, peripheral, control, running, powered, selected, ghost, damaged, burntPins, board, tone, onControl, interactive } */

export { PITCH }

export const INK = {
  primary: '#0F172A',
  secondary: '#475569',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  strong: '#CBD5E1',
  brand: '#0D9488',
  brandRing: '#14B8A6',
  danger: '#E11D48',
  warning: '#D97706',
  success: '#059669',
}

export const METAL = { fill: '#CBD5E1', stroke: '#64748B', highlight: '#F8FAFC' }
export const CHARCOAL = '#1F2937'
export const LEAD = '#94A3B8'

export const LED_COLORS = {
  red: '#EF4444',
  green: '#22C55E',
  blue: '#3B82F6',
  yellow: '#FACC15',
  white: '#F1F5F9',
}

/** Label used for the LED colour (also for accessibility names). */
export function ledColorName(color) {
  return typeof color === 'string' && color.length ? color[0].toUpperCase() + color.slice(1) : 'Red'
}

/** Clamps `value` to [min, max]; non-finite input becomes `min`. */
export function clamp(value, min, max) {
  const v = Number(value)
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

/** Un-rotated local body box of a def in px (board mount is centred on the anchor hole; free mount starts at 0,0). */
export function bodyBox(def) {
  const width = Math.max(1, def?.footprint?.width ?? 1)
  const height = Math.max(1, def?.footprint?.height ?? 1)
  if (def?.mount === 'free') return { x: 0, y: 0, width: width * PITCH, height: height * PITCH }
  return { x: -PITCH / 2, y: -PITCH / 2, width: width * PITCH, height: height * PITCH }
}

/** Footprint pins with local px positions: `[{ id, label, x, y }]`. */
export function footprintPins(def) {
  const pins = def?.footprint?.pins ?? []
  return pins.map((pin) => ({ id: pin.id, label: pin.label ?? pin.id, x: (pin.dx ?? 0) * PITCH, y: (pin.dy ?? 0) * PITCH }))
}

/** Local px position of one footprint pin; `(0,0)` when the pin is unknown so drawings stay connected. */
export function pinPoint(def, pinId) {
  const pin = def?.footprint?.pins?.find((p) => p.id === pinId)
  return pin ? { x: (pin.dx ?? 0) * PITCH, y: (pin.dy ?? 0) * PITCH } : { x: 0, y: 0 }
}

/** Formats amps as a UI string ("12.5 mA", "1.20 A"). */
export function formatCurrent(amps) {
  const a = Math.abs(Number(amps) || 0)
  if (a >= 1) return `${a.toFixed(2)} A`
  if (a >= 0.01) return `${(a * 1000).toFixed(1)} mA`
  return `${(a * 1000).toFixed(2)} mA`
}

/** Formats ohms as "220 Ω", "10 kΩ", "1 MΩ". */
export function formatOhms(ohms) {
  const r = Number(ohms) || 0
  if (r >= 1e6) return `${trimNumber(r / 1e6)} MΩ`
  if (r >= 1e3) return `${trimNumber(r / 1e3)} kΩ`
  return `${trimNumber(r)} Ω`
}

function trimNumber(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

const TEXT_CLASS = 'font-sans select-none pointer-events-none'

/** Metallic pin pad drawn exactly on a footprint position. Burnt pins turn charcoal with a ⚠ marker and a tooltip. */
export function PinDot({ x, y, id, burnt = false, title, r = 3.6 }) {
  return (
    <g data-pin={id} data-burnt={burnt || undefined} transform={`translate(${x} ${y})`}>
      {title ? <title>{title}</title> : null}
      <circle r={r} fill={burnt ? CHARCOAL : METAL.fill} stroke={burnt ? INK.primary : METAL.stroke} strokeWidth={1} />
      <circle r={r * 0.38} fill={burnt ? INK.primary : METAL.highlight} opacity={burnt ? 1 : 0.9} />
      {burnt ? (
        <text y={-r - 2.5} textAnchor="middle" fontSize={8} fill={INK.warning} className={TEXT_CLASS} aria-hidden="true">
          ⚠
        </text>
      ) : null}
    </g>
  )
}

/** Pin dots for every footprint pin. */
export function PinDots({ def, burntPins, burntTitle }) {
  return footprintPins(def).map((pin) => {
    const burnt = Boolean(burntPins?.[pin.id])
    return <PinDot key={pin.id} id={pin.id} x={pin.x} y={pin.y} burnt={burnt} title={burnt ? burntTitle : undefined} />
  })
}

/** Tiny muted pin label (6.5 px). */
export function PinLabel({ x, y, text, fill = INK.muted, anchor = 'middle', size = 6.5, rotate = 0 }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fill={fill}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      className={TEXT_CLASS}
      aria-hidden="true"
    >
      {text}
    </text>
  )
}

/** Small labels under (or above) every footprint pin. */
export function PinLabels({ def, dy = 12, fill, size, only, labels }) {
  return footprintPins(def)
    .filter((pin) => !only || only.includes(pin.id))
    .map((pin) => <PinLabel key={pin.id} x={pin.x} y={pin.y + dy} text={labels?.[pin.id] ?? pin.label} fill={fill} size={size} />)
}

/** 10 px value label (component value / name). */
export function ValueLabel({ x, y, text, fill = INK.secondary, anchor = 'middle', weight = 500 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={10} fontWeight={weight} fill={fill} className={`${TEXT_CLASS} tabular-nums`} aria-hidden="true">
      {text}
    </text>
  )
}

/** Small readout pill ("90°", "50 cm"). */
export function Readout({ x, y, text, width = 40, tone = 'neutral' }) {
  const colors = tone === 'brand' ? { bg: '#F0FDFA', fg: INK.brand, line: '#99F6E4' } : { bg: '#FFFFFF', fg: INK.secondary, line: INK.line }
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none" aria-hidden="true" data-readout>
      <rect x={-width / 2} y={-7} width={width} height={14} rx={4} fill={colors.bg} stroke={colors.line} />
      <text y={3.5} textAnchor="middle" fontSize={8.5} fontWeight={600} fill={colors.fg} className={`${TEXT_CLASS} tabular-nums`}>
        {text}
      </text>
    </g>
  )
}

/**
 * Wrapper every renderer uses: hosts the body, applies ghost opacity, gray + cracks when damaged and a dashed
 * teal outline when selected. `box` overrides the footprint box for parts whose drawing extends beyond it.
 */
export function PartFrame({ comp, def, selected, ghost, damaged, box, pad = 3, children, ariaLabel }) {
  const frame = box ?? bodyBox(def)
  return (
    <g
      data-component-id={comp?.id}
      data-component-type={def?.type ?? comp?.type}
      opacity={ghost ? 0.45 : 1}
      style={ghost ? { pointerEvents: 'none' } : undefined}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <g data-damaged={damaged || undefined} style={damaged ? { filter: 'grayscale(1) brightness(0.92)' } : undefined}>
        {children}
      </g>
      {damaged ? <CrackOverlay x={frame.x} y={frame.y} width={frame.width} height={frame.height} /> : null}
      {selected ? (
        <rect
          x={frame.x - pad}
          y={frame.y - pad}
          width={frame.width + pad * 2}
          height={frame.height + pad * 2}
          rx={6}
          fill="none"
          stroke={INK.brand}
          strokeWidth={1.5}
          strokeDasharray="5 3"
          pointerEvents="none"
          data-selection-outline
        />
      ) : null}
    </g>
  )
}

/** Straight lead from a pin to the body. */
export function Lead({ from, to, width = 2 }) {
  return <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={LEAD} strokeWidth={width} strokeLinecap="round" />
}

const FOCUS_CLASS = 'outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500'

/** Returns true for Enter / Space keyboard "activation" presses. */
export function isActivationKey(event) {
  return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'
}

/** Converts a pointer event into `el`'s local coordinate system → `{ x, y }` (null when unavailable, e.g. jsdom). */
export function pointerLocal(event, el) {
  const ctm = el?.getScreenCTM?.()
  if (!ctm) return null
  const m = ctm.inverse()
  return {
    x: m.a * event.clientX + m.c * event.clientY + m.e,
    y: m.b * event.clientX + m.d * event.clientY + m.f,
  }
}

/** Local x coordinate of a pointer event in `el`'s coordinate system (null when unavailable). */
export function pointerLocalX(event, el) {
  return pointerLocal(event, el)?.x ?? null
}

/** Height in px of a SensorPanel with `rowCount` sliders. */
export function sensorPanelHeight(rowCount) {
  return rowCount * 22 + 10
}

function roundToStep(value, min, step) {
  const steps = Math.round((value - min) / step)
  const v = min + steps * step
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)))
  return Number(v.toFixed(Math.min(6, decimals)))
}

/**
 * Compact SVG slider (track + handle + label + readout). Pointer drag maps x → value; keyboard arrows step it.
 * Calls `onChange(value)` with the clamped, step-rounded value.
 */
export function MiniSlider({ x = 0, y = 0, width = 96, value, min = 0, max = 100, step = 1, onChange, label, unit = '', format, disabled = false, ariaLabel }) {
  const trackRef = useRef(null)
  const dragging = useRef(false)
  const range = Math.max(1e-9, max - min)
  const v = clamp(value ?? min, min, max)
  const frac = (v - min) / range
  const readout = format ? format(v) : `${Number.isInteger(step) ? Math.round(v) : v.toFixed(Math.max(0, Math.ceil(-Math.log10(step))))}${unit ? ` ${unit}` : ''}`

  const emit = useCallback(
    (next) => {
      if (disabled || typeof onChange !== 'function') return
      const clamped = roundToStep(clamp(next, min, max), min, step)
      if (clamped !== v) onChange(clamped)
    },
    [disabled, onChange, min, max, step, v],
  )

  const valueFromPointer = useCallback(
    (event) => {
      const localX = pointerLocalX(event, trackRef.current)
      if (localX == null) return null
      return min + clamp((localX - x) / width, 0, 1) * range
    },
    [min, range, width, x],
  )

  const onPointerDown = (event) => {
    if (disabled) return
    event.stopPropagation()
    event.preventDefault()
    dragging.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const next = valueFromPointer(event)
    if (next != null) emit(next)
  }
  const onPointerMove = (event) => {
    if (!dragging.current) return
    const next = valueFromPointer(event)
    if (next != null) emit(next)
  }
  const endDrag = (event) => {
    if (!dragging.current) return
    dragging.current = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }
  const onKeyDown = (event) => {
    if (disabled) return
    const big = step * 10
    const map = { ArrowRight: v + step, ArrowUp: v + step, ArrowLeft: v - step, ArrowDown: v - step, PageUp: v + big, PageDown: v - big, Home: min, End: max }
    if (!(event.key in map)) return
    event.preventDefault()
    event.stopPropagation()
    emit(map[event.key])
  }

  const handleX = x + frac * width
  return (
    <g
      data-mini-slider
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel ?? label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={v}
      aria-valuetext={readout}
      aria-disabled={disabled || undefined}
      className={FOCUS_CLASS}
      style={{ cursor: disabled ? 'default' : 'ew-resize' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
      onClick={(event) => event.stopPropagation()}
    >
      {label ? (
        <text x={x} y={y - 4} fontSize={7} fill={INK.muted} className={TEXT_CLASS}>
          {label}
        </text>
      ) : null}
      <text x={x + width} y={y - 4} fontSize={7.5} fontWeight={600} textAnchor="end" fill={INK.secondary} className={`${TEXT_CLASS} tabular-nums`}>
        {readout}
      </text>
      <rect ref={trackRef} x={x} y={y + 2} width={width} height={4} rx={2} fill={INK.line} />
      <rect x={x} y={y + 2} width={Math.max(0, frac * width)} height={4} rx={2} fill={disabled ? INK.faint : INK.brand} />
      <circle cx={handleX} cy={y + 4} r={5} fill="#FFFFFF" stroke={disabled ? INK.faint : INK.brand} strokeWidth={1.5} />
      {/* generous hit area */}
      <rect x={x - 6} y={y - 6} width={width + 12} height={20} fill="transparent" />
    </g>
  )
}

/**
 * White card with stacked MiniSliders — shown next to sensors when selected or the sim is running.
 * `rows`: `[{ key, label, value, min, max, step, unit, format }]`; `onChange(key, value)`.
 */
export function SensorPanel({ x, y, rows, onChange, disabled = false, width = 132 }) {
  const rowHeight = 22
  const height = sensorPanelHeight(rows.length)
  return (
    <g transform={`translate(${x} ${y})`} data-sensor-panel>
      <rect width={width} height={height} rx={6} fill="#FFFFFF" stroke={INK.line} />
      {rows.map((row, i) => (
        <MiniSlider
          key={row.key}
          x={8}
          y={14 + i * rowHeight}
          width={width - 16}
          value={row.value}
          min={row.min}
          max={row.max}
          step={row.step ?? 1}
          unit={row.unit}
          format={row.format}
          label={row.label}
          disabled={disabled}
          onChange={(v) => onChange?.(row.key, v)}
        />
      ))}
    </g>
  )
}

/** Small pill toggle button (e.g. "Motion"). */
export function ToggleChip({ x, y, width = 56, label, pressed, onToggle, disabled = false }) {
  const activate = (event) => {
    event.stopPropagation()
    if (!disabled) onToggle?.(!pressed)
  }
  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={Boolean(pressed)}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={FOCUS_CLASS}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={activate}
      onKeyDown={(event) => {
        if (isActivationKey(event)) {
          event.preventDefault()
          activate(event)
        }
      }}
      data-toggle-chip
    >
      <rect x={-width / 2} y={-8} width={width} height={16} rx={8} fill={pressed ? INK.brand : '#FFFFFF'} stroke={pressed ? INK.brand : INK.strong} />
      <circle cx={-width / 2 + 8} cy={0} r={3.5} fill={pressed ? '#FFFFFF' : INK.faint} />
      <text x={4} y={3} textAnchor="middle" fontSize={8} fontWeight={600} fill={pressed ? '#FFFFFF' : INK.secondary} className={TEXT_CLASS}>
        {label}
      </text>
    </g>
  )
}

export { FOCUS_CLASS, TEXT_CLASS }

/** Wraps a renderer in React.memo and gives it a readable displayName. */
export function defineRenderer(name, component) {
  component.displayName = name
  return memo(component)
}
