import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { FOUNDATION_LINKS, MAP_BRIDGES, MAP_TOPICS, STEP_KIND_LABELS, bridgeBetween, bridgesOf, foundationLinksOf, getTopic, otherEnd } from './learningMap.js'

const linkClass = 'rounded font-medium text-brand-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-brand-500'
const eyebrowClass = 'text-xs font-semibold uppercase tracking-wide text-slate-600'

// Corners of the square, in percent: every applied topic has a line to the other three.
const CORNERS = { robotics: [22, 20], vision: [78, 20], drone: [22, 80], iot: [78, 80] }
const APPLIED = MAP_TOPICS.filter(topic => topic.layer === 'applied')
const FOUNDATIONS = MAP_TOPICS.filter(topic => topic.layer === 'foundation')

/**
 * The connected learning map. `current` is the topic whose hub renders it ("you are here"); the
 * learner can select any other topic to read its bridges without leaving the page. `initial` is the
 * first selection when the page is not itself a topic. Remount with
 * `key={current}` when the current topic can change in place. Hubs link to it with `#connected-map`.
 */
export default function ConnectedMap({ current = null, initial = 'robotics', className = 'mb-8' }) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState(() => getTopic(current)?.id ?? getTopic(initial)?.id ?? 'robotics')
  const [neighborId, setNeighborId] = useState(null)
  const selected = getTopic(selectedId)
  const bridges = bridgesOf(selectedId)
  const bridge = (neighborId && bridgeBetween(selectedId, neighborId)) || bridges[0] || null

  function choose(id) {
    // Jumping to the other end of the open bridge keeps that bridge open.
    setNeighborId(bridgeBetween(id, selectedId) ? selectedId : null)
    setSelectedId(id)
  }

  return <section id="connected-map" aria-labelledby="connected-map-title" className={`scroll-mt-6 rounded-lg border border-line bg-white p-5 ${className}`}>
    <div className="max-w-3xl">
      <h2 id="connected-map-title" className="text-lg font-semibold text-ink">{t('Connected learning map')}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('Robotics, computer vision, drones and IoT each connect to the other three. Electronics and programming sit under all four. Choose a topic to see how it connects.')}</p>
    </div>
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <MapDiagram selectedId={selectedId} current={current} bridge={bridge} onChoose={choose} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-lg font-semibold text-ink">{t(selected.title)}</h3>
          {selected.id === current
            ? <p className="text-xs font-semibold text-brand-700">{t('You are here')}</p>
            : <Link to={selected.hub} className={`${linkClass} text-sm`}>{t('Open topic')}</Link>}
        </div>
        <nav aria-label={t('Resources for {stage}', { stage: t(selected.title) })} className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to={selected.start.href} className={linkClass}>{t('Start: {title}', { title: t(selected.start.title) })}</Link>
          <Link to={selected.bench} className={linkClass}>{t(selected.benchLabel)}</Link>
        </nav>
        {bridge && <BridgeExplorer topic={selected} bridges={bridges} bridge={bridge} onPick={setNeighborId} />}
        <FoundationList topic={selected} />
        {selected.deeper && <p className="mt-4 border-t border-line pt-3 text-sm text-slate-600">{t('Go deeper')}: <Link to={selected.deeper.href} className={linkClass}>{t(selected.deeper.title)}</Link>. {t(selected.deeper.note)}</p>}
      </div>
    </div>
  </section>
}

/** Topics joined to the selection through foundation links: applied topics for a foundation, and vice versa. */
const linkedThroughFoundations = id => new Set(FOUNDATION_LINKS.flatMap(link => link.foundation === id ? [link.topic] : link.topic === id ? [link.foundation] : []))

function MapDiagram({ selectedId, current, bridge, onChoose }) {
  const { t } = useI18n()
  const linked = linkedThroughFoundations(selectedId)
  return <div className="min-w-0">
    <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
      <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        {MAP_BRIDGES.map(item => {
          const [[x1, y1], [x2, y2]] = item.between.map(id => CORNERS[id])
          const tone = item === bridge ? 'stroke-brand-700' : item.between.includes(selectedId) ? 'stroke-brand-500' : 'stroke-slate-300'
          return <line key={item.id} x1={x1} y1={y1} x2={x2} y2={y2} className={tone} vectorEffect="non-scaling-stroke"
            strokeWidth={item === bridge ? 4 : 2} strokeDasharray={item.joined ? undefined : '6 5'} strokeLinecap="round" />
        })}
      </svg>
      {APPLIED.map(topic => <TopicButton key={topic.id} topic={topic} selected={topic.id === selectedId} here={topic.id === current}
        linked={linked.has(topic.id)} onChoose={onChoose} className="absolute w-[40%] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${CORNERS[topic.id][0]}%`, top: `${CORNERS[topic.id][1]}%` }} />)}
    </div>
    <div className="mx-auto mt-3 max-w-[20rem] rounded-lg border border-dashed border-line-strong bg-surface-sunken p-2">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t('Foundations under every topic')}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">{FOUNDATIONS.map(topic => <TopicButton key={topic.id} topic={topic}
        selected={topic.id === selectedId} here={topic.id === current} linked={linked.has(topic.id)} onChoose={onChoose} />)}</div>
    </div>
    <ul className="mx-auto mt-3 max-w-[20rem] space-y-1 text-xs text-slate-600">
      <li className="flex items-center gap-2"><svg aria-hidden="true" width="28" height="6"><line x1="2" y1="3" x2="26" y2="3" className="stroke-slate-400" strokeWidth="2" strokeLinecap="round" /></svg>{t('Solid line: one lab passes data between the two topics')}</li>
      <li className="flex items-center gap-2"><svg aria-hidden="true" width="28" height="6"><line x1="2" y1="3" x2="26" y2="3" className="stroke-slate-400" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" /></svg>{t('Dashed line: compare each topic in its own labs')}</li>
    </ul>
  </div>
}

