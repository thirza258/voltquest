import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/** Navigation only: keep native source and course content in the lazy WinUI route. */
export default function WinuiPromo() {
  const { t } = useI18n()
  return <section className="mb-7 rounded-lg border border-teal-200 bg-teal-50 p-5" aria-label={t('C++ / WinUI 3 desktop development')}>
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{t('C++ / WinUI 3 desktop development')}</p>
    <h2 className="mt-2 text-xl font-semibold">{t('Build Windows desktop apps with C++')}</h2>
    <p className="mt-2 text-sm leading-6 text-ink-secondary">{t('13 courses from XAML and C++/WinRT to HTTP API requests and a task notebook, with section questions, exams and downloadable source. Build native labs on Windows with Visual Studio.')}</p>
    <div className="mt-4 flex flex-wrap gap-3">{[['/winui', 'Explore C++ / WinUI courses'], ['/winui/winui-start', 'Create your first WinUI window']].map(([to, label]) => <Link key={to} to={to} className="rounded-md border border-brand-600 bg-white px-3 py-2 text-sm font-semibold text-brand-700 focus:ring-2 focus:ring-brand-500">{t(label)}</Link>)}</div>
  </section>
}
