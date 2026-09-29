import { useState } from 'react'
import { Moon, Sun, X } from 'lucide-react'
import { useI18n } from '../../../i18n/index.jsx'
import { readJson, writeJson } from '../../../lib/storage.js'
import './workbench.css'

/** One Dark/Light preference for every VS Code-style sandbox workbench (AI agents, HPC). */
export const WORKBENCH_THEME_KEY = 'vq.workbench.theme'

export function useWorkbenchTheme() {
  const [theme, setTheme] = useState(() => readJson(WORKBENCH_THEME_KEY) === 'light' ? 'light' : 'dark')
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); writeJson(WORKBENCH_THEME_KEY, next)
  }
  return [theme, toggle]
}

export function ThemeToggle({ theme, onToggle }) {
  const { t } = useI18n()
  const label = t(theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  return <button type="button" className="wb-icon-button" aria-label={label} title={label} onClick={onToggle}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
}

/** Editor document tabs; `fixed` ids cannot be closed. */
export function EditorTabs({ docs, active, label, modified = () => false, fixed = [], onSelect, onClose, prefix = 'wb-doc' }) {
  const { t } = useI18n()
  return <div className="wb-tabs" role="tablist" aria-label={t('Open editors')}>
    {docs.map(id => <span key={id} className="wb-tab-wrap">
      <button type="button" role="tab" id={`${prefix}-${id.replace(/[^\w-]/g, '_')}`} aria-selected={active === id} className="wb-tab" onClick={() => onSelect(id)}>{label(id)}{modified(id) ? <span aria-label={t('modified')} style={{ color: 'var(--wb-accent)' }}>●</span> : null}</button>
      {!fixed.includes(id) && <button type="button" className="wb-icon-button" aria-label={t('Close {name}', { name: label(id) })} onClick={() => onClose(id)}><X size={12} /></button>}
    </span>)}
  </div>
}
export const tabPanelId = (prefix, id) => `${prefix}-${id.replace(/[^\w-]/g, '_')}`

/** Bottom panel tabs: [id, label, count]. */
export function PanelTabs({ tabs, active, onSelect, label, prefix = 'wb-panel' }) {
  const { t } = useI18n()
  return <div className="wb-panel-tabs" role="tablist" aria-label={t(label)}>
    {tabs.map(([id, text, count, disabled]) => <button key={id} type="button" role="tab" id={`${prefix}-${id}`} aria-selected={active === id} disabled={disabled} className="wb-panel-tab" onClick={() => onSelect(id)}>{t(text)}{count ? <span className="wb-badge">{count}</span> : null}</button>)}
  </div>
}