function TopicButton({ topic, selected, here, linked = false, onChoose, className = '', style }) {
  const { t } = useI18n()
  const tone = selected ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
    : linked ? 'border-brand-400 bg-white text-ink hover:border-brand-600' : 'border-line-strong bg-white text-ink hover:border-brand-500'
  return <button type="button" aria-pressed={selected} onClick={() => onChoose(topic.id)} style={style}
    className={`min-h-11 rounded-lg border px-2 py-1.5 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 ${tone} ${className}`}>
    <span className="block text-sm font-semibold leading-tight">{t(topic.short)}</span>{' '}
    {here && <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-brand-700">{t('You are here')}</span>}
  </button>
}

function BridgeExplorer({ topic, bridges, bridge, onPick }) {
  const { t } = useI18n()
  return <div className="mt-4">
    <p id="connected-map-bridges" className={eyebrowClass}>{t('Connects to')}</p>
    <div role="group" aria-labelledby="connected-map-bridges" className="mt-2 flex flex-wrap gap-2">
      {bridges.map(item => {
        const other = otherEnd(item, topic.id)
        return <button key={item.id} type="button" aria-pressed={item === bridge} onClick={() => onPick(other.id)}
          className={`min-h-9 rounded-md border px-3 py-1 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${item === bridge
            ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white text-ink hover:border-brand-500'}`}>
          <span className="font-semibold">{t(other.short)}</span> · {t(item.title)}
        </button>
      })}
    </div>
    <BridgeCard bridge={bridge} titleId="connected-map-bridge-title" />
  </div>
}

/**
 * One bridge: the two topics, what passes between them, an honest note about whether one lab joins
 * them, the ordered route of lessons, and the exercise. Shared by the hardware map and the
 * networking ↔ security panel.
 */
export function BridgeCard({ bridge, titleId, level = 4 }) {
  const { t } = useI18n()
  const [a, b] = bridge.between.map(getTopic)
  const Heading = `h${level}`
  return <article aria-labelledby={titleId} className="mt-3 rounded-lg border border-line p-4">
    <p className={eyebrowClass}>{t(a.short)} ↔ {t(b.short)}</p>
    <Heading id={titleId} className="mt-1 text-base font-semibold text-ink">{t(bridge.title)}</Heading>
    <p className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${bridge.joined ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
      {t(bridge.joined ? 'The vision capstone passes data between these two topics' : 'No lab passes messages between these two yet')}</p>
    <p className="mt-3 break-words rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs leading-relaxed text-ink">{t(bridge.flow)}</p>
    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{t(bridge.summary)}</p>
    <ol className="mt-4 space-y-3" aria-label={t('Bridge route')}>
      {bridge.steps.map((step, index) => <li key={step.href} className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{index + 1}</span>
        <div className="min-w-0 text-sm">
          <p><span className="text-xs text-slate-600">{t(STEP_KIND_LABELS[step.kind])}: </span><Link to={step.href} className={linkClass}>{t(step.title)}</Link></p>
          <p className="mt-0.5 leading-relaxed text-ink-secondary">{t(step.note)}</p>
        </div>
      </li>)}
    </ol>
    <p className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm leading-relaxed text-teal-900"><span className="font-semibold">{t('Try it')}:</span> {t(bridge.tryIt)}</p>
    {!bridge.joined && <p className="mt-2 text-xs leading-relaxed text-slate-600">{t('Work through each side in its own lab, then compare. The exercise is a written comparison, not a combined simulation.')}</p>}
  </article>
}

/** Applied topics list the foundation courses they are built on; foundations list where they are used. */
function FoundationList({ topic }) {
  const { t } = useI18n()
  const links = foundationLinksOf(topic.id)
  if (!links.length) return null
  const foundation = topic.layer === 'foundation'
  return <div className="mt-5">
    <h4 id="connected-map-foundations" className="text-sm font-semibold text-ink">{t(foundation ? 'Used in' : 'Built on')}</h4>
    <ul aria-labelledby="connected-map-foundations" className="mt-2 space-y-2 text-sm">{links.map(link => {
      const label = getTopic(foundation ? link.topic : link.foundation).short
      return <li key={`${link.course.id}-${link.lesson.id}`} className="min-w-0 leading-relaxed">
        <span className="text-xs font-semibold text-slate-600">{t(label)}: </span><Link to={link.course.href} className={linkClass}>{t(link.course.title)}</Link>
        {foundation && <> → <Link to={link.lesson.href} className={linkClass}>{t(link.lesson.title)}</Link></>}
        <span className="text-ink-secondary"> — {t(link.note)}</span>
      </li>
    })}</ul>
  </div>
}
