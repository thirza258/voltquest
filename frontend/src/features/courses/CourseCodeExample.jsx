import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Copy, Download } from 'lucide-react'
import { getBoard } from '../../engine/boards/index.js'
import { downloadText } from '../../lib/download.js'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { courseLinkClass } from './CoursesPage.jsx'

export default function CourseCodeExample({ course }) {
  const { t } = useI18n()
  const example = course.codeExample
  const [board, setBoard] = useState(example.boards[0])
  const [notice, setNotice] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(example.code)
      setNotice('Sketch copied. Paste it into the linked lab’s code editor, then Run example.')
    } catch {
      setNotice('Copy is unavailable. Select the code below or download the sketch, then paste it into the lab.')
    }
  }
  return <section id="code-example" aria-labelledby="code-example-title" className="min-w-0 scroll-mt-6 rounded-lg border border-line bg-white p-5 sm:p-6">
    <h2 id="code-example-title" className="text-xl font-semibold text-ink">{t('Code walkthrough and experiment')}</h2>
    <h3 className="mt-4 font-semibold text-brand-700">{t(example.title)}</h3>
    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t('Read the complete sketch, predict its output, then copy it into the prepared lab and run it. Opening the lab keeps its original example until you paste this sketch.')}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={copy}>{t('Copy sketch')}</Button>
      <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => {
        if (!downloadText(example.code, `${course.id}.ino`)) setNotice('Download is unavailable. Select and copy the code below.')
      }}>{t('Download sketch')}</Button>
    </div>
    <p role="status" className="mt-2 text-sm text-brand-700">{notice && t(notice)}</p>
    <pre tabIndex={0} aria-label={t('Course example code')} className="mt-3 max-h-[32rem] overflow-auto rounded-md border border-line bg-surface-sunken p-4 font-mono text-xs leading-6 text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"><code>{example.code}</code></pre>
    <h3 className="mt-5 font-semibold text-ink">{t('Expected output')}</h3>
    <pre tabIndex={0} aria-label={t('Expected program output')} className="mt-3 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500">{example.output}</pre>
    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t(example.explanation)}</p>
    <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4">
      <h3 className="font-semibold text-ink">{t('Try it yourself')}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t(example.exercise)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-secondary">{t('Example board')}<select value={board} onChange={event => setBoard(event.target.value)} className="h-10 max-w-full rounded-md border border-line-strong bg-white px-2 focus:outline-none focus:ring-2 focus:ring-brand-500">{example.boards.map(id => <option key={id} value={id}>{getBoard(id).name}</option>)}</select></label>
        <Link to={`/tutorials/${example.tutorialId}?board=${board}`} target="_blank" rel="noopener noreferrer" className={`${courseLinkClass} text-sm`}>{t('Open experiment lab')}<ArrowRight size={14} /></Link>
      </div>
    </div>
  </section>
}
