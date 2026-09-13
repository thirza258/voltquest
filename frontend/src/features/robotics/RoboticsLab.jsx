import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createSimulation, DEFAULT_PROJECT, parseProject, validateProject, publishTwist, stepSimulation, startGoal, cancelGoal, resetPose, setParameters } from '../../engine/robotics/model.js'
import { readJson, writeJson } from '../../lib/storage.js'
import { downloadJson } from '../../lib/download.js'
import { Button, Modal } from '../../ui/index.js'
import { useI18n } from '../../i18n/index.jsx'

export const ROBOT_PROJECT_KEY = 'vq.robotics.project.v1'
const fieldClass = 'mt-1 block w-full min-w-0 rounded border border-line-strong bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const panelClass = 'min-w-0 space-y-4 rounded-lg border border-line bg-white p-4'
function NumberField({ label, value, onChange, ...rest }) {
  return <label className="block min-w-0 text-sm">{label}<input type="number" step="any" className={fieldClass} value={value} onChange={event => onChange(event.target.value)} {...rest} /></label>
}
export default function RoboticsLab({ initialProject = DEFAULT_PROJECT }) {
  const { t } = useI18n()
  const simulation = useRef(null)
  if (!simulation.current) simulation.current = createSimulation(initialProject)
  const [, refresh] = useReducer(value => value + 1, 0)
  const [running, setRunning] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [forward, setForward] = useState('0.4')
  const [yawRate, setYawRate] = useState('0')
  const [topics, updateTopics] = useState(initialProject.topics)
  const [parameters, updateParameters] = useState(initialProject.parameters)
  const [editor, setEditor] = useState(() => JSON.stringify(initialProject, null, 2))
  const [pending, setPending] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef(null)
  const controls = useRef({ streaming, forward, yawRate })
  controls.current = { streaming, forward, yawRate }
  const sim = simulation.current
  function attempt(fn) {
    try { fn(); setError(''); refresh() } catch (e) { setError(e.message) }
  }
  const tick = useCallback(() => {
    const s = simulation.current, c = controls.current
    try {
      if (c.streaming && s.ticks % 2 === 0) publishTwist(s, s.project.topics.publisher, { linear: { x: Number(c.forward) }, angular: { z: Number(c.yawRate) } })
      stepSimulation(s)
      refresh()
    } catch (e) { setError(e.message); setRunning(false); setStreaming(false); cancelGoal(s) }
  }, [])
  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(tick, 50)
    return () => window.clearInterval(timer)
  }, [running, tick])
  useEffect(() => {
    const stop = () => { setRunning(false); setStreaming(false); cancelGoal(simulation.current); refresh() }
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  function applyProject(project) {
    simulation.current = createSimulation(project)
    setRunning(false); setStreaming(false); updateTopics(project.topics); updateParameters(project.parameters)
    setEditor(JSON.stringify(project, null, 2)); setPending(null); setNotice('Project loaded. Simulation reset.'); setError(''); refresh()
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try {
      if (file.size > 30000) throw new Error('Robotics files must be smaller than 30 KB.')
      const project = parseProject(await file.text())
      setRunning(false); setPending(project); setError('')
    } catch (e) { setError(e.message) }
  }
  function publish() {
    attempt(() => { publishTwist(sim, sim.project.topics.publisher, { linear: { x: Number(forward) }, angular: { z: Number(yawRate) } }); setNotice('Inspect the message log to check delivery.') })
  }
  const pose = sim.pose, goal = sim.project.goal
  const sx = value => 20 + value * 60, sy = value => 380 - value * 60
  return <section className="space-y-4" aria-label={t('Robotics browser sandbox')}>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => setRunning(value => !value)}>{t(running ? 'Pause simulation' : 'Run simulation')}</Button>
      <Button variant="secondary" disabled={running} onClick={() => { tick(); tick() }}>{t('Step 0.1 s')}</Button>
      <Button variant="danger" onClick={() => { setStreaming(false); cancelGoal(sim); setNotice('Motion stopped.'); refresh() }}>{t('Stop motion')}</Button>
      <span className="text-sm text-slate-600">{t('Virtual time')}: {sim.time.toFixed(2)} s</span>
    </div>
    <p className="text-sm leading-relaxed text-ink-secondary">{t('ROS 2 concept simulator · ideal 2D wheels · no ROS installation or arbitrary code execution. Message previews show selected fields. Run advances virtual time; leaving the window pauses and stops motion.')}</p>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className={panelClass}>
        <h2 className="font-semibold">{t('Robot world')}</h2>
        <svg viewBox="0 0 400 400" role="img" aria-label={t('Robot position, goal, obstacles and forward sensor ray')} className="block w-full rounded bg-slate-50">
          <rect x="20" y="20" width="360" height="360" fill="#f8fafc" stroke="#94a3b8" />
          {Array.from({ length: 7 }, (_, i) => <g key={i}><path d={`M ${sx(i)} 20 V 380 M 20 ${sy(i)} H 380`} stroke="#e2e8f0" strokeWidth="0.6" /><text x={sx(i)} y="395" textAnchor="middle" fontSize="9" fill="#475569">{i}</text><text x="7" y={sy(i)} fontSize="9" fill="#475569">{i}</text></g>)}
          <polyline points={sim.trail.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke="#5eead4" strokeWidth="2" />
          {sim.project.obstacles.map((o, i) => <circle key={i} cx={sx(o.x)} cy={sy(o.y)} r={o.radius * 60} fill="#64748b" />)}
          <circle cx={sx(goal.x)} cy={sy(goal.y)} r="8" fill="none" stroke="#d97706" strokeWidth="2" /><text x={sx(goal.x)} y={sy(goal.y) - 13} textAnchor="middle" fontSize="10" fill="#92400e">{t('Goal')}</text>
          <line x1={sx(pose.x)} y1={sy(pose.y)} x2={sx(pose.x + sim.range * Math.cos(pose.yaw))} y2={sy(pose.y + sim.range * Math.sin(pose.yaw))} stroke="#ea580c" strokeDasharray="4 3" />
          <g transform={`translate(${sx(pose.x)} ${sy(pose.y)}) rotate(${-pose.yaw * 180 / Math.PI})`}>
            <circle r={sim.project.robot.radius * 60} fill="#0d9488" stroke="#115e59" strokeWidth="2" /><path d="M -4 -5 L 7 0 L -4 5 Z" fill="white" />
          </g>
        </svg>
        <p className="text-xs text-slate-600">{t('6 × 6 m world · teal: robot · amber: goal · orange ray: forward range · grey: obstacles')}</p>
        <dl aria-label={t('Robot telemetry')} className="grid grid-cols-2 gap-3 text-sm">
          {[[t('Position x / y'), `${pose.x.toFixed(3)} / ${pose.y.toFixed(3)} m`], [t('Yaw'), `${pose.yaw.toFixed(3)} rad`], [t('Forward range'), `${sim.range.toFixed(3)} m`], [t('Body velocity'), `${sim.velocity.linear.toFixed(2)} m/s · ${sim.velocity.angular.toFixed(2)} rad/s`], [t('Wheel rates L / R'), `${sim.wheels.left.toFixed(2)} / ${sim.wheels.right.toFixed(2)} rad/s`], [t('Action feedback'), `${t(sim.action.status)} · ${sim.action.remaining.toFixed(3)} m`]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-mono text-xs">{value}</dd></div>)}
        </dl>
        <p className="rounded bg-teal-50 p-2 text-sm" aria-label={t('Drive status')}>{t(sim.status)}</p>
      </div>
      <div className={panelClass}>
        <h2 className="font-semibold">{t('Nodes and topics')}</h2>
        <div className="rounded bg-slate-50 p-3 font-mono text-xs leading-loose break-all" aria-label={t('ROS concept graph')}>
          <p>/command_publisher → {sim.project.topics.publisher}</p><p>{sim.project.topics.subscriber} → /drive_node → /odom</p><p>/range_sensor → /range → /waypoint_controller</p><p>/odom → /waypoint_controller → {sim.project.topics.publisher}</p>
        </div>
        <p className={`text-sm ${sim.project.topics.publisher === sim.project.topics.subscriber ? 'text-teal-700' : 'text-amber-800'}`}>{t(sim.project.topics.publisher === sim.project.topics.subscriber ? 'Command topic connected' : 'Topic mismatch: the drive receives no new commands')}</p>
        <label className="block text-sm">{t('Publisher topic')}<input className={fieldClass} value={topics.publisher} onChange={e => updateTopics({ ...topics, publisher: e.target.value })} /></label>
        <label className="block text-sm">{t('Subscriber topic')}<input className={fieldClass} value={topics.subscriber} onChange={e => updateTopics({ ...topics, subscriber: e.target.value })} /></label>
        <Button size="sm" variant="secondary" onClick={() => attempt(() => { const next = validateProject({ ...sim.project, topics }); cancelGoal(sim); setStreaming(false); sim.project = next; setEditor(JSON.stringify(next, null, 2)); setNotice('Graph applied. Pose preserved; motion stopped.') })}>{t('Apply graph')}</Button>
        <div className="grid grid-cols-2 gap-2"><NumberField label={t('Forward speed (m/s)')} value={forward} onChange={setForward} min="-1" max="1" /><NumberField label={t('Yaw rate (rad/s)')} value={yawRate} onChange={setYawRate} min="-3" max="3" /></div>
        <Button size="sm" onClick={publish}>{t('Publish Twist once')}</Button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={streaming} onChange={e => { setStreaming(e.target.checked); if (e.target.checked) cancelGoal(sim) }} />{t('Stream commands at 10 Hz')}</label>
        <p className="text-xs text-slate-600">{t('Twist: linear.x and angular.z. Delivery expires after 1 virtual second without a new command. Manual delivery cancels an active waypoint task.')}</p>
        <details><summary className="cursor-pointer text-sm font-semibold">{t('Live message log')}</summary><div className="mt-2 max-h-72 overflow-auto rounded bg-slate-900 p-3 text-slate-100" tabIndex="0" aria-label={t('Robot messages')}>
          {sim.messages.length ? [...sim.messages].reverse().map((m, i) => <div key={i} className="mb-3 border-b border-slate-700 pb-2 text-xs"><p className="break-all">{m.time.toFixed(2)} s · {m.topic} · {t(m.delivered ? 'delivered' : 'no subscriber')}</p><p className="break-all text-teal-300">{m.type}</p><pre className="whitespace-pre-wrap break-all">{JSON.stringify(m.data, null, 2)}</pre></div>) : <p className="text-sm">{t('Publish or step to create messages.')}</p>}
        </div></details>
      </div>
      <div className={panelClass}>
        <h2 className="font-semibold">{t('Services, parameters and actions')}</h2>
        <Button size="sm" variant="secondary" onClick={() => { setStreaming(false); resetPose(sim); setNotice('Service response: success = true; pose reset.'); refresh() }}>{t('Reset pose service')}</Button>
        <p className="break-all font-mono text-xs text-slate-500">/reset_pose · std_srvs/srv/Trigger</p>
        <NumberField label={t('Maximum speed (m/s)')} value={parameters.maxSpeed} onChange={value => updateParameters({ ...parameters, maxSpeed: value })} />
        <NumberField label={t('Heading gain (1/s)')} value={parameters.gain} onChange={value => updateParameters({ ...parameters, gain: value })} />
        <NumberField label={t('Stop distance (m)')} value={parameters.stopDistance} onChange={value => updateParameters({ ...parameters, stopDistance: value })} />
        <Button size="sm" variant="secondary" onClick={() => attempt(() => { setParameters(sim, Object.fromEntries(Object.entries(parameters).map(([k, v]) => [k, Number(v)]))); setEditor(JSON.stringify(sim.project, null, 2)); setNotice('Parameters applied without resetting pose.') })}>{t('Apply parameters')}</Button>
        <p className="text-xs text-slate-600">{t('Stop distance is measured from the robot centre and applies to the waypoint controller. Physical braking, wheel slip and obstacle avoidance are not simulated.')}</p>
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => { setStreaming(false); startGoal(sim); refresh() }}>{t('Start waypoint action')}</Button><Button size="sm" variant="secondary" onClick={() => { cancelGoal(sim); refresh() }}>{t('Cancel action')}</Button></div>
        <p className="text-sm">{t('Action result')}: <strong aria-label={t('Action result')}>{t(sim.action.status)}</strong></p>
        <p className="text-xs text-slate-600">{t('Start the action, then Run or Step. Arrival tolerance is 0.08 m. A blocked task needs a new request; this controller cannot plan a detour.')}</p>
      </div>
    </div>
    <details className={panelClass}><summary className="cursor-pointer font-semibold">{t('Edit robot, goal and obstacles · save / import / export')}</summary>
      <p className="text-sm text-slate-600">{t('Edit the project JSON to change wheel dimensions, start pose, goal or circular obstacles. Coordinates are metres; yaw is radians. Applying a project resets the simulation after confirmation. Saved projects stay in this browser and are separate from circuit accounts.')}</p>
      <textarea aria-label={t('Robotics project JSON')} className={`${fieldClass} h-72 font-mono text-xs`} spellCheck="false" value={editor} onChange={e => setEditor(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => attempt(() => { const project = parseProject(editor); setRunning(false); setPending(project) })}>{t('Review project changes')}</Button>
        <Button size="sm" variant="secondary" onClick={() => attempt(() => { if (!writeJson(ROBOT_PROJECT_KEY, validateProject(sim.project))) throw new Error('Browser storage is unavailable. Export the project to keep it.'); setNotice('Robot project saved in this browser.') })}>{t('Save robot project')}</Button>
        <Button size="sm" variant="secondary" onClick={() => attempt(() => { const project = validateProject(readJson(ROBOT_PROJECT_KEY)); setRunning(false); setPending(project) })}>{t('Load saved robot')}</Button>
        <Button size="sm" variant="secondary" onClick={() => attempt(() => { downloadJson(validateProject(sim.project), 'voltquest-robotics.json') })}>{t('Export robot JSON')}</Button>
        <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>{t('Import robot JSON')}</Button>
        <input ref={fileInput} className="hidden" type="file" accept="application/json,.json" aria-label={t('Import robot JSON file')} onChange={importFile} />
      </div><p className="text-xs text-slate-600">{t('Save and export use the applied project. Review and apply editor changes first. Only one named robot project is saved locally; export copies to keep more.')}</p>
    </details>
    {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{t(error)}</p>}
    <p role="status" className="text-sm text-teal-800">{t(notice)}</p>
    <Modal open={Boolean(pending)} title={t('Replace the robot project?')} onClose={() => setPending(null)} description={t('The simulation will reset. Export or save the current applied project first if you want to keep it.')} footer={<><Button variant="secondary" onClick={() => setPending(null)}>{t('Cancel')}</Button><Button onClick={() => applyProject(pending)}>{t('Apply and reset robot')}</Button></>}>
      {pending && <p className="text-sm break-words">{pending.name} · {pending.obstacles.length} {t('obstacles')} · {pending.robot.wheelRadius} m / {pending.robot.wheelBase} m</p>}
    </Modal>
  </section>
}
