// CircuitDoc store (CONTRACTS §4.1, §11.2): the single source of truth for the circuit being edited,
// with undo/redo history, MCU swapping (with wire remapping) and breadboard layout changes.
import { create } from 'zustand'
import * as defaultRegistry from '../engine/components/registry.js'
import * as defaultBoards from '../engine/boards/index.js'
import * as defaultBreadboard from '../engine/components/breadboard.js'
import { newId } from '../lib/ids.js'

const HISTORY_LIMIT = 100
const ROTATIONS = [0, 90, 180, 270]
const FALLBACK_BOARD_IDS = ['uno', 'nano', 'esp32', 'esp32s3']

/** A fresh, empty CircuitDoc for the given breadboard layout. */
export function emptyDoc(boardMode = 'half', breadboard = defaultBreadboard) {
  return {
    version: 1,
    boardMode,
    breadboards: layoutFor(boardMode, breadboard),
    mcu: null,
    components: [],
    wires: [],
    meta: {},
  }
}

function layoutFor(boardMode, breadboard) {
  const layout = breadboard?.layoutBreadboards?.(boardMode)
  if (Array.isArray(layout) && layout.length) return layout.map((b) => ({ ...b }))
  const base = { id: 'bb1', type: boardMode === 'full' ? 'full' : 'half', x: 0, y: 0 }
  return boardMode === 'dual' ? [base, { id: 'bb2', type: 'half', x: 0, y: 21 * (breadboard?.PITCH ?? 24) }] : [base]
}

const ownerOf = (terminal) => String(terminal).split(':')[0]
const pinOf = (terminal) => String(terminal).slice(String(terminal).indexOf(':') + 1)
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)))

/**
 * Create a document store. Dependencies default to the real engine modules; tests inject fakes.
 * @param {{ registry?: object, boards?: object, breadboard?: object }} deps
 */
