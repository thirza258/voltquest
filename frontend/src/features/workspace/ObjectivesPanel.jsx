import { useI18n } from '../../i18n/index.jsx'
/**
 * The live objective checklist (DESIGN.md "Workspace body → Objectives").
 *
 * Purely presentational: it is handed the validator's report, the level and the current hint tiers,
 * so it renders identically from a fixture and from the store. State never lives here.
 */
import { Check, Circle, Flame } from 'lucide-react'
import { Badge, Callout, ChipMascot, SpeechBubble, Stars, cx } from '../../ui/index.js'

/** "Step 2 of 4 complete" — the string the polite live region announces. */
export function progressSentence(objectives = []) {
  const total = objectives.length
  const done = objectives.filter((o) => o.passed).length
  if (!total) return 'No steps yet'
  return `Step ${done} of ${total} complete`
}

function ObjectiveRow({ objective, hint, tier }) {
  const { t } = useI18n()
  const passed = !!objective.passed
  return (
    <li className="rounded-lg border border-line bg-surface-panel p-2.5">
      <div className="flex items-start gap-2">
        <span
          className={cx(
            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
            passed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-line-strong text-slate-500',
          )}
          aria-hidden="true"
        >
          {passed ? <Check size={11} strokeWidth={3} /> : <Circle size={7} />}
        </span>
        <span className={cx('flex-1 text-sm leading-snug', passed ? 'text-ink-secondary' : 'text-ink')}>
          {t(objective.text)}
        </span>
        <Badge tone={passed ? 'success' : 'neutral'}>{passed ? t("Done") : t("To do")}</Badge>
      </div>

      {tier >= 1 && hint && (
        <div className="mt-2 flex items-start gap-2">
          <ChipMascot mood="thinking" size={28} className="shrink-0" />
          <SpeechBubble tone="info">{t(hint)}</SpeechBubble>
        </div>
      )}
    </li>
  )
}

/** One star criterion with its live tick. */
function StarRow({ symbol, text, met }) {
  const { t } = useI18n()
  return (
    <li className="flex items-start gap-1.5">
      <span
        className={cx('mt-0.5 h-3.5 w-3.5 shrink-0', met ? 'text-emerald-600' : 'text-ink-muted')}
        aria-hidden="true"
      >
        {met ? <Check size={14} strokeWidth={3} /> : <Circle size={10} />}
      </span>
      <span className="text-volt-500" aria-hidden="true">
        {symbol}
      </span>
      <span className={cx('flex-1 text-xxs', met ? 'text-ink-secondary' : 'text-slate-500')}>
        {t(text)}
        <span className="sr-only">{met ? t(" — earned") : t(" — not yet")}</span>
      </span>
    </li>
  )
}

/**
 * @param {object} props
 * @param {object|null} props.report validator `ObjectiveReport`
 * @param {object|null} props.level the quest level (objectives supply the hint text and star criteria)
 * @param {{ [id: string]: number }} [props.hintTier]
 * @param {{ message?: string, hint?: string, componentIds?: string[] } | null} [props.smoke] damage callout
 */
export function ObjectivesPanel({
  report = null,
  level = null,
  hintTier = {},
  smoke = null,
  onShowWhy,
  onReplacePart,
  onDismissSmoke,
  className = '',
  ...rest
}) {
  const { t } = useI18n()
  const levelObjectives = level?.objectives ?? []
  const reported = report?.objectives ?? []
  // Show the level's own list even before the validator has produced a report.
  const objectives = levelObjectives.length
    ? levelObjectives.map((objective) => {
        const match = reported.find((o) => o.id === objective.id)
        return { ...objective, passed: !!match?.passed }
      })
    : reported

  const stars = Number(report?.stars ?? 0)
  const allPassed = !!report?.allPassed
  const threeText = level?.starCriteria?.threeText ?? 'Bonus challenge'
  const damageExpected = !!level?.starCriteria?.damageExpected

  return (
    <div className={cx('flex h-full flex-col gap-3 overflow-y-auto p-3', className)} {...rest}>
      {/* Mounted unconditionally so the announcement is not missed when the node appears. */}
      <p className="sr-only" aria-live="polite" role="status">
        {objectives.length ? t('Step {done} of {total} complete', { done: objectives.filter(o => o.passed).length, total: objectives.length }) : t('No steps yet')}
      </p>

      {smoke && (
        <Callout
          tone="danger"
          title={t("Magic smoke!")}
          icon={<Flame size={15} />}
          action={
            <div className="flex flex-wrap gap-1.5">
              {onShowWhy && (
                <button
                  type="button"
                  onClick={onShowWhy}
                  className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xxs font-medium text-rose-700 ring-brand-500 ring-offset-1 hover:bg-rose-50 focus:outline-none focus-visible:ring-2"
                >{t("Show me why")}</button>
              )}
              {onReplacePart && (
                <button
                  type="button"
                  onClick={onReplacePart}
                  className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xxs font-medium text-rose-700 ring-brand-500 ring-offset-1 hover:bg-rose-50 focus:outline-none focus-visible:ring-2"
                >{t("Replace part")}</button>
              )}
              {onDismissSmoke && (
                <button
                  type="button"
                  onClick={onDismissSmoke}
                  className="rounded-md px-2 py-1 text-xxs font-medium text-slate-500 ring-brand-500 ring-offset-1 hover:text-ink focus:outline-none focus-visible:ring-2"
                >{t("Dismiss")}</button>
              )}
            </div>
          }
        >
          <span className="flex items-start gap-2">
            <ChipMascot mood="alert" size={28} className="shrink-0" />
            <span>{t(level?.chipOnSmoke ?? smoke.hint ?? smoke.message ?? "Something let its smoke out.")}</span>
          </span>
        </Callout>
      )}

      {objectives.length === 0 ? (
        <p className="text-sm text-slate-500">{t("This level has no checklist — build freely.")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {objectives.map((objective) => (
            <ObjectiveRow
              key={objective.id}
              objective={objective}
              tier={hintTier[objective.id] ?? 0}
              hint={levelObjectives.find((o) => o.id === objective.id)?.hints?.tier1}
            />
          ))}
        </ol>
      )}

      <div className="mt-auto rounded-lg border border-line bg-surface-sunken p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xxs font-semibold uppercase tracking-wide text-slate-500">{t("Stars")}</span>
          <Stars value={stars} max={3} size="sm" />
        </div>
        <ul className="flex flex-col gap-1">
          <StarRow symbol="★" text="Complete all steps" met={allPassed} />
          <StarRow
            symbol="★★"
            text={damageExpected ? 'Finish the lesson (damage is expected here)' : 'No smoke or shorts'}
            met={stars >= 2}
          />
          <StarRow symbol="★★★" text={threeText} met={stars >= 3} />
        </ul>
        {report?.starReasons?.length > 0 && stars < 3 && (
          <p className="mt-1.5 text-xxs text-slate-500">{report.starReasons.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

export default ObjectivesPanel
