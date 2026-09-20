import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Navigation only: keep native source and course content in the lazy Qt route. */
export default function QtPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('Qt 6 / C++ desktop development')}>
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('Qt 6 / C++ desktop development')}</p>
    <h2 className="mt-2 text-xl font-semibold">{t('Build desktop apps with Qt and C++')}</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">{t('16 courses from your first Qt window to a task manager, with Widgets, QML, SQLite, networking, section questions, exams and complete CMake source projects.')}</p>
    <div className="mt-4 flex flex-wrap gap-3">{[['/qt', 'Explore C++ / Qt courses'], ['/qt/qt-start', 'Create your first Qt window']].map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t(label)}</Link>)}</div>
  </section>
}
