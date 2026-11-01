import { useState } from 'react'
import {
  CheckCircle2,
  ListOrdered,
  Download,
  Award,
  ChevronRight,
} from 'lucide-react'
import ExcelSimulator from './ExcelSimulator'

export default function ExcelLab({ course, onNextStage = null }) {
  const [completedSteps, setCompletedSteps] = useState({})

  const toggleStep = (idx) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  const handleDownloadCsv = () => {
    if (!course || !course.code) return
    const blob = new Blob([course.code], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${course.id || 'excel_lab'}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 font-sans">
      {/* Left Column: Instructions, Steps, Expected & Challenge */}
      <div className="lg:col-span-4 space-y-4">
        {/* Lab Overview Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <ListOrdered className="h-4 w-4" />
            Interactive Guided Lab
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-100">
            {course.title || 'Microsoft Excel Practice Lab'}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {course.summary || 'Follow the step-by-step instructions to model calculations in the simulator.'}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-500 hover:text-white"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              Download Dataset ({course.codeExt || 'csv'})
            </button>
          </div>
        </div>

        {/* Guided Steps Checklist */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
          <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Guided Steps ({Object.values(completedSteps).filter(Boolean).length}/{course.steps?.length || 0})
          </h4>
          <div className="mt-3 space-y-2.5">
            {course.steps?.map((stepText, idx) => {
              const isDone = Boolean(completedSteps[idx])
              return (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-xs transition ${
                    isDone
                      ? 'border-emerald-800/60 bg-emerald-950/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-slate-600 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span className={isDone ? 'line-through opacity-80' : ''}>{stepText}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expected Result */}
        {course.expected && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Expected Outcome
            </h4>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{course.expected}</p>
          </div>
        )}

        {/* Applied Challenge Card */}
        {course.challenge && (
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Award className="h-4 w-4" />
              Applied Hands-On Challenge
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-amber-200/90">{course.challenge}</p>
          </div>
        )}

        {/* Next Stage Button */}
        {onNextStage && (
          <button
            onClick={onNextStage}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500"
          >
            Take 5-Question Certification Exam
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Right Column: Excel Simulator */}
      <div className="lg:col-span-8">
        <ExcelSimulator
          initialDataset={course.dataset}
          initialCsv={course.code}
          height="680px"
        />
      </div>
    </div>
  )
}
