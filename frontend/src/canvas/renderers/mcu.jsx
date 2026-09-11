import { getBoard } from '../../engine/boards/index.js'
import { INK, PITCH, PartFrame, PinDot, TEXT_CLASS, bodyBox, defineRenderer, footprintPins } from './common.jsx'

export const ESP32_BURNT_TITLE = 'Overvoltage! ESP32 GPIOs tolerate max 3.3 V'
export const AVR_BURNT_TITLE = 'Overvoltage! This pin was damaged'

const THEMES = {
  uno: { fill: '#1B7F8C', stroke: '#125E68', label: '#E6F4F1', text: '#F8FAFC', name: 'ARDUINO UNO', family: 'avr' },
  nano: { fill: '#1E3A5F', stroke: '#0F2440', label: '#DBEAFE', text: '#F8FAFC', name: 'NANO', family: 'avr' },
  esp32: { fill: '#1F2937', stroke: '#0F172A', label: '#E2E8F0', text: '#F8FAFC', name: 'ESP32 DEVKIT V1', family: 'esp32' },
  esp32s3: { fill: '#1F2937', stroke: '#0F172A', label: '#E2E8F0', text: '#F8FAFC', name: 'ESP32-S3 DEVKITC-1', family: 'esp32' },
}

/** Resolves the BoardProfile for an MCU renderer: the `board` prop, else the registry, else null (labels fall back to the footprint). */
function resolveBoard(board, def, comp) {
  if (board?.pins) return board
  return getBoard(def?.type ?? comp?.type) ?? null
}

/** Silkscreen label for a footprint pin (PinDef.label, "~" prefix for AVR PWM pins). */
function pinLabelFor(boardProfile, pin, family) {
  const pinDef = boardProfile?.pins?.find((p) => p.name === pin.id)
  const label = pinDef?.label ?? pin.label ?? pin.id
  return family === 'avr' && pinDef?.caps?.includes('pwm') ? `~${label}` : label
}

/** Groups footprint pins into header rows (same dy). */
function headerRows(pins) {
  const rows = new Map()
  for (const pin of pins) {
    const key = pin.y
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key).push(pin)
  }
  return [...rows.entries()].map(([y, rowPins]) => ({ y, pins: rowPins, minX: Math.min(...rowPins.map((p) => p.x)), maxX: Math.max(...rowPins.map((p) => p.x)) }))
}

/** Green/red power LED with a soft ring when lit. */
function PowerLed({ x, y, on, color = '#22C55E', dim = '#14532D', label = 'ON', labelFill }) {
  return (
    <g data-power-led={on ? 'on' : 'off'}>
      {on ? <circle cx={x} cy={y} r={6.5} fill={color} opacity={0.35} /> : null}
      <circle cx={x} cy={y} r={3} fill={on ? color : dim} stroke="#0F172A" strokeWidth={0.5} />
      <text x={x + 7} y={y + 2.5} fontSize={6.5} fill={labelFill} className={TEXT_CLASS} aria-hidden="true">
        {label}
      </text>
    </g>
  )
}

/** TX / RX activity dots (amber while the sketch runs). */
function SerialDots({ x, y, running, labelFill }) {
  return (
    <g data-serial-dots={running ? 'active' : 'idle'}>
      {['TX', 'RX'].map((name, i) => (
        <g key={name}>
          <circle cx={x} cy={y + i * 11} r={2.4} fill={running ? '#F59E0B' : '#78350F'} />
          <text x={x + 6} y={y + i * 11 + 2.5} fontSize={6.5} fill={labelFill} className={TEXT_CLASS} aria-hidden="true">
            {name}
          </text>
        </g>
      ))}
    </g>
  )
}

/** Silver USB / power connector. */
function Connector({ x, y, width, height, label, labelFill }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} fill="#CBD5E1" stroke="#64748B" />
      <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} rx={1} fill="#94A3B8" />
      {label ? (
        <text x={x + width / 2} y={y + height + 9} textAnchor="middle" fontSize={6.5} fill={labelFill} className={TEXT_CLASS} aria-hidden="true">
          {label}
        </text>
      ) : null}
    </g>
  )
}

