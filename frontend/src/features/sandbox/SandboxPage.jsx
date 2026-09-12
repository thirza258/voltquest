import { useI18n } from '../../i18n/index.jsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useAsyncResource } from '../../hooks/useAsyncResource.js'
import { buildStarterDoc } from '../../hooks/useLevelSession.js'
import { useDocumentStore } from '../../store/documentStore.js'
import { useWorkspaceStore } from '../../store/workspaceStore.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { getLevel } from '../../content/index.js'
import { downloadBlob, downloadJson, downloadText } from '../../lib/download.js'
import { exportCanvasPng } from '../../canvas/exportPng.js'
import { Badge, Button, Menu, Modal, TextInput, useToast } from '../../ui/index.js'
import WorkspacePage from '../workspace/WorkspacePage.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { parseProjectFile, projectFile, projectPayload, seedFromProject } from './projectFile.js'
import { billOfMaterials, bomCsv } from './bom.js'
import { cacheProject, cachedProject, cachedProjects, isOfflineFailure, removeCachedProject } from './projectCache.js'

const START = 'void setup() {\n}\n\nvoid loop() {\n}\n'
const fingerprint = file => JSON.stringify(projectPayload(file))
function currentFile(name, description) {
  const { code, blocklyXml, editorMode } = useWorkspaceStore.getState()
  return projectFile({ name, description, circuit: useDocumentStore.getState().doc, code, blocklyXml, editorMode })
}
function initialProject(from) {
  const level = getLevel(from)
  const draft = level ? useWorkspaceStore.getState().peekDraft('campaign', from) : null
  const solution = level ? usePlayerStore.getState().progress[from]?.solution : null
  const circuit = draft?.doc ?? solution?.circuit ?? buildStarterDoc(level ?? { board: 'uno', boardMode: 'half' })
  return projectFile({ name: level ? `${level.title} remix` : 'Untitled circuit', circuit, code: draft?.code ?? solution?.code ?? level?.starterCode ?? START, blocklyXml: draft?.blocklyXml, editorMode: draft?.editorMode ?? 'text' })
}

export default function SandboxPage() {
  const { t } = useI18n()
  const { projectId } = useParams()
  const [search] = useSearchParams()
  const location = useLocation()
  const cached = location.state?.project?.id === projectId ? location.state : null
  const importedFile = location.state?.imported
  const fetcher = useCallback(async () => {
    if (!projectId) return importedFile ?? initialProject(search.get('from'))
    if (cached) { cacheProject(cached.project); return cached.project }
    await usePlayerStore.getState().ensureGuest()
    try {
      const project = await api.projects.get(projectId)
      cacheProject(project)
      return project
    } catch (error) {
      const project = isOfflineFailure(error) ? cachedProject(projectId, usePlayerStore.getState().player?.id) : null
      if (project) return project
      throw error
    }
  }, [projectId, search, cached, importedFile])
  const resource = useAsyncResource(fetcher)
  if (resource.loading || resource.error) return <div><AppHeader /><main className="p-8">{resource.loading ? <p role="status">{t("Opening project…")}</p> : <><p role="alert">{resource.error.message}</p><Button className="mt-3" onClick={resource.reload}>{t("Try again")}</Button><Link className="ml-4 underline" to="/sandbox">{t("New project")}</Link></>}</main></div>
  return <SandboxEditor key={projectId ?? `new:${location.key}`} initial={resource.data} working={cached?.working} />
}

