import { useCallback, useId, useRef } from 'react'
import { GlowFilter } from '../effects/GlowFilter.jsx'
import {
  CHARCOAL,
  FOCUS_CLASS,
  INK,
  Lead,
  PITCH,
  PartFrame,
  PinDots,
  PinLabels,
  Readout,
  SensorPanel,
  TEXT_CLASS,
  ToggleChip,
  ValueLabel,
  clamp,
  defineRenderer,
  formatOhms,
  isActivationKey,
  pinPoint,
  pointerLocal,
  sensorPanelHeight,
} from './common.jsx'

/** Tactile push button: hold with the pointer or Enter/Space → `onControl({ pressed })`. */
const PushbuttonRenderer = defineRenderer('PushbuttonRenderer', function PushbuttonRenderer({ comp, def, control, selected, ghost, damaged, onControl, interactive = true }) {
  const pressed = Boolean(control?.pressed)
  const a1 = pinPoint(def, 'a1')
  const b2 = pinPoint(def, 'b2')
  const cx = (a1.x + b2.x) / 2
  const cy = (a1.y + b2.y) / 2
  const enabled = interactive && !ghost && typeof onControl === 'function'

  const setPressed = useCallback(
    (next) => {
      if (enabled && next !== pressed) onControl({ pressed: next })
    },
    [enabled, onControl, pressed],
  )

  const onPointerDown = (event) => {
    if (!enabled) return
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setPressed(true)
  }
  const release = (event) => {
    if (!enabled) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    setPressed(false)
  }
  const onKeyDown = (event) => {
    if (!enabled || !isActivationKey(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) setPressed(true)
  }
  const onKeyUp = (event) => {
    if (!enabled || !isActivationKey(event)) return
    event.preventDefault()
    setPressed(false)
  }

  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged}>
      <rect x={a1.x - 10} y={a1.y - 10} width={b2.x - a1.x + 20} height={b2.y - a1.y + 20} rx={3} fill="#E5E7EB" stroke="#9CA3AF" />
      <g
        role="button"
        tabIndex={enabled ? 0 : -1}
        aria-label="Push button (hold to press)"
        aria-pressed={pressed}
        aria-disabled={!enabled || undefined}
        data-pushbutton
        data-pressed={pressed || undefined}
        className={FOCUS_CLASS}
        style={{ cursor: enabled ? 'pointer' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={() => setPressed(false)}
        onClick={(event) => event.stopPropagation()}
      >
        <circle cx={cx} cy={cy} r={14} fill="transparent" />
        <circle cx={cx} cy={cy} r={pressed ? 10 : 11.5} fill={pressed ? '#0F172A' : CHARCOAL} stroke={pressed ? INK.brand : '#111827'} strokeWidth={pressed ? 2 : 1} />
        <circle cx={cx - 3} cy={cy - 3} r={3} fill="#FFFFFF" opacity={pressed ? 0.1 : 0.2} />
      </g>
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Knob angle (degrees, clockwise from 12 o'clock) for a 0..1 value across a 270° sweep. */
function knobAngle(value) {
  return -135 + clamp(value, 0, 1) * 270
}

/** Rotary potentiometer: drag the knob (or use arrow keys) → `onControl({ value })` with value 0..1. */
const PotentiometerRenderer = defineRenderer('PotentiometerRenderer', function PotentiometerRenderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const knobRef = useRef(null)
  const dragState = useRef(null)
  const ohms = Number(comp?.props?.ohms ?? def?.props?.ohms?.default ?? 10000)
  const value = clamp(control?.value ?? def?.control?.default ?? 0.5, 0, 1)
  const end1 = pinPoint(def, 'end1')
  const end2 = pinPoint(def, 'end2')
  const wiper = pinPoint(def, 'wiper')
  const cx = wiper.x
  const knobY = -PITCH / 2 - 14
  const enabled = interactive && !ghost && typeof onControl === 'function'

  const emit = useCallback(
    (next) => {
      const v = Math.round(clamp(next, 0, 1) * 1000) / 1000
      if (enabled && v !== value) onControl({ value: v })
    },
    [enabled, onControl, value],
  )

  const valueFromPointer = (event) => {
    const local = pointerLocal(event, knobRef.current)
    if (local) {
      const angle = (Math.atan2(local.x, -local.y) * 180) / Math.PI // 0° at top, clockwise positive
      return (clamp(angle, -135, 135) + 135) / 270
    }
    // Fallback (no CTM available): horizontal drag, 150 px for the full sweep.
    const start = dragState.current
    return start ? start.value + (event.clientX - start.clientX) / 150 : value
  }

  const onPointerDown = (event) => {
    if (!enabled) return
    event.stopPropagation()
    event.preventDefault()
    dragState.current = { clientX: event.clientX, value }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    emit(valueFromPointer(event))
  }
  const onPointerMove = (event) => {
    if (!dragState.current) return
    emit(valueFromPointer(event))
  }
  const endDrag = (event) => {
    if (!dragState.current) return
    dragState.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }
  const onKeyDown = (event) => {
    if (!enabled) return
    const map = { ArrowRight: value + 0.05, ArrowUp: value + 0.05, ArrowLeft: value - 0.05, ArrowDown: value - 0.05, PageUp: value + 0.2, PageDown: value - 0.2, Home: 0, End: 1 }
    if (!(event.key in map)) return
    event.preventDefault()
    event.stopPropagation()
    emit(map[event.key])
  }

  const angle = knobAngle(value)
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={{ x: end1.x - PITCH / 2, y: knobY - 20, width: end2.x - end1.x + PITCH, height: PITCH / 2 - (knobY - 20) }}>
      {[end1, wiper, end2].map((pin) => (
        <Lead key={pin.x} from={pin} to={{ x: pin.x, y: -8 }} />
      ))}
      <rect x={end1.x - 6} y={knobY - 18} width={end2.x - end1.x + 12} height={-8 - (knobY - 18)} rx={4} fill="#2563EB" stroke="#1E3A8A" />
      <g
        ref={knobRef}
        transform={`translate(${cx} ${knobY})`}
        role="slider"
        tabIndex={enabled ? 0 : -1}
        aria-label={`Potentiometer ${formatOhms(ohms)}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${Math.round(value * 100)} %`}
        aria-disabled={!enabled || undefined}
        data-pot-knob
        className={FOCUS_CLASS}
        style={{ cursor: enabled ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <circle r={14} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1.5} />
        <circle r={10} fill="#E2E8F0" />
        <g transform={`rotate(${angle})`}>
          <line x1={0} y1={-3} x2={0} y2={-12} stroke={INK.brand} strokeWidth={2.5} strokeLinecap="round" />
        </g>
        {/* sweep arc markers */}
        <path d="M -9.9 9.9 A 14 14 0 1 1 9.9 9.9" fill="none" stroke="#CBD5E1" strokeWidth={1} transform="translate(0 0) scale(1.18)" opacity={0.8} />
      </g>
      <ValueLabel x={cx} y={knobY - 20} text={formatOhms(ohms)} />
      {selected || running ? <Readout x={cx + 32} y={knobY} text={`${Math.round(value * 100)} %`} width={34} tone="brand" /> : null}
      <PinLabels def={def} dy={13} labels={{ end1: '1', wiper: 'W', end2: '2' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** LDR (photoresistor): tan disc with a serpentine track; light-level slider when selected or running. */
const LdrRenderer = defineRenderer('LdrRenderer', function LdrRenderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const p1 = pinPoint(def, 'p1')
  const p2 = pinPoint(def, 'p2')
  const cx = (p1.x + p2.x) / 2
  const cy = -PITCH / 2 - 8
  const lightLevel = clamp(control?.lightLevel ?? def?.control?.default ?? 60, 0, 100)
  const showPanel = selected || running
  const panelH = sensorPanelHeight(1)
  const panelY = cy - 14 - panelH - 6
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const serpentine = 'M -8 -6 h 16 M -8 -2 h 16 M -8 2 h 16 M -8 6 h 16 M -8 -6 v 4 M 8 -2 v 4 M -8 2 v 4'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={{ x: p1.x - PITCH / 2, y: cy - 14, width: p2.x - p1.x + PITCH, height: 14 + PITCH / 2 - cy }} ariaLabel={`Light sensor at ${Math.round(lightLevel)} % light`}>
      <Lead from={p1} to={{ x: cx - 6, y: cy + 8 }} />
      <Lead from={p2} to={{ x: cx + 6, y: cy + 8 }} />
      <circle cx={cx} cy={cy} r={13} fill="#F5D0A9" stroke="#B45309" />
      <path d={serpentine} transform={`translate(${cx} ${cy})`} fill="none" stroke="#7C2D12" strokeWidth={1.6} strokeLinecap="round" />
      {/* light indicator */}
      <circle cx={cx + 18} cy={cy - 12} r={4} fill="#F59E0B" opacity={0.15 + 0.85 * (lightLevel / 100)} data-light-level={Math.round(lightLevel)} />
      {showPanel ? (
        <SensorPanel
          x={cx - 66}
          y={panelY}
          rows={[{ key: 'lightLevel', label: 'Light', value: lightLevel, min: 0, max: 100, step: 1, unit: '%' }]}
          disabled={!enabled}
          onChange={(key, v) => onControl?.({ [key]: v })}
        />
      ) : null}
      <PinDots def={def} />
    </PartFrame>
  )
})

/** ESP32 capacitive touch pad: glows when `control.touched`; click/Enter toggles it. */
const TouchPadRenderer = defineRenderer('TouchPadRenderer', function TouchPadRenderer({ comp, def, control, selected, ghost, damaged, onControl, interactive = true }) {
  const filterId = useId()
  const touched = Boolean(control?.touched)
  const pad = pinPoint(def, 'pad')
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const padY = pad.y + 8
  const padH = PITCH + 4
  const toggle = (event) => {
    event.stopPropagation()
    if (enabled) onControl({ touched: !touched })
  }
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged}>
      <defs>
        <GlowFilter id={filterId} blur={4} />
      </defs>
      <Lead from={pad} to={{ x: pad.x, y: padY }} />
      {touched ? <rect x={pad.x - 14} y={padY - 3} width={28} height={padH + 6} rx={8} fill={INK.brandRing} opacity={0.55} filter={`url(#${filterId})`} pointerEvents="none" data-touch-glow /> : null}
      <g
        role="button"
        tabIndex={enabled ? 0 : -1}
        aria-label="Touch pad"
        aria-pressed={touched}
        aria-disabled={!enabled || undefined}
        data-touch-pad
        data-touched={touched || undefined}
        className={FOCUS_CLASS}
        style={{ cursor: enabled ? 'pointer' : 'default' }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={toggle}
        onKeyDown={(event) => {
          if (isActivationKey(event)) {
            event.preventDefault()
            toggle(event)
          }
        }}
      >
        <rect x={pad.x - 11} y={padY} width={22} height={padH} rx={6} fill={touched ? '#F59E0B' : '#D97706'} stroke={touched ? INK.brand : '#92400E'} strokeWidth={touched ? 2 : 1} />
        <circle cx={pad.x} cy={padY + padH / 2} r={5} fill="none" stroke="#FEF3C7" strokeWidth={1.2} opacity={0.9} />
        <circle cx={pad.x} cy={padY + padH / 2} r={1.8} fill="#FEF3C7" />
      </g>
      <text x={pad.x} y={padY + padH + 8} textAnchor="middle" fontSize={6.5} fill={INK.muted} className={TEXT_CLASS} aria-hidden="true">
        TOUCH
      </text>
      <PinDots def={def} />
    </PartFrame>
  )
})

/** HC-SR501 PIR: white fresnel dome tints amber while `control.motion`; toggle chip when selected or running. */
const PirRenderer = defineRenderer('PirRenderer', function PirRenderer({ comp, def, control, selected, ghost, damaged, running, onControl, interactive = true }) {
  const motion = Boolean(control?.motion)
  const vcc = pinPoint(def, 'vcc')
  const out = pinPoint(def, 'out')
  const gnd = pinPoint(def, 'gnd')
  const cx = out.x
  const boardTop = -PITCH / 2 - 34
  const domeY = boardTop + 18
  const enabled = interactive && !ghost && typeof onControl === 'function'
  const showToggle = selected || running
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={{ x: vcc.x - PITCH / 2, y: boardTop - (showToggle ? 26 : 2), width: gnd.x - vcc.x + PITCH, height: PITCH / 2 - boardTop + (showToggle ? 26 : 2) }} ariaLabel={`PIR motion sensor, motion ${motion ? 'detected' : 'idle'}`}>
      {[vcc, out, gnd].map((pin) => (
        <Lead key={pin.x} from={pin} to={{ x: pin.x, y: -6 }} />
      ))}
      <rect x={vcc.x - 10} y={boardTop} width={gnd.x - vcc.x + 20} height={-6 - boardTop} rx={3} fill="#166534" stroke="#14532D" />
      <circle cx={cx} cy={domeY} r={15} fill={motion ? '#FDE68A' : '#F8FAFC'} stroke={motion ? '#D97706' : '#CBD5E1'} data-pir-dome data-motion={motion || undefined} />
      <path d={`M ${cx - 10} ${domeY} h 20 M ${cx} ${domeY - 10} v 20 M ${cx - 7} ${domeY - 7} l 14 14 M ${cx + 7} ${domeY - 7} l -14 14`} stroke={motion ? '#F59E0B' : '#E2E8F0'} strokeWidth={0.8} fill="none" opacity={0.9} />
      {showToggle ? <ToggleChip x={cx} y={boardTop - 12} width={64} label="Motion" pressed={motion} disabled={!enabled} onToggle={(next) => onControl?.({ motion: next })} /> : null}
      <PinLabels def={def} dy={13} labels={{ vcc: 'VCC', out: 'OUT', gnd: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { PushbuttonRenderer, PotentiometerRenderer, LdrRenderer, TouchPadRenderer, PirRenderer }
