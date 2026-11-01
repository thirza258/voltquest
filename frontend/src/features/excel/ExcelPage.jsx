import { useState, useEffect } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { readCourseProgress } from '../courses/progress.js'
import CourseRewards from '../courses/CourseRewards.jsx'
import SandboxBenchLayout from '../sandbox/SandboxBenchLayout.jsx'
import ExcelCourse from './ExcelCourse.jsx'
import ExcelSimulator from './ExcelSimulator.jsx'
import ExcelFunctionDirectoryModal from './ExcelFunctionDirectoryModal.jsx'
import excelData from '../../../../content/excel.json'
import {
  Table,
  Search,
  BookOpen,
  CheckCircle2,
  Play,
} from 'lucide-react'

export const EXCEL_COURSES = excelData.courses

function ExcelHub() {
  const { t } = useI18n()
  const { hash } = useLocation()
  const [search, setSearch] = useSearchParams()
  const [isFuncLibOpen, setIsFuncLibOpen] = useState(false)

  const query = search.get('q') ?? ''
  const difficulty = search.get('difficulty') ?? ''

  const progress = Object.fromEntries(
    EXCEL_COURSES.map((course) => [course.id, readCourseProgress(course)])
  )
  const passed = EXCEL_COURSES.filter(
    (course) => progress[course.id].bestPercent >= course.exam.passPercent
  )
  const next = EXCEL_COURSES.find((course) => !passed.includes(course)) ?? EXCEL_COURSES[0]

  const matches = EXCEL_COURSES.filter((course) => {
    const matchesDiff = !difficulty || course.difficulty === difficulty
    const textSearch = [
      course.title,
      course.summary,
      ...course.lessons.map((l) => l.title),
    ]
      .join(' ')
      .toLowerCase()
    return matchesDiff && textSearch.includes(query.trim().toLowerCase())
  })

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
    }
  }, [hash])

  function filter(key, value) {
    const params = new URLSearchParams(search)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearch(params, { replace: true })
  }

  const panelClass = 'rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-md'
  const linkClass = 'text-emerald-400 hover:text-emerald-300 font-medium underline'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 font-sans text-slate-100 sm:px-6 lg:px-8">
      <Link to="/courses" className={linkClass}>
        ← {t('All learning paths & tracks')}
      </Link>

      {/* Header */}
      <header className="my-7 max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          {t('Enterprise Data Analytics & Modeling')} · {t('Fundamental → Advanced')}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
          Microsoft Excel & Data Analytics
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          Master data analysis, spreadsheet modeling, and business intelligence with Microsoft Excel.
          Explore formulas from SUM to XLOOKUP, conditional aggregations, pivot table summaries,
          statistical exploratory analysis, and executive dashboards—all inside an interactive in-browser
          Excel simulator.
        </p>

        <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-emerald-300">
          <span className="rounded-full border border-emerald-800/80 bg-emerald-950/60 px-3 py-1">
            10 Structured Courses · 40 Checkpoints
          </span>
          <span className="rounded-full border border-sky-800/80 bg-sky-950/60 px-3 py-1 text-sky-300">
            40 Practice Checks · 10 Certification Exams
          </span>
          <span className="rounded-full border border-amber-800/80 bg-amber-950/60 px-3 py-1 text-amber-300">
            Interactive In-Browser Excel Simulator
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
            to={`/excel/${next.id}`}
          >
            <Play className="h-4 w-4 fill-white" />
            {t('Continue Excel Path')} ({next.title.split('.')[1] || next.title})
          </Link>
          <Link
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-500 hover:text-white"
            to="/sandbox?bench=excel"
          >
            <Table className="h-4 w-4 text-emerald-400" />
            {t('Open Freeform Excel Sandbox')}
          </Link>
          <button
            onClick={() => setIsFuncLibOpen(true)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-emerald-400"
          >
            <BookOpen className="h-4 w-4" />
            {t('Browse Function Library')}
          </button>
        </div>
      </header>

      {/* Curriculum Stages Overview */}
      <section className={`${panelClass} mb-8`} aria-label="Curriculum stages">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
          Curriculum Architecture & Roadmap
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div>
            <p className="font-mono font-bold text-emerald-400">01–03</p>
            <h3 className="mt-1 font-bold text-white text-sm">Formulas & Lookups</h3>
            <p className="mt-1 leading-5 text-slate-400">
              Worksheet coordinates, relative vs. absolute references, arithmetic, VLOOKUP, INDEX/MATCH, and XLOOKUP.
            </p>
          </div>
          <div>
            <p className="font-mono font-bold text-sky-400">04–06</p>
            <h3 className="mt-1 font-bold text-white text-sm">Logic & Wrangling</h3>
            <p className="mt-1 leading-5 text-slate-400">
              SUMIFS/AVERAGEIFS, text cleansing (TRIM/CONCAT), serial date mathematics (DATEDIF), and deduplication.
            </p>
          </div>
          <div>
            <p className="font-mono font-bold text-amber-400">07–08</p>
            <h3 className="mt-1 font-bold text-white text-sm">Pivots & Dashboards</h3>
            <p className="mt-1 leading-5 text-slate-400">
              Pivot table caches, multidimensional grouping, interactive slicers, column/line/pie charts, and visual hierarchy.
            </p>
          </div>
          <div>
            <p className="font-mono font-bold text-purple-400">09–10</p>
            <h3 className="mt-1 font-bold text-white text-sm">Statistics & Capstone</h3>
            <p className="mt-1 leading-5 text-slate-400">
              Descriptive statistics (STDEV.S, IQR outliers, CORREL) leading into an end-to-end commercial analytics capstone.
            </p>
          </div>
        </div>
      </section>

      {/* Rewards & Daily Streak Widget */}
      <div className="mb-8">
        <CourseRewards />
      </div>

      {/* Search and Difficulty Filter */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder={t('Search Excel courses, formulas, topics…')}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            value={query}
            onChange={(e) => filter('q', e.target.value)}
          />
        </div>
        <div>
          <select
            aria-label="Course difficulty"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
            value={difficulty}
            onChange={(e) => filter('difficulty', e.target.value)}
          >
            <option value="">{t('All Difficulties (Fundamental, Intermediate, Advanced)')}</option>
            <option value="Fundamental">{t('Fundamental')}</option>
            <option value="Intermediate">{t('Intermediate')}</option>
            <option value="Advanced">{t('Advanced')}</option>
          </select>
        </div>
      </div>

      {/* Course Count Summary */}
      <p role="status" className="mb-4 text-xs font-medium text-slate-400">
        {t('{count} courses available', { count: matches.length })} ·{' '}
        <span className="text-emerald-400 font-semibold">
          {t('{count} of {total} certification exams passed', {
            count: passed.length,
            total: EXCEL_COURSES.length,
          })}
        </span>
      </p>

      {/* Course Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {matches.map((course) => {
          const courseProg = progress[course.id]
          const isExamPassed = courseProg.bestPercent >= course.exam.passPercent
          const readCount = courseProg.read.length

          return (
            <Link
              key={course.id}
              to={`/excel/${course.id}`}
              className={`${panelClass} group flex flex-col justify-between transition-all hover:border-emerald-500/80 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-semibold ${
                      course.difficulty === 'Fundamental'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                        : course.difficulty === 'Intermediate'
                        ? 'bg-sky-950 text-sky-400 border border-sky-800/60'
                        : 'bg-purple-950 text-purple-400 border border-purple-800/60'
                    }`}
                  >
                    {t(course.difficulty)}
                  </span>
                  <span className="text-slate-400 font-mono">{course.minutes} mins</span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-white group-hover:text-emerald-400 transition">
                  {course.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{course.summary}</p>

                <div className="mt-4 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                  <span className="rounded bg-slate-950 px-2 py-0.5 font-mono">
                    4 Checkpoints with Practice Checks
                  </span>
                  <span className="rounded bg-slate-950 px-2 py-0.5 font-mono text-emerald-400">
                    Interactive Lab & Challenge
                  </span>
                  <span className="rounded bg-slate-950 px-2 py-0.5 font-mono text-sky-400">
                    5-Question Exam (80%)
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                <span className="text-slate-400">
                  {isExamPassed ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Passed ({courseProg.bestPercent}%)
                    </span>
                  ) : (
                    t('{count} of {total} sections completed', {
                      count: readCount,
                      total: course.lessons.length,
                    })
                  )}
                </span>
                <span className="font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                  {t('Open Course')} →
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {matches.length === 0 && (
        <div className={`${panelClass} py-12 text-center`}>
          <p className="text-sm text-slate-400">{t('No courses match your filter criteria.')}</p>
          <button
            onClick={() => setSearch({})}
            className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {t('Clear Filters')}
          </button>
        </div>
      )}

      {/* Function Directory Modal */}
      <ExcelFunctionDirectoryModal
        isOpen={isFuncLibOpen}
        onClose={() => setIsFuncLibOpen(false)}
      />
    </div>
  )
}