/** Small tactile button (reset / EN / BOOT). */
function SmallButton({ x, y, label, labelFill, size = 14 }) {
  return (
    <g>
      <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={2} fill="#CBD5E1" stroke="#64748B" />
      <circle cx={x} cy={y} r={size * 0.28} fill="#475569" />
      {label ? (
        <text x={x} y={y + size / 2 + 8} textAnchor="middle" fontSize={6} fill={labelFill} className={TEXT_CLASS} aria-hidden="true">
          {label}
        </text>
      ) : null}
    </g>
  )
}

/** Black IC package with a notch and a label. */
function Chip({ x, y, width, height, label, sub }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={2} fill="#111827" stroke="#0F172A" />
      <circle cx={x + 8} cy={y + 8} r={2.5} fill="#374151" />
      <text x={x + width / 2} y={y + height / 2 + (sub ? -1 : 3)} textAnchor="middle" fontSize={Math.min(9, height / 3)} fontWeight={600} fill="#E5E7EB" className={TEXT_CLASS} aria-hidden="true">
        {label}
      </text>
      {sub ? (
        <text x={x + width / 2} y={y + height / 2 + 9} textAnchor="middle" fontSize={6.5} fill="#9CA3AF" className={TEXT_CLASS} aria-hidden="true">
          {sub}
        </text>
      ) : null}
    </g>
  )
}

/**
 * Shared MCU board drawing: PCB, black header strips with metallic pins exactly on the footprint positions,
 * silkscreen labels (PinDef.label), burnt-pin markers, power LED and TX/RX dots. `children` adds board-specific parts.
 */
function McuBoard({ comp, def, board, powered, running, selected, ghost, damaged, burntPins, theme, children, powerLed, serialDots, cornerRadius = 10 }) {
  const box = bodyBox(def)
  const pins = footprintPins(def)
  const rows = headerRows(pins)
  const centerY = box.y + box.height / 2
  const burntTitle = theme.family === 'esp32' ? ESP32_BURNT_TITLE : AVR_BURNT_TITLE
  const burntCount = pins.filter((pin) => burntPins?.[pin.id]).length
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} pad={4} ariaLabel={`${board?.name ?? theme.name}${powered ? ', powered' : ', power off'}${burntCount ? `, ${burntCount} burnt pin${burntCount > 1 ? 's' : ''}` : ''}`}>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} rx={cornerRadius} fill={theme.fill} stroke={theme.stroke} strokeWidth={1.5} data-mcu-board={def?.type} />
      {/* mounting holes */}
      {[
        [box.x + 14, box.y + 14],
        [box.x + box.width - 14, box.y + 14],
        [box.x + 14, box.y + box.height - 14],
        [box.x + box.width - 14, box.y + box.height - 14],
      ].map(([hx, hy]) => (
        <circle key={`${hx},${hy}`} cx={hx} cy={hy} r={3.5} fill="#F8FAFC" stroke={theme.stroke} opacity={0.85} />
      ))}
      {children}
      {rows.map((row) => (
        <rect key={row.y} x={row.minX - 11} y={row.y - 10} width={row.maxX - row.minX + 22} height={20} rx={2.5} fill="#111827" stroke="#0F172A" data-header-row />
      ))}
      {rows.map((row) => {
        const below = row.y < centerY
        const labelY = below ? row.y + 19 : row.y - 14
        return row.pins.map((pin) => {
          const label = pinLabelFor(board, pin, theme.family)
          return (
            <text key={pin.id} x={pin.x} y={labelY} textAnchor="middle" fontSize={label.length > 4 ? 5.5 : 6.5} fill={theme.label} className={TEXT_CLASS} data-pin-label={pin.id} aria-hidden="true">
              {label}
            </text>
          )
        })
      })}
      {pins.map((pin) => {
        const burnt = Boolean(burntPins?.[pin.id])
        return <PinDot key={pin.id} id={pin.id} x={pin.x} y={pin.y} burnt={burnt} title={burnt ? burntTitle : undefined} />
      })}
      {powerLed ? <PowerLed {...powerLed} on={Boolean(powered)} labelFill={theme.label} /> : null}
      {serialDots ? <SerialDots {...serialDots} running={Boolean(running)} labelFill={theme.label} /> : null}
    </PartFrame>
  )
}

