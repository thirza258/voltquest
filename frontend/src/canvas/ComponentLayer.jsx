import React, { useCallback, useMemo } from 'react'
import { PITCH, holeWorldPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'
import { getBoard } from '../engine/boards/index.js'
import { RENDERERS } from './renderers/index.js'
import { GenericPartRenderer } from './GenericPartRenderer.jsx'
import { componentOrigin, localBodyBox } from './geometry.js'

const PIN_HIT_RADIUS = PITCH * 0.3

/** Shallow one-level object equality (used to keep memoised items stable across sim snapshots). */
function shallowEqual(a, b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) if (a[k] !== b[k]) return false
  return true
}

function itemPropsEqual(prev, next) {
  for (const k of Object.keys(next)) {
    if (k === 'state' || k === 'control' || k === 'peripheral' || k === 'burntPins' || k === 'pins') {
      if (!shallowEqual(prev[k], next[k])) return false
    } else if (prev[k] !== next[k]) return false
  }
  return Object.keys(prev).length === Object.keys(next).length
}

/** Resolve the renderer for a component type (§10: RENDERERS[type] or the generic fallback). */
export function rendererFor(type) {
  return RENDERERS[type] ?? GenericPartRenderer
}

/**
 * Mount point of one component: `<g transform="translate(Ox,Oy) rotate(rot)">` (§4.2) holding the
 * renderer, invisible pin hit pads (wire starts) and the selection outline.
 */
