import catalog from '@content/winui.json'

export const WINUI_COURSES = catalog.courses
export const WINUI_STAGES = catalog.stages
export const WINUI_REVIEWED_AT = catalog.reviewedAt
export const panelClass = 'min-w-0 rounded-lg border border-line bg-white p-5 sm:p-6'
export const linkClass = 'rounded font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-brand-500'
export const fieldClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
export const codeClass = 'max-w-full overflow-x-auto rounded-md border border-line bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800'

export function filterWinuiCourses(query = '', stage = '', difficulty = '') {
  const needle = query.trim().toLowerCase().replace(/win\s+ui/g, 'winui')
  return WINUI_COURSES.filter(course => (!stage || course.stage === stage)
    && (!difficulty || course.difficulty === difficulty)
    && `winui c++ desktop ${course.title} ${course.summary} ${course.lessons.map(lesson => lesson.title).join(' ')}`.toLowerCase().includes(needle))
}
