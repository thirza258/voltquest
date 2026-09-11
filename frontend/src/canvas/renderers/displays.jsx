import { useMemo } from 'react'
import { INK, Lead, PITCH, PartFrame, PinDots, PinLabels, TEXT_CLASS, defineRenderer, pinPoint } from './common.jsx'

const LCD_COLS = 16
const LCD_ROWS = 2
const LCD_CELL_W = 10.5
const LCD_CELL_H = 18

/** Pads/truncates a display line to 16 characters. */
function lcdLine(line) {
  const text = typeof line === 'string' ? line : ''
  return text.length >= LCD_COLS ? text.slice(0, LCD_COLS) : text.padEnd(LCD_COLS, ' ')
}

/** Whether the module backlight should be drawn lit: from peripheral data when present, else from module power. */
function backlightOn(peripheral, state, powered) {
  if (peripheral?.data) return peripheral.data.backlight !== false
  return Boolean(state?.powered ?? powered)
}

/** 16×2 character LCD with an I2C backpack: cells from `peripheral.data.lines`, blue backlight. */
const Lcd16x2Renderer = defineRenderer('Lcd16x2Renderer', function Lcd16x2Renderer({ comp, def, state, peripheral, powered, selected, ghost, damaged }) {
  const gnd = pinPoint(def, 'gnd')
  const scl = pinPoint(def, 'scl')
  const left = gnd.x - PITCH / 2
  const pcbW = 192
  const pcbTop = -PITCH / 2 - 112
  const pcbBottom = -6
  const glassX = left + 8
  const glassY = pcbTop + 8
  const glassW = pcbW - 16
  const glassH = LCD_ROWS * LCD_CELL_H + 12
  const lit = !damaged && backlightOn(peripheral, state, powered)
  const lines = Array.from({ length: LCD_ROWS }, (_, i) => lcdLine(damaged ? '' : peripheral?.data?.lines?.[i]))
  const addr = comp?.props?.addr ?? def?.props?.addr?.default ?? 0x27
  const box = { x: left, y: pcbTop, width: pcbW, height: PITCH / 2 - pcbTop }
  const cellsX = glassX + (glassW - LCD_COLS * LCD_CELL_W) / 2
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`LCD 16×2: "${lines[0].trimEnd()}" / "${lines[1].trimEnd()}"${lit ? '' : ' (backlight off)'}`}>
      {['gnd', 'vcc', 'sda', 'scl'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: pcbBottom }} />
      ))}
      <rect x={left} y={pcbTop} width={pcbW} height={pcbBottom - pcbTop} rx={4} fill="#166534" stroke="#14532D" />
      <rect x={left + 4} y={pcbBottom - 16} width={scl.x - gnd.x + 16} height={12} rx={2} fill="#111827" />
      <rect x={glassX} y={glassY} width={glassW} height={glassH} rx={3} fill={lit ? '#1D4ED8' : '#334155'} stroke={lit ? '#1E40AF' : '#1E293B'} data-lcd-backlight={lit ? 'on' : 'off'} />
      {lines.map((line, row) =>
        line.split('').map((ch, col) =>
          ch === ' ' ? null : (
            <text
              key={`${row}-${col}`}
              x={cellsX + col * LCD_CELL_W + LCD_CELL_W / 2}
              y={glassY + 6 + row * LCD_CELL_H + LCD_CELL_H - 5}
              textAnchor="middle"
              fontSize={13}
              fill={lit ? '#F8FAFC' : '#94A3B8'}
              className="font-mono select-none pointer-events-none"
              data-lcd-cell={`${row},${col}`}
              aria-hidden="true"
            >
              {ch}
            </text>
          ),
        ),
      )}
      {/* faint cell grid */}
      {Array.from({ length: LCD_ROWS }, (_, row) =>
        Array.from({ length: LCD_COLS }, (_, col) => (
          <rect key={`${row}-${col}`} x={cellsX + col * LCD_CELL_W + 1} y={glassY + 6 + row * LCD_CELL_H} width={LCD_CELL_W - 2} height={LCD_CELL_H - 2} fill="none" stroke="#FFFFFF" strokeOpacity={lit ? 0.08 : 0.04} />
        )),
      )}
      <text x={left + pcbW - 6} y={pcbBottom - 7} textAnchor="end" fontSize={7} fill="#BBF7D0" className={TEXT_CLASS} aria-hidden="true">
        16×2 I2C · 0x{Number(addr).toString(16).toUpperCase()}
      </text>
      <PinLabels def={def} dy={13} labels={{ gnd: 'GND', vcc: 'VCC', sda: 'SDA', scl: 'SCL' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

const OLED_W = 128
const OLED_H = 64
const OLED_SCALE = 1.5

/**
 * Builds one SVG path covering every lit pixel of an SSD1306 frame buffer
 * (page layout: byte `page*128 + x`, bit `b` → y = page*8 + b).
 */
export function oledPixelPath(pixels) {
  if (!pixels || typeof pixels.length !== 'number') return ''
  const parts = []
  const pages = OLED_H / 8
  for (let page = 0; page < pages; page++) {
    for (let x = 0; x < OLED_W; x++) {
      const byte = pixels[page * OLED_W + x] ?? 0
      if (!byte) continue
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (1 << bit)) parts.push(`M${x} ${page * 8 + bit}h1v1h-1z`)
      }
    }
  }
  return parts.join('')
}

