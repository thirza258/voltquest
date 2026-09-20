import { useMemo, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { ALL_COURSES, COURSE_DOMAINS } from './coursesDirectory.js'
import CourseTrackCard from './CourseTrackCard.jsx'
import { BookOpen, Search } from 'lucide-react'
import { EmptyState } from '../../ui/index.js'

export default function AllCoursesSection({ className = '', initialDomain = 'all' }) {
  const { t } = useI18n()
  const [activeDomain, setActiveDomain] = useState(initialDomain)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCourses = useMemo(() => {
    return ALL_COURSES.filter((course) => {
      const matchesDomain = activeDomain === 'all' || course.domain === activeDomain
      if (!matchesDomain) return false

      if (!searchQuery.trim()) return true
      const query = searchQuery.trim().toLowerCase()
      const haystack = [
        course.title,
        course.summary,
        course.category,
        ...course.topics,
      ].join(' ').toLowerCase()

      return haystack.includes(query)
    })
  }, [activeDomain, searchQuery])

  return (
    <section className={`mb-12 ${className}`} aria-labelledby="all-courses-catalog-title">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-100 text-brand-700">
              <BookOpen size={14} />
            </span>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
              {t("Engineering Curricula")}
            </p>
          </div>
          <h2 id="all-courses-catalog-title" className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {t("All Courses & Learning Tracks")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
            {t("Structured engineering curricula with guided theory, checkpoints, interactive sandbox experiments, and verified exams across hardware, systems, AI and security.")}
          </p>
        </div>
      </div>

      {/* Domain filters and Search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Course categories")}>
          {COURSE_DOMAINS.map((domain) => {
            const count = domain.id === 'all'
              ? ALL_COURSES.length
              : ALL_COURSES.filter((c) => c.domain === domain.id).length
            const isSelected = activeDomain === domain.id
            return (
              <button
                key={domain.id}
                onClick={() => setActiveDomain(domain.id)}
                aria-pressed={isSelected}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  isSelected
                    ? 'border-brand-600 bg-brand-600 text-white shadow-xs'
                    : 'border-line bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t(domain.label)} ({count})
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <label htmlFor="course-catalog-search" className="sr-only">
            {t("Filter learning tracks")}
          </label>
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            id="course-catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("Filter tracks…")}
            className="h-9 w-full rounded-md border border-line-strong bg-white pl-9 pr-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <CourseTrackCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search />}
          title={t("No courses match your filter")}
          description={t("Try searching for another keyword or switch category.")}
          action={
            <button
              onClick={() => {
                setActiveDomain('all')
                setSearchQuery('')
              }}
              className="text-xs font-semibold text-brand-700 underline"
            >
              {t("Reset filters")}
            </button>
          }
        />
      )}
    </section>
  )
}
