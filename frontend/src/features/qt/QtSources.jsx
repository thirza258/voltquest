import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { downloadBlob, downloadText } from '../../lib/download.js'
import { Button } from '../../ui/index.js'
import { getQtFiles } from './samples.js'
import { sourcePack } from '../../lib/sourcePack.js'
import { codeClass, fieldClass, panelClass } from './content.js'

export default function QtSources({ course }) {
  const { t } = useI18n()
  const files = useMemo(() => getQtFiles(course), [course])
  const [filename, setFilename] = useState('main.cpp')
  const [notice, setNotice] = useState('')
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(files[filename])
      setNotice('Source copied.')
    } catch { setNotice('Copy is unavailable. Select the source text or download the file.') }
  }
  return <section id="native-source" aria-labelledby="native-source-title" className={`${panelClass} scroll-mt-6`}>
    <h2 id="native-source-title" className="text-xl font-semibold">{t('C++ / Qt lesson files')}</h2>
    <p className="mt-3 text-sm leading-6 text-ink-secondary">{t('Download and extract the complete CMake project. Read README.md for the required Qt modules, build commands, test commands and expected behavior. The source shown here is exactly what the ZIP contains.')}</p>
    <div className="my-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
      <p>{t('Build and run these projects on your computer with Qt. VoltQuest displays source and provides assessments; it does not compile or run Qt apps in the browser.')}</p>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 basis-full text-sm font-medium sm:flex-1 sm:basis-60">{t('Lesson source file')}
        <select className={`${fieldClass} mt-1`} value={filename} onChange={event => { setFilename(event.target.value); setNotice('') }}>
          {Object.keys(files).map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <Button variant="secondary" onClick={copy}>{t('Copy source')}</Button>
      <Button variant="secondary" onClick={() => { if (!downloadText(files[filename], filename)) setNotice('Download is unavailable in this browser.') }}>{t('Download file')}</Button>
      <Button onClick={() => { if (!downloadBlob(sourcePack(files), `${course.id}-source.zip`)) setNotice('Download is unavailable in this browser.') }}>{t('Download lesson ZIP')}</Button>
    </div>
    <p role="status" className="my-3 text-sm text-brand-700">{notice && t(notice)}</p>
    <pre aria-label={t('Native lesson source')} className={`${codeClass} max-h-[36rem]`} tabIndex={0}><code>{files[filename]}</code></pre>
    <details className="mt-5 border-t border-line pt-4">
      <summary className="cursor-pointer font-semibold text-brand-700">{t('Qt setup and build instructions')}</summary>
      <pre tabIndex={0} className={`${codeClass} mt-4 whitespace-pre-wrap break-words`}>{files['README.md']}</pre>
    </details>
  </section>
}
