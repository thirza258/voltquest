import { useId } from 'react'
import { GlowFilter } from '../effects/GlowFilter.jsx'
import { CHARCOAL, INK, LED_COLORS, Lead, PITCH, PartFrame, PinDots, PinLabels, ValueLabel, clamp, defineRenderer, ledColorName, pinPoint } from './common.jsx'

/** Halo circle whose radius and opacity grow with brightness (0..1). Always rendered so tests/tooltips can read it. */
function Glow({ cx, cy, color, brightness, filterId, baseR = 10, spread = 18 }) {
  const b = clamp(brightness, 0, 1)
  return (
    <circle
      data-glow
      data-brightness={b.toFixed(3)}
      cx={cx}
      cy={cy}
      r={b > 0 ? baseR + spread * b : 0}
      fill={color}
      opacity={b > 0 ? 0.2 + 0.6 * b : 0}
      filter={`url(#${filterId})`}
      pointerEvents="none"
    />
  )
}

/** Dome path (flat side at `flatY`) centred on `cx`. */
function domePath(cx, flatY, r) {
  return `M ${cx - r} ${flatY} L ${cx - r} ${flatY - r * 0.55} A ${r} ${r} 0 0 1 ${cx + r} ${flatY - r * 0.55} L ${cx + r} ${flatY} Z`
}

