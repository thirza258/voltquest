import { useI18n } from '../../i18n/index.jsx'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BreadboardCanvas } from '../../canvas/BreadboardCanvas.jsx'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { createComponent, getDef, resolvePins, WIRE_COLORS } from '../../engine/components/registry.js'
import { useLevelSession } from '../../hooks/useLevelSession.js'
import { useKeyboard, KEYBOARD_SHORTCUTS } from '../../hooks/useKeyboard.js'
import { useToneAudio } from '../../hooks/useToneAudio.js'
import { useDocumentStore } from '../../store/documentStore.js'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { useSimStore } from '../../store/simStore.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { nextLevelId } from '../../content/index.js'
import { Badge, Button, ChipMascot, Kbd, Modal, ProgressBar, SegmentedControl, Stars, Switch, Tabs, useToast } from '../../ui/index.js'
import { AppHeader, LevelHeaderCenter } from './AppHeader.jsx'
import { ObjectivesPanel } from './ObjectivesPanel.jsx'
import PartsDrawer from './PartsDrawer.jsx'
import Inspector from './Inspector.jsx'
import CircuitInsights from './CircuitInsights.jsx'
import ResizeHandle from './ResizeHandle.jsx'
import CompletionReward from './CompletionReward.jsx'
import { placementForPart } from './placement.js'
import CodePanel from '../code/CodePanel.jsx'
import SerialMonitor from '../code/SerialMonitor.jsx'
import AssistantPanel from '../assistant/AssistantPanel.jsx'
import './workspace.css'

const VirtualPhone = lazy(() => import('../iot/VirtualPhone.jsx'))
const IoTInspector = lazy(() => import('../iot/IoTInspector.jsx'))
const EMPTY = []

