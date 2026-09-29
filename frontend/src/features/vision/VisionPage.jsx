import CourseRewards from '../courses/CourseRewards.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import content from '@content/vision.json'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { downloadText } from '../../lib/download.js'
import StudyLesson from '../courses/StudyLesson.jsx'
import VisionLab from './VisionLab.jsx'
import { DEFAULT_VISION } from '../../engine/vision/model.js'
import { VISION_EXAMPLES } from './examples.js'

import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'

export const VISION_TUTORIALS = content.tutorials
function Examples({ ids }) {
  const { t } = useI18n()
  return <section className="mt-6 space-y-4" aria-label={t('Companion integration examples')}><h2 className="text-xl font-semibold">{t('Companion code and integration')}</h2>{ids.map(id => { const example = VISION_EXAMPLES[id]; return <details key={id} className="rounded-lg border border-line bg-white p-4"><summary className="cursor-pointer font-semibold">{t(example.title)}</summary><p className="my-3 text-sm leading-relaxed text-slate-600">{t(example.note)}</p><pre className="max-h-96 overflow-auto rounded bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{example.code}</pre><Button size="sm" variant="secondary" className="mt-3" onClick={() => downloadText(example.code, example.filename)}>{t('Download Python example')}</Button></details> })}</section>
}
export default function VisionPage({ sandbox = false }) {
  const { t } = useI18n()
  const { lessonId } = useParams()
  const [search] = useSearchParams()
  const lesson = VISION_TUTORIALS.find(item => item.id === (sandbox ? search.get('lesson') : lessonId))

  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="vision"
        description={t('Explore OpenCV, patch attention and device integration with editable scenes and local processing.')}
        courseLink={lesson ? `/vision/${lesson.id}` : '/vision'}
        courseLinkLabel={t(lesson ? 'Back to the course' : 'All computer vision courses')}
      >
        <VisionLab key={lesson?.id ?? 'free'} initialConfig={lesson?.config ?? DEFAULT_VISION} integrated={lesson?.integrated ?? false} />
      </SandboxBenchLayout>
    )
  }

  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <CourseRewards />
    <Link className="mb-6 inline-block text-sm text-brand-700 underline" to={lessonId ? '/vision' : '/tutorials'}>{t(lessonId ? 'All computer vision courses' : 'All tutorials')}</Link>
    {lesson ? <StudyLesson key={lesson.id} lesson={lesson} next={VISION_TUTORIALS[lesson.order]} basePath="/vision" sandboxLink={`/sandbox?bench=vision&lesson=${lesson.id}`}><VisionLab initialConfig={lesson.config} integrated={lesson.integrated} /><Examples ids={lesson.exampleIds} /></StudyLesson>
      : lessonId ? <h1 className="text-xl font-semibold">{t('Lesson not found')}</h1>
        : <><h1 className="text-3xl font-semibold">{t('Computer vision: OpenCV, transformers & integration')}</h1><p className="my-4 max-w-3xl leading-relaxed text-ink-secondary">{t('Six courses with guided tutorials, formulas, questions and exams. Learn image processing, drone markers, robot steering, vision transformer concepts, deployment interfaces and a capstone connecting all three device themes.')}</p><div className="flex flex-wrap gap-4"><Link className="my-3 inline-block rounded border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700" to="/sandbox?bench=vision">{t('Open computer vision sandbox')}</Link><Link className="my-3 inline-block rounded border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700" to="/vision/vision-integration">{t('Open the integration capstone')}</Link></div><div className="mt-5 grid gap-4 md:grid-cols-2">{VISION_TUTORIALS.map(item => <Link key={item.id} className="rounded-lg border border-line bg-white p-5 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500" to={`/vision/${item.id}`}><p className="text-xs font-semibold text-brand-700">{t(item.difficulty)} · {item.minutes} {t('min')}</p><h2 className="mt-2 text-lg font-semibold">{t(item.title)}</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t(item.summary)}</p><p className="mt-4 text-sm font-medium text-brand-700">{t('Open course and tutorial →')}</p></Link>)}</div></>}
  </main></div>
}
