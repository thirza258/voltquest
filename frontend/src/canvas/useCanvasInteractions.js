import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PITCH, findBreadboard, holeAtWorld, holeWorldPosition, stripOf, terminalPosition } from '../engine/components/breadboard.js'
import * as registry from '../engine/components/registry.js'
import { WIRE_COLORS } from '../engine/components/registry.js'
import { describeWireColor } from './wirePath.js'
import {
  DND_MIME,
  DRAG_THRESHOLD,
  componentOrigin,
  describeStrip,
  formatAmps,
  formatVolts,
  formatWatts,
  nearestValidCandidate,
  nearestValidOrigin,
  netInfoForTerminal,
  netLine,
  parseDropPayload,
  placementOf,
  samePlacement,
} from './geometry.js'

/** Pixel deltas per wheel notch when the browser reports lines / pages instead of pixels. */
const LINE_HEIGHT_PX = 16
const PAGE_HEIGHT_PX = 400
/** Wheel-to-zoom sensitivity (ctrl/cmd + wheel). */
const ZOOM_SENSITIVITY = 0.0018

/** Elements that swallow canvas hotkeys because the user is typing in them. */
function isTextEntry(el) {
  if (!el || el.nodeType !== 1) return false
  const tag = el.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  const role = el.getAttribute?.('role')
  return role === 'textbox' || role === 'combobox'
}

/** Topmost element under the pointer (pointer capture makes `event.target` unreliable mid-gesture). */
function elementAt(event) {
  try {
    const el = document.elementFromPoint?.(event.clientX, event.clientY)
    if (el) return el
  } catch {
    // jsdom and some engines do not implement elementFromPoint — fall back to the event target
  }
  return event.target ?? null
}

function safeTerminalPosition(doc, terminal) {
  try {
    return terminalPosition(doc, terminal, registry)
  } catch {
    return null
  }
}

/** Strip id (`'row12:upper'`) of a terminal that refers to a breadboard hole, else null. */
function stripOfTerminal(doc, terminal) {
  const idx = terminal?.indexOf?.(':') ?? -1
  if (idx <= 0) return null
  const boardId = terminal.slice(0, idx)
  const board = findBreadboard(doc, boardId)
  if (!board) return null
  const strip = stripOf(board.type, terminal.slice(idx + 1))
  return strip ? { board, strip } : null
}

/** Tooltip descriptor for a breadboard hole (§10: strip name + net label and voltage). */
export function holeTooltip(doc, simState, boardId, hole) {
  const terminal = `${boardId}:${hole.name}`
  const info = netInfoForTerminal(simState, terminal)
  const line = netLine(info)
  return {
    kind: 'hole',
    title: describeStrip(hole.strip),
    subtitle: `${boardId} · ${hole.name}`,
    lines: line ? [line] : [],
  }
}

/** Tooltip descriptor for a component pin: pin label plus its net. */
export function pinTooltip(doc, simState, comp, pinId, terminal) {
  const def = registry.getDef(comp?.type)
  const pin = def?.footprint?.pins?.find((p) => p.id === pinId)
  const info = netInfoForTerminal(simState, terminal)
  const line = netLine(info)
  return {
    kind: 'pin',
    title: `${def?.name ?? comp?.type ?? 'Part'} · ${pin?.label ?? pinId}`,
    subtitle: terminal,
    lines: line ? [line] : [],
  }
}

/** Tooltip descriptor for a component: live V / I / P from the evaluation. */
export function componentTooltip(doc, simState, comp) {
  const def = registry.getDef(comp?.type)
  const state = simState?.evaluation?.componentStates?.[comp.id]
  const powered = simState?.powered !== false
  const lines = []
  if (simState?.evaluation) {
    if (!powered) {
      lines.push({ label: 'V', value: '—' }, { label: 'I', value: '—' })
    } else if (state) {
      if (Number.isFinite(state.voltage)) lines.push({ label: 'V', value: formatVolts(state.voltage) })
      if (Number.isFinite(state.current)) lines.push({ label: 'I', value: formatAmps(state.current) })
      if (Number.isFinite(state.power)) lines.push({ label: 'P', value: formatWatts(state.power) })
    }
  }
  if (state?.state && state.state !== 'ok') lines.push({ label: 'State', value: state.state })
  let subtitle
  try {
    subtitle = registry.describeValue(comp.type, comp.props ?? {})
  } catch {
    subtitle = undefined
  }
  return { kind: 'component', title: def?.name ?? comp.type, subtitle, lines }
}

