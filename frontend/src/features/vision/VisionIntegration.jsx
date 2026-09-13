import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { createSimulation } from '../../engine/sim/index.js'
import { createSimulation as createRobot } from '../../engine/robotics/model.js'
import { TUTORIALS } from '../../content/index.js'
import { tutorialCircuit, tutorialCode } from '../tutorials/circuits.js'
import { deviceMessages, robotResponse, VISION_ESC_CODE } from './integration.js'

export default function VisionIntegration({ observation }) {
  const { t } = useI18n()
  const devices = useRef(null), robot = useRef(createRobot()), active = useRef(true), sending = useRef(false)
  const [states, setStates] = useState({})
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [robotPose, setRobotPose] = useState(robot.current.pose)
  useEffect(() => {
    active.current = true
    const stop = () => { devices.current?.drone.setSticks({ arm: false, throttle: 0, signal: false }); devices.current?.iot.stop(); devices.current?.drone.stop() }
    window.addEventListener('blur', stop)
    return () => { active.current = false; window.removeEventListener('blur', stop); devices.current?.dispose(); devices.current = null }
  }, [])
  function setupDevices() {
    devices.current?.dispose()
    const createWorker = typeof Worker === 'undefined' ? null : () => new Worker(new URL('../../engine/sim/sim.worker.js', import.meta.url), { type: 'module' })
    const iot = createSimulation({ createWorker }), drone = createSimulation({ createWorker })
    const http = TUTORIALS.find(item => item.id === 'iot-web-control'), esc = TUTORIALS.find(item => item.id === 'drone-esc-basics')
    const unsub = [iot.subscribe(state => { if (active.current) setStates(previous => ({ ...previous, iot: state })) }), drone.subscribe(state => { if (active.current) setStates(previous => ({ ...previous, drone: state })) })]
    iot.setDocument(tutorialCircuit(http, 'esp32')); iot.setCode(tutorialCode(http, 'esp32'))
    drone.setDocument(tutorialCircuit(esc, 'esp32')); drone.setCode(VISION_ESC_CODE)
    const timer = createWorker ? null : setInterval(() => { iot.advance(50); drone.advance(50) }, 50)
    devices.current = { iot, drone, dispose: () => { unsub.forEach(fn => fn()); if (timer) clearInterval(timer); iot.dispose(); drone.dispose() } }
  }
  async function start() {
    setBusy(true); setError(''); setResponse(''); setupDevices(); robot.current = createRobot(); setRobotPose(robot.current.pose)
    try { await Promise.all([devices.current.iot.run(), devices.current.drone.run()]); if (active.current) setStarted(true) }
    catch (e) { if (active.current) setError(e.message ?? 'Device simulation failed.') }
    finally { if (active.current) setBusy(false) }
  }
  async function send() {
    if (sending.current || !observation) return
    sending.current = true; setBusy(true); setError('')
    try {
      const message = deviceMessages(observation)
      const result = await devices.current.iot.httpRequest(message.iot)
      if (!active.current) return
      devices.current.drone.setSticks({ arm: message.drone.arm, throttle: 0, signal: true })
      devices.current.drone.serialWrite(message.drone.serial)
      robotResponse(observation, robot.current); setRobotPose({ ...robot.current.pose })
      setResponse(`${result.status} · ${result.body}`)
    } catch (e) { if (active.current) setError(e.error ?? e.message ?? 'Device simulation failed.') }
    finally { sending.current = false; if (active.current) setBusy(false) }
  }
  const ready = started && states.iot?.status === 'running' && states.drone?.status === 'running' && states.drone?.millis >= 1200
  const message = observation ? deviceMessages(observation) : null
  return <section className="space-y-4 rounded-lg border border-teal-200 bg-white p-5" aria-label={t('Connected vision devices')}>
    <h2 className="text-xl font-semibold">{t('Integration bench: one observation, three devices')}</h2>
    <p className="text-sm leading-relaxed text-slate-600">{t('Send the measured mask to a real virtual ESP32 HTTP LED circuit, a clamped props-off drone ESC, and the differential-drive robot model. Each send advances the robot by one virtual second. The ESC pulse demonstrates a signal adapter; it is not a flight or landing controller.')}</p>
    <div className="flex flex-wrap gap-3"><Button size="sm" disabled={busy} onClick={start}>{t(started ? 'Restart connected devices' : 'Start connected devices')}</Button><Button size="sm" disabled={!ready || !observation || busy} onClick={send}>{t('Send observation to all devices')}</Button><Button size="sm" variant="secondary" onClick={() => { devices.current?.drone.setSticks({ arm: false, throttle: 0, signal: false }); devices.current?.iot.stop(); devices.current?.drone.stop(); setStarted(false) }}>{t('Stop connected devices')}</Button></div>
    <p className="text-xs text-slate-600">{t(!observation ? 'Attention weights cannot command devices. Choose an OpenCV mask or edge pipeline.' : ready ? 'Devices ready. Change the scene and send a fresh observation.' : 'Start devices and allow 1.2 virtual seconds for the low ESC arming signal.')}</p>
    <div className="grid gap-4 md:grid-cols-3">
      <article className="min-w-0 rounded border border-line p-3"><h3 className="font-semibold">{t('IoT · HTTP LED')}</h3><p className="my-2 text-sm" aria-label={t('Vision HTTP response')}>{response || '—'}</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(message?.iot ?? null, null, 2)}</pre><Link className="mt-3 inline-block text-xs text-brand-700 underline" to="/tutorials/iot-web-control" target="_blank" rel="noopener noreferrer">{t('Inspect the IoT circuit')}</Link></article>
      <article className="min-w-0 rounded border border-line p-3"><h3 className="font-semibold">{t('Drone · props-off ESC')}</h3><p className="my-2 text-sm" aria-label={t('Vision ESC response')}>{Math.round(states.drone?.flight?.pulses?.[0] ?? 1000)} µs · {Math.round(states.drone?.flight?.rpm?.[0] ?? 0)} RPM</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(message?.drone ?? null, null, 2)}</pre><Link className="mt-3 inline-block text-xs text-brand-700 underline" to="/tutorials/drone-esc-basics" target="_blank" rel="noopener noreferrer">{t('Inspect the drone bench')}</Link></article>
      <article className="min-w-0 rounded border border-line p-3"><h3 className="font-semibold">{t('Robot · ROS 2 Twist')}</h3><p className="my-2 text-sm" aria-label={t('Vision robot response')}>x {robotPose.x.toFixed(3)} m · y {robotPose.y.toFixed(3)} m · θ {robotPose.yaw.toFixed(3)} rad</p><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(message?.robot ?? null, null, 2)}</pre><Link className="mt-3 inline-block text-xs text-brand-700 underline" to="/robotics/ros2-topics" target="_blank" rel="noopener noreferrer">{t('Inspect the ROS 2 graph')}</Link></article>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {(states.iot?.runtimeError || states.drone?.runtimeError) && <p role="alert" className="text-sm text-rose-700">{states.iot?.runtimeError?.message ?? states.drone?.runtimeError?.message}</p>}
    <details><summary className="cursor-pointer text-sm font-semibold">{t('Drone adapter source')}</summary><pre className="mt-3 overflow-auto rounded bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">{VISION_ESC_CODE}</pre></details>
  </section>
}