export default function ExcelPage({ sandbox = false }) {
  const { t, locale } = useI18n()
  const { lessonId } = useParams()
  const [search] = useSearchParams()

  const requested = sandbox ? search.get('lesson') : lessonId
  const course = EXCEL_COURSES.find((c) => c.id === requested)
  const index = course ? EXCEL_COURSES.indexOf(course) : -1

  if (requested && !course) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-white">{t('Course not found')}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {t('The requested Excel course does not exist or has been relocated.')}
          </p>
          <Link
            to="/excel"
            className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            ← {t('Return to Excel & Analytics Track')}
          </Link>
        </main>
      </div>
    )
  }

  // Standalone Sandbox Mode (/sandbox?bench=excel)
  if (sandbox) {
    const starterDataset = course ? course.dataset : EXCEL_COURSES[0].dataset
    return (
      <SandboxBenchLayout
        bench="excel"
        variant="app"
        description={t(
          'Interactive Excel spreadsheet IDE: formulas, cell ranges, VLOOKUP/XLOOKUP, pivot summaries, descriptive stats and charts.'
        )}
        courseLink={course ? `/excel/${course.id}` : '/excel'}
        courseLinkLabel={t(course ? 'Back to course lesson' : 'All Excel courses')}
        localeNotice={
          locale === 'id'
            ? t(
                'Excel course narratives and formulas use industry-standard English spreadsheet syntax. Interface controls support Indonesian.'
              )
            : null
        }
      >
        <div className="h-full p-4">
          <ExcelSimulator initialDataset={starterDataset} height="100%" />
        </div>
      </SandboxBenchLayout>
    )
  }

  // Course Lesson View (/excel/:lessonId)
  if (course) {
    const previous = index > 0 ? EXCEL_COURSES[index - 1] : null
    const next = index < EXCEL_COURSES.length - 1 ? EXCEL_COURSES[index + 1] : null

    return (
      <div className="min-h-screen bg-slate-950">
        <AppHeader />
        <main>
          <ExcelCourse course={course} previous={previous} next={next} />
        </main>
      </div>
    )
  }

  // Track Hub View (/excel)
  return (
    <div className="min-h-screen bg-slate-950">
      <AppHeader />
      <main>
        <ExcelHub />
      </main>
    </div>
  )
}