/** Tooltip descriptor for a wire: colour name plus the net it joins. */
export function wireTooltip(doc, simState, wire) {
  const info = netInfoForTerminal(simState, wire.from)
  const line = netLine(info) ?? netLine(netInfoForTerminal(simState, wire.to))
  return {
    kind: 'wire',
    title: describeWireColor(wire.color),
    subtitle: `${wire.from} ↔ ${wire.to}`,
    lines: line ? [line] : [],
  }
}

/** Schedule `fn` at most once per animation frame with the latest payload. */
function useRafSchedule(fn) {
  const handle = useRef(0)
  const payload = useRef(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const hasRaf = typeof requestAnimationFrame === 'function'

  const cancel = useCallback(() => {
    if (!handle.current) return
    if (hasRaf) cancelAnimationFrame(handle.current)
    else clearTimeout(handle.current)
    handle.current = 0
  }, [hasRaf])

  const schedule = useCallback(
    (value) => {
      payload.current = value
      if (handle.current) return
      const run = () => {
        handle.current = 0
        const next = payload.current
        payload.current = null
        fnRef.current(next)
      }
      handle.current = hasRaf ? requestAnimationFrame(run) : setTimeout(run, 16)
    },
    [hasRaf],
  )

  useEffect(() => cancel, [cancel])
  return [schedule, cancel]
}

/**
 * All pointer, drag-and-drop and keyboard behaviour of the breadboard canvas.
 *
 * Holes are hit-tested mathematically (`holeAtWorld`) — no per-hole handlers — so a full board stays
 * at 60 FPS. Placements are validated ONLY by building a candidate Component and calling
 * `registry.resolvePins(candidate, doc).valid` (CONTRACTS §4.2).
 *
 * @returns {{ hover, drag, wireDraft, stripHover, cursor, handlers }}
 */
export function useCanvasInteractions({
  doc,
  readOnly = false,
  tool = 'select',
  wireColor = 'red',
  selectedIds,
  simState,
  rootRef,
  svgRef,
  viewport,
  onSelect,
  onAddComponent,
  onMoveComponent,
  onRotateComponent,
  onRemove,
  onAddWire,
  onRemoveWire,
  onWireColorChange,
  onDropRejected,
  onEspNeedsDualBoard,
  onToolChange,
}) {
  const [hover, setHover] = useState(null)
  const [drag, setDrag] = useState(null)
  const [wireDraft, setWireDraft] = useState(null)
  const [dropHole, setDropHole] = useState(null)
  const [panning, setPanning] = useState(false)

  const ctx = useRef({})
  ctx.current = {
    doc,
    readOnly,
    tool,
    wireColor,
    selectedIds: selectedIds ?? [],
    simState,
    viewport,
    onSelect,
    onAddComponent,
    onMoveComponent,
    onRotateComponent,
    onRemove,
    onAddWire,
    onRemoveWire,
    onWireColorChange,
    onDropRejected,
    onEspNeedsDualBoard,
    onToolChange,
  }

  const gesture = useRef(null)
  const spaceDown = useRef(false)
  /** Last hole name used for a move candidate — lets an unchanged pointer skip the anchor search. */
  const lastAnchorKey = useRef(null)

  /** Pointer event → svg-local point. */
  const toScreen = useCallback(
    (event) => {
      const el = svgRef?.current ?? rootRef?.current
      const rect = el?.getBoundingClientRect?.()
      return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
    },
    [rootRef, svgRef],
  )

  /** Terminal under the pointer: a component pin pad first, then the nearest breadboard hole. */
  const terminalAt = useCallback((event, world) => {
    const { doc: d } = ctx.current
    const el = elementAt(event)
    const pinEl = el?.closest?.('[data-terminal]')
    if (pinEl) {
      const terminal = pinEl.getAttribute('data-terminal')
      const pos = safeTerminalPosition(d, terminal)
      if (terminal && pos) {
        return {
          terminal,
          pos,
          pinId: pinEl.getAttribute('data-pin-id'),
          componentId: pinEl.closest('[data-component-id]')?.getAttribute('data-component-id') ?? null,
        }
      }
    }
    const hit = holeAtWorld(d, world.x, world.y)
    if (!hit) return null
    const pos = holeWorldPosition(d, hit.board, hit.hole.name)
    if (!pos) return null
    return { terminal: `${hit.board}:${hit.hole.name}`, pos, hole: hit.hole, boardId: hit.board }
  }, [])

  /** What the pointer is over: wire → pin → component → hole → empty space. */
  const hitTest = useCallback(
    (event, world) => {
      const { doc: d } = ctx.current
      const el = elementAt(event)
      const wireEl = el?.closest?.('[data-wire-id]')
      if (wireEl) {
        const id = wireEl.getAttribute('data-wire-id')
        const wire = (d?.wires ?? []).find((w) => w.id === id)
        if (wire) return { kind: 'wire', wire }
      }
      const compEl = el?.closest?.('[data-component-id]')
      const pinEl = el?.closest?.('[data-terminal]')
      if (compEl) {
        const id = compEl.getAttribute('data-component-id')
        const comp = (d?.components ?? []).find((c) => c.id === id)
        if (comp && pinEl) {
          return {
            kind: 'pin',
            comp,
            terminal: pinEl.getAttribute('data-terminal'),
            pinId: pinEl.getAttribute('data-pin-id'),
          }
        }
        if (comp) return { kind: 'component', comp }
      }
      const hit = holeAtWorld(d, world.x, world.y)
      if (hit) return { kind: 'hole', boardId: hit.board, hole: hit.hole }
      return { kind: 'empty' }
    },
    [],
  )

  // ---------------------------------------------------------------- hover / tooltip

  const [scheduleHover, cancelHover] = useRafSchedule((payload) => {
    if (!payload) return
    const { event, screen } = payload
    const { doc: d, simState: sim } = ctx.current
    const world = ctx.current.viewport.toWorld(screen)
    const hit = hitTest(event, world)
    let next = null
    if (hit.kind === 'wire') next = { ...wireTooltip(d, sim, hit.wire), ...screen }
    else if (hit.kind === 'pin') next = { ...pinTooltip(d, sim, hit.comp, hit.pinId, hit.terminal), ...screen, strip: stripOfTerminal(d, hit.terminal) }
    else if (hit.kind === 'component') next = { ...componentTooltip(d, sim, hit.comp), ...screen }
    else if (hit.kind === 'hole') {
      next = {
        ...holeTooltip(d, sim, hit.boardId, hit.hole),
        ...screen,
        strip: { board: findBreadboard(d, hit.boardId), strip: hit.hole.strip },
      }
    }
    setHover(next)
  })

  const clearHover = useCallback(() => {
    cancelHover()
    setHover(null)
  }, [cancelHover])

  // ---------------------------------------------------------------- move drag

  const [scheduleDrag] = useRafSchedule((world) => {
    if (!world) return
    const g = gesture.current
    if (!g || g.type !== 'move') return
    const { doc: d } = ctx.current
    const origin = { x: world.x - g.grab.dx, y: world.y - g.grab.dy }
    // Skip the anchor search while the pointer stays inside the same half-pitch cell.
    const anchorKey = `${Math.round(origin.x / (PITCH / 2))}:${Math.round(origin.y / (PITCH / 2))}:${g.comp.rotation ?? 0}`
    if (anchorKey === lastAnchorKey.current) return
    lastAnchorKey.current = anchorKey
    const result = nearestValidOrigin({ ...g.comp }, g.def, origin, d, registry)
    // The gesture ref carries the result so pointer-up never reads a frame-behind render state.
    g.result = { ...result, rawOrigin: origin }
    setDrag({ comp: g.comp, def: g.def, ...g.result })
  })

  // ---------------------------------------------------------------- wire draft

  const [scheduleWire] = useRafSchedule((payload) => {
    if (!payload) return
    const g = gesture.current
    if (!g || g.type !== 'wire') return
    const { event, world } = payload
    const target = terminalAt(event, world)
    const valid = target && target.terminal !== g.from
    setWireDraft({
      from: g.from,
      fromPos: g.fromPos,
      cursor: world,
      color: g.color,
      target: valid ? target.terminal : null,
      targetPos: valid ? target.pos : null,
    })
  })

  const cancelWire = useCallback(() => {
    if (gesture.current?.type === 'wire') gesture.current = null
    setWireDraft(null)
  }, [])

  /** Begin a rubber-band wire at `terminal`. */
  const startWire = useCallback((event, terminal, pos, world) => {
    const { wireColor: color } = ctx.current
    gesture.current = { type: 'wire', pointerId: event.pointerId, from: terminal, fromPos: pos, color }
    setWireDraft({ from: terminal, fromPos: pos, cursor: world, color, target: null, targetPos: null })
  }, [])

  // ---------------------------------------------------------------- pointer handlers

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== 0 && event.button !== 1) return
      const { doc: d, readOnly: ro, tool: t } = ctx.current
      const screen = toScreen(event)
      const world = ctx.current.viewport.toWorld(screen)
      const hit = hitTest(event, world)
      rootRef?.current?.focus?.({ preventScroll: true })
      clearHover()

      const wantsPan = event.button === 1 || spaceDown.current || hit.kind === 'empty'
      if (wantsPan) {
        gesture.current = { type: 'pan', pointerId: event.pointerId, last: screen, start: screen, moved: false, hit }
        setPanning(true)
        try {
          rootRef?.current?.setPointerCapture?.(event.pointerId)
        } catch {
          // pointer capture is best-effort (jsdom / older engines)
        }
        event.preventDefault()
        return
      }

      const canEdit = !ro
      const wireStart = canEdit && (hit.kind === 'hole' || hit.kind === 'pin')

      if (t === 'wire' && wireStart) {
        const target = terminalAt(event, world)
        if (target) {
          startWire(event, target.terminal, target.pos, world)
          try {
            rootRef?.current?.setPointerCapture?.(event.pointerId)
          } catch {
            // best effort
          }
          event.preventDefault()
          return
        }
      }

      // Select mode: a press that may become a move (component) or a wire (hole).
      const comp = hit.comp ?? null
      gesture.current = {
        type: 'press',
        pointerId: event.pointerId,
        start: screen,
        last: screen,
        moved: false,
        hit,
        comp,
        shiftKey: event.shiftKey,
        promote: canEdit ? (hit.kind === 'hole' ? 'wire' : comp ? 'move' : null) : null,
      }
      if (comp) {
        const def = registry.getDef(comp.type)
        const origin = componentOrigin(comp, d, holeWorldPosition)
        gesture.current.def = def
        gesture.current.grab = origin ? { dx: world.x - origin.x, dy: world.y - origin.y } : { dx: 0, dy: 0 }
        if (!def || !origin) gesture.current.promote = null
      }
      try {
        rootRef?.current?.setPointerCapture?.(event.pointerId)
      } catch {
        // best effort
      }
    },
    [clearHover, hitTest, rootRef, startWire, terminalAt, toScreen],
  )

  const onPointerMove = useCallback(
    (event) => {
      const screen = toScreen(event)
      const g = gesture.current
      if (!g) {
        scheduleHover({ event, screen })
        return
      }
      const world = ctx.current.viewport.toWorld(screen)

      if (g.type === 'pan') {
        const dx = screen.x - g.last.x
        const dy = screen.y - g.last.y
        g.last = screen
        if (Math.abs(screen.x - g.start.x) + Math.abs(screen.y - g.start.y) > DRAG_THRESHOLD) g.moved = true
        if (dx || dy) ctx.current.viewport.panBy(dx, dy)
        return
      }

      if (g.type === 'press') {
        const far = Math.hypot(screen.x - g.start.x, screen.y - g.start.y) > DRAG_THRESHOLD
        if (!far) return
        g.moved = true
        if (g.promote === 'move' && g.comp) {
          gesture.current = { ...g, type: 'move' }
          lastAnchorKey.current = null
          const { selectedIds: sel, onSelect: select } = ctx.current
          if (!sel.includes(g.comp.id)) select?.([g.comp.id])
          scheduleDrag(world)
          return
        }
        if (g.promote === 'wire') {
          const target = terminalAt(event, world)
          if (target) {
            startWire(event, target.terminal, target.pos, world)
            return
          }
        }
        // nothing to promote to — treat the rest of this gesture as a pan
        gesture.current = { ...g, type: 'pan', last: screen }
        setPanning(true)
        return
      }

      if (g.type === 'move') {
        scheduleDrag(world)
        return
      }

      if (g.type === 'wire') {
        scheduleWire({ event, world })
      }
    },
    [scheduleDrag, scheduleHover, scheduleWire, startWire, terminalAt, toScreen],
  )

  const finishGesture = useCallback(
    (event, cancelled) => {
      const g = gesture.current
      gesture.current = null
      setPanning(false)
      try {
        rootRef?.current?.releasePointerCapture?.(event.pointerId)
      } catch {
        // best effort
      }
      if (!g) return
      const c = ctx.current

      if (g.type === 'pan') {
        if (!g.moved && !cancelled && g.hit?.kind === 'empty') c.onSelect?.([])
        return
      }

      if (g.type === 'press') {
        if (cancelled) return
        const { hit } = g
        if (hit.kind === 'wire') {
          c.onSelect?.(toggleSelection(c.selectedIds, hit.wire.id, g.shiftKey))
          return
        }
        if (hit.kind === 'component' || hit.kind === 'pin') {
          c.onSelect?.(toggleSelection(c.selectedIds, hit.comp.id, g.shiftKey))
          return
        }
        c.onSelect?.([])
        return
      }

      if (g.type === 'move') {
        setDrag(null)
        lastAnchorKey.current = null
        if (cancelled) return
        // A flick that starts and ends inside one frame never reaches the rAF callback — resolve the
        // candidate here so the drop always answers with a move or an explicit rejection.
        let result = g.result
        if (!result) {
          const world = ctx.current.viewport.toWorld(toScreen(event))
          const origin = { x: world.x - g.grab.dx, y: world.y - g.grab.dy }
          result = nearestValidOrigin({ ...g.comp }, g.def, origin, ctx.current.doc, registry)
        }
        if (!result) return
        if (!result.valid || !result.candidate) {
          c.onDropRejected?.(result.reason ?? 'invalid_placement')
          return
        }
        const next = placementOf(result.candidate)
        if (!samePlacement(next, placementOf(g.comp))) c.onMoveComponent?.(g.comp.id, next)
        return
      }

      if (g.type === 'wire') {
        setWireDraft(null)
        if (cancelled) return
        const world = ctx.current.viewport.toWorld(toScreen(event))
        const target = terminalAt(event, world)
        if (!target || target.terminal === g.from) return
        c.onAddWire?.(g.from, target.terminal, g.color)
      }
    },
    [rootRef, terminalAt, toScreen],
  )

  const onPointerUp = useCallback((event) => finishGesture(event, false), [finishGesture])
  const onPointerCancel = useCallback((event) => finishGesture(event, true), [finishGesture])
  const onPointerLeave = useCallback(() => {
    if (!gesture.current) clearHover()
  }, [clearHover])

  // ---------------------------------------------------------------- wheel (native, non-passive)

  useEffect(() => {
    const el = rootRef?.current
    if (!el) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const scale = event.deltaMode === 1 ? LINE_HEIGHT_PX : event.deltaMode === 2 ? PAGE_HEIGHT_PX : 1
      const { viewport: vp } = ctx.current
      if (event.ctrlKey || event.metaKey) {
        const rect = (svgRef?.current ?? el).getBoundingClientRect?.()
        const point = { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
        vp.zoomBy(Math.exp(-event.deltaY * scale * ZOOM_SENSITIVITY), point)
      } else {
        vp.panBy(-event.deltaX * scale, -event.deltaY * scale)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [rootRef, svgRef])

  // ---------------------------------------------------------------- external drops

  const hasPayload = useCallback((event) => {
    const types = event.dataTransfer?.types
    if (!types) return false
    return Array.from(types).includes(DND_MIME)
  }, [])

  const onDragOver = useCallback(
    (event) => {
      if (!hasPayload(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = ctx.current.readOnly ? 'none' : 'copy'
      const world = ctx.current.viewport.toWorld(toScreen(event))
      const hit = holeAtWorld(ctx.current.doc, world.x, world.y, PITCH * 0.75)
      setDropHole((prev) => {
        const next = hit ? { boardId: hit.board, strip: hit.hole.strip } : null
        if (prev?.boardId === next?.boardId && prev?.strip === next?.strip) return prev
        return next
      })
    },
    [hasPayload, toScreen],
  )

  const onDragLeave = useCallback(() => setDropHole(null), [])

  const onDrop = useCallback(
    (event) => {
      if (!hasPayload(event)) return
      event.preventDefault()
      setDropHole(null)
      const c = ctx.current
      if (c.readOnly) {
        c.onDropRejected?.('readOnly')
        return
      }
      const raw = event.dataTransfer?.getData(DND_MIME) || event.dataTransfer?.getData('text/plain')
      const payload = parseDropPayload(raw)
      if (!payload) {
        c.onDropRejected?.('invalid_payload')
        return
      }
      const def = registry.getDef(payload.type)
      if (!def) {
        c.onDropRejected?.('unknown_type')
        return
      }
      const world = c.viewport.toWorld(toScreen(event))
      const base = {
        id: '__drop_candidate__',
        type: payload.type,
        props: { ...registry.propDefaults(def), ...(payload.props ?? {}) },
        rotation: 0,
      }
      const { candidate, valid, reason } = nearestValidCandidate(base, def, world, c.doc, registry)
      if (!valid || !candidate) {
        c.onDropRejected?.(reason ?? 'invalid_placement')
        return
      }
      c.onAddComponent?.(payload.type, placementOf(candidate), payload.props)
      if ((payload.type === 'esp32' || payload.type === 'esp32s3') && c.doc?.boardMode !== 'dual') {
        c.onEspNeedsDualBoard?.()
      }
    },
    [hasPayload, toScreen],
  )

  // ---------------------------------------------------------------- keyboard

  const inScope = useCallback(
    (event) => {
      const root = rootRef?.current
      if (!root) return false
      if (isTextEntry(event.target)) return false
      const active = typeof document !== 'undefined' ? document.activeElement : null
      if (!active || active === document.body || active === document.documentElement) return true
      if (!root.contains(active)) return false
      return !isTextEntry(active)
    },
    [rootRef],
  )

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (!inScope(event)) return
      const c = ctx.current
      const key = event.key

      if (key === ' ') {
        spaceDown.current = true
        event.preventDefault()
        return
      }
      if (key === 'Escape') {
        if (gesture.current?.type === 'wire') cancelWire()
        else c.onSelect?.([])
        return
      }
      if (key === 'v' || key === 'V') {
        c.onToolChange?.('select')
        return
      }
      if (key === 'w' || key === 'W') {
        c.onToolChange?.('wire')
        return
      }
      if (key === 'f' || key === 'F') {
        c.viewport.fit()
        return
      }
      if (key === '+' || key === '=') {
        event.preventDefault()
        c.viewport.zoomIn()
        return
      }
      if (key === '-' || key === '_') {
        event.preventDefault()
        c.viewport.zoomOut()
        return
      }
      if (key === '0') {
        event.preventDefault()
        c.viewport.actualSize()
        return
      }
      if (key >= '1' && key <= '5') {
        c.onWireColorChange?.(WIRE_COLORS[Number(key) - 1])
        return
      }
      if (c.readOnly) return
      if (key === 'r' || key === 'R') {
        const wireIds = new Set((c.doc?.wires ?? []).map((w) => w.id))
        for (const id of c.selectedIds) if (!wireIds.has(id)) c.onRotateComponent?.(id)
        return
      }
      if (key === 'Delete' || key === 'Backspace') {
        event.preventDefault()
        const wireIds = new Set((c.doc?.wires ?? []).map((w) => w.id))
        const wires = c.selectedIds.filter((id) => wireIds.has(id))
        const comps = c.selectedIds.filter((id) => !wireIds.has(id))
        for (const id of wires) c.onRemoveWire?.(id)
        if (comps.length > 0) c.onRemove?.(comps)
      }
    }
    const onKeyUp = (event) => {
      if (event.key === ' ') spaceDown.current = false
    }
    const onBlur = () => {
      spaceDown.current = false
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [cancelWire, inScope])

  // ---------------------------------------------------------------- derived

  /** Breadboard strip to light up: the hovered hole, the active wire target or an incoming drop. */
  const stripHover = useMemo(() => {
    if (dropHole) {
      const board = findBreadboard(doc, dropHole.boardId)
      return board ? { board, strip: dropHole.strip } : null
    }
    if (wireDraft?.target) return stripOfTerminal(doc, wireDraft.target)
    if (hover?.strip?.board) return hover.strip
    return null
  }, [doc, dropHole, hover, wireDraft])

  const cursor = panning ? 'grabbing' : tool === 'wire' && !readOnly ? 'crosshair' : 'default'

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onDragOver,
      onDragEnter: onDragOver,
      onDragLeave,
      onDrop,
    }),
    [onDragLeave, onDragOver, onDrop, onPointerCancel, onPointerDown, onPointerLeave, onPointerMove, onPointerUp],
  )

  return { hover, drag, wireDraft, stripHover, cursor, handlers }
}

/** Click selection: shift toggles membership, a plain click replaces the selection. */
export function toggleSelection(selected, id, shiftKey) {
  const list = selected ?? []
  if (!shiftKey) return [id]
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export default useCanvasInteractions