/** 5 mm LED: coloured dome that glows ∝ `state.brightness`; blown → gray + cracks. */
const LedRenderer = defineRenderer('LedRenderer', function LedRenderer({ comp, def, state, selected, ghost, damaged }) {
  const filterId = useId()
  const colorKey = comp?.props?.color ?? def?.props?.color?.default ?? 'red'
  const color = LED_COLORS[colorKey] ?? LED_COLORS.red
  const brightness = damaged || state?.state === 'blown' ? 0 : clamp(state?.brightness ?? 0, 0, 1)
  const anode = pinPoint(def, 'anode')
  const cathode = pinPoint(def, 'cathode')
  const cx = (anode.x + cathode.x) / 2
  const cy = -10
  const isDamaged = damaged || state?.state === 'blown'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} ariaLabel={`${ledColorName(colorKey)} LED${brightness > 0 ? ' (lit)' : ''}`}>
      <defs>
        <GlowFilter id={filterId} blur={5} />
      </defs>
      <Glow cx={cx} cy={cy - 2} color={color} brightness={brightness} filterId={filterId} />
      <Lead from={anode} to={{ x: anode.x + 4, y: cy + 6 }} />
      <Lead from={cathode} to={{ x: cathode.x - 4, y: cy + 6 }} />
      <path d={domePath(cx, cy + 6, 11)} fill={color} opacity={0.35 + 0.65 * brightness} stroke={color} strokeOpacity={0.6} />
      {/* flat edge on the cathode side */}
      <line x1={cathode.x - 2} y1={cy + 6} x2={cathode.x - 2} y2={cy - 2} stroke={CHARCOAL} strokeWidth={1.2} opacity={0.5} />
      <ellipse cx={cx - 3} cy={cy - 3} rx={2.5} ry={4} fill="#FFFFFF" opacity={0.25 + 0.6 * brightness} />
      <text x={anode.x} y={PITCH / 2 + 8} textAnchor="middle" fontSize={7} fontWeight={700} fill={INK.muted} className="font-sans select-none pointer-events-none" aria-hidden="true">
        +
      </text>
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Composite colour from per-channel 0..1 brightness values. */
function channelsToColor(channels) {
  const r = clamp(channels?.r ?? 0, 0, 1)
  const g = clamp(channels?.g ?? 0, 0, 1)
  const b = clamp(channels?.b ?? 0, 0, 1)
  const peak = Math.max(r, g, b)
  if (peak <= 0) return { color: '#F1F5F9', peak: 0 }
  const scale = (v) => Math.round(255 * (0.15 + 0.85 * (v / peak)) * (v > 0 ? 1 : 0))
  return { color: `rgb(${scale(r)}, ${scale(g)}, ${scale(b)})`, peak }
}

/** Common-cathode RGB LED: clear dome mixing `state.channels` r/g/b. */
const RgbLedRenderer = defineRenderer('RgbLedRenderer', function RgbLedRenderer({ comp, def, state, selected, ghost, damaged }) {
  const filterId = useId()
  const isDamaged = damaged || state?.state === 'blown'
  const { color, peak } = isDamaged ? { color: '#F1F5F9', peak: 0 } : channelsToColor(state?.channels)
  const pins = ['r', 'cathode', 'g', 'b'].map((id) => pinPoint(def, id))
  const cx = (pins[0].x + pins[3].x) / 2
  const cy = -12
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} ariaLabel={`RGB LED${peak > 0 ? ' (lit)' : ''}`}>
      <defs>
        <GlowFilter id={filterId} blur={6} />
      </defs>
      <Glow cx={cx} cy={cy - 2} color={color} brightness={peak} filterId={filterId} baseR={12} spread={20} />
      {pins.map((pin) => (
        <Lead key={`${pin.x}`} from={pin} to={{ x: cx + (pin.x - cx) * 0.5, y: cy + 8 }} />
      ))}
      <path d={domePath(cx, cy + 8, 14)} fill={color} opacity={peak > 0 ? 0.95 : 0.6} stroke="#CBD5E1" />
      <ellipse cx={cx - 4} cy={cy - 4} rx={3} ry={5} fill="#FFFFFF" opacity={0.35 + 0.5 * peak} />
      <PinLabels def={def} dy={13} labels={{ r: 'R', cathode: '−', g: 'G', b: 'B' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Segment geometry for a digit centred at (cx, cy): rects keyed by segment pin id. */
function segmentRects(cx, cy) {
  const w = 20
  const t = 4.2
  const h = 16
  return {
    seg_a: { x: cx - w / 2, y: cy - 19 - t / 2, width: w, height: t },
    seg_g: { x: cx - w / 2, y: cy - t / 2, width: w, height: t },
    seg_d: { x: cx - w / 2, y: cy + 19 - t / 2, width: w, height: t },
    seg_f: { x: cx - w / 2 - t / 2 - 1, y: cy - 18, width: t, height: h },
    seg_b: { x: cx + w / 2 - t / 2 + 1, y: cy - 18, width: t, height: h },
    seg_e: { x: cx - w / 2 - t / 2 - 1, y: cy + 2, width: t, height: h },
    seg_c: { x: cx + w / 2 - t / 2 + 1, y: cy + 2, width: t, height: h },
  }
}

/** Common-cathode 7-segment digit lit from `state.segments[seg_x]`. */
const SevenSegmentRenderer = defineRenderer('SevenSegmentRenderer', function SevenSegmentRenderer({ comp, def, state, selected, ghost, damaged }) {
  const filterId = useId()
  const top = pinPoint(def, 'seg_g')
  const bottom = pinPoint(def, 'seg_e')
  const right = pinPoint(def, 'seg_b')
  const left = Math.min(top.x, bottom.x) - PITCH / 2
  const width = right.x - top.x + PITCH
  const bodyTop = top.y + 9
  const bodyBottom = bottom.y - 9
  const cx = top.x + (right.x - top.x) / 2
  const cy = (bodyTop + bodyBottom) / 2
  const rects = segmentRects(cx, cy)
  const segments = damaged ? {} : state?.segments ?? {}
  const litColor = '#EF4444'
  const litCount = Object.values(segments).filter(Boolean).length
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} ariaLabel={`7-segment display, ${litCount} segments lit`}>
      <defs>
        <GlowFilter id={filterId} blur={2.5} />
      </defs>
      <rect x={left} y={bodyTop} width={width} height={bodyBottom - bodyTop} rx={4} fill="#111827" stroke="#0F172A" />
      {Object.entries(rects).map(([id, r]) => {
        const lit = Boolean(segments[id])
        return (
          <g key={id} data-segment={id} data-lit={lit || undefined}>
            {lit ? <rect {...r} rx={1.5} fill={litColor} opacity={0.7} filter={`url(#${filterId})`} /> : null}
            <rect {...r} rx={1.5} fill={lit ? litColor : '#3F3F46'} opacity={lit ? 1 : 0.7} />
          </g>
        )
      })}
      <circle data-segment="seg_dp" data-lit={segments.seg_dp || undefined} cx={cx + 19} cy={cy + 19} r={2.6} fill={segments.seg_dp ? litColor : '#3F3F46'} />
      <PinLabels def={def} dy={-7} only={['seg_g', 'seg_f', 'com', 'seg_a', 'seg_b']} labels={{ seg_g: 'g', seg_f: 'f', com: 'com', seg_a: 'a', seg_b: 'b' }} />
      <PinLabels def={def} dy={13} only={['seg_e', 'seg_d', 'com2', 'seg_c', 'seg_dp']} labels={{ seg_e: 'e', seg_d: 'd', com2: 'com', seg_c: 'c', seg_dp: 'dp' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Normalises NeoPixel data to css colours (brightness may be 0..1 or 0..255). */
function neopixelColor(pixel, brightness) {
  if (!Array.isArray(pixel)) return null
  const scale = brightness == null ? 1 : brightness > 1 ? clamp(brightness, 0, 255) / 255 : clamp(brightness, 0, 1)
  const [r = 0, g = 0, b = 0] = pixel
  const rr = Math.round(clamp(r, 0, 255) * scale)
  const gg = Math.round(clamp(g, 0, 255) * scale)
  const bb = Math.round(clamp(b, 0, 255) * scale)
  if (rr + gg + bb === 0) return null
  return { color: `rgb(${rr}, ${gg}, ${bb})`, intensity: Math.max(rr, gg, bb) / 255 }
}

/** WS2812B ring with `props.count` pixels coloured from `peripheral.data.pixels`. */
const NeopixelRingRenderer = defineRenderer('NeopixelRingRenderer', function NeopixelRingRenderer({ comp, def, peripheral, selected, ghost, damaged }) {
  const filterId = useId()
  const count = Math.max(1, Math.min(64, Math.round(Number(comp?.props?.count ?? def?.props?.count?.default ?? 12))))
  const din = pinPoint(def, 'din')
  const gnd = pinPoint(def, 'gnd')
  const cx = (din.x + gnd.x) / 2
  const outerR = 40
  const innerR = 24
  const cy = -PITCH / 2 - outerR - 4
  const pixels = damaged ? null : peripheral?.data?.pixels
  const brightness = peripheral?.data?.brightness
  const box = { x: Math.min(din.x, cx - outerR) - PITCH / 2, y: cy - outerR - 2, width: Math.max(gnd.x - din.x + PITCH, outerR * 2 + PITCH), height: outerR + 2 - cy + PITCH / 2 }
  const litCount = Array.isArray(pixels) ? pixels.slice(0, count).filter((p) => neopixelColor(p, brightness)).length : 0
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`NeoPixel ring, ${count} pixels, ${litCount} lit`}>
      <defs>
        <GlowFilter id={filterId} blur={4} />
      </defs>
      {['din', 'vcc', 'gnd'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: cy + outerR - 4 }} />
      ))}
      <circle cx={cx} cy={cy} r={outerR} fill="#1F2937" stroke="#0F172A" />
      <circle cx={cx} cy={cy} r={innerR} fill="#FFFFFF" stroke="#0F172A" />
      {Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
        const r = (outerR + innerR) / 2
        const px = cx + r * Math.cos(angle)
        const py = cy + r * Math.sin(angle)
        const lit = neopixelColor(pixels?.[i], brightness)
        const size = count > 24 ? 5 : 8
        return (
          <g key={i} data-pixel={i} data-lit={lit ? 'true' : undefined}>
            {lit ? <circle cx={px} cy={py} r={size + 4 * lit.intensity} fill={lit.color} opacity={0.75} filter={`url(#${filterId})`} /> : null}
            <rect x={px - size / 2} y={py - size / 2} width={size} height={size} rx={1.5} fill={lit ? lit.color : '#F8FAFC'} stroke={lit ? 'none' : '#94A3B8'} strokeWidth={0.8} />
          </g>
        )
      })}
      <ValueLabel x={cx} y={cy + 3.5} text={`×${count}`} fill={INK.muted} />
      <PinLabels def={def} dy={13} labels={{ din: 'DIN', vcc: 'VCC', gnd: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { LedRenderer, RgbLedRenderer, SevenSegmentRenderer, NeopixelRingRenderer }
