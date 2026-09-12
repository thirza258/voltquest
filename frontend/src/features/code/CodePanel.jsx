import { useI18n } from '../../i18n/index.jsx'
import { lazy, Suspense, useState } from 'react'
import { Button, Modal, SegmentedControl } from '../../ui/index.js'
const MonacoEditor = lazy(() => import('./MonacoEditor.jsx'))
const BlocklyEditor = lazy(() => import('./BlocklyEditor.jsx'))

export default function CodePanel({ code, xml, editorMode, board, diagnostics, readOnly = false, onCode, onBlocks, onMode }) {
  const { t } = useI18n()
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const python = board?.family === 'raspberrypi'
  const blocks = !python && editorMode === 'blocks'
  async function changeMode(mode) {
    if (mode === editorMode) return
    if (mode === 'text') { onMode(mode); return }
    try {
      const { codeFromXml } = await import('./BlocklyEditor.jsx')
      if (code.trim() !== codeFromXml(xml).trim()) { setConfirm(true); return }
      onMode('blocks')
    } catch (e) { setError(e.message) }
  }
  return <div className="flex h-full min-h-0 flex-col" aria-label={t("Code editor")}>
    <div className="flex items-center justify-between gap-2 border-b border-line p-2">
      <span className="text-xs font-medium text-slate-600">{python ? t("Python GPIO") : t("Arduino C++")}</span>
      {!python && !readOnly && <SegmentedControl size="sm" options={[{ value: 'text', label: 'Text' }, { value: 'blocks', label: 'Blocks' }]} value={editorMode} onChange={changeMode} aria-label={t("Editor mode")} />}
    </div>
    {error && <p role="alert" className="p-2 text-xs text-rose-700">{error}</p>}
    {python && <p className="border-b border-line p-2 text-xs text-slate-600">{t("Restricted GPIO Python: gpiozero, RPi.GPIO and time. See the Pi tutorials for supported syntax.")}</p>}
    <Suspense fallback={<p role="status" className="p-3 text-sm text-slate-600">{t("Loading editor…")}</p>}>
      {blocks && <div className="min-h-[280px] flex-1"><BlocklyEditor xml={xml} esp32={board?.family === 'esp32'} readOnly={readOnly} onChange={onBlocks} /></div>}
      {blocks && <p className="border-y border-line p-2 text-xs text-slate-600">{t("Generated from blocks")}</p>}
      <div className={blocks ? 'h-48 min-h-[160px]' : 'min-h-[260px] flex-1'}><MonacoEditor value={code} onChange={onCode} language={python ? 'python' : 'cpp'} diagnostics={diagnostics} readOnly={readOnly || blocks} /></div>
    </Suspense>
    {!!diagnostics?.length && <ul aria-label={t("Code diagnostics")} className="max-h-28 overflow-auto border-t border-line bg-rose-50 p-2 text-xs text-rose-800">{diagnostics.map((d, i) => <li key={i}>{t("Line ")}{d.line ?? 1}: {d.message}</li>)}</ul>}
    <Modal open={confirm} onClose={() => setConfirm(false)} title={t("Use the block program?")} description={t("The block program will replace your current text. Export or copy your sketch first if you want to keep both versions.")} footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t("Keep text")}</Button><Button onClick={() => { setConfirm(false); onMode('blocks') }}>{t("Use blocks")}</Button></>} />
  </div>
}