/** 0.96" SSD1306 OLED: 128×64 bitmap from `peripheral.data.pixels` drawn at 1.5× (192×96 px). */
const OledRenderer = defineRenderer('OledRenderer', function OledRenderer({ comp, def, peripheral, selected, ghost, damaged }) {
  const vcc = pinPoint(def, 'vcc')
  const left = vcc.x - PITCH / 2 - 2
  const screenW = OLED_W * OLED_SCALE
  const screenH = OLED_H * OLED_SCALE
  const pcbW = screenW + 16
  const pcbBottom = -6
  const screenY = pcbBottom - 16 - screenH
  const pcbTop = screenY - 8
  const screenX = left + 8
  const pixels = damaged ? null : peripheral?.data?.pixels
  const path = useMemo(() => oledPixelPath(pixels), [pixels])
  const addr = comp?.props?.addr ?? def?.props?.addr?.default ?? 0x3c
  const box = { x: left, y: pcbTop, width: pcbW, height: PITCH / 2 - pcbTop }
  return (
    <PartFrame comp={comp} def={def} selected={selected} ghost={ghost} damaged={damaged} box={box} ariaLabel={`OLED display 128×64${path ? '' : ' (blank)'}`}>
      {['vcc', 'gnd', 'scl', 'sda'].map((id) => (
        <Lead key={id} from={pinPoint(def, id)} to={{ x: pinPoint(def, id).x, y: pcbBottom }} />
      ))}
      <rect x={left} y={pcbTop} width={pcbW} height={pcbBottom - pcbTop} rx={4} fill="#1E40AF" stroke="#1E3A8A" />
      <rect x={screenX} y={screenY} width={screenW} height={screenH} fill="#0B1020" stroke="#0F172A" data-oled-screen />
      {path ? (
        <g transform={`translate(${screenX} ${screenY}) scale(${OLED_SCALE})`}>
          <path d={path} fill="#E0F2FE" data-oled-pixels shapeRendering="crispEdges" />
        </g>
      ) : null}
      <text x={left + pcbW - 6} y={pcbBottom - 6} textAnchor="end" fontSize={7} fill="#BFDBFE" className={TEXT_CLASS} aria-hidden="true">
        OLED 128×64 · 0x{Number(addr).toString(16).toUpperCase()}
      </text>
      <PinLabels def={def} dy={13} fill={INK.muted} labels={{ vcc: 'VCC', gnd: 'GND', scl: 'SCL', sda: 'SDA' }} />
      <PinDots def={def} />
    </PartFrame>
  )
})

export { Lcd16x2Renderer, OledRenderer }
