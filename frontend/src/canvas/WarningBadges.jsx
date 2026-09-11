import React, { useMemo, useState } from 'react'
import { PITCH, terminalPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'

const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif'
const BADGE_R = 9
/** Badges that land on the same spot are fanned out by this many px. */
const STACK_DX = 20
const POPUP_WIDTH = 236
const LINE_HEIGHT = 13
const MAX_CHARS = 38

const TONES = {
  error: { fill: '#E11D48', ring: '#FECDD3', text: '#FFFFFF' },
  warning: { fill: '#D97706', ring: '#FDE68A', text: '#FFFFFF' },
  info: { fill: '#0284C7', ring: '#BAE6FD', text: '#FFFFFF' },
}

/** Greedy word wrap to `max` characters per line. */
export function wrapText(text, max = MAX_CHARS) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    if (!line) line = word
    else if (line.length + 1 + word.length <= max) line += ` ${word}`
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Pin positions of the MCU component, memo-free helper used by {@link warningAnchors}. */
function mcuPinPositions(doc) {
  for (const comp of doc?.components ?? []) {
    if (registry.getDef(comp.type)?.category !== 'mcu') continue
    try {
      return registry.resolvePins(comp, doc).pins
    } catch {
      return null
    }
  }
  return null
}

/**
 * World anchor for each warning: the first component it names, else its first terminal, else the
 * first MCU pin it names. Warnings that resolve to nothing (global power warnings) get no badge.
 *
 * @param {Array} warnings Evaluation warnings (§5.4)
 * @param {object} doc CircuitDoc
 * @returns {{ key: string, x: number, y: number, warning: object }[]}
 */
export function warningAnchors(warnings, doc) {
  const byId = new Map((doc?.components ?? []).map((c) => [c.id, c]))
  let pins
  const out = []
  const used = new Map()

  ;(warnings ?? []).forEach((warning, index) => {
    let pos = null
    let anchorKey = null

    const componentId = warning?.componentIds?.[0]
    if (componentId && byId.has(componentId)) {
      try {
        const b = registry.componentBounds(byId.get(componentId), doc)
        if (b && b.width >= 0) pos = { x: b.x + b.width, y: b.y }
      } catch {
        pos = null
      }
      anchorKey = `c:${componentId}`
    }
    if (!pos && warning?.terminals?.[0]) {
      try {
        pos = terminalPosition(doc, warning.terminals[0], registry)
      } catch {
        pos = null
      }
      anchorKey = `t:${warning.terminals[0]}`
    }
    if (!pos && warning?.pinNames?.[0]) {
      if (pins === undefined) pins = mcuPinPositions(doc)
      const entry = pins?.[warning.pinNames[0]]
      if (entry) pos = { x: entry.x, y: entry.y }
      anchorKey = `p:${warning.pinNames[0]}`
    }
    if (!pos) return

    const seen = used.get(anchorKey) ?? 0
    used.set(anchorKey, seen + 1)
    out.push({
      key: `${warning.code ?? 'warning'}:${anchorKey}:${index}`,
      x: pos.x + seen * STACK_DX,
      y: pos.y - PITCH * 0.5,
      warning,
    })
  })

  return out
}

/** One badge plus its hover card (the card is never exported to PNG). */
const WarningBadge = React.memo(function WarningBadge({ anchor, scale, open, onOpen, onClose }) {
  const { warning } = anchor
  const tone = TONES[warning.severity] ?? TONES.warning
  const messageLines = wrapText(warning.message)
  const hintLines = warning.hint ? wrapText(warning.hint) : []
  const bodyHeight = 10 + messageLines.length * LINE_HEIGHT + (hintLines.length ? 6 + hintLines.length * LINE_HEIGHT : 0) + 8
  return (
    <g
      data-warning-badge={warning.code}
      transform={`translate(${anchor.x} ${anchor.y}) scale(${scale})`}
      onPointerEnter={onOpen}
      onPointerLeave={onClose}
      style={{ cursor: 'help' }}
    >
      <circle className="vq-badge-pulse" r={BADGE_R + 3} fill={tone.ring} opacity={0.55} />
      <circle r={BADGE_R} fill={tone.fill} stroke="#FFFFFF" strokeWidth={1.5} />
      <text
        y={3.5}
        textAnchor="middle"
        fontFamily={FONT}
        fontSize={12}
        fontWeight={700}
        fill={tone.text}
        style={{ pointerEvents: 'none' }}
      >
        !
      </text>
      <title>{warning.hint ? `${warning.message} — ${warning.hint}` : warning.message}</title>
      {open && (
        <g data-export-hide transform={`translate(${BADGE_R + 6} ${-bodyHeight / 2})`} style={{ pointerEvents: 'none' }}>
          <rect
            width={POPUP_WIDTH}
            height={bodyHeight}
            rx={7}
            fill="#0F172A"
            fillOpacity={0.96}
            stroke={tone.fill}
            strokeWidth={1}
          />
          <text fontFamily={FONT} fontSize={11} fill="#F8FAFC">
            {messageLines.map((line, i) => (
              <tspan key={i} x={10} y={18 + i * LINE_HEIGHT}>
                {line}
              </tspan>
            ))}
          </text>
          {hintLines.length > 0 && (
            <text fontFamily={FONT} fontSize={11} fill="#94A3B8">
              {hintLines.map((line, i) => (
                <tspan key={i} x={10} y={24 + (messageLines.length + i) * LINE_HEIGHT}>
                  {line}
                </tspan>
              ))}
            </text>
          )}
        </g>
      )}
    </g>
  )
})

/**
 * Rose / amber badges for every warning of the current evaluation, counter-scaled so they stay
 * readable at any zoom. Hovering one shows the warning message and its fix.
 */
export const WarningBadges = React.memo(function WarningBadges({ warnings, doc, zoom = 1 }) {
  const [openKey, setOpenKey] = useState(null)
  const anchors = useMemo(() => warningAnchors(warnings, doc), [warnings, doc])
  if (anchors.length === 0) return null
  // Counter-scale so badges stay legible, but never blow the hover card past a phone viewport.
  const scale = 1 / Math.min(Math.max(zoom, 0.5), 2)
  return (
    <g data-layer="warnings">
      {anchors.map((anchor) => (
        <WarningBadge
          key={anchor.key}
          anchor={anchor}
          scale={scale}
          open={openKey === anchor.key}
          onOpen={() => setOpenKey(anchor.key)}
          onClose={() => setOpenKey((k) => (k === anchor.key ? null : k))}
        />
      ))}
    </g>
  )
})

export default WarningBadges