function SandboxEditor({ initial, working }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const [project, setProject] = useState(initial)
  const [name, setName] = useState(working?.name ?? initial.name)
  const [description, setDescription] = useState(working?.description ?? initial.description ?? '')
  const [seed] = useState(() => seedFromProject(working ?? initial))
  const [saved, setSaved] = useState(() => initial.id ? fingerprint({ ...initial, boardMode: initial.board_mode, blocklyXml: initial.blockly_xml, editorMode: initial.editor_mode }) : null)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(null)
  const [imported, setImported] = useState(null)
  const [projects, setProjects] = useState(null)
  const [listError, setListError] = useState(null)
  const fileInput = useRef(null)
  const busyRef = useRef(false)
  const active = useRef(true)
  const details = useRef({ name, description })
  details.current = { name, description }
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const doc = useDocumentStore(s => s.doc)
  const code = useWorkspaceStore(s => s.code)
  const xml = useWorkspaceStore(s => s.blocklyXml)
  const editorMode = useWorkspaceStore(s => s.editorMode)
  const current = useMemo(() => projectFile({ name, description, circuit: doc, code, blocklyXml: xml, editorMode }), [name, description, doc, code, xml, editorMode])
  let dirty = true
  try { dirty = fingerprint(current) !== saved } catch { /* An incomplete circuit is still editable/exportable. */ }
  const fail = error => toast.push({ tone: 'danger', message: error.message || 'The request failed. Your local draft is still available.' })
  async function save({ publish = false } = {}) {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true)
    try {
      const file = currentFile(name, description)
      const payload = projectPayload(file)
      useWorkspaceStore.getState().saveDraft()
      await usePlayerStore.getState().ensureGuest()
      let result = project.id ? await api.projects.update(project.id, payload) : await api.projects.create(payload)
      if (publish) result = await api.projects.publish(result.id, true)
      cacheProject(result)
      if (!active.current) return
      if (!project.id) {
        navigate(`/sandbox/${result.id}`, { replace: true, state: { project: result, working: currentFile(details.current.name, details.current.description) } })
      } else { setProject(result); setSaved(fingerprint(file)); if (publish) setModal('share') }
      toast.push({ tone: 'success', message: publish ? 'Project published to the showcase.' : 'Project saved.' })
    } catch (error) { fail(error) } finally { busyRef.current = false; setBusy(false) }
  }
  async function openProjects() {
    setModal('projects'); setProjects(null); setListError(null)
    try { await usePlayerStore.getState().ensureGuest(); setProjects((await api.projects.list()).projects) }
    catch (error) {
      const available = isOfflineFailure(error) ? cachedProjects(usePlayerStore.getState().player?.id) : []
      if (available.length) { setProjects(available); toast.push({ message: 'Offline: showing recently opened projects saved on this device.' }) }
      else setListError(error.message)
    }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try {
      if (file.size > 800 * 1024) throw new Error('Project file is too large.')
      setImported(parseProjectFile(await file.text())); setModal('import')
    } catch (error) { fail(error) }
  }
  function applyImport() {
    useWorkspaceStore.getState().saveDraft()
    useWorkspaceStore.getState().discardDraft('sandbox', 'new')
    useWorkspaceStore.getState().setDraftsEnabled(false)
    setModal(null)
    navigate('/sandbox', { state: { imported } })
  }
  async function exportAs(kind) {
    try {
      const file = currentFile(name, description)
      const filename = name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '') || 'circuit'
      if (kind === 'json') downloadJson(file, `${filename}.json`)
      if (kind === 'code') downloadText(file.code, `${filename}.${file.board?.startsWith('raspberrypi') ? 'py' : 'ino'}`)
      if (kind === 'png') downloadBlob(await exportCanvasPng(document.querySelector('[data-canvas-svg]')), `${filename}.png`)
      if (kind === 'csv') downloadText(bomCsv(billOfMaterials(file.circuit)), `${filename}-bom.csv`, 'text/csv;charset=utf-8')
    } catch (error) { fail(error) }
  }
  async function unpublish() {
    setBusy(true)
    try { const updated = await api.projects.publish(project.id, false); cacheProject(updated); setProject(updated); setModal(null); toast.push({ message: 'Project removed from the showcase.' }) } catch (error) { fail(error) } finally { setBusy(false) }
  }
  const rows = modal === 'bom' ? billOfMaterials(doc) : []
  const shareUrl = project.share_slug ? `${window.location.origin}/showcase/${project.share_slug}` : ''
  return <>
    <WorkspacePage mode="sandbox" projectName={name} seed={seed} sessionId={project.id ?? 'new'} title={<input aria-label={t("Project name")} className="w-40 min-w-0 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-medium hover:border-line focus:border-brand-600 focus:outline-none" value={name} maxLength={80} onChange={e => setName(e.target.value)} />} onSave={() => save()} actions={<>
      <Badge tone={dirty ? 'neutral' : 'success'}>{busy ? t("Saving…") : dirty ? t("Unsaved") : t("Saved")}</Badge>
      <Button size="sm" onClick={() => save()} disabled={busy}>{t("Save")}</Button>
      <Menu label={t("Project actions")} trigger="Project" align="right" items={[
        { label: 'Name and description', onSelect: () => setModal('details') },
        { label: 'My projects', onSelect: openProjects },
        { label: 'New project', onSelect: () => setModal('new') },
        { label: 'Import JSON', onSelect: () => fileInput.current?.click() },
        { label: 'Export JSON', onSelect: () => exportAs('json') },
        { label: 'Export code', onSelect: () => exportAs('code') },
        { label: 'Export PNG', onSelect: () => exportAs('png') },
        { label: 'Bill of materials', onSelect: () => setModal('bom') },
        { label: project.is_public ? 'Share link / Unpublish' : 'Publish to showcase', disabled: busy, onSelect: () => setModal('share') },
        ...(project.id ? [{ label: 'Delete project', danger: true, onSelect: () => setModal('delete') }] : []),
      ]} />
    </>} />
    <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" aria-label={t("Import project file")} onChange={importFile} />
    <Modal open={modal === 'details'} onClose={() => setModal(null)} title={t("Project details")} footer={<Button onClick={() => setModal(null)}>{t("Done")}</Button>}><div className="space-y-4"><TextInput label={t("Project name")} value={name} maxLength={80} onChange={e => setName(e.target.value)} /><label className="block text-sm">{t("Description")}<textarea className="mt-2 min-h-28 w-full rounded-md border border-line p-2" value={description} maxLength={1000} onChange={e => setDescription(e.target.value)} /></label></div></Modal>
    <Modal open={modal === 'projects'} onClose={() => setModal(null)} title={t("My projects")}>{listError ? <div><p role="alert">{listError}</p><Button onClick={openProjects}>{t("Retry")}</Button></div> : projects == null ? <p role="status">{t("Loading projects…")}</p> : projects.length ? <ul className="space-y-3">{projects.map(p => <li key={p.id}><Link className="font-medium text-brand-700 underline" to={`/sandbox/${p.id}`} onClick={() => setModal(null)}>{p.name}</Link><p className="text-xs text-slate-500">{p.board} · {p.is_public ? t("Public") : t("Private")}</p></li>)}</ul> : <p>{t("No saved projects yet. Save this circuit to keep it in your account.")}</p>}</Modal>
    <Modal open={modal === 'bom'} onClose={() => setModal(null)} title={t("Bill of materials")} footer={<Button onClick={() => exportAs('csv')}>{t("Download CSV")}</Button>}><p className="mb-3 text-sm text-slate-600">{t("Catalog estimates are illustrative; check current vendor prices before buying.")}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t("Qty")}</th><th>{t("Part")}</th><th>{t("Unit USD")}</th></tr></thead><tbody>{rows.map(r => <tr key={`${r.catalog_id}:${r.value}`} className="border-t border-line"><td className="py-2 pr-3">{r.qty}</td><td className="pr-3">{r.part}{r.link && <a className="ml-2 text-brand-700 underline" href={r.link} target="_blank" rel="noreferrer">{t("Vendor")}</a>}</td><td>{r.unit_price_usd.toFixed(2)}</td></tr>)}</tbody></table></div><p className="mt-3 font-semibold">{t("Estimated total: $")}{rows.reduce((sum, r) => sum + r.qty * r.unit_price_usd, 0).toFixed(2)}</p></Modal>
    <Modal open={modal === 'share'} onClose={() => setModal(null)} title={project.is_public ? t("Share this circuit") : t("Publish this circuit?")} footer={project.is_public ? <><Button variant="secondary" onClick={unpublish} disabled={busy}>{t("Unpublish")}</Button><Button onClick={() => save({ publish: true })} disabled={busy}>{t("Save public changes")}</Button></> : <Button onClick={() => save({ publish: true })} disabled={busy}>{t("Save and publish")}</Button>}><p className="text-sm text-slate-600">{t("Published projects appear in the showcase. Anyone with the link can run and fork the circuit and code.")}</p>{shareUrl && project.is_public && <div className="mt-4 space-y-3"><Link className="break-all text-brand-700 underline" to={`/showcase/${project.share_slug}`}>{shareUrl}</Link><Button variant="secondary" onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast.push({ message: 'Share link copied.' }), fail)}>{t("Copy link")}</Button></div>}</Modal>
    <Modal open={modal === 'import'} onClose={() => setModal(null)} title={`Open ${imported?.name ?? 'imported project'}?`} description={t("Imported work replaces the current unsaved circuit. Save or export your work first to keep both projects.")} footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button onClick={applyImport}>{t("Open imported project")}</Button></>} />
    <Modal open={modal === 'new'} onClose={() => setModal(null)} title={t("Start a new circuit?")} description={t("Start with an empty Uno circuit. Save or export current unsaved work first to keep it.")} footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button onClick={() => { useWorkspaceStore.getState().saveDraft(); useWorkspaceStore.getState().discardDraft('sandbox', 'new'); useWorkspaceStore.getState().setDraftsEnabled(false); setModal(null); navigate('/sandbox', { state: { imported: initialProject() } }) }}>{t("New circuit")}</Button></>} />
    <Modal open={modal === 'delete'} onClose={() => setModal(null)} title={t("Delete this saved project?")} description={t("This removes the server copy and its public share link.")} footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("Cancel")}</Button><Button variant="danger" disabled={busy} onClick={async () => { setBusy(true); try { await api.projects.remove(project.id); removeCachedProject(project.id); useWorkspaceStore.getState().discardDraft('sandbox', project.id); useWorkspaceStore.getState().setDraftsEnabled(false); navigate('/sandbox') } catch (error) { fail(error) } finally { setBusy(false) } }}>{t("Delete project")}</Button></>} />
  </>
}