export function createDocumentStore({ registry = defaultRegistry, boards = defaultBoards, breadboard = defaultBreadboard } = {}) {
  const boardIds = Array.isArray(boards?.BOARD_IDS) && boards.BOARD_IDS.length ? boards.BOARD_IDS : FALLBACK_BOARD_IDS

  const isMcuType = (type) => registry.getDef?.(type)?.category === 'mcu' || boardIds.includes(type)
  const findMcu = (doc) => doc.components.find((c) => isMcuType(c.type)) ?? null

  /** Ensure `mcu` mirrors the MCU component and the breadboard layout matches boardMode. */
  function normalizeDoc(input) {
    const doc = { ...emptyDoc(input?.boardMode ?? 'half', breadboard), ...clone(input ?? {}) }
    doc.version = 1
    doc.boardMode = ['half', 'full', 'dual'].includes(doc.boardMode) ? doc.boardMode : 'half'
    if (doc.kind !== 'drone' && (!Array.isArray(doc.breadboards) || !doc.breadboards.length)) doc.breadboards = layoutFor(doc.boardMode, breadboard)
    doc.components = Array.isArray(doc.components) ? doc.components : []
    doc.wires = Array.isArray(doc.wires) ? doc.wires : []
    doc.meta = doc.meta && typeof doc.meta === 'object' ? doc.meta : {}
    const mcu = findMcu(doc)
    doc.mcu = mcu ? mcu.type : null
    return doc
  }

  function pinHoles(comp, doc) {
    try {
      const res = registry.resolvePins?.(comp, doc)
      return Object.values(res?.pins ?? {}).map((p) => p?.hole).filter(Boolean)
    } catch {
      return []
    }
  }

  function isValidPlacement(comp, doc) {
    if (!comp.anchor) return true
    try {
      return Boolean(registry.resolvePins?.(comp, doc)?.valid)
    } catch {
      return false
    }
  }

  /** Wires attached to a component either by id alias or through the holes its pins sit in. */
  function wiresAttached(doc, comp) {
    const holes = new Set(pinHoles(comp, doc))
    return doc.wires.filter((w) => [w.from, w.to].some((t) => ownerOf(t) === comp.id || holes.has(t)))
  }

  function wiresOwnedBy(doc, ids) {
    const set = new Set(ids)
    return doc.wires.filter((w) => set.has(ownerOf(w.from)) || set.has(ownerOf(w.to)))
  }

  function holeExists(doc, terminal) {
    const bb = doc.breadboards.find((b) => b.id === ownerOf(terminal))
    if (!bb) return false
    if (typeof breadboard.holeByName !== 'function') return true
    return Boolean(breadboard.holeByName(bb.type, pinOf(terminal)))
  }

  function isBreadboardTerminal(doc, terminal) {
    return doc.breadboards.some((b) => b.id === ownerOf(terminal)) || /^bb\d+$/.test(ownerOf(terminal))
  }

  /** Map a pin name from one board to another following CONTRACTS §11.2 (same name, 5V↔VIN, A0..A5 → ADC pins, GND family). */
  function remapPinName(pinName, oldBoard, newBoard) {
    const pins = newBoard?.pins ?? []
    if (!pins.length) return null
    if (pins.some((p) => p.name === pinName)) return pinName
    if (pinName === '5V' && pins.some((p) => p.name === 'VIN')) return 'VIN'
    if (pinName === 'VIN' && pins.some((p) => p.name === '5V')) return '5V'
    const analog = /^A([0-5])$/.exec(pinName)
    if (analog) {
      const adc = pins.filter((p) => p.kind !== 'power' && p.kind !== 'ground' && (p.caps ?? []).includes('adc'))
      return adc[Number(analog[1])]?.name ?? null
    }
    const oldPin = oldBoard?.pins?.find((p) => p.name === pinName)
    if (oldPin?.kind === 'ground' || /^GND\d*$/.test(pinName)) return pins.find((p) => p.kind === 'ground')?.name ?? null
    return null
  }

  return create((set, get) => {
    /** Replace the doc, recording the previous one in history. */
    const commit = (nextDoc, extra = {}) => {
      const { doc, past } = get()
      const nextPast = [...past, doc]
      if (nextPast.length > HISTORY_LIMIT) nextPast.splice(0, nextPast.length - HISTORY_LIMIT)
      set({ doc: nextDoc, past: nextPast, future: [], ...extra })
    }
    const pruneSelection = (doc, selectedIds) => {
      const ids = new Set([...doc.components.map((c) => c.id), ...(doc.links ?? doc.wires).map((w) => w.id)])
      return selectedIds.filter((id) => ids.has(id))
    }

    /** Add an MCU: replaces an existing one and remaps its wires. Returns { doc, id, removedWires, remapped }. */
    const placeMcu = (doc, boardId, placement) => {
      const old = findMcu(doc)
      const oldBoard = old ? boards.getBoard?.(old.type) : null
      const newBoard = boards.getBoard?.(boardId)
      const comp = registry.createComponent(boardId, placement)
      const components = doc.components.filter((c) => c !== old).concat(comp)
      const removedWires = []
      const remapped = []
      const wires = []
      for (const w of doc.wires) {
        const next = { ...w }
        let drop = false
        for (const end of ['from', 'to']) {
          if (!old || ownerOf(w[end]) !== old.id) continue
          const fromPin = pinOf(w[end])
          const toPin = remapPinName(fromPin, oldBoard, newBoard)
          if (!toPin) {
            drop = true
            break
          }
          next[end] = `${comp.id}:${toPin}`
          if (toPin !== fromPin) remapped.push({ wireId: w.id, end, fromPin, toPin })
        }
        if (drop) removedWires.push(w.id)
        else wires.push(next)
      }
      return { doc: { ...doc, mcu: boardId, components, wires }, id: comp.id, removedWires, remapped }
    }

    return {
      doc: emptyDoc('half', breadboard),
      selectedIds: [],
      past: [],
      future: [],

      /** Replace the document (undoable). */
      setDoc(doc) {
        const next = normalizeDoc(doc)
        commit(next, { selectedIds: pruneSelection(next, get().selectedIds) })
      },

      /** Load a document, clearing history and selection (not undoable). */
      load(doc) {
        set({ doc: normalizeDoc(doc), past: [], future: [], selectedIds: [] })
      },

      /** Reset to an empty half breadboard (undoable). */
      clear() {
        commit(emptyDoc(get().doc.boardMode, breadboard), { selectedIds: [] })
      },

      /** Merge fields into doc.meta (name, …). */
      setMeta(patch) {
        const { doc } = get()
        commit({ ...doc, meta: { ...doc.meta, ...patch } })
      },

      /**
       * Change the breadboard layout. Refuses to shrink while parts would lose their holes
       * (parts on bb2, or on rows the smaller board lacks) → { ok:false, blocking:[ids] }.
       * The MCU is re-placed at registry.defaultMcuPlacement when needed. Dangling wires are removed.
       */
      setBoardMode(mode) {
        const { doc } = get()
        if (!['half', 'full', 'dual'].includes(mode)) return { ok: false, blocking: [], reason: 'unknown_mode' }
        if (mode === doc.boardMode) return { ok: true, removedWires: [] }
        const candidate = { ...doc, boardMode: mode, breadboards: layoutFor(mode, breadboard) }
        const mcu = findMcu(doc)
        const blocking = doc.components
          .filter((c) => c !== mcu && c.anchor)
          .filter((c) => !candidate.breadboards.some((b) => b.id === c.anchor.board) || !isValidPlacement(c, candidate))
          .map((c) => c.id)
        if (blocking.length) return { ok: false, blocking }

        let components = doc.components
        if (mcu && mcu.anchor) {
          const stillValid = candidate.breadboards.some((b) => b.id === mcu.anchor.board) && isValidPlacement(mcu, candidate)
          const untethered = wiresAttached(doc, mcu).length === 0
          if (!stillValid || untethered) {
            const placement = registry.defaultMcuPlacement?.(mcu.type, mode)
            if (placement) {
              const moved = { ...mcu, rotation: placement.rotation ?? mcu.rotation ?? 0 }
              delete moved.anchor
              delete moved.position
              if (placement.anchor) moved.anchor = { ...placement.anchor }
              else moved.position = { ...placement.position }
              components = components.map((c) => (c === mcu ? moved : c))
            }
          }
        }
        const nextDoc = { ...candidate, components }
        const removedWires = doc.wires
          .filter((w) => [w.from, w.to].some((t) => isBreadboardTerminal(nextDoc, t) && !holeExists(nextDoc, t)))
          .map((w) => w.id)
        const removed = new Set(removedWires)
        nextDoc.wires = doc.wires.filter((w) => !removed.has(w.id))
        commit(nextDoc, { selectedIds: pruneSelection(nextDoc, get().selectedIds) })
        return { ok: true, removedWires }
      },

      /**
       * Replace (or remove with null) the MCU at registry.defaultMcuPlacement.
       * Keeps wires whose pin exists on the new board (5V↔VIN, A0..A5 → ADC pins, GND family remapped);
       * removes the rest. Returns { removedWires, remapped }.
       */
      setMcu(boardId) {
        const { doc } = get()
        const old = findMcu(doc)
        if (boardId == null) {
          if (!old) return { removedWires: [], remapped: [] }
          const removedWires = wiresOwnedBy(doc, [old.id]).map((w) => w.id)
          const removed = new Set(removedWires)
          const nextDoc = { ...doc, mcu: null, components: doc.components.filter((c) => c !== old), wires: doc.wires.filter((w) => !removed.has(w.id)) }
          commit(nextDoc, { selectedIds: pruneSelection(nextDoc, get().selectedIds) })
          return { removedWires, remapped: [] }
        }
        if (!isMcuType(boardId)) return { removedWires: [], remapped: [], error: `Unknown board ${boardId}` }
        if (old?.type === boardId) return { removedWires: [], remapped: [] }
        const placement = registry.defaultMcuPlacement?.(boardId, doc.boardMode) ?? { position: { x: 0, y: 0 } }
        const result = placeMcu(doc, boardId, placement)
        commit(result.doc, { selectedIds: pruneSelection(result.doc, get().selectedIds) })
        return { removedWires: result.removedWires, remapped: result.remapped, id: result.id }
      },

      /** Add a component via registry.createComponent. MCU types replace the existing MCU. Returns the new id. */
      addComponent(type, placement, props) {
        const { doc } = get()
        if (isMcuType(type)) {
          const result = placeMcu(doc, type, placement)
          commit(result.doc, { selectedIds: [result.id] })
          return result.id
        }
        const comp = registry.createComponent(type, placement, props)
        commit({ ...doc, components: [...doc.components, comp] }, { selectedIds: [comp.id] })
        return comp.id
      },

      /** Shallow-merge a patch into a component. */
      updateComponent(id, patch) {
        const { doc } = get()
        if (!doc.components.some((c) => c.id === id)) return
        commit({ ...doc, components: doc.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
      },

      /** Merge a props patch into a component. */
      setProps(id, propsPatch) {
        const { doc } = get()
        const comp = doc.components.find((c) => c.id === id)
        if (!comp) return
        commit({ ...doc, components: doc.components.map((c) => (c.id === id ? { ...c, props: { ...c.props, ...propsPatch } } : c)) })
      },

      /** Move a component to a new Placement (anchor or position; optional rotation). */
      moveComponent(id, placement) {
        const { doc } = get()
        const comp = doc.components.find((c) => c.id === id)
        if (!comp || !placement) return
        const moved = { ...comp }
        delete moved.anchor
        delete moved.position
        if (placement.anchor) moved.anchor = { board: placement.anchor.board, hole: placement.anchor.hole }
        else if (placement.position) moved.position = { x: placement.position.x, y: placement.position.y }
        else return
        if (placement.rotation != null) moved.rotation = placement.rotation
        commit({ ...doc, components: doc.components.map((c) => (c.id === id ? moved : c)) })
      },

      /** Rotate a component by `delta` degrees (default 90, clockwise). */
      rotateComponent(id, delta = 90) {
        const { doc } = get()
        const comp = doc.components.find((c) => c.id === id)
        if (!comp) return
        const idx = ROTATIONS.indexOf(comp.rotation ?? 0)
        const rotation = ROTATIONS[(((idx < 0 ? 0 : idx) + Math.round(delta / 90)) % 4 + 4) % 4]
        commit({ ...doc, components: doc.components.map((c) => (c.id === id ? { ...c, rotation } : c)) })
      },

      /** Remove components (and wires attached to their pin aliases). Accepts an id or an array. */
      removeComponents(ids) {
        const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean)
        const { doc } = get()
        const removing = new Set(list.filter((id) => doc.components.some((c) => c.id === id)))
        if (!removing.size) return
        const components = doc.components.filter((c) => !removing.has(c.id))
        const wires = doc.wires.filter((w) => !removing.has(ownerOf(w.from)) && !removing.has(ownerOf(w.to)))
        const mcu = components.find((c) => isMcuType(c.type))
        const nextDoc = { ...doc, components, wires, mcu: mcu ? mcu.type : null }
        commit(nextDoc, { selectedIds: pruneSelection(nextDoc, get().selectedIds) })
      },

      /**
       * Replace a component with a fresh one of the same type/props/placement (e.g. after it blew).
       * Wires referencing the old id are re-pointed to the new one. Returns the new id or null.
       */
      replaceComponent(id) {
        const { doc } = get()
        const comp = doc.components.find((c) => c.id === id)
        if (!comp) return null
        const placement = comp.anchor ? { anchor: { ...comp.anchor }, rotation: comp.rotation } : { position: { ...comp.position }, rotation: comp.rotation }
        const fresh = registry.createComponent(comp.type, placement, clone(comp.props ?? {}))
        fresh.rotation = comp.rotation ?? 0
        const wires = doc.wires.map((w) => ({
          ...w,
          from: ownerOf(w.from) === id ? `${fresh.id}:${pinOf(w.from)}` : w.from,
          to: ownerOf(w.to) === id ? `${fresh.id}:${pinOf(w.to)}` : w.to,
        }))
        const components = doc.components.map((c) => (c.id === id ? fresh : c))
        commit({ ...doc, components, wires }, { selectedIds: get().selectedIds.map((s) => (s === id ? fresh.id : s)) })
        return fresh.id
      },

      /** Add a wire between two TerminalRefs. Returns its id (or the existing id for a duplicate; null if invalid). */
      addWire(from, to, color = 'red') {
        if (!from || !to || from === to || !String(from).includes(':') || !String(to).includes(':')) return null
        const { doc } = get()
        const dup = doc.wires.find((w) => (w.from === from && w.to === to) || (w.from === to && w.to === from))
        if (dup) return dup.id
        const wire = { id: newId('w'), from, to, color }
        commit({ ...doc, wires: [...doc.wires, wire] })
        return wire.id
      },

      /** Shallow-merge a patch (color, endpoints) into a wire. */
      updateWire(id, patch) {
        const { doc } = get()
        if (!doc.wires.some((w) => w.id === id)) return
        commit({ ...doc, wires: doc.wires.map((w) => (w.id === id ? { ...w, ...patch } : w)) })
      },

      /** Remove wires by id (id or array). */
      removeWires(ids) {
        const list = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))
        const { doc } = get()
        if (!doc.wires.some((w) => list.has(w.id))) return
        const nextDoc = { ...doc, wires: doc.wires.filter((w) => !list.has(w.id)) }
        commit(nextDoc, { selectedIds: pruneSelection(nextDoc, get().selectedIds) })
      },

      /** Select ids (array, single id or null to clear). */
      select(ids) {
        const list = ids == null ? [] : Array.isArray(ids) ? ids : [ids]
        set({ selectedIds: pruneSelection(get().doc, list) })
      },

      undo() {
        const { past, future, doc, selectedIds } = get()
        if (!past.length) return false
        const previous = past[past.length - 1]
        set({ doc: previous, past: past.slice(0, -1), future: [doc, ...future].slice(0, HISTORY_LIMIT), selectedIds: pruneSelection(previous, selectedIds) })
        return true
      },

      redo() {
        const { past, future, doc, selectedIds } = get()
        if (!future.length) return false
        const [next, ...rest] = future
        set({ doc: next, past: [...past, doc].slice(-HISTORY_LIMIT), future: rest, selectedIds: pruneSelection(next, selectedIds) })
        return true
      },

      /** Wires attached to a component by id alias or by hole (helper for panels). */
      wiresAttached(id) {
        const { doc } = get()
        const comp = doc.components.find((c) => c.id === id)
        return comp ? wiresAttached(doc, comp) : []
      },
    }
  })
}

export const useDocumentStore = createDocumentStore()
export default useDocumentStore
