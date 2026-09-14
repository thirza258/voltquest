import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createCircuitScene, disposeObject } from './scene.js'
import { paintSurface } from './surfaces.js'

/** Owns only rendering, camera input and hit testing. Firmware keeps its existing Worker. */
export function createCircuitViewer(host, { onSelect, onUnavailable }) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false })
  if (!context) throw new Error('WebGL2 unavailable')
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor('#f8fafc')
  canvas.className = 'block h-full w-full outline-none'
  canvas.style.touchAction = 'none'
  canvas.dataset.circuit3dCanvas = ''
  host.append(canvas)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10000)
  const controls = new OrbitControls(camera, canvas)
  controls.minPolarAngle = 0.01; controls.maxPolarAngle = Math.PI / 2 - 0.025
  controls.enableDamping = false
  scene.add(new THREE.HemisphereLight('#ffffff', '#9aa8b8', 2.5))
  const key = new THREE.DirectionalLight('#ffffff', 2.3)
  key.position.set(-30, 60, 25); scene.add(key)
  const fill = new THREE.DirectionalLight('#e2e8f0', 0.8)
  fill.position.set(40, 20, -20); scene.add(fill)
  const grid = new THREE.GridHelper(240, 120, '#cbd5e1', '#e2e8f0')
  grid.position.y = -0.04; scene.add(grid)
  let circuit = null, frame = null, active = true, disposed = false, currentDoc = null
  let state = null, selected = [], press = null, fitted = false
  const pointerIds = new Set()
  const ray = new THREE.Raycaster()
  const bounds = new THREE.Box3()

  function render() {
    frame = null
    if (disposed || !active || document.hidden) return
    renderer.render(scene, camera)
  }
  function invalidate() {
    if (frame == null && active && !disposed) frame = requestAnimationFrame(render)
  }
  function fit(top = false) {
    if (!circuit) return
    bounds.setFromObject(circuit.root)
    const center = bounds.getCenter(new THREE.Vector3())
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const direction = new THREE.Vector3(...(top ? [0, 1, 0.001] : [0.65, 1.15, 1.2])).normalize()
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize()
    const up = new THREE.Vector3().crossVectors(direction, right).normalize()
    let distance = 5
    // Fit every corner in camera space instead of surrounding a long layout with a loose sphere.
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const corner = new THREE.Vector3(x, y, z).sub(center)
      const near = corner.dot(direction)
      distance = Math.max(distance, near + Math.abs(corner.dot(right)) / (Math.tan(fov / 2) * camera.aspect), near + Math.abs(corner.dot(up)) / Math.tan(fov / 2))
    }
    distance *= 1.12
    controls.target.copy(center)
    controls.minDistance = 2; controls.maxDistance = Math.max(300, distance * 4)
    camera.far = Math.max(10000, distance * 8); camera.updateProjectionMatrix()
    camera.position.copy(center).add(direction.multiplyScalar(distance))
    controls.update(); invalidate(); fitted = true
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect()
    if (width < 2 || height < 2) return
    camera.aspect = width / height; camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    if (!fitted && circuit) fit()
    invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  controls.addEventListener('change', invalidate)
  function down(event) {
    pointerIds.add(event.pointerId)
    press = pointerIds.size === 1 && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null
  }
  function move(event) {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.moved = true
  }
  function up(event) {
    pointerIds.delete(event.pointerId)
    const start = press; press = null
    if (!start || start.id !== event.pointerId || start.moved || !active || !circuit) return
    const rect = canvas.getBoundingClientRect()
    ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
    // Test the first visible surface, so a board occludes parts beneath it.
    const hit = ray.intersectObjects(circuit.root.children, true).find(item => item.object.isMesh)
    onSelect(hit?.object.userData.selectId ? [hit.object.userData.selectId] : [])
  }
  function cancel(event) { pointerIds.delete(event.pointerId); press = null }
  function lost(event) { event.preventDefault(); active = false; onUnavailable() }
  const events = { pointerdown: down, pointermove: move, pointerup: up, pointercancel: cancel, lostpointercapture: cancel, webglcontextlost: lost }
  for (const [type, listener] of Object.entries(events)) canvas.addEventListener(type, listener)
  document.addEventListener('visibilitychange', invalidate)

  return {
    update(doc, nextState, nextSelection) {
      state = nextState; selected = nextSelection
      if (doc !== currentDoc) {
        currentDoc = doc
        if (circuit) { scene.remove(circuit.root); circuit.dispose() }
        circuit = createCircuitScene(doc, { surface: paintSurface }); scene.add(circuit.root)
        if (!fitted) { resize(); fit() }
      }
      circuit.update(state, selected); invalidate()
    },
    setActive(value) { active = value; controls.enabled = value; if (value) { resize(); invalidate() } else if (frame != null) { cancelAnimationFrame(frame); frame = null } },
    fit,
    orbit(horizontal, vertical) {
      const offset = camera.position.clone().sub(controls.target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      spherical.theta += horizontal
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical, controls.minPolarAngle, controls.maxPolarAngle)
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
      controls.update(); invalidate()
    },
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset); controls.update(); invalidate()
    },
    dispose() {
      disposed = true
      if (frame != null) cancelAnimationFrame(frame)
      observer.disconnect(); controls.dispose()
      for (const [type, listener] of Object.entries(events)) canvas.removeEventListener(type, listener)
      document.removeEventListener('visibilitychange', invalidate)
      circuit?.dispose(); disposeObject(grid)
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove()
    },
  }
}