export const ComponentItem = React.memo(function ComponentItem({
  comp,
  def,
  origin,
  pins,
  Renderer,
  state,
  peripheral,
  control,
  running,
  powered,
  selected,
  damaged,
  burntPins,
  board,
  tone,
  onControl,
  interactive,
  dimmed,
  movable,
}) {
  const handleControl = useCallback(
    (a, b) => {
      if (!onControl) return
      // Renderers may call onControl(patch) or onControl(componentId, patch); accept both.
      if (typeof a === 'string' && b && typeof b === 'object') onControl(a, b)
      else if (a && typeof a === 'object') onControl(comp.id, a)
    },
    [onControl, comp.id],
  )
  const box = localBodyBox(def)
  const rotation = comp.rotation ?? 0
  return (
    <g
      data-component-id={comp.id}
      data-component-type={comp.type}
      transform={`translate(${origin.x} ${origin.y}) rotate(${rotation})`}
      opacity={dimmed ? 0.3 : 1}
      style={{ cursor: movable ? 'move' : 'default' }}
    >
      <Renderer
        comp={comp}
        def={def}
        state={state}
        peripheral={peripheral}
        control={control}
        running={running}
        powered={powered}
        selected={selected}
        ghost={false}
        damaged={damaged}
        burntPins={burntPins}
        board={board}
        tone={tone}
        onControl={handleControl}
        interactive={interactive}
      />
      {selected && (
        <rect
          data-selection-outline
          data-export-hide
          x={box.x - 2}
          y={box.y - 2}
          width={box.width + 4}
          height={box.height + 4}
          rx={5}
          fill="none"
          stroke="#14B8A6"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <g data-pin-pads data-export-hide fill="none" stroke="none">
        {(def?.footprint?.pins ?? []).map((pin) => {
          const terminal = pins?.[pin.id]?.terminal ?? `${comp.id}:${pin.id}`
          return (
            <circle
              key={pin.id}
              className="vq-pin"
              data-terminal={terminal}
              data-pin-id={pin.id}
              data-pin-label={pin.label ?? pin.id}
              cx={pin.dx * PITCH}
              cy={pin.dy * PITCH}
              r={PIN_HIT_RADIUS}
              style={{ pointerEvents: 'all' }}
            />
          )
        })}
      </g>
    </g>
  )
}, itemPropsEqual)

/** Tone frequency for a component: `simState.tones[binding.pins.signal] ?? 0` (§10). */
export function toneFor(simState, componentId) {
  const binding = simState?.compiled?.peripheralMap?.find((b) => b.componentId === componentId)
  const pin = binding?.pins?.signal
  if (!pin) return 0
  return simState?.tones?.[pin] ?? 0
}

/** Per-component placement data derived from the document (memoised by the layer). */
export function placeComponents(doc) {
  const out = []
  for (const comp of doc?.components ?? []) {
    const def = registry.getDef(comp.type)
    if (!def) continue
    const origin = componentOrigin(comp, doc, holeWorldPosition)
    if (!origin) continue
    let pins = {}
    try {
      pins = registry.resolvePins(comp, doc)?.pins ?? {}
    } catch {
      pins = {}
    }
    out.push({ comp, def, origin, pins })
  }
  return out
}

/**
 * All components of the document. Receives the whole SimState but hands each item only its own
 * slices so memoised items skip renders when nothing about them changed.
 */
export const ComponentLayer = React.memo(function ComponentLayer({ doc, simState, selectedIds, readOnly, onControl, dragId }) {
  const placed = useMemo(() => placeComponents(doc), [doc])
  const mcuBoard = useMemo(() => (doc?.mcu ? getBoard(doc.mcu) : null), [doc?.mcu])
  const selected = useMemo(() => new Set(selectedIds ?? []), [selectedIds])
  const running = simState?.status === 'running'
  const powered = simState?.powered !== false
  const evaluation = simState?.evaluation
  return (
    <g data-layer="components">
      {placed.map(({ comp, def, origin, pins }) => {
        const isMcu = def.category === 'mcu'
        return (
          <ComponentItem
            key={comp.id}
            comp={comp}
            def={def}
            origin={origin}
            pins={pins}
            Renderer={rendererFor(comp.type)}
            state={evaluation?.componentStates?.[comp.id]}
            peripheral={simState?.peripherals?.[comp.id]}
            control={simState?.controls?.[comp.id]}
            running={running}
            powered={powered}
            selected={selected.has(comp.id)}
            damaged={!!simState?.damaged?.[comp.id]}
            burntPins={isMcu ? simState?.burntPins : undefined}
            board={isMcu ? getBoard(comp.type) : mcuBoard}
            tone={toneFor(simState, comp.id)}
            onControl={onControl}
            interactive={!!onControl}
            dimmed={dragId === comp.id}
            movable={!readOnly}
          />
        )
      })}
    </g>
  )
})

/**
 * Live snap preview while a component is dragged: the renderer at the candidate placement with a
 * brand (valid) or rose (invalid) outline. Falls back to the raw pointer position when no hole is near.
 */
export const DragPreview = React.memo(function DragPreview({ drag, doc, simState }) {
  if (!drag) return null
  const { comp, def, candidate, valid, rawOrigin } = drag
  const origin = (candidate && componentOrigin(candidate, doc, holeWorldPosition)) ?? rawOrigin
  if (!origin) return null
  const Renderer = rendererFor(comp.type)
  const box = localBodyBox(def)
  const rotation = (candidate ?? comp).rotation ?? 0
  const color = valid ? '#0D9488' : '#E11D48'
  return (
    <g
      data-drag-preview={valid ? 'valid' : 'invalid'}
      data-export-hide
      transform={`translate(${origin.x} ${origin.y}) rotate(${rotation})`}
      opacity={0.9}
      style={{ pointerEvents: 'none' }}
    >
      <Renderer
        comp={candidate ?? comp}
        def={def}
        state={undefined}
        peripheral={undefined}
        control={simState?.controls?.[comp.id]}
        running={false}
        powered={false}
        selected={false}
        ghost={false}
        damaged={false}
        burntPins={undefined}
        board={def.category === 'mcu' ? getBoard(comp.type) : null}
        tone={0}
        onControl={undefined}
        interactive={false}
      />
      <rect
        x={box.x - 3}
        y={box.y - 3}
        width={box.width + 6}
        height={box.height + 6}
        rx={6}
        fill={valid ? 'rgba(13,148,136,0.08)' : 'rgba(225,29,72,0.10)'}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={valid ? undefined : '5 4'}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  )
})

export default ComponentLayer
