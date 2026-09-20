import CourseRewards from '../courses/CourseRewards.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, Cpu, Layers, Search, Sparkles } from 'lucide-react'
import { TUTORIALS } from '../../content/index.js'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, ChipMascot, EmptyState } from '../../ui/index.js'
import AllCoursesSection from '../courses/AllCoursesSection.jsx'

export default function TutorialsPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const board = params.get('board') ?? ''
  const query = params.get('q') ?? ''
  const difficulty = params.get('difficulty') ?? ''
  const topic = params.get('topic') ?? ''

  const tutorials = useMemo(() => TUTORIALS.filter((tutorial) => (!board || tutorial.boards.includes(board))
    && (!difficulty || tutorial.difficulty === difficulty)
    && (!topic || tutorial.track === topic)
    && `${tutorial.title} ${t(tutorial.title)} ${tutorial.summary} ${t(tutorial.summary)} ${tutorial.concepts.map(t).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [board, query, difficulty, topic, t])

  function filter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <CourseRewards />

        {/* Hero Section */}
        <div className="mb-10 flex flex-col md:flex-row items-start justify-between gap-6 rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                <Sparkles size={13} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                {t("The VoltQuest learning lab")}
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {t("Small circuits. Big discoveries.")}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              {t("Learn by making something work. Explore ")}{TUTORIALS.length}{t(" guided tutorials with ready-wired circuits, editable code, and experiments for Arduino Uno, ESP32, and Raspberry Pi 4 / 5 alongside 10 comprehensive engineering courses.")}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="brand"><BookOpen size={12} /> {TUTORIALS.length} {t("tutorials")}</Badge>
              <Badge tone="info"><Cpu size={12} /> {t("6 boards")}</Badge>
              <Badge tone="brand"><Layers size={12} /> {t("10 course tracks")}</Badge>
              <Badge>{t("Runs in your browser")}</Badge>
            </div>

            {/* Quick jump navigation */}
            <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-line text-xs font-medium">
              <span className="text-slate-500">{t("Jump to:")}</span>
              <a
                href="#all-courses-catalog-title"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle px-3 py-1.5 text-ink hover:border-brand-500 hover:text-brand-700 transition-colors"
              >
                <BookOpen size={13} className="text-brand-700" />
                {t("All Courses & Curricula (10)")}
              </a>
              <a
                href="#interactive-tutorials-title"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-subtle px-3 py-1.5 text-ink hover:border-brand-500 hover:text-brand-700 transition-colors"
              >
                <Cpu size={13} className="text-brand-700" />
                {t("Circuit Tutorials ({count})", { count: TUTORIALS.length })}
              </a>
            </div>
          </div>
          <div className="hidden sm:block flex-shrink-0 self-center">
            <ChipMascot size={110} mood="thinking" />
          </div>
        </div>

        {/* All Courses & Learning Tracks Catalog (Consistent cards including ALL courses) */}
        <AllCoursesSection />

        {/* Guided Circuit Tutorials Section */}
        <section className="mt-12" aria-labelledby="interactive-tutorials-title">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
                <Cpu size={14} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
                {t("Hands-on Hardware Labs")}
              </p>
            </div>
            <h2 id="interactive-tutorials-title" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t("Interactive Circuit Tutorials")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
              {t("Real-time breadboard simulation with editable C++ and Python code, component pin tables, and click-to-highlight wiring.")}
            </p>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 grid gap-3 rounded-xl border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_220px] shadow-xs">
            <label className="relative block">
              <span className="sr-only">{t("Search tutorials")}</span>
              <Search size={17} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => filter('q', event.target.value)}
                placeholder={t("Search LEDs, Python, WiFi, sensors…")}
                className="h-10 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </label>
            <label>
              <span className="sr-only">{t("Filter by board")}</span>
              <select
                value={board}
                onChange={(event) => filter('board', event.target.value)}
                className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t("All boards")}</option>
                {BOARD_IDS.map((id) => (
                  <option key={id} value={id}>{getBoard(id).name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">{t('Tutorial topic')}</span>
              <select
                value={topic}
                onChange={event => filter('topic', event.target.value)}
                className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t('All topics')}</option>
                <option value="iot-foundations">{t('IoT / Arduino fundamentals')}</option>
                <option value="drone-foundations">{t('Drone fundamentals')}</option>
              </select>
            </label>
          </div>

          {/* Difficulty and Learning Path shortcuts */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Tutorial difficulty")}>
              {['', 'Easy', 'Intermediate', 'Hard'].map((tier, index) => (
                <button
                  key={tier}
                  onClick={() => filter('difficulty', tier)}
                  aria-pressed={difficulty === tier}
                  className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    difficulty === tier
                      ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                      : 'border-line bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {tier ? `${index}. ${t(tier)}` : t("Full learning path")}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('q', 'C++')
                  next.delete('difficulty')
                  next.delete('board')
                  next.delete('topic')
                  setParams(next)
                }}
                className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xs"
              >
                {t("Explore Arduino / ESP32 code lessons")}
              </button>
              <span className="text-slate-500">
                {t("From setup and variables to serial commands and state machines.")}
              </span>
            </div>
          </div>

          <p className="mb-5 text-sm text-slate-500" role="status">
            {tutorials.length}{t(" tutorials")}
            {board ? ` for ${getBoard(board)?.name ?? board}` : t(" to explore")}
            {t(" · Easy → Intermediate → Hard")}
          </p>

          {/* Tutorials Cards Grid */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tutorials.map((tutorial) => (
              <Link
                key={tutorial.id}
                to={`/tutorials/${tutorial.id}${board ? `?board=${board}` : ''}`}
                className="group flex flex-col justify-between rounded-xl border border-line bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <Badge tone={tutorial.language === 'python' ? 'info' : 'brand'}>
                      {tutorial.kind === 'drone'
                        ? t('Drone · ESP32')
                        : tutorial.language === 'python'
                        ? t("Raspberry Pi · Python")
                        : tutorial.boards.includes('uno') && tutorial.boards.includes('esp32')
                        ? t("Arduino / ESP32 · C++")
                        : tutorial.boards[0] === 'uno'
                        ? t("Arduino · C++")
                        : t("ESP32 · C++")}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={12} />
                      {tutorial.minutes}{t(" min")}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-ink group-hover:text-brand-700 transition-colors">
                    {t(tutorial.title)}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                    {t(tutorial.summary)}
                  </p>
                  <div className="my-4 flex flex-wrap gap-1.5">
                    {tutorial.concepts.map((concept) => (
                      <span key={concept} className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-slate-600 font-mono">
                        {t(concept)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-xs">
                  <span className="text-slate-500 font-medium">{t(tutorial.difficulty)}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-700 group-hover:text-brand-800">
                    {t("Open tutorial ")}
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {!tutorials.length && (
            <EmptyState
              icon={<Search />}
              title={t("No tutorials match")}
              description={t("Try another topic or choose a different board.")}
              action={
                <button className="text-brand-700 underline text-sm font-medium" onClick={() => setParams({})}>
                  {t("Clear filters")}
                </button>
              }
            />
          )}
        </section>
      </main>
    </div>
  )
}