/** Arduino Uno R3 — free-mounted 648×504 px teal board. */
const UnoRenderer = defineRenderer('UnoRenderer', function UnoRenderer(props) {
  const { comp, def } = props
  const board = resolveBoard(props.board, def, comp)
  const theme = THEMES.uno
  const box = bodyBox(def)
  return (
    <McuBoard {...props} board={board} theme={theme} cornerRadius={14} powerLed={{ x: box.x + 560, y: box.y + 200, label: 'ON' }} serialDots={{ x: box.x + 118, y: box.y + 190 }}>
      <Connector x={box.x - 6} y={box.y + 60} width={78} height={80} label="USB" labelFill={theme.label} />
      <Connector x={box.x - 6} y={box.y + 372} width={70} height={70} label="POWER" labelFill={theme.label} />
      <Chip x={box.x + 300} y={box.y + 250} width={270} height={70} label="ATMEGA328P" sub="AVR · 16 MHz · 5 V" />
      <Chip x={box.x + 110} y={box.y + 90} width={70} height={52} label="16U2" />
      <SmallButton x={box.x + 600} y={box.y + 70} label="RESET" labelFill={theme.label} />
      <ellipse cx={box.x + 230} cy={box.y + 100} rx={16} ry={7} fill="#CBD5E1" stroke="#64748B" />
      <text x={box.x + 200} y={box.y + 320} fontSize={26} fontWeight={700} letterSpacing={2} fill={theme.text} className={TEXT_CLASS} aria-hidden="true">
        UNO
      </text>
      <text x={box.x + 200} y={box.y + 342} fontSize={10} letterSpacing={1} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        {board?.name ?? 'Arduino Uno R3'}
      </text>
      <text x={box.x + 118} y={box.y + 178} fontSize={6.5} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        L
      </text>
      <circle cx={box.x + 118} cy={box.y + 168} r={2.4} fill="#78350F" />
      <text x={box.x + 330} y={box.y + 60} textAnchor="middle" fontSize={8} letterSpacing={1} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        DIGITAL (PWM ~)
      </text>
      <text x={box.x + 300} y={box.y + 450} textAnchor="middle" fontSize={8} letterSpacing={1} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        POWER
      </text>
      <text x={box.x + 480} y={box.y + 450} textAnchor="middle" fontSize={8} letterSpacing={1} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        ANALOG IN
      </text>
    </McuBoard>
  )
})

/** Arduino Nano — board-mounted 15×7 pitch dark-blue board. */
const NanoRenderer = defineRenderer('NanoRenderer', function NanoRenderer(props) {
  const { comp, def } = props
  const board = resolveBoard(props.board, def, comp)
  const theme = THEMES.nano
  const box = bodyBox(def)
  const midY = box.y + box.height / 2
  return (
    <McuBoard {...props} board={board} theme={theme} cornerRadius={6} powerLed={{ x: box.x + 292, y: midY - 8, label: 'PWR' }} serialDots={{ x: box.x + 292, y: midY + 8 }}>
      <Connector x={box.x - 4} y={midY - 22} width={30} height={44} labelFill={theme.label} />
      <Chip x={box.x + 130} y={midY - 22} width={96} height={44} label="ATMEGA328P" />
      <SmallButton x={box.x + 80} y={midY} size={12} />
      <text x={box.x + 250} y={midY + 4} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={1.5} fill={theme.text} className={TEXT_CLASS} aria-hidden="true">
        NANO
      </text>
    </McuBoard>
  )
})

/** Antenna zig-zag trace for the ESP module. */
function Antenna({ x, y, height }) {
  const steps = Math.max(2, Math.floor(height / 8))
  const d = Array.from({ length: steps }, (_, i) => `${i === 0 ? 'M' : 'L'} ${x + (i % 2 ? 14 : 2)} ${y + (i * height) / (steps - 1)}`).join(' ')
  return <path d={d} fill="none" stroke="#475569" strokeWidth={1.5} strokeLinejoin="round" />
}

/** Silver shielded WiFi module with antenna region. */
function EspModule({ x, y, width, height, label }) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={5} fill="#CBD5E1" stroke="#94A3B8" />
      <rect x={x} y={y} width={30} height={height} rx={5} fill="#E2E8F0" />
      <Antenna x={x + 6} y={y + 10} height={height - 20} />
      <rect x={x + 42} y={y + 12} width={width - 54} height={height - 24} rx={3} fill="#94A3B8" stroke="#64748B" />
      <text x={x + 42 + (width - 54) / 2} y={y + height / 2 + 3} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="#1F2937" className={TEXT_CLASS} aria-hidden="true">
        {label}
      </text>
    </g>
  )
}

