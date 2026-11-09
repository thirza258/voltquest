import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import {
  Activity,
  ArrowRight,
  Binary,
  Bot,
  Compass,
  Cpu,
  Eye,
  Layout,
  Monitor,
  Network,
  Shield,
  Zap,
} from 'lucide-react'
import { Badge } from '../../ui/index.js'

const ICONS = {
  Cpu,
  Binary,
  Layout,
  Monitor,
  Zap,
  Shield,
  Activity,
  Bot,
  Compass,
  Eye,
  Network,
}

const TONE_CLASSES = {
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', ring: 'focus:ring-teal-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'focus:ring-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', ring: 'focus:ring-emerald-500' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', ring: 'focus:ring-blue-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'focus:ring-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', ring: 'focus:ring-rose-500' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', ring: 'focus:ring-orange-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', ring: 'focus:ring-purple-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', ring: 'focus:ring-cyan-500' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', ring: 'focus:ring-sky-500' },
}

export default function CourseTrackCard({ course }) {
  const { t } = useI18n()
  const IconComponent = ICONS[course.icon] ?? Cpu
  const tone = TONE_CLASSES[course.color] ?? TONE_CLASSES.teal

  return (
    <div className="group flex flex-col justify-between rounded-xl border border-line bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md">
      <div>
        {/* Card Header: Category badge, Icon, Metrics */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone.bg} ${tone.text} border ${tone.border}`}>
              <IconComponent size={18} />
            </span>
            <Badge tone="brand">{t(course.category)}</Badge>
          </div>
          <span className="text-xs font-medium text-slate-500">{t(course.metrics)}</span>
        </div>

        {/* Card Title & Summary */}
        <h4 className="text-lg font-semibold text-ink group-hover:text-brand-700 transition-colors">
          <Link to={course.href} className="focus:outline-none focus:underline">
            {t(course.title)}
          </Link>
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
          {t(course.summary)}
        </p>

        {/* Topic tags */}
        <div className="my-4 flex flex-wrap gap-1.5">
          {course.topics.map((topic) => (
            <span
              key={topic}
              className="rounded bg-surface-sunken px-2 py-0.5 text-xs text-slate-600 font-mono"
            >
              {t(topic)}
            </span>
          ))}
        </div>
      </div>

      {/* Card Footer: Primary & Secondary actions */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {course.secondaryHref && (
            <Link
              to={course.secondaryHref}
              className="font-medium text-slate-600 hover:text-ink underline focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1 py-0.5"
            >
              {t(course.secondaryAction)}
            </Link>
          )}
          {course.benchHref && (
            <Link
              to={course.benchHref}
              className="font-medium text-brand-700 hover:text-brand-800 underline focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-1 py-0.5"
            >
              {t(course.benchLabel)}
            </Link>
          )}
        </div>
        <Link
          to={course.href}
          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1.5 py-0.5"
        >
          {t(course.primaryAction)}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
