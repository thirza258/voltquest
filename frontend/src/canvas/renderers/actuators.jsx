import { useReducedMotion } from '../effects/motion.js'
import { CHARCOAL, INK, Lead, PITCH, PartFrame, PinDots, PinLabels, Readout, TEXT_CLASS, clamp, defineRenderer, formatCurrent, pinPoint } from './common.jsx'

const ACTUATOR_KEYFRAMES = `
@keyframes vq-arc-pulse { 0% { opacity: 0.25; } 50% { opacity: 1; } 100% { opacity: 0.25; } }
@keyframes vq-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.vq-rotor { transform-box: fill-box; transform-origin: center; }
@media (prefers-reduced-motion: reduce) {
  .vq-rotor, .vq-arc { animation: none !important; }
}
`

/** Formats a tone frequency. */
function formatHz(freq) {
  return freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)} kHz` : `${Math.round(freq)} Hz`
}

/** Piezo buzzer: black cylinder; sound arcs pulse while `tone > 0`. */
const BuzzerRenderer = defineRenderer('BuzzerRenderer', function BuzzerRenderer({ comp, def, tone, selected, ghost, damaged }) {
  const reduced = useReducedMotion()
  const pos = pinPoint(def, 'pos')
  const neg = pinPoint(def, 'neg')
  const cx = (pos.x + neg.x) / 2
  const cy = -PITCH / 2 - 8
  const freq = damaged ? 0 : Math.max(0, Number(tone) || 0)
  const sounding = freq > 0
  const box = { x: pos.x - PITCH / 2, y: cy - 20, width: neg.x - pos.x + PITCH + (sounding ? 24 : 0), height: 20 + PITCH / 2 - cy }
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={sounding ? `Buzzer sounding ${formatHz(freq)}` : 'Buzzer (silent)'}>
      <defs>
        <style>{ACTUATOR_KEYFRAMES}</style>
      </defs>
      <Lead from={pos} to={{ x: pos.x + 6, y: cy + 10 }} />
      <Lead from={neg} to={{ x: neg.x - 6, y: cy + 10 }} />
      <circle cx={cx} cy={cy} r={16} fill="#111827" stroke="#000000" />
      <circle cx={cx} cy={cy} r={12} fill="none" stroke="#374151" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={3} fill="#374151" />
      <text x={pos.x + 3} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#F8FAFC" className={TEXT_CLASS} aria-hidden="true">
        +
      </text>
      {sounding
        ? [22, 28, 34].map((r, i) => (
            <path
              key={r}
              className="vq-arc"
              data-sound-arc
              d={`M ${cx + r * Math.cos(-0.6)} ${cy + r * Math.sin(-0.6)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(0.6)} ${cy + r * Math.sin(0.6)}`}
              fill="none"
              stroke={INK.brand}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={reduced ? 0.9 : 0.4}
              style={reduced ? undefined : { animation: `vq-arc-pulse ${clamp(1400 - freq / 4, 300, 1400)}ms ease-in-out ${i * 120}ms infinite` }}
            />
          ))
        : null}
      {sounding ? <Readout x={cx} y={cy - 26} text={formatHz(freq)} width={46} tone="brand" /> : null}
      <PinLabels def={def} dy={13} labels={{ pos: '+', neg: '−' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** SG90 micro servo: horn rotates to `peripheral.data.angle` (0..180°, 90° = straight up). */
const ServoRenderer = defineRenderer('ServoRenderer', function ServoRenderer({ comp, def, peripheral, running, selected, ghost, damaged }) {
  const reduced = useReducedMotion()
  const signal = pinPoint(def, 'signal')
  const gnd = pinPoint(def, 'gnd')
  const angle = clamp(peripheral?.data?.angle ?? 90, 0, 180)
  const bodyTop = -PITCH / 2 - 30
  const bodyBottom = -6
  const hubX = signal.x + 12
  const hubY = bodyTop
  const hornLen = 26
  const box = { x: signal.x - PITCH / 2, y: hubY - hornLen - 6, width: gnd.x - signal.x + PITCH, height: PITCH / 2 - (hubY - hornLen - 6) }
  const wireColors = { signal: '#F97316', vcc: '#EF4444', gnd: '#78350F' }
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`Servo at ${Math.round(angle)}°`}>
      {['signal', 'vcc', 'gnd'].map((id) => {
        const pin = pinPoint(def, id)
        return <line key={id} x1={pin.x} y1={pin.y} x2={pin.x} y2={bodyBottom} stroke={wireColors[id]} strokeWidth={2.5} strokeLinecap="round" />
      })}
      <rect x={signal.x - 8} y={bodyTop} width={gnd.x - signal.x + 16} height={bodyBottom - bodyTop} rx={3} fill="#1E40AF" stroke="#1E3A8A" />
      <rect x={signal.x - 12} y={bodyTop + 8} width={gnd.x - signal.x + 24} height={6} rx={1} fill="#1E3A8A" />
      <text x={(signal.x + gnd.x) / 2 + 6} y={bodyBottom - 8} textAnchor="middle" fontSize={7} fontWeight={600} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
        SG90
      </text>
      <circle cx={hubX} cy={hubY} r={9} fill="#1E3A8A" />
      <g
        data-servo-horn
        data-angle={Math.round(angle)}
        transform={`rotate(${angle - 90} ${hubX} ${hubY})`}
        style={reduced ? undefined : { transition: 'transform 150ms ease-out' }}
      >
        <path d={`M ${hubX - 4} ${hubY} L ${hubX - 2.5} ${hubY - hornLen} A 2.5 2.5 0 0 1 ${hubX + 2.5} ${hubY - hornLen} L ${hubX + 4} ${hubY} Z`} fill="#F8FAFC" stroke="#94A3B8" />
        {[8, 14, 20].map((d) => (
          <circle key={d} cx={hubX} cy={hubY - d} r={1} fill="#94A3B8" />
        ))}
      </g>
      <circle cx={hubX} cy={hubY} r={4.5} fill="#F8FAFC" stroke="#94A3B8" />
      <circle cx={hubX} cy={hubY} r={1.5} fill="#64748B" />
      {running || selected ? <Readout x={hubX + 34} y={hubY - 10} text={`${Math.round(angle)}°`} width={34} tone="brand" /> : null}
      <PinLabels def={def} dy={13} labels={{ signal: 'SIG', vcc: 'VCC', gnd: 'GND' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

/** Spin speed 0..1 for a motor current (|I|; full speed at ≥ 150 mA, stopped below 1 mA). */
export function motorSpeed(current) {
  const amps = Math.abs(Number(current) || 0)
  if (amps < 0.001) return 0
  return clamp(amps / 0.15, 0.08, 1)
}

/** Brushed DC motor: rotor spins ∝ |state.current| (direction follows the sign); readout of the current. */
const DcMotorRenderer = defineRenderer('DcMotorRenderer', function DcMotorRenderer({ comp, def, state, running, selected, ghost, damaged }) {
  const reduced = useReducedMotion()
  const p1 = pinPoint(def, 'p1')
  const p2 = pinPoint(def, 'p2')
  const cx = (p1.x + p2.x) / 2
  const cy = -PITCH / 2 - 16
  const current = damaged || state?.state === 'blown' ? 0 : Number(state?.current) || 0
  const speed = motorSpeed(current)
  const reverse = current < 0
  const spinning = speed > 0
  const box = { x: p1.x - PITCH / 2, y: cy - 22, width: p2.x - p1.x + PITCH, height: 22 + PITCH / 2 - cy }
  const durationMs = spinning ? Math.round(2400 / speed) : 0
  const isDamaged = damaged || state?.state === 'blown'
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={isDamaged} box={box} ariaLabel={spinning ? `DC motor spinning (${formatCurrent(current)})` : 'DC motor (stopped)'}>
      <defs>
        <style>{ACTUATOR_KEYFRAMES}</style>
      </defs>
      <Lead from={p1} to={{ x: p1.x + 4, y: cy + 14 }} />
      <Lead from={p2} to={{ x: p2.x - 4, y: cy + 14 }} />
      <circle cx={cx} cy={cy} r={20} fill="#CBD5E1" stroke="#64748B" />
      <circle cx={cx} cy={cy} r={14} fill="#94A3B8" />
      <g
        className="vq-rotor"
        data-rotor
        data-spin-speed={speed.toFixed(2)}
        data-spin-direction={spinning ? (reverse ? 'ccw' : 'cw') : undefined}
        style={spinning && !reduced ? { animation: `vq-spin ${durationMs}ms linear infinite`, animationDirection: reverse ? 'reverse' : 'normal' } : undefined}
      >
        {[0, 120, 240].map((rot) => (
          <rect key={rot} x={cx - 3} y={cy - 13} width={6} height={13} rx={3} fill={spinning ? INK.brand : CHARCOAL} transform={`rotate(${rot} ${cx} ${cy})`} opacity={spinning && reduced ? 0.6 + 0.4 * speed : 1} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={3.5} fill="#F8FAFC" stroke="#64748B" />
      {running || selected ? <Readout x={cx} y={cy - 30} text={spinning ? formatCurrent(current) : 'stopped'} width={50} tone={spinning ? 'brand' : 'neutral'} /> : null}
      <PinDots def={def} />
    </PartFrame>
  )
})

/** 5 V relay module: contact schematic follows `state.state` ('on' → COM–NO, 'off' → COM–NC). */
const RelayRenderer = defineRenderer('RelayRenderer', function RelayRenderer({ comp, def, state, selected, ghost, damaged }) {
  const vcc = pinPoint(def, 'vcc')
  const nc = pinPoint(def, 'nc')
  const on = !damaged && state?.state === 'on'
  const boardTop = -PITCH / 2 - 42
  const boardBottom = -6
  const left = vcc.x - PITCH / 2
  const width = nc.x - vcc.x + PITCH
  const box = { x: left, y: boardTop, width, height: PITCH / 2 - boardTop }
  const comX = left + 12
  const comY = boardTop + 24
  const noY = boardTop + 12
  const ncY = boardTop + 36
  const contactX = left + 50
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`Relay ${on ? 'on (COM–NO closed)' : 'off (COM–NC closed)'}`}>
      {['vcc', 'gnd', 'in', 'com', 'no', 'nc'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: boardBottom }} />
      ))}
      <rect x={left} y={boardTop} width={width} height={boardBottom - boardTop} rx={3} fill="#1D4ED8" stroke="#1E3A8A" />
      {/* relay can */}
      <rect x={left + width - 74} y={boardTop + 4} width={68} height={boardBottom - boardTop - 8} rx={2} fill="#1E3A8A" stroke="#172554" />
      <text x={left + width - 40} y={boardTop + 18} textAnchor="middle" fontSize={6.5} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
        SRD-05VDC
      </text>
      <text x={left + width - 40} y={boardTop + 27} textAnchor="middle" fontSize={6.5} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
        10A 250VAC
      </text>
      {/* contact schematic */}
      <g data-relay-state={on ? 'on' : 'off'}>
        <circle cx={comX} cy={comY} r={2.2} fill="#F8FAFC" />
        <circle cx={contactX} cy={noY} r={2.2} fill={on ? '#F8FAFC' : '#93C5FD'} />
        <circle cx={contactX} cy={ncY} r={2.2} fill={on ? '#93C5FD' : '#F8FAFC'} />
        <line x1={comX} y1={comY} x2={contactX - 3} y2={on ? noY + 1 : ncY - 1} stroke="#F8FAFC" strokeWidth={2} strokeLinecap="round" data-relay-armature />
        <text x={comX - 2} y={comY + 10} fontSize={6} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
          COM
        </text>
        <text x={contactX + 5} y={noY + 2} fontSize={6} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
          NO
        </text>
        <text x={contactX + 5} y={ncY + 2} fontSize={6} fill="#DBEAFE" className={TEXT_CLASS} aria-hidden="true">
          NC
        </text>
      </g>
      {/* status LED */}
      <circle cx={left + 12} cy={boardBottom - 10} r={3} fill={on ? '#EF4444' : '#7F1D1D'} data-relay-led={on ? 'on' : 'off'} />
      {on ? <circle cx={left + 12} cy={boardBottom - 10} r={6} fill="#EF4444" opacity={0.3} /> : null}
      <PinLabels def={def} dy={13} labels={{ vcc: 'VCC', gnd: 'GND', in: 'IN', com: 'COM', no: 'NO', nc: 'NC' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { BuzzerRenderer, ServoRenderer, DcMotorRenderer, RelayRenderer }
