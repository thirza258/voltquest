import { useI18n } from '../../i18n/index.jsx'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, Cpu, Search } from 'lucide-react'
import { TUTORIALS } from '../../content/index.js'
import { BOARD_IDS, getBoard } from '../../engine/boards/index.js'
import { AppHeader } from '../workspace/AppHeader.jsx'
import { Badge, ChipMascot, EmptyState } from '../../ui/index.js'
import CybersecurityPromo from '../cybersecurity/CybersecurityPromo.jsx'
import MatlabPromo from '../matlab/MatlabPromo.jsx'

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
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-700">{t("The VoltQuest learning lab")}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{t("Small circuits. Big discoveries.")}</h1>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">{t("Learn by making something work. Explore ")}{TUTORIALS.length}{t(" guided tutorials with ready-wired circuits, editable code, and experiments for Arduino Uno, ESP32, and Raspberry Pi 4 / 5.")}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Badge tone="brand"><BookOpen size={12} /> {TUTORIALS.length}{t(" tutorials")}</Badge><Badge tone="info"><Cpu size={12} />{t(" 6 boards")}</Badge><Badge>{t("Runs in your browser")}</Badge></div>
          </div>
          <div className="hidden sm:block"><ChipMascot size={100} mood="thinking" /></div>
        </div>
        <CybersecurityPromo />
        <MatlabPromo />
        <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-labelledby="hpc-path-title">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('C / C++ learning path')}</p>
          <h2 id="hpc-path-title" className="mt-2 text-xl font-semibold text-ink">{t('High-performance computing in C & C++')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t('Ten detailed courses with interactive experiments, editable native C/C++ examples, testing guides, practice questions and exams. Learn benchmarking, caches, SIMD, OpenMP, MPI and a distributed stencil capstone.')}</p>
          <div className="mt-4 flex flex-wrap gap-3"><Link to="/hpc" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Explore HPC courses')}</Link><Link to="/sandbox?bench=hpc" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Open HPC sandbox')}</Link></div>
        </section>
        <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-labelledby="courses-title">
          <h2 id="courses-title" className="text-xl font-semibold text-ink">{t('Programming, electronics & IoT courses')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{t('Follow 12 C and Arduino / ESP32 programming courses, or study electronics, IoT parts and drone foundations. Every course includes lessons, practice questions and an exam.')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/courses?track=programming" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('C, C++ & Arduino / ESP32 programming')}</Link>
            <Link to="/courses#tutorial-fundamentals" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Fundamentals for every tutorial')}</Link>
            <Link to="/courses?track=electrical" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Electrical engineering foundations')}</Link>
            <Link to="/courses?track=iot-parts" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('IoT parts and device building')}</Link>
            <Link to="/courses/iot-foundations" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Study IoT / Arduino foundations')}</Link>
            <Link to="/courses/drone-foundations" className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t('Study drone foundations')}</Link>
          </div>
          <p className="mt-4 text-sm text-ink-secondary">{t('IoT and drone foundations now include theory, formulas and guided practical labs.')}</p>
        </section>
        <section className="mb-7 rounded-lg border border-line bg-white p-5">
          <h2 className="text-xl font-semibold">{t('Robotics & ROS 2 learning path')}</h2>
          <p className="mt-2 text-sm text-ink-secondary">{t('Five tutorials from robot motion to waypoint control, with formulas, questions, exams and a browser sandbox.')}</p>
          <div className="mt-4 flex flex-wrap gap-4"><Link to="/robotics" className="text-sm font-semibold text-brand-700 underline">{t('Explore robotics tutorials')}</Link><Link to="/sandbox?bench=robotics" className="text-sm font-semibold text-brand-700 underline">{t('Open robotics sandbox')}</Link></div>
        </section>
        <section className="mb-7 rounded-lg border border-line bg-white p-5">
          <h2 className="text-xl font-semibold">{t('Computer vision: OpenCV, transformers & integration')}</h2><p className="mt-2 text-sm text-ink-secondary">{t('Six courses with hands-on labs, from image processing to a capstone connecting IoT, drones and ROS 2 robotics.')}</p>
          <div className="mt-4 flex flex-wrap gap-4"><Link to="/vision" className="text-sm font-semibold text-brand-700 underline">{t('Explore computer vision courses')}</Link><Link to="/vision/vision-integration" className="text-sm font-semibold text-brand-700 underline">{t('Open the integration capstone')}</Link></div>
        </section>
        <div className="mb-7 grid gap-3 rounded-lg border border-line bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="relative block"><span className="sr-only">{t("Search tutorials")}</span><Search size={17} className="absolute left-3 top-3 text-slate-500" /><input type="search" value={query} onChange={(event) => filter('q', event.target.value)} placeholder={t("Search LEDs, Python, WiFi, sensors…")} className="h-10 w-full rounded-md border border-line-strong bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></label>
          <label><span className="sr-only">{t("Filter by board")}</span><select value={board} onChange={(event) => filter('board', event.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"><option value="">{t("All boards")}</option>{BOARD_IDS.map((id) => <option key={id} value={id}>{getBoard(id).name}</option>)}</select></label>
          <label><span className="sr-only">{t('Tutorial topic')}</span><select value={topic} onChange={event => filter('topic', event.target.value)} className="h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"><option value="">{t('All topics')}</option><option value="iot-foundations">{t('IoT / Arduino fundamentals')}</option><option value="drone-foundations">{t('Drone fundamentals')}</option></select></label>
        </div>
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label={t("Tutorial difficulty")}>{['', 'Easy', 'Intermediate', 'Hard'].map((tier, index) => <button key={tier} onClick={() => filter('difficulty', tier)} aria-pressed={difficulty === tier} className={`rounded-md border px-4 py-2 text-sm font-medium ${difficulty === tier ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-slate-600'}`}>{tier ? `${index}. ${t(tier)}` : t("Full learning path")}</button>)}</div>
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm"><button onClick={() => { const next = new URLSearchParams(params); next.set('q', 'C++'); next.delete('difficulty'); next.delete('board'); next.delete('topic'); setParams(next) }} className="rounded-md border border-brand-600 bg-white px-3 py-2 font-medium text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500">{t("Explore Arduino / ESP32 code lessons")}</button><span className="text-slate-600">{t("From setup and variables to serial commands and state machines.")}</span></div>
        <p className="mb-4 text-sm text-slate-500" role="status">{tutorials.length}{t(" tutorials")}{board ? ` for ${getBoard(board)?.name ?? board}` : t(" to explore")}{t(" · Easy → Intermediate → Hard")}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tutorials.map((tutorial) => (
            <Link key={tutorial.id} to={`/tutorials/${tutorial.id}${board ? `?board=${board}` : ''}`} className="group flex flex-col rounded-lg border border-line bg-white p-5 transition-colors hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500">
              <div className="mb-4 flex items-center justify-between gap-2"><Badge tone={tutorial.language === 'python' ? 'info' : 'brand'}>{tutorial.kind === 'drone' ? t('Drone · ESP32') : tutorial.language === 'python' ? t("Raspberry Pi · Python") : tutorial.boards.includes('uno') && tutorial.boards.includes('esp32') ? t("Arduino / ESP32 · C++") : tutorial.boards[0] === 'uno' ? t("Arduino · C++") : t("ESP32 · C++")}</Badge><span className="flex items-center gap-1 text-xs text-slate-500"><Clock size={12} />{tutorial.minutes}{t(" min")}</span></div>
              <h2 className="text-lg font-semibold text-ink group-hover:text-brand-700">{t(tutorial.title)}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-secondary">{t(tutorial.summary)}</p>
              <div className="my-5 flex flex-wrap gap-1.5">{tutorial.concepts.map((concept) => <span key={concept} className="rounded bg-surface-sunken px-2 py-1 text-xs text-slate-600">{t(concept)}</span>)}</div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-xs"><span className="text-slate-500">{t(tutorial.difficulty)}</span><span className="inline-flex items-center gap-1 font-semibold text-brand-700">{t("Open tutorial ")}<ArrowRight size={14} /></span></div>
            </Link>
          ))}
        </div>
        {!tutorials.length && <EmptyState icon={<Search />} title={t("No tutorials match")} description={t("Try another topic or choose a different board.")} action={<button className="text-brand-700 underline" onClick={() => setParams({})}>{t("Clear filters")}</button>} />}
      </main>
    </div>
  )
}
