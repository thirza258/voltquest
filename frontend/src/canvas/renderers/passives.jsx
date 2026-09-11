import { resistorBands } from '../../engine/components/registry.js'
import { CHARCOAL, INK, Lead, PITCH, PartFrame, PinDots, PinLabels, ValueLabel, defineRenderer, formatOhms, pinPoint } from './common.jsx'

const BAND_COLORS = {
  black: '#111827',
  brown: '#7C3A12',
  red: '#DC2626',
  orange: '#F97316',
  yellow: '#FACC15',
  green: '#16A34A',
  blue: '#2563EB',
  violet: '#7C3AED',
  gray: '#6B7280',
  white: '#F8FAFC',
  gold: '#D4A017',
  silver: '#C0C0C0',
}

/** Through-hole resistor: beige body between p1 and p2 with four colour bands and a 10 px value label. */
const ResistorRenderer = defineRenderer('ResistorRenderer', function ResistorRenderer({ comp, def, selected, ghost, damaged, state }) {
  const ohms = Number(comp?.props?.ohms ?? def?.props?.ohms?.default ?? 220)
  const p1 = pinPoint(def, 'p1')
  const p2 = pinPoint(def, 'p2')
  const bands = resistorBands(ohms) ?? []
  const bodyX = (p1.x + p2.x) / 2 - PITCH
  const bodyW = PITCH * 2
  const isDamaged = damaged || state?.state === 'blown'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} ariaLabel={`Resistor ${formatOhms(ohms)}`}>
      <Lead from={p1} to={p2} />
      <rect x={bodyX} y={-8} width={bodyW} height={16} rx={7} fill="#F1E3C6" stroke="#C9B48B" />
      {bands.slice(0, 4).map((band, i) => {
        const bx = i < 3 ? bodyX + 8 + i * 8 : bodyX + bodyW - 11
        return <rect key={i} x={bx} y={-8} width={4} height={16} fill={BAND_COLORS[band] ?? '#111827'} />
      })}
      <ValueLabel x={(p1.x + p2.x) / 2} y={-14} text={formatOhms(ohms)} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Electrolytic capacitor: navy can with a light stripe marking the negative lead. */
const CapacitorRenderer = defineRenderer('CapacitorRenderer', function CapacitorRenderer({ comp, def, selected, ghost, damaged }) {
  const uF = Number(comp?.props?.uF ?? def?.props?.uF?.default ?? 100)
  const pos = pinPoint(def, 'pos')
  const neg = pinPoint(def, 'neg')
  const cx = (pos.x + neg.x) / 2
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} ariaLabel={`Capacitor ${uF} µF`}>
      <Lead from={pos} to={{ x: pos.x, y: -6 }} />
      <Lead from={neg} to={{ x: neg.x, y: -6 }} />
      <rect x={cx - 18} y={-30} width={36} height={24} rx={5} fill="#1E3A8A" stroke="#172554" />
      <rect x={neg.x - 2} y={-30} width={8} height={24} rx={2} fill="#E2E8F0" opacity={0.9} />
      <text x={neg.x + 2} y={-14} textAnchor="middle" fontSize={8} fontWeight={700} fill={INK.primary} className="font-sans select-none pointer-events-none" aria-hidden="true">
        −
      </text>
      <text x={pos.x + 2} y={-14} textAnchor="middle" fontSize={8} fontWeight={700} fill="#FFFFFF" className="font-sans select-none pointer-events-none" aria-hidden="true">
        +
      </text>
      <ValueLabel x={cx} y={-35} text={`${uF} µF`} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Rectifier diode: black body with a silver cathode band. */
const DiodeRenderer = defineRenderer('DiodeRenderer', function DiodeRenderer({ comp, def, selected, ghost, damaged, state }) {
  const anode = pinPoint(def, 'anode')
  const cathode = pinPoint(def, 'cathode')
  const cx = (anode.x + cathode.x) / 2
  const dir = Math.sign(cathode.x - anode.x) || 1
  const isDamaged = damaged || state?.state === 'blown'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} ariaLabel="Diode 1N4007">
      <Lead from={anode} to={cathode} />
      <rect x={cx - 14} y={-7} width={28} height={14} rx={3} fill={CHARCOAL} stroke="#0F172A" />
      <rect x={cx + dir * 8 - 2} y={-7} width={4} height={14} fill="#E2E8F0" />
      <ValueLabel x={cx} y={-13} text="1N4007" />
      <PinLabels def={def} dy={13} labels={{ anode: 'A', cathode: 'K' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** NPN transistor in a TO-92 package (flat face toward the pins). */
const TransistorNpnRenderer = defineRenderer('TransistorNpnRenderer', function TransistorNpnRenderer({ comp, def, selected, ghost, damaged, state }) {
  const e = pinPoint(def, 'e')
  const b = pinPoint(def, 'b')
  const c = pinPoint(def, 'c')
  const cx = b.x
  const isDamaged = damaged || state?.state === 'blown'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} ariaLabel="NPN transistor 2N2222">
      {[e, b, c].map((pin) => (
        <Lead key={`${pin.x},${pin.y}`} from={pin} to={{ x: pin.x, y: -8 }} />
      ))}
      <path d={`M ${cx - 20} -8 L ${cx + 20} -8 L ${cx + 20} -16 A 20 20 0 0 0 ${cx - 20} -16 Z`} fill="#374151" stroke="#1F2937" />
      <text x={cx} y={-18} textAnchor="middle" fontSize={7} fill="#E5E7EB" className="font-sans select-none pointer-events-none" aria-hidden="true">
        2N2222
      </text>
      <PinLabels def={def} dy={13} labels={{ e: 'E', b: 'B', c: 'C' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Bidirectional 4-channel level shifter: HV row on top, LV row below, channel traces between. */
const LevelShifterRenderer = defineRenderer('LevelShifterRenderer', function LevelShifterRenderer({ comp, def, selected, ghost, damaged }) {
  const hv = pinPoint(def, 'hv')
  const lv = pinPoint(def, 'lv')
  const gndH = pinPoint(def, 'gnd_h')
  const left = Math.min(hv.x, lv.x) - PITCH / 2
  const right = Math.max(gndH.x, pinPoint(def, 'gnd_l').x) + PITCH / 2
  const top = hv.y + 10
  const bottom = lv.y - 10
  const midY = (top + bottom) / 2
  const channels = [1, 2, 3, 4]
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} ariaLabel="Level shifter 5 V ↔ 3.3 V">
      <rect x={left} y={top} width={right - left} height={bottom - top} rx={4} fill="#B91C1C" stroke="#7F1D1D" />
      {channels.map((n) => {
        const hx = pinPoint(def, `hv${n}`).x
        const lx = pinPoint(def, `lv${n}`).x
        return (
          <g key={n}>
            <line x1={hx} y1={top} x2={hx} y2={midY - 5} stroke="#FCA5A5" strokeWidth={1.2} />
            <line x1={lx} y1={bottom} x2={lx} y2={midY + 5} stroke="#FCA5A5" strokeWidth={1.2} />
            <rect x={(hx + lx) / 2 - 5} y={midY - 5} width={10} height={10} rx={1.5} fill="#111827" stroke="#0F172A" />
          </g>
        )
      })}
      <text x={left + 6} y={top + 10} fontSize={8} fontWeight={700} fill="#FFFFFF" className="font-sans select-none pointer-events-none" aria-hidden="true">
        HV · 5 V
      </text>
      <text x={left + 6} y={bottom - 4} fontSize={8} fontWeight={700} fill="#FFFFFF" className="font-sans select-none pointer-events-none" aria-hidden="true">
        LV · 3.3 V
      </text>
      <PinLabels def={def} dy={19} fill="#FEE2E2" only={['hv1', 'hv2', 'hv3', 'hv4', 'gnd_h']} labels={{ hv1: 'HV1', hv2: 'HV2', hv3: 'HV3', hv4: 'HV4', gnd_h: 'GND' }} />
      <PinLabels def={def} dy={-13} fill="#FEE2E2" only={['lv1', 'lv2', 'lv3', 'lv4', 'gnd_l']} labels={{ lv1: 'LV1', lv2: 'LV2', lv3: 'LV3', lv4: 'LV4', gnd_l: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { ResistorRenderer, CapacitorRenderer, DiodeRenderer, TransistorNpnRenderer, LevelShifterRenderer, BAND_COLORS }
