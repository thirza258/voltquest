import { useState } from 'react'
import { Link } from 'react-router-dom'
import reference from '@content/matlab-functions.json'
import { useI18n } from '../../i18n/index.jsx'
import { MATLAB_COURSES } from './project.js'
import { fieldClass, linkClass, panelClass } from './styles.js'

export default function FunctionReference() {
  const { t } = useI18n()
  const [query, setQuery] = useState(''), [category, setCategory] = useState(''), [scope, setScope] = useState('')
  const categories = [...new Set(reference.functions.map(item => item.category))]
  const matches = reference.functions.filter(item => (!category || item.category === category) && (!scope || item.scope === scope)
    && [item.name, item.description, item.category, item.product].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  return <section id="function-reference" className={`${panelClass} mt-8 scroll-mt-6`} aria-labelledby="matlab-reference-title">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">MATLAB · {reference.functions.length} {t('reference entries')}</p>
    <h2 id="matlab-reference-title" className="mt-2 text-2xl font-semibold">{t('MATLAB function reference')}</h2>
    <p className="mt-3 text-sm leading-6 text-ink-secondary">{t('Search a curated guide to core functions and specialist products. Browser entries show the exact supported signatures; other overloads and desktop entries need MATLAB and any listed products. This guide does not claim to implement every MATLAB function or toolbox.')}</p>
    <a className={`${linkClass} mt-3 inline-block text-sm`} href="https://www.mathworks.com/help/matlab/referencelist.html?type=function" target="_blank" rel="noopener noreferrer">{t('Complete official MATLAB function catalog')}</a>
    <div className="my-5 grid gap-3 sm:grid-cols-3"><label className="text-sm">{t('Search MATLAB functions')}<input type="search" className={`${fieldClass} mt-1`} value={query} onChange={event => setQuery(event.target.value)} /></label><label className="text-sm">{t('Function category')}<select className={`${fieldClass} mt-1`} value={category} onChange={event => setCategory(event.target.value)}><option value="">{t('All categories')}</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm">{t('Execution environment')}<select className={`${fieldClass} mt-1`} value={scope} onChange={event => setScope(event.target.value)}><option value="">{t('All environments')}</option><option value="browser">{t('Runs in this sandbox')}</option><option value="desktop">{t('Desktop MATLAB')}</option></select></label></div>
    <p className="mb-3 text-sm text-slate-600" role="status">{t('{count} functions found', { count: matches.length })}</p>
    <div className="max-h-[40rem] overflow-auto rounded border border-line" tabIndex={0} role="region" aria-label={t('Function reference results')}>
      {matches.map(item => <details key={item.name} className="border-b border-line p-4 last:border-0"><summary className="cursor-pointer text-sm leading-6"><span className="font-mono font-semibold text-brand-700">{item.name}</span><span className="ml-3 text-xs text-slate-600">{t(item.scope === 'browser' ? 'Runs in this sandbox' : 'Desktop MATLAB')} · {item.category}</span><span className="mt-1 block text-ink-secondary">{item.description}</span></summary><div className="mt-3 space-y-3 text-sm"><pre className="overflow-x-auto rounded bg-slate-50 p-3 font-mono text-xs leading-6" tabIndex={0}><code>{item.signature}</code></pre><p className="text-slate-600">{item.product}</p>{item.example && <><p className="font-medium">{t('Runnable example')}</p><pre className="overflow-x-auto rounded bg-slate-900 p-3 font-mono text-xs leading-6 text-white" tabIndex={0}><code>{item.example}</code></pre></>}<a href={item.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{t('Official documentation')}</a>{MATLAB_COURSES.filter(course => course.functions.includes(item.name)).map(course => <Link className={`${linkClass} block`} key={course.id} to={`/matlab/${course.id}`}>{course.title}</Link>)}</div></details>)}
      {!matches.length && <p className="p-4 text-sm text-slate-600">{t('No functions match. Try another name or clear the filters.')}</p>}
    </div>
  </section>
}
