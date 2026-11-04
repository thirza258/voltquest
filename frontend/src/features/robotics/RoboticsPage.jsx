import CourseRewards from '../courses/CourseRewards.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import content from '@content/robotics.json'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { useI18n } from '../../i18n/index.jsx'
import StudyLesson from '../courses/StudyLesson.jsx'
import RoboticsLab from './RoboticsLab.jsx'
import { DEFAULT_PROJECT } from '../../engine/robotics/model.js'

import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import ConnectedPath from '../courses/ConnectedPath.jsx'

export const ROBOTICS_TUTORIALS = content.tutorials
export default function RoboticsPage({ sandbox = false }) {
  const { t } = useI18n()
  const { lessonId } = useParams()
  const [search] = useSearchParams()
  const lesson = ROBOTICS_TUTORIALS.find(item => item.id === (sandbox ? search.get('lesson') : lessonId))

  if (sandbox) {
    return (
      <SandboxBenchLayout
        bench="robotics"
        description={t('Experiment freely with a mobile robot and ROS 2 concepts. Load a saved robot or edit the world below.')}
        courseLink={lesson ? `/robotics/${lesson.id}` : '/robotics'}
        courseLinkLabel={t(lesson ? 'Back to the tutorial' : 'All robotics tutorials')}
      >
        <RoboticsLab key={lesson?.id ?? 'free'} initialProject={lesson?.project ?? DEFAULT_PROJECT} />
      </SandboxBenchLayout>
    )
  }

  return <div className="min-h-screen bg-surface-page"><AppHeader /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <CourseRewards />
    <Link className="mb-6 inline-block text-sm text-brand-700 underline" to={lessonId ? '/robotics' : '/tutorials'}>{t(lessonId ? 'All robotics tutorials' : 'All tutorials')}</Link>
    {lesson ? <StudyLesson key={lesson.id} lesson={lesson} next={ROBOTICS_TUTORIALS[lesson.order]} basePath="/robotics" sandboxLink={`/sandbox?bench=robotics&lesson=${lesson.id}`}><RoboticsLab initialProject={lesson.project} /></StudyLesson>
      : lessonId ? <h1 className="text-xl font-semibold">{t('Lesson not found')}</h1>
        : <><h1 className="text-3xl font-semibold">{t('Robotics & ROS 2 learning path')}</h1><p className="my-4 max-w-3xl leading-relaxed text-ink-secondary">{t('Five tutorials from easy to intermediate: robot motion, nodes and topics, sensors, services and parameters, then waypoint actions. Each combines theory, formulas, an interactive world, practice questions and an exam.')}</p><Link className="my-3 inline-block rounded border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700" to="/sandbox?bench=robotics">{t('Open robotics sandbox')}</Link><ConnectedPath current="robotics" /><div className="mt-5 grid gap-4 md:grid-cols-2">{ROBOTICS_TUTORIALS.map(item => <Link key={item.id} className="rounded-lg border border-line bg-white p-5 hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500" to={`/robotics/${item.id}`}><p className="text-xs font-semibold text-brand-700">{t(item.difficulty)} · {item.minutes} {t('min')}</p><h2 className="mt-2 text-lg font-semibold">{t(item.title)}</h2><p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t(item.summary)}</p><p className="mt-4 text-sm font-medium text-brand-700">{t('Open tutorial →')}</p></Link>)}</div></>}
  </main></div>
}
