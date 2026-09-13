import { useId, useRef, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { Button } from '../../ui/index.js'
import { gradeQuestions } from './content.js'

export default function Assessment({ questions, exam = false, passPercent = 80, onResult }) {
  const { t } = useI18n()
  const formId = useId()
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(false)
  const formRef = useRef(null)
  const resultRef = useRef(null)
  const graded = gradeQuestions(questions, answers)
  function submit(event) {
    event.preventDefault()
    if (result) return
    if (!graded.complete) {
      setError(true)
      const missing = graded.results.findIndex(item => !item.answered)
      formRef.current?.querySelectorAll('fieldset')[missing]?.querySelector('input')?.focus()
      return
    }
    setError(false)
    setResult(graded)
    onResult?.(graded)
    // The status container is always mounted so keyboard focus can move to the new feedback.
    resultRef.current?.focus()
  }
  function retry() {
    setAnswers({})
    setResult(null)
    setError(false)
    formRef.current?.querySelector('input')?.focus()
  }
  return <form ref={formRef} onSubmit={submit} noValidate className="space-y-5" aria-label={t(exam ? 'Course exam' : 'Practice questions')}>
    <p className="text-sm leading-relaxed text-ink-secondary">{exam
      ? t('Answer all five questions, then submit. Pass with {percent}% (4 of 5). Answers and explanations appear after submission. There is no time limit; retries are welcome.', { percent: passPercent })
      : t('Choose an answer for each practice question, then check your reasoning. Practice does not count toward your exam score.')}</p>
    {questions.map((question, index) => <fieldset key={question.id} className="min-w-0 rounded-lg border border-line bg-white p-4">
      <legend className="max-w-full px-1 text-sm font-semibold leading-relaxed text-ink">{index + 1}. {t(question.prompt)}</legend>
      <div className="space-y-2">{question.options.map(option => <label key={option.id} className={`flex min-h-10 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm leading-relaxed ${answers[question.id] === option.id ? 'border-brand-600 bg-teal-50' : 'border-line'}`}>
        <input type="radio" name={`${formId}-${question.id}`} value={option.id} checked={answers[question.id] === option.id} aria-disabled={Boolean(result)} className="mt-1 shrink-0 accent-teal-700 focus:ring-2 focus:ring-brand-500"
          onChange={() => { if (!result) setAnswers(previous => ({ ...previous, [question.id]: option.id })) }} />
        <span className="min-w-0 break-words">{t(option.text)}</span>
      </label>)}</div>
      {result && <div className={`mt-3 rounded-md p-3 text-sm leading-relaxed ${result.results[index].correct ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
        <p className="font-semibold">{t(result.results[index].correct ? 'Correct' : 'Review this answer')}</p>
        <p className="mt-1">{t('Correct answer: {answer}', { answer: t(question.options.find(option => option.id === question.answerId).text) })}</p>
        <p className="mt-2">{t(question.explanation)}</p>
        <a className="mt-2 inline-block rounded font-medium underline focus:outline-none focus:ring-2 focus:ring-brand-500" href={`#${question.lessonId}`}>{t('Review related lesson')}</a>
      </div>}
    </fieldset>)}
    {error && <p role="alert" className="text-sm text-rose-700">{t('Answer every question before submitting. Your choices have been kept.')}</p>}
    <div ref={resultRef} tabIndex={-1} role="status" className="rounded-md outline-none focus:ring-2 focus:ring-brand-500">
      {result && <div className={`rounded-lg border p-4 ${result.percent >= passPercent ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <p className="font-semibold text-ink">{exam ? t(result.percent >= passPercent ? 'Exam passed' : 'Keep learning — try again') : t('Practice results')}</p>
        <p className="mt-1 text-sm text-ink-secondary">{t('{correct} of {total} correct · {percent}%', { correct: result.correct, total: result.total, percent: result.percent })}</p>
        <p className="mt-2 text-sm text-ink-secondary">{t('Review the explanations above before another attempt.')}</p>
      </div>}
    </div>
    <div className="flex flex-wrap items-center gap-3">{result
      ? <Button type="button" onClick={retry}>{t(exam ? 'Retake exam' : 'Try practice again')}</Button>
      : <Button type="submit">{t(exam ? 'Submit exam' : 'Check practice answers')}</Button>}
      <span className="text-sm text-slate-600">{t('{count} of {total} answered', { count: graded.results.filter(item => item.answered).length, total: questions.length })}</span>
    </div>
  </form>
}