/** Shared working bench for campaign, sandbox and public interactive previews. */
export default function WorkspacePage({ mode = 'campaign', seed = null, sessionId, title, projectName, actions, onSave, onRestart, readOnly = mode === 'showcase' }) {
  const { t } = useI18n()
  const params = useParams()
  const navigate = useNavigate()
  const id = mode === 'campaign' ? params.levelId : sessionId ?? 'new'
  const session = useLevelSession({ levelId: id, mode, level: seed })
  const { doc, code, level, simState: state, objectives, success } = session
  const selectedIds = useDocumentStore(s => s.selectedIds)
  const workspace = useWorkspaceStore()
  const player = usePlayerStore(s => s.player)
  const settings = usePlayerStore(s => s.settings)
  const online = usePlayerStore(s => s.online)
  const board = getBoard(session.boardId)
  const toast = useToast()
  const [dualPrompt, setDualPrompt] = useState(false)
  const [smoke, setSmoke] = useState(null)
  const [restartPrompt, setRestartPrompt] = useState(false)
  const eventsSeen = useRef(new Set())
  const selectedKey = selectedIds.join(',')
  const campaign = mode === 'campaign'
  const rightTabs = board?.family === 'esp32' ? ['code', 'phone', 'iot'] : ['code']
  const rightTab = rightTabs.includes(workspace.rightTab) ? workspace.rightTab : 'code'
  const reportObjectives = objectives?.objectives ?? EMPTY
  const firstUnpassed = reportObjectives.find(o => !o.passed) ?? level?.objectives?.[0]
  const tier = workspace.hintTier[firstUnpassed?.id] ?? 0
  const status = state?.status ?? 'idle'
  const boardOptions = useMemo(() => BOARD_IDS.filter(value => !campaign || !level?.allowedComponents || level.allowedComponents.includes(value)).map(value => ({ value, label: getBoard(value).name })), [campaign, level])
  const diagnostics = useMemo(() => [...(state?.diagnostics ?? []), ...(state?.runtimeError ? [{ ...state.runtimeError, severity: 'error' }] : [])], [state?.diagnostics, state?.runtimeError])

  useToneAudio(state?.tones, settings.audio)
  useEffect(() => {
    if (selectedKey) useWorkspaceStore.getState().setLeftTab('inspect')
  }, [selectedKey])
  useEffect(() => {
    eventsSeen.current.clear(); setSmoke(null)
  }, [state?.runId, id])
  useEffect(() => {
    for (const event of state?.events ?? []) {
      const key = `${event.type}:${event.componentId ?? event.pinName ?? ''}`
      if (eventsSeen.current.has(key)) continue
      eventsSeen.current.add(key)
      if (!['blow', 'burnt_pin', 'short'].includes(event.type)) continue
      const warning = state?.warnings?.find(w => event.componentId ? w.componentIds?.includes(event.componentId) : event.pinName ? w.pinNames?.includes(event.pinName) : w.code === 'short_circuit')
      setSmoke(warning ?? { message: 'A part was damaged. Check the wiring before resetting.', componentIds: event.componentId ? [event.componentId] : [] })
      useWorkspaceStore.getState().setLeftTab(campaign ? 'objectives' : 'learn')
    }
  }, [state?.events, state?.warnings, campaign])
  useEffect(() => {
    if (campaign && level && !usePlayerStore.getState().hasSeen('level', level.id)) {
      useWorkspaceStore.getState().openModal('briefing')
      usePlayerStore.getState().markSeen('level', level.id)
    }
  }, [campaign, level])
  useEffect(() => {
    const timer = typeof Worker === 'undefined' ? setInterval(() => {
      const sim = useSimStore.getState().sim
      if (sim?.getState().status === 'running') sim.advance(50)
    }, 50) : null
    const save = () => useWorkspaceStore.getState().saveDraft()
    window.addEventListener('pagehide', save)
    return () => {
      if (timer) clearInterval(timer)
      save(); window.removeEventListener('pagehide', save)
      useSimStore.getState().dispose()
    }
  }, [])

  const shortcuts = useCallback(() => useWorkspaceStore.getState().openModal('shortcuts'), [])
  useKeyboard({ onRunStop: session.run, onUndo: readOnly ? undefined : useDocumentStore.getState().undo, onRedo: readOnly ? undefined : useDocumentStore.getState().redo, onSave, onHint: campaign ? session.requestHint : undefined, onShortcuts: shortcuts }, { enabled: !workspace.modal && !restartPrompt && !dualPrompt })
  function reject(reason) { toast.push({ tone: 'warning', message: reason === 'off_board' ? 'Place every leg over a breadboard hole.' : reason === 'readOnly' ? 'This shared circuit is read-only. Fork it to make changes.' : 'That placement does not fit. Try another row or rotate the part.' }) }
  function add(type) {
    if (readOnly) return
    if (campaign && level?.allowedComponents && !level.allowedComponents.includes(type)) return
    if (getDef(type)?.category === 'mcu') { changeBoard(type); return }
    const placement = placementForPart(type, doc)
    if (!placement) { toast.push({ tone: 'warning', message: 'No free placement found. Add a second breadboard or move a part.' }); return }
    useDocumentStore.getState().addComponent(type, placement)
  }
  function changeBoard(boardId) {
    if (readOnly || (campaign && level?.boardSwitcher !== 'enabled')) return
    const oldFamily = board?.family
    const result = useDocumentStore.getState().setMcu(boardId)
    const newBoard = getBoard(boardId)
    if ((oldFamily === 'raspberrypi') !== (newBoard.family === 'raspberrypi')) {
      useWorkspaceStore.getState().setEditorMode('text')
      useWorkspaceStore.getState().setCode(newBoard.family === 'raspberrypi' ? 'from gpiozero import LED\nfrom time import sleep\n\n# Connect a GPIO output before running.\n' : 'void setup() {\n}\n\nvoid loop() {\n}\n')
      useWorkspaceStore.getState().setBlocklyXml(null)
    }
    useSimStore.getState().reset()
    if (result?.removedWires?.length) toast.push({ tone: 'warning', message: `${result.removedWires.length} wires had no matching pin on the new board and were removed.` })
    if (newBoard.family === 'esp32' && doc.boardMode !== 'dual') setDualPrompt(true)
  }
  function dropPart(type, placement, props) {
    if (readOnly || (campaign && level?.allowedComponents && !level.allowedComponents.includes(type))) return
    if (getDef(type)?.category === 'mcu') {
      if (campaign && level?.boardSwitcher !== 'enabled') return
      changeBoard(type)
      const store = useDocumentStore.getState()
      const controller = store.doc.components.find(c => c.type === type)
      if (controller) store.moveComponent(controller.id, placement)
      return
    }
    useDocumentStore.getState().addComponent(type, placement, props)
  }
  function layout(boardMode) {
    const result = useDocumentStore.getState().setBoardMode(boardMode)
    if (result?.ok === false) toast.push({ tone: 'warning', message: `Move the ${result.blocking.length} parts on the second breadboard before shrinking the layout.` })
  }
  function rotate(id) {
    const comp = doc.components.find(c => c.id === id)
    const candidate = { ...comp, rotation: ((comp.rotation ?? 0) + 90) % 360 }
    if (resolvePins(candidate, doc).valid) useDocumentStore.getState().rotateComponent(id)
    else reject('invalid_placement')
  }
  function remove(ids) {
    const store = useDocumentStore.getState()
    store.removeWires(ids.filter(id => doc.wires.some(w => w.id === id)))
    store.removeComponents(ids.filter(id => doc.components.some(c => c.id === id)))
  }
  function replaceDamaged() {
    const component = doc.components.find(c => smoke?.componentIds?.includes(c.id))
    if (!component) { session.resetSim(); return }
    const replacement = createComponent(component.type, component.anchor ? { anchor: component.anchor, rotation: component.rotation } : { position: component.position, rotation: component.rotation }, component.props)
    useDocumentStore.getState().setDoc({ ...doc, components: doc.components.map(c => c.id === component.id ? replacement : c), wires: doc.wires.map(w => ({ ...w, from: w.from.replace(`${component.id}:`, `${replacement.id}:`), to: w.to.replace(`${component.id}:`, `${replacement.id}:`) })) })
    setSmoke(null)
  }
  if (session.notFound) return <div><AppHeader /><main className="p-8"><h1 className="text-xl font-semibold">{t("Quest not found")}</h1><Link className="text-brand-700 underline" to="/">{t("Back to the campaign")}</Link></main></div>
  const nextId = campaign && level ? nextLevelId(level.id) : null
  const closeModal = () => useWorkspaceStore.getState().closeModal()
  const restart = () => { setRestartPrompt(false); session.restartLevel(); onRestart?.() }
  return <div className="vq-workspace flex min-h-screen flex-col bg-surface-page text-ink">
    <AppHeader className="vq-workspace-header" center={campaign ? <LevelHeaderCenter level={level} boardVcc={board?.vcc} onBriefing={() => workspace.openModal('briefing')} /> : title} actions={actions} workspaceControls boardId={session.boardId} boardOptions={boardOptions} boardSwitcherEnabled={!readOnly && (!campaign || level?.boardSwitcher === 'enabled')} onBoardChange={changeBoard} powered={state?.powered !== false} onPoweredChange={useSimStore.getState().setPowered} showHint={campaign} hintTier={tier} hintDisabled={!campaign || !firstUnpassed || objectives?.allPassed} onHint={session.requestHint} onResetSim={session.resetSim} onRestartLevel={readOnly ? undefined : () => setRestartPrompt(true)} onShortcuts={shortcuts} status={status} onRunStop={session.run} runDisabled={!doc.mcu} />
    {session.draftOffer && <div className="border-b border-brand-200 bg-brand-50 p-2 text-sm text-brand-900">{t("Saved work is available. ")}<button className="ml-2 underline" onClick={session.resumeDraft}>{t("Resume your work")}</button><button className="ml-3 underline" onClick={session.dismissDraft}>{t("Start fresh")}</button></div>}
    {workspace.draftRestored && <div className="border-b border-line p-2 text-xs text-slate-600">{t("Resumed your work · ")}<button className="underline" onClick={() => setRestartPrompt(true)}>{t("Start over")}</button></div>}
    <main className="vq-workbench flex min-h-0 flex-1 flex-col xl:flex-row">
      <aside className="vq-left flex min-h-0 flex-col border-b border-line bg-white xl:border-b-0 xl:border-r" style={{ '--panel-width': `${workspace.panels.left}px` }}>
        <Tabs aria-label={t("Circuit panels")} size="sm" className="overflow-x-auto shrink-0" tabs={(campaign ? ['objectives', 'parts', 'inspect', 'learn', 'assistant'] : ['parts', 'inspect', 'learn', 'assistant']).map(id => ({ id, label: id === 'assistant' ? 'AI' : id[0].toUpperCase() + id.slice(1) }))} value={workspace.leftTab} onChange={workspace.setLeftTab} />
        <div className="min-h-0 flex-1 overflow-auto">
          {workspace.leftTab === 'objectives' && campaign && <ObjectivesPanel level={level} report={objectives} hintTier={workspace.hintTier} smoke={smoke} onDismissSmoke={() => setSmoke(null)} onShowWhy={() => { useDocumentStore.getState().select(smoke?.componentIds ?? []); workspace.setLeftTab('inspect') }} onReplacePart={replaceDamaged} />}
          {workspace.leftTab === 'parts' && <PartsDrawer allowed={campaign ? level?.allowedComponents : null} onAdd={add} readOnly={readOnly} />}
          {workspace.leftTab === 'inspect' && <Inspector doc={doc} selectedIds={selectedIds} state={state} readOnly={readOnly} onProps={useDocumentStore.getState().setProps} onRotate={rotate} onRemove={remove} onWireColor={(id, color) => useDocumentStore.getState().updateWire(id, { color })} onControl={useSimStore.getState().setControl} />}
          {workspace.leftTab === 'learn' && <CircuitInsights level={campaign ? level : null} state={state} />}
          <div hidden={workspace.leftTab !== 'assistant'}><AssistantPanel key={`${mode}:${id}:${doc.mcu}`} mode={mode} title={campaign ? t(level?.title) : projectName ?? seed?.title ?? doc.meta?.name} doc={doc} code={code} state={state} selectedIds={selectedIds} lesson={campaign ? level : null} objectives={objectives} /></div>
        </div>
      </aside>
      <ResizeHandle side="left" value={workspace.panels.left} onChange={px => workspace.setPanelSize('left', px)} />
      <section className="vq-bench relative min-w-0 flex-1" aria-label={t("Circuit workbench")}>
        <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap justify-end gap-2 rounded-lg border border-line bg-white p-1.5">
          <SegmentedControl size="sm" value={workspace.tool} onChange={workspace.setTool} options={[{ value: 'select', label: 'Select' }, { value: 'wire', label: 'Wire' }]} aria-label={t("Canvas tool")} />
          <Button size="sm" variant="secondary" onClick={() => workspace.setLeftTab('assistant')}>{t("Ask AI")}</Button>
          {!readOnly && <div className="flex flex-wrap gap-1" aria-label={t("Wire palette")}>{WIRE_COLORS.map(color => <button key={color} aria-label={t('{color} wire', { color: t(color) })} aria-pressed={workspace.wireColor === color} title={t('{color} wire', { color: t(color) })} className={`h-7 w-7 rounded border-2 ${workspace.wireColor === color ? 'border-brand-600' : 'border-line'}`} style={{ backgroundColor: color }} onClick={() => workspace.setWireColor(color)} />)}</div>}
        </div>
        <BreadboardCanvas doc={doc} simState={state} readOnly={readOnly} selectedIds={selectedIds} tool={workspace.tool} wireColor={workspace.wireColor} cosmetics={settings} ghost={workspace.showGhost ? level?.solution?.circuit : null} highlights={workspace.hintTargets} onSelect={useDocumentStore.getState().select} onAddComponent={dropPart} onMoveComponent={useDocumentStore.getState().moveComponent} onRotateComponent={rotate} onRemove={remove} onAddWire={useDocumentStore.getState().addWire} onRemoveWire={id => useDocumentStore.getState().removeWires([id])} onControl={useSimStore.getState().setControl} onToolChange={workspace.setTool} onWireColorChange={workspace.setWireColor} onDropRejected={reject} onEspNeedsDualBoard={() => setDualPrompt(true)} toolbarExtra={!readOnly && (!campaign || level?.boardSwitcher === 'enabled') ? <SegmentedControl size="sm" options={['half', 'full', 'dual'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} value={doc.boardMode} onChange={layout} aria-label={t("Breadboard layout")} /> : null} />
      </section>
      <ResizeHandle side="right" value={workspace.panels.right} onChange={px => workspace.setPanelSize('right', px)} />
      <aside className="vq-right flex min-h-0 flex-col border-t border-line bg-white xl:border-l xl:border-t-0" style={{ '--panel-width': `${workspace.panels.right}px` }}>
        <Tabs size="sm" aria-label={t("Program panels")} tabs={rightTabs.map(id => ({ id, label: id === 'iot' ? 'IoT' : id[0].toUpperCase() + id.slice(1) }))} value={rightTab} onChange={workspace.setRightTab} />
        <div className="min-h-0 flex-1 overflow-auto">
          {rightTab === 'code' && <CodePanel key={`${id}:${doc.mcu}`} code={code} xml={workspace.blocklyXml} editorMode={workspace.editorMode} board={board} diagnostics={diagnostics} readOnly={readOnly} onCode={workspace.setCode} onMode={workspace.setEditorMode} onBlocks={(xml, code) => { workspace.setBlocklyXml(xml); workspace.setCode(code, { fromBlocks: true }) }} />}
          <Suspense fallback={<p role="status" className="p-3 text-sm text-slate-600">{t("Loading network tools…")}</p>}>
            {rightTab === 'phone' && <VirtualPhone state={state} onRequest={useSimStore.getState().httpRequest} />}
            {rightTab === 'iot' && <IoTInspector state={state} onPublish={useSimStore.getState().mqttPublish} />}
          </Suspense>
        </div>
        <SerialMonitor state={state} baud={settings.monitorBaud} onBaud={monitorBaud => usePlayerStore.getState().setSettings({ monitorBaud })} onSend={useSimStore.getState().serialWrite} open={workspace.serialOpen} onToggle={workspace.toggleSerial} python={board?.family === 'raspberrypi'} />
      </aside>
    </main>
    <footer className="flex min-h-8 flex-wrap items-center gap-3 border-t border-line bg-white px-3 py-1 text-xs text-slate-600"><span>{t("Level ")}{player?.level ?? 1} · {player?.xp ?? 0}{t(" XP")}</span><ProgressBar className="w-28" value={player?.xp_into_level ?? 0} max={player?.xp_for_next ?? 100} label={t("Level progress")} size="sm" /><Switch label={t("Audio")} checked={settings.audio} onChange={audio => usePlayerStore.getState().setSettings({ audio })} />{!online && <Badge tone="warning">{t("Offline — saving on this device")}</Badge>}<span className="ml-auto" role="status">{t(status)} · {((state?.millis ?? 0) / 1000).toFixed(1)}{t(" s")}</span><button onClick={() => workspace.setLeftTab('learn')}>{state?.warnings?.length ?? 0}{t(" warnings")}</button></footer>
    <Modal open={workspace.modal === 'briefing'} onClose={closeModal} title={level?.title ?? t("Welcome to the lab")} footer={<Button onClick={closeModal}>{t("Start building")}</Button>}><div className="space-y-4">{level?.briefing?.map((entry, i) => <div key={i} className="flex items-start gap-3"><ChipMascot mood={entry.mood} size={44} /><p className="text-sm leading-relaxed text-slate-600">{t(entry.text)}</p></div>)}</div></Modal>
    <Modal open={workspace.modal === 'success' && !!success} onClose={session.closeSuccess} title={t("Quest complete!")} description={level?.successText} footer={<><Button variant="secondary" onClick={() => { session.closeSuccess(); session.restartLevel() }}>{t("Replay")}</Button><Button variant="secondary" onClick={() => navigate(`/sandbox?from=${level.id}`)}>{t("Open in Sandbox")}</Button><Button onClick={() => navigate(nextId ? `/play/${nextId}` : '/')}>{nextId ? t("Next level") : t("Back to map")}</Button></>}><div className="space-y-3"><Stars value={success?.stars ?? 0} animated /><CompletionReward xp={success?.xpGained ?? 0} unlocked={success?.unlocked} />{success?.levelUp && <p>{t("Level up! New cosmetics are available in your profile.")}</p>}{success?.starReasons?.map(reason => <p key={reason} className="text-sm text-slate-600">{reason}</p>)}</div></Modal>
    <Modal open={workspace.modal === 'shortcuts'} onClose={closeModal} title={t("Keyboard shortcuts")}><div className="space-y-4">{KEYBOARD_SHORTCUTS.map(group => <div key={group.group}><h3 className="mb-2 font-semibold">{t(group.group)}</h3>{group.items.map(item => <div key={item.label} className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{t(item.label)}</span><span>{item.keys.map(key => <Kbd key={key}>{key}</Kbd>)}</span></div>)}</div>)}</div></Modal>
    <Modal open={dualPrompt} onClose={() => setDualPrompt(false)} title={t("This board covers all available pin rows.")} description={t("Snap a second breadboard alongside it?")} footer={<><Button variant="secondary" onClick={() => setDualPrompt(false)}>{t("Keep one board")}</Button><Button onClick={() => { layout('dual'); setDualPrompt(false) }}>{t("Add second breadboard")}</Button></>} />
    <Modal open={restartPrompt} onClose={() => setRestartPrompt(false)} title={campaign ? t("Restart this level?") : t("Restart this project?")} description={t("This restores the starting circuit and code and clears its local draft.")} footer={<><Button variant="secondary" onClick={() => setRestartPrompt(false)}>{t("Keep working")}</Button><Button variant="danger" onClick={restart}>{t("Start over")}</Button></>} />
    {state?.runtimeError && <div className="sr-only" role="alert">{state.runtimeError.message}</div>}
  </div>
}
