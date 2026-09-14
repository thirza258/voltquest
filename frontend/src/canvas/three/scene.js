import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { PITCH } from '../../engine/components/breadboard.js'
import { resistorBands } from '../../engine/components/registry.js'
import { BOARD_TOP, circuitModel } from './model.js'

const LED_COLORS = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', white: '#f1f5f9' }
const BAND_COLORS = { gold: '#ca8a04', violet: '#7c3aed', gray: '#6b7280' }
const clamp = value => Math.min(1, Math.max(0, Number(value) || 0))

/** GPU resources belong to one scene and are released on a document change or unmount. */
export function disposeObject(root) {
  const resources = new Set()
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry)
    for (const material of [].concat(object.material ?? [])) {
      resources.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
  })
  for (const resource of resources) resource.dispose()
}

/** Three scene construction works in Node; the browser injects optional painted surfaces. */
export function createCircuitScene(doc, { surface } = {}) {
  const model = circuitModel(doc)
  const root = new THREE.Group()
  const updaters = []
  const selections = []
  const materials = new Map()
  const geometries = new Map()
  const geometry = (key, create) => {
    if (!geometries.has(key)) geometries.set(key, create())
    return geometries.get(key)
  }
  const material = (color, metalness = 0, unique = false) => {
    const key = `${color}:${metalness}`
    if (unique) return new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness })
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness }))
    return materials.get(key)
  }
  function mesh(parent, shape, color, position, metalness = 0, unique = false) {
    const item = new THREE.Mesh(shape, material(color, metalness, unique))
    item.position.set(...position)
    parent.add(item)
    return item
  }
  function box(parent, x, y, z, w, h, d, color, rounded = false) {
    const shape = geometry(`box:${w}:${h}:${d}:${rounded}`, () => rounded ? new RoundedBoxGeometry(w, h, d, 2, Math.min(0.15, h / 3, d / 4)) : new THREE.BoxGeometry(w, h, d))
    return mesh(parent, shape, color, [x, y, z])
  }
  function cylinder(parent, x, y, z, radius, height, color, unique = false) {
    return mesh(parent, geometry(`cylinder:${radius}:${height}`, () => new THREE.CylinderGeometry(radius, radius, height, 20)), color, [x, y, z], 0.15, unique)
  }
  function sphere(parent, x, y, z, radius, color, unique = false) {
    return mesh(parent, geometry(`sphere:${radius}`, () => new THREE.SphereGeometry(radius, 20, 12)), color, [x, y, z], 0, unique)
  }
  function lead(parent, from, to, color = '#a8b2bf', radius = 0.065) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
    const item = cylinder(parent, ...(a.clone().add(b).multiplyScalar(0.5).toArray()), radius, a.distanceTo(b), color)
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize())
    return item
  }
  function paint(parent, spec, x, y, z, width, depth) {
    const texture = surface?.({ ...spec, width, depth })
    if (!texture) return null
    const item = new THREE.Mesh(geometry(`plane:${width}:${depth}`, () => new THREE.PlaneGeometry(width, depth)), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    item.rotation.x = -Math.PI / 2
    item.position.set(x, y, z)
    parent.add(item)
    return item
  }
  function light(lens, value, color) {
    if (color) lens.material.color.set(color)
    lens.material.emissive.copy(lens.material.color)
    lens.material.emissiveIntensity = clamp(value) * 2.2
  }

  for (const board of model.boards) {
    const group = new THREE.Group()
    group.position.set(board.x / PITCH, 0, board.y / PITCH)
    group.name = board.id
    box(group, board.width / 2, BOARD_TOP / 2, board.depth / 2, board.width, BOARD_TOP, board.depth, '#e7e5e4', true)
    paint(group, { kind: 'breadboard', type: board.type }, board.width / 2, BOARD_TOP + 0.01, board.depth / 2, board.width, board.depth)
    box(group, board.width / 2, BOARD_TOP + 0.015, 9.5, board.width - 1, 0.035, 1.7, '#c8c7c3')
    root.add(group)
  }

  for (const { comp, def, origin, rotation } of model.parts) {
    const group = new THREE.Group()
    group.name = comp.id
    group.userData.componentId = comp.id
    group.position.set(...origin)
    group.rotation.y = rotation
    root.add(group)
    const w = def.footprint.width, d = def.footprint.height
    const cx = (w - (comp.anchor ? 1 : 0)) / 2, cz = (d - (comp.anchor ? 1 : 0)) / 2
    const pins = def.footprint.pins
    for (const pin of pins) lead(group, [pin.dx, 0.02, pin.dy], [pin.dx, def.category === 'mcu' ? 0.75 : 0.5, pin.dy])

    if (def.category === 'mcu') {
      const pi = comp.type.startsWith('raspberrypi')
      const color = pi ? '#15803d' : comp.type.startsWith('esp32') ? '#243142' : '#087e91'
      box(group, cx, 0.4, cz, w, 0.28, d, color, true)
      for (const pin of pins) {
        box(group, pin.dx, 0.72, pin.dy, 0.65, 0.4, 0.65, '#111827')
        cylinder(group, pin.dx, 0.94, pin.dy, 0.14, 0.04, '#d4af55')
      }
      box(group, cx, 0.85, cz, Math.min(w * 0.45, 7), 0.55, Math.max(1, d * 0.3), comp.type.startsWith('esp32') ? '#b5bdc5' : '#1e293b', true)
      box(group, comp.anchor ? -0.1 : 1.2, 1, cz, 1.5, 1, Math.min(2.5, d * 0.5), '#cbd5e1', true)
      paint(group, { kind: 'controller', def, label: def.name, color }, cx, 0.555, cz, w, d)
      const builtin = sphere(group, cx + w * 0.3, 0.8, cz, 0.18, '#fbbf24', true)
      updaters.push(state => {
        const pin = state?.compiled?.mcu?.board?.ledBuiltin
        const output = pin && state?.mcuPins?.[pin]
        light(builtin, state?.powered === false || pi ? 0 : output?.duty ?? output?.level ?? 0)
      })
    } else if (['resistor', 'diode', 'variable_resistor', 'reed_switch'].includes(comp.type)) {
      const glass = comp.type === 'reed_switch'
      const body = cylinder(group, cx, 0.6, 0, glass ? 0.28 : 0.38, Math.max(0.8, w - 2), glass ? '#b7d7d2' : comp.type === 'diode' ? '#26313d' : '#dfc493')
      body.rotation.z = Math.PI / 2
      lead(group, [0, 0.45, 0], [cx, 0.6, 0])
      lead(group, [w - 1, 0.45, 0], [cx, 0.6, 0])
      const bands = comp.type === 'resistor' ? resistorBands(comp.props.ohms) : comp.type === 'diode' ? ['#d1d5db'] : []
      bands.forEach((color, i) => {
        const band = cylinder(group, cx - 0.85 + i * 0.5, 0.6, 0, 0.39, 0.16, BAND_COLORS[color] ?? color)
        band.rotation.z = Math.PI / 2
      })
      if (glass) updaters.push(state => { body.material = material(state?.controls?.[comp.id]?.magnetNear ? '#5eead4' : '#b7d7d2') })
    } else if (['led', 'rgb_led'].includes(comp.type)) {
      const color = LED_COLORS[comp.props.color] ?? '#e2e8f0'
      cylinder(group, cx, 0.55, 0, 0.56, 0.15, color)
      const lens = sphere(group, cx, 1.05, 0, 0.52, color, true)
      cylinder(group, cx, 0.8, 0, 0.52, 0.5, color)
      updaters.push(state => {
        const live = state?.evaluation?.componentStates?.[comp.id]
        const channels = live?.channels
        const tint = channels ? new THREE.Color(clamp(channels.r), clamp(channels.g), clamp(channels.b)) : color
        light(lens, state?.powered === false || state?.damaged?.[comp.id] ? 0 : live?.brightness, tint)
      })
    } else if (['potentiometer', 'trimpot'].includes(comp.type)) {
      cylinder(group, cx, 0.7, 0, 0.85, 0.55, comp.type === 'trimpot' ? '#2563eb' : '#64748b')
      const knob = cylinder(group, cx, 1.2, 0, 0.57, 0.65, '#1f2937')
      box(knob, 0, 0.34, -0.24, 0.1, 0.025, 0.45, '#f8fafc')
      updaters.push(state => { knob.rotation.y = -(clamp(state?.controls?.[comp.id]?.value ?? 0.5) - 0.5) * Math.PI * 1.5 })
    } else if (['pushbutton', 'slide_switch', 'tilt_switch'].includes(comp.type)) {
      box(group, cx, 0.6, cz, w - 0.3, 0.5, Math.max(0.75, d - 0.25), '#d1d5db', true)
      const cap = box(group, cx, 1, cz, 0.85, 0.4, 0.7, '#26313d', true)
      updaters.push(state => {
        const pressed = !!state?.controls?.[comp.id]?.[def.control.field]
        cap.position.y = pressed && comp.type === 'pushbutton' ? 0.82 : 1
        cap.position.x = cx + (comp.type === 'slide_switch' ? (pressed ? 0.45 : -0.45) : 0)
        cap.material = material(pressed ? '#0d9488' : '#26313d')
      })
    } else if (['capacitor', 'buzzer', 'dc_motor'].includes(comp.type)) {
      cylinder(group, cx, 1.05, 0, 0.75, 1.35, comp.type === 'capacitor' ? '#1e40af' : comp.type === 'dc_motor' ? '#b5bdc5' : '#202b3b')
      cylinder(group, cx, 1.74, 0, 0.64, 0.04, comp.type === 'buzzer' ? '#0f172a' : '#cbd5e1')
      const slot = box(group, cx, 1.78, 0, 0.9, 0.03, 0.07, '#475569')
      if (comp.type === 'dc_motor') updaters.push(state => { slot.rotation.y = (state?.millis ?? 0) * (state?.evaluation?.componentStates?.[comp.id]?.current ?? 0) * 0.02 })
    } else if (comp.type === 'servo') {
      box(group, cx, 1.1, -0.65, 2.4, 1.5, 1.4, '#2563eb', true)
      const horn = cylinder(group, cx, 1.95, -0.65, 0.25, 0.2, '#f8fafc')
      box(horn, 0, 0.08, 0, 2.5, 0.15, 0.22, '#f8fafc', true)
      updaters.push(state => { horn.rotation.y = -(state?.peripherals?.[comp.id]?.data?.angle ?? 90) * Math.PI / 180 })
    } else if (['ldr', 'thermistor_ntc', 'force_sensor', 'flex_sensor', 'touch_pad'].includes(comp.type)) {
      const color = { ldr: '#d6a66f', thermistor_ntc: '#a16207', force_sensor: '#334155', flex_sensor: '#be8d47', touch_pad: '#c08038' }[comp.type]
      if (comp.type === 'flex_sensor') box(group, cx, 0.55, -1.2, 0.6, 0.2, 3.3, color, true)
      else cylinder(group, cx, 0.65, 0, 0.65, 0.3, color)
      paint(group, { label: comp.type === 'thermistor_ntc' ? 'NTC' : comp.type === 'ldr' ? 'LDR' : 'SENSOR', color }, cx, 0.82, 0, 1.2, 0.5)
    } else if (comp.type === 'neopixel_ring') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.22, 8, 32), material('#1e293b'))
      ring.rotation.x = Math.PI / 2; ring.position.set(cx, 0.65, -1.1); group.add(ring)
      const pixels = Array.from({ length: comp.props.count ?? 12 }, (_, i) => {
        const angle = i * Math.PI * 2 / (comp.props.count ?? 12)
        return sphere(group, cx + Math.cos(angle) * 1.65, 0.85, -1.1 + Math.sin(angle) * 1.65, 0.2, '#e2e8f0', true)
      })
      updaters.push(state => {
        const live = state?.peripherals?.[comp.id]?.data
        pixels.forEach((pixel, i) => {
          const rgb = live?.pixels?.[i] ?? [0, 0, 0]
          const lit = state?.powered !== false && !state?.damaged?.[comp.id] && state?.evaluation?.componentStates?.[comp.id]?.powered
          light(pixel, lit ? Math.max(...rgb) / 255 * ((live?.brightness ?? 255) / 255) : 0, new THREE.Color(...rgb.map(value => clamp(value / 255))))
        })
      })
    } else {
      const display = ['lcd16x2_i2c', 'oled_ssd1306', 'seven_segment'].includes(comp.type)
      const depth = Math.max(d, display ? 2.6 : 1.8)
      const color = display ? '#087f72' : '#236456'
      box(group, cx, 0.65, cz - 0.5, w, 0.3, depth, color, true)
      box(group, cx, 0.95, cz - 0.65, Math.max(0.6, w - 0.6), 0.35, depth - 0.6, display ? '#102635' : '#293342', true)
      const panel = paint(group, { label: def.name, color: display ? '#102635' : '#293342' }, cx, 1.135, cz - 0.65, w - 0.5, depth - 0.5)
      if (display && panel) {
        let previous = null
        updaters.push(state => {
          const data = state?.powered === false || !state?.evaluation?.componentStates?.[comp.id]?.powered && comp.type !== 'seven_segment' ? null : state?.peripherals?.[comp.id]?.data
          const signature = JSON.stringify([data, state?.evaluation?.componentStates?.[comp.id]?.segments])
          if (signature === previous) return
          previous = signature
          const texture = surface({ kind: 'display', label: def.name, type: comp.type, data, segments: state?.powered === false ? {} : state?.evaluation?.componentStates?.[comp.id]?.segments, width: w - 0.5, depth: depth - 0.5 })
          panel.material.map.dispose(); panel.material.map = texture; panel.material.needsUpdate = true
        })
      }
      if (comp.type === 'ultrasonic_hcsr04') for (const x of [0.5, w - 1.5]) cylinder(group, x, 1.3, -0.7, 0.6, 0.65, '#cbd5e1')
      if (comp.type === 'pir') sphere(group, cx, 1.2, -0.7, 0.75, '#f1f5f9')
    }
    group.traverse(object => { if (object.isMesh) object.userData.selectId = comp.id })
    group.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(group).expandByScalar(0.12)
    const outline = new THREE.Box3Helper(bounds, '#0d9488')
    outline.visible = false
    root.add(outline)
    selections.push({ id: comp.id, outline })
  }

  for (const wire of model.wires) {
    const curve = new THREE.CatmullRomCurve3(wire.points.map(point => new THREE.Vector3(...point)), false, 'centripetal')
    const cable = mesh(root, new THREE.TubeGeometry(curve, 32, 0.09, 6, false), wire.color, [0, 0, 0], 0, true)
    cable.name = wire.id; cable.userData.selectId = wire.id
    updaters.push((state, selected) => { cable.material.emissive.set(selected.has(wire.id) ? '#0d9488' : '#000000'); cable.material.emissiveIntensity = 0.6 })
  }
  return { root, model,
    update(state, selectedIds = []) {
      const selected = new Set(selectedIds)
      for (const update of updaters) update(state, selected)
      for (const { id, outline } of selections) {
        outline.visible = selected.has(id) || !!state?.damaged?.[id]
        outline.material.color.set(state?.damaged?.[id] ? '#e11d48' : '#0d9488')
      }
    },
    dispose() {
      disposeObject(root)
      // Some cached materials can be detached by a live state update.
      for (const value of materials.values()) value.dispose()
    },
  }
}