/** ESP32 DevKit V1 — board-mounted 15×11 pitch dark board with a silver module; 3.3 V GPIOs burn on overvoltage. */
const Esp32Renderer = defineRenderer('Esp32Renderer', function Esp32Renderer(props) {
  const { comp, def } = props
  const board = resolveBoard(props.board, def, comp)
  const theme = THEMES.esp32
  const box = bodyBox(def)
  const midY = box.y + box.height / 2
  return (
    <McuBoard {...props} board={board} theme={theme} cornerRadius={8} powerLed={{ x: box.x + 270, y: midY - 36, label: 'PWR', color: '#EF4444', dim: '#7F1D1D' }} serialDots={{ x: box.x + 270, y: midY + 26 }}>
      <EspModule x={box.x + 4} y={box.y + 32} width={166} height={box.height - 64} label="ESP-WROOM-32" />
      <Connector x={box.x + box.width - 26} y={midY - 20} width={30} height={40} label="USB" labelFill={theme.label} />
      <SmallButton x={box.x + 215} y={midY - 60} label="EN" labelFill={theme.label} />
      <SmallButton x={box.x + 215} y={midY + 46} label="BOOT" labelFill={theme.label} />
      <Chip x={box.x + 190} y={midY - 22} width={60} height={44} label="CP2102" />
      <text x={box.x + 270} y={midY + 4} textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={1} fill={theme.text} className={TEXT_CLASS} aria-hidden="true">
        3.3 V
      </text>
      <text x={box.x + 270} y={midY - 10} textAnchor="middle" fontSize={7} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        {board?.name ?? 'ESP32 DevKit V1'}
      </text>
    </McuBoard>
  )
})

/** ESP32-S3 DevKitC-1 — board-mounted 22×11 pitch dark board, two USB ports. */
const Esp32S3Renderer = defineRenderer('Esp32S3Renderer', function Esp32S3Renderer(props) {
  const { comp, def } = props
  const board = resolveBoard(props.board, def, comp)
  const theme = THEMES.esp32s3
  const box = bodyBox(def)
  const midY = box.y + box.height / 2
  return (
    <McuBoard {...props} board={board} theme={theme} cornerRadius={8} powerLed={{ x: box.x + 400, y: midY - 36, label: 'PWR', color: '#EF4444', dim: '#7F1D1D' }} serialDots={{ x: box.x + 400, y: midY + 26 }}>
      <EspModule x={box.x + 4} y={box.y + 32} width={200} height={box.height - 64} label="ESP32-S3-WROOM-1" />
      <Connector x={box.x + box.width - 26} y={midY - 52} width={30} height={36} label="UART" labelFill={theme.label} />
      <Connector x={box.x + box.width - 26} y={midY + 16} width={30} height={36} label="USB" labelFill={theme.label} />
      <SmallButton x={box.x + 250} y={midY - 60} label="RST" labelFill={theme.label} />
      <SmallButton x={box.x + 250} y={midY + 46} label="BOOT" labelFill={theme.label} />
      <Chip x={box.x + 230} y={midY - 22} width={70} height={44} label="CH343" />
      <circle cx={box.x + 330} cy={midY} r={4} fill="#F8FAFC" stroke="#64748B" data-rgb-led="GPIO48" />
      <text x={box.x + 330} y={midY + 14} textAnchor="middle" fontSize={6} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        RGB
      </text>
      <text x={box.x + 400} y={midY + 4} textAnchor="middle" fontSize={8} fontWeight={700} letterSpacing={1} fill={theme.text} className={TEXT_CLASS} aria-hidden="true">
        3.3 V
      </text>
      <text x={box.x + 400} y={midY - 10} textAnchor="middle" fontSize={7} fill={theme.label} className={TEXT_CLASS} aria-hidden="true">
        {board?.name ?? 'ESP32-S3 DevKitC-1'}
      </text>
    </McuBoard>
  )
})

export { UnoRenderer, NanoRenderer, Esp32Renderer, Esp32S3Renderer, INK as _INK, PITCH as _PITCH }
