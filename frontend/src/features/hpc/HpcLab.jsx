import { useI18n } from '../../i18n/index.jsx'
import { Button, Modal } from '../../ui/index.js'
import { LABS } from '../../engine/hpc/model.js'
import { createHpcProject } from './project.js'
import { useHpcNotebook } from './useHpcNotebook.js'

export const panelClass = 'min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6'
export const fieldClass = 'w-full min-w-0 rounded-md border border-line-strong bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const numberText = value => typeof value === 'number' ? Number.isInteger(value) ? String(value) : Number(value.toPrecision(7)).toString() : value

export function ExperimentResults({ result }) {
  const { t } = useI18n()
  const barMax = Math.max(1, ...(result.bars ?? []).map(bar => bar.value))
  return <section className="mt-5 space-y-5" aria-label={t('Experiment results')}>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{result.metrics.map(item => <div key={item.label} className="min-w-0 rounded-md border border-teal-200 bg-teal-50 p-3"><p className="text-xs text-teal-900">{t(item.label)}</p><p className="mt-2 break-words font-mono text-xl tabular-nums">{numberText(item.value)} <span className="text-xs">{item.unit}</span></p></div>)}</div>
    <ul className="space-y-2">{result.checks.map(item => <li key={item.label} className={`rounded-md border p-3 text-sm leading-relaxed ${item.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><strong>{t(item.passed ? 'PASS' : 'FAIL')}: {t(item.label)}</strong><p className="mt-1">{t(item.detail)}</p></li>)}</ul>
    {result.bars && <div className="flex h-36 items-end gap-1 overflow-hidden border-b border-line px-1" role="img" aria-label={t('Relative values; exact values appear in the results table.')}>
      {result.bars.map((bar, i) => <div key={bar.label} title={`${bar.label}: ${numberText(bar.value)}`} className="min-w-0 flex-1 bg-teal-600" style={{ height: `${100 * bar.value / barMax}%`, minHeight: '1px', opacity: i % 2 ? 0.7 : 1 }} />)}
    </div>}
    <div className="max-h-96 overflow-auto rounded-md border border-line" tabIndex={0} role="region" aria-label={t('Experiment data table')}><table className="w-full text-left text-sm"><caption className="sr-only">{t('Experiment data')}</caption><thead className="bg-surface-sunken"><tr>{result.columns.map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{t(label)}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index} className="border-t border-line">{row.map((value, i) => <td key={i} className="max-w-sm break-words px-3 py-2 font-mono text-xs tabular-nums">{typeof value === 'string' ? t(value) : numberText(value)}</td>)}</tr>)}</tbody></table></div>
    <p className="text-sm leading-relaxed text-slate-600">{t(result.note)}</p>
  </section>
}

export default function HpcLab({ initialLab = 'correctness', free = false }) {
  const { t } = useI18n()
  const notebook = useHpcNotebook({ initialLab, free })
  const { project, result, running, message, error, pending, dirty, lab, instructions, fileRef } = notebook
  const { edit, replace, propose, run, save, importFile } = notebook
  return <div className="space-y-5" data-hpc-lab={project.lab}>
    <section className={panelClass} aria-labelledby="hpc-experiment-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Interactive HPC experiment')}</p><h2 id="hpc-experiment-title" className="mt-2 text-xl font-semibold">{t(lab.title)}</h2></div><span className="text-xs text-slate-600">{t(dirty ? 'Unsaved changes' : 'Current experiment')}</span></div>
      <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t('Run an algorithm or a performance model using the controls below. Results explain the experiment; native CPU, GPU and cluster performance must be measured on your own system.')}</p>
      {free && <label className="mt-4 block text-sm"><span>{t('Choose an HPC experiment')}</span><select className={`${fieldClass} mt-1`} value={project.lab} onChange={event => notebook.selectLab(event.target.value)}>{Object.entries(LABS).map(([id, item]) => <option key={id} value={id}>{t(item.title)}</option>)}</select></label>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(lab.fields).map(([key, field]) => <label key={key} className="min-w-0 text-sm"><span>{t(field.label)}</span>{field.type === 'select' ? <select className={`${fieldClass} mt-1`} value={project.parameters[key]} onChange={event => edit({ parameters: { ...project.parameters, [key]: event.target.value } }, true)}>{field.options.map(option => <option key={option} value={option}>{t(option)}</option>)}</select> : <input className={`${fieldClass} mt-1`} type={field.type} min={field.min} max={field.max} step={field.step} maxLength={field.type === 'text' ? 2000 : undefined} value={Number.isNaN(project.parameters[key]) ? '' : project.parameters[key]} onChange={event => edit({ parameters: { ...project.parameters, [key]: field.type === 'number' ? event.target.value === '' ? NaN : Number(event.target.value) : event.target.value } }, true)} />}</label>)}</div>
      <div className="mt-5 flex flex-wrap gap-2"><Button onClick={run} disabled={running}>{t('Run experiment')}</Button>{running && <Button variant="secondary" onClick={notebook.cancel}>{t('Cancel run')}</Button>}<Button variant="secondary" onClick={() => propose(createHpcProject(project.lab))}>{t('Reset experiment')}</Button><Button variant="secondary" disabled={!result || running} onClick={notebook.exportResults}>{t('Export results')}</Button></div>
      <p className="mt-3 text-sm text-brand-700" role="status">{running ? t('Running experiment…') : t(message || 'Change the settings, make a prediction, then run the experiment.')}</p>
      {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-800">{t(error)}</p>}
      {result && <ExperimentResults result={result} />}
    </section>
    <section className={panelClass} aria-labelledby="native-source-title">
      <h2 id="native-source-title" className="text-xl font-semibold">{t('Native C / C++ source and testing')}</h2>
      <p className="my-3 text-sm leading-relaxed text-ink-secondary">{t('Edit and download this standalone program, then compile it locally. Source edits do not change the browser experiment. Both language drafts are retained when switching C and C++.')}</p>
      <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm"><span>{t('Source language')}</span><select className={`${fieldClass} mt-1`} value={project.language} onChange={event => edit({ language: event.target.value })}><option value="c">C17</option><option value="cpp">C++17</option></select></label><Button variant="secondary" onClick={notebook.downloadSource}>{t('Download source')}</Button><Button variant="ghost" onClick={notebook.restoreSource}>{t('Restore source example')}</Button></div>
      <textarea aria-label={t('Editable native source')} className={`${fieldClass} h-80 resize-y whitespace-pre font-mono text-xs leading-5`} spellCheck={false} wrap="off" maxLength={65536} value={project.sources[project.language]} onChange={event => edit({ sources: { ...project.sources, [project.language]: event.target.value } })} />
      <h3 className="mt-5 font-semibold">{t('Build and run locally')}</h3><p className="my-2 text-sm leading-relaxed text-slate-600">{t(instructions.requirements)}</p>
      <pre className="overflow-x-auto rounded-md bg-surface-sunken p-4 text-xs leading-6" tabIndex={0}><code>{instructions.build}{'\n'}{instructions.run}</code></pre>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-brand-700">{t('Compiler setup, debug checks and performance reports')}</summary><div className="mt-3 space-y-3 leading-relaxed text-slate-700">
        <p>{t('Use a local GCC or Clang toolchain. Linux/WSL can use distribution packages for a C/C++ compiler and Open MPI. On macOS install the command-line developer tools; OpenMP and MPI require additional runtimes. Check compiler and runtime versions before copying benchmark results.')}</p>
        <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs leading-6" tabIndex={0}><code>{'# Ubuntu / Debian / WSL\nsudo apt install build-essential openmpi-bin libopenmpi-dev\n\n# macOS, with Homebrew already installed\nxcode-select --install\nbrew install libomp open-mpi'}</code></pre>
        <p>{t('For a debug check, replace -O3 with -O1 -g -fsanitize=address,undefined -fno-omit-frame-pointer. Run the test cases again. Collect release performance separately. Sanitizer support varies by toolchain and parallel runtime.')}</p>
        <p>{t('Clang vectorization diagnostics: -Rpass=loop-vectorize -Rpass-missed=loop-vectorize. GCC diagnostics: -fopt-info-vec-optimized -fopt-info-vec-missed. Inspect the target kernel, not just initialization loops.')}</p>
        <p>{t('Apple Clang with Homebrew libomp: replace -fopenmp with -Xpreprocessor -fopenmp and add the installed libomp include directory, library directory and -lomp. Use brew --prefix libomp to locate them. MPI programs use mpicc or mpicxx and mpiexec from the same installation.')}</p>
        {instructions.macBuild && <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 text-xs leading-6" tabIndex={0}><code>{instructions.macBuild}{'\n'}{instructions.run}</code></pre>}
        <p>{t('Each example accepts bounded positive integer arguments and exits nonzero on a failed check. Run the course’s edge cases after editing; a PASS from the browser does not validate this source.')}</p>
      </div></details>
    </section>
    <section className={panelClass} aria-labelledby="hpc-notebook-title"><h2 id="hpc-notebook-title" className="text-lg font-semibold">{t('Experiment notebook')}</h2><p className="my-3 text-sm text-slate-600">{t('Record your prediction, commands, machine and compiler, correctness results, raw timings and conclusion. Save keeps this experiment’s settings, both source drafts and notes in this browser.')}</p>
      <textarea aria-label={t('Experiment notes')} className={`${fieldClass} h-36`} value={project.notes} maxLength={10240} onChange={event => edit({ notes: event.target.value })} />
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={save}>{t('Save experiment')}</Button><Button variant="secondary" onClick={notebook.loadSaved}>{t('Load saved experiment')}</Button><Button variant="secondary" onClick={notebook.exportProject}>{t('Export experiment')}</Button><Button variant="secondary" onClick={() => fileRef.current?.click()}>{t('Import experiment')}</Button><input ref={fileRef} type="file" className="hidden" accept=".json,application/json" aria-label={t('Import HPC JSON file')} onChange={importFile} /></div>
      <p className="mt-3 text-xs text-slate-600">{t('HPC work is stored separately from circuit projects and account saves. Export a JSON file to move it to another browser. Results are valid only for the settings that produced them.')}</p>
    </section>
    <Modal open={Boolean(pending)} onClose={() => notebook.setPending(null)} title={t('Replace the current HPC experiment?')} description={t('This replaces the displayed settings, source drafts and notes with the selected version. Export or save current work first if you want to keep it.')} footer={<><Button variant="secondary" onClick={() => notebook.setPending(null)}>{t('Cancel')}</Button><Button onClick={() => replace(pending)}>{t('Replace experiment')}</Button></>}><p className="text-sm">{pending && t(LABS[pending.lab].title)}</p></Modal>
  </div>
}
