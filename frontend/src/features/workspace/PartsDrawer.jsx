import { useI18n } from '../../i18n/index.jsx'
import { useMemo, useState } from 'react'
import { listDefs } from '../../engine/components/registry.js'
import { DND_MIME } from '../../canvas/geometry.js'
import { Badge } from '../../ui/index.js'

const CATEGORIES = { mcu: 'Controllers', output: 'Outputs', input: 'Inputs and sensors', passive: 'Passives', module: 'Modules' }
export default function PartsDrawer({ allowed, onAdd, readOnly = false, bench = 'breadboard' }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const defs = useMemo(() => listDefs({ bench }).filter(d => (!allowed || allowed.includes(d.type)) && `${d.name} ${t(d.name)} ${d.type} ${d.category}`.toLowerCase().includes(query.toLowerCase())), [allowed, query, t, bench])
  return <section className="space-y-4 overflow-auto p-3" aria-label={t("Component drawer")}>
    <input type="search" aria-label={t("Search components")} placeholder={t("Find a component…")} value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-md border border-line-strong p-2 text-sm" />
    <p className="text-xs text-slate-600">{t(bench === 'drone' ? 'Add a part to a free compatible mount. Select it to change its mount.' : 'Drag a part onto the breadboard or click Add for a free position.')}</p>
    {Object.entries(CATEGORIES).map(([category, title]) => {
      const items = defs.filter(d => d.category === category)
      return !!items.length && <div key={category}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(title)}</h3><div className="space-y-2">{items.map(def => <div key={def.type} draggable={!readOnly} onDragStart={event => { event.dataTransfer.setData(DND_MIME, def.type); event.dataTransfer.effectAllowed = 'copy' }} className="rounded-lg border border-line bg-white p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{t(def.name)}</span><button disabled={readOnly} aria-label={t('Add {name}', { name: t(def.name) })} className="rounded border border-line px-2 py-1 text-xs text-brand-700 disabled:opacity-40" onClick={() => onAdd(def.type)}>{t("Add")}</button></div>{def.type.startsWith('esp32') && <Badge tone="info">{t("3.3 V GPIO")}</Badge>}<p className="mt-1 text-xs text-slate-600">{t(def.learn?.summary)}</p></div>)}</div></div>
    })}
    {!defs.length && <p className="text-sm text-slate-600">{t("No components match your search.")}</p>}
  </section>
}
