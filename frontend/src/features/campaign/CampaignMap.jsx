/**
 * The campaign map (`/`): hero, player summary, one section per world, and the always-present
 * sandbox card. Content and progress arrive as props (defaulting to the bundled content and the
 * player store) so the page renders from fixtures in tests.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Boxes, Star, Trophy } from 'lucide-react'
import { Badge, Button, Card, ChipMascot, EmptyState, ProgressBar, SpeechBubble, Stars, cx } from '../../ui/index.js'
import { LEVELS, LEVEL_ORDER, WORLDS } from '../../content/index.js'
import { getBoard } from '../../engine/boards/index.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { blockedBy, campaignTotals, isAvailable, nextUpLevelId, starsFor } from './gating.js'
import { LevelCard } from './LevelCard.jsx'

/** Static class maps — Tailwind only keeps classes it can see in the source. */
const THEME = {
  amber: 'border-volt-200 bg-volt-50',
  teal: 'border-brand-200 bg-brand-50',
  rose: 'border-rose-200 bg-rose-50',
  indigo: 'border-indigo-200 bg-indigo-50',
}

/** "Arduino Uno · 5 V" for a world's board. */
function boardLabel(boardId) {
  try {
    const board = getBoard(boardId)
    return `${board.name} · ${board.vcc} V`
  } catch {
    return boardId ?? 'Any board'
  }
}

function PlayerSummary({ player, totals }) {
  const level = player?.level ?? 1
  const into = player?.xp_into_level ?? 0
  const forNext = player?.xp_for_next ?? 100
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-panel p-3 sm:min-w-64">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xxs font-semibold uppercase tracking-wide text-slate-500">Your bench</span>
        <Badge tone="volt">Level {level}</Badge>
      </div>
      <ProgressBar value={into} max={forNext} tone="volt" label="XP to next level" showValue size="sm" />
      <div className="flex items-center gap-4 text-xxs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Star size={12} className="text-volt-500" aria-hidden="true" />
          {totals.stars} / {totals.maxStars} stars
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy size={12} className="text-brand-600" aria-hidden="true" />
          {totals.completed} / {totals.total} levels
        </span>
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {object[]} [props.worlds] world records (defaults to bundled content)
 * @param {object} [props.levels] levelId → level
 * @param {string[]} [props.order] LEVEL_ORDER
 * @param {object} [props.progress] playerStore progress (defaults to the store)
 */
export function CampaignMap({
  worlds = WORLDS,
  levels = LEVELS,
  order = LEVEL_ORDER,
  progress: progressProp,
  player: playerProp,
  onOpenLevel,
  onOpenSandbox,
  className = '',
}) {
  const navigate = useNavigate()
  const storeProgress = usePlayerStore((s) => s.progress)
  const storePlayer = usePlayerStore((s) => s.player)
  const hasSeen = usePlayerStore((s) => s.hasSeen)
  const markSeen = usePlayerStore((s) => s.markSeen)

  const progress = progressProp ?? storeProgress ?? {}
  const player = playerProp ?? storePlayer

  const openLevel = onOpenLevel ?? ((levelId) => navigate(`/play/${levelId}`))
  const openSandbox = onOpenSandbox ?? (() => navigate('/sandbox'))

  const totals = useMemo(() => campaignTotals(order, progress), [order, progress])
  const nextId = useMemo(() => nextUpLevelId(order, progress), [order, progress])
  const nextLevel = nextId ? levels[nextId] : null

  // World intros are shown once. Snapshot on mount so marking them seen cannot re-hide them mid-view.
  const [introsToShow] = useState(() => new Set(worlds.filter((w) => !hasSeen('world', w.id)).map((w) => w.id)))
  useEffect(() => {
    for (const id of introsToShow) markSeen('world', id)
  }, [introsToShow, markSeen])

  return (
    <div className={cx('mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6', className)}>
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-surface-panel p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ChipMascot mood={totals.completed > 0 ? 'happy' : 'celebrate'} size={56} />
          <div>
            <h1 className="text-lg font-semibold text-ink">VoltQuest campaign</h1>
            <p className="max-w-lg text-xxs text-slate-500">
              Build real circuits on a real breadboard, write real Arduino code, and find out exactly why things glow —
              or smoke.
            </p>
            {nextLevel && (
              <div className="mt-3">
                <Button size="md" iconRight={<ArrowRight size={15} />} onClick={() => openLevel(nextLevel.id)}>
                  Continue → {nextLevel.codeName} {nextLevel.title}
                </Button>
              </div>
            )}
          </div>
        </div>
        <PlayerSummary player={player} totals={totals} />
      </section>

      {worlds.length === 0 && (
        <EmptyState
          icon={<Boxes size={24} />}
          title="No quests are bundled yet"
          description="The campaign content could not be loaded. The sandbox is still open for free building."
          action={<Button onClick={openSandbox}>Open the sandbox</Button>}
        />
      )}

      {worlds.map((world) => {
        const worldLevels = (world.levelIds ?? []).map((id) => levels[id]).filter(Boolean)
        const worldStars = worldLevels.reduce((sum, level) => sum + starsFor(progress, level.id), 0)
        return (
          <section key={world.id} className={cx('rounded-lg border p-3 sm:p-4', THEME[world.theme] ?? THEME.teal)}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-ink">{world.title}</h2>
                <p className="text-xxs text-slate-500">{world.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="neutral">{boardLabel(world.board)}</Badge>
                <Stars value={Math.round(worldStars / Math.max(1, worldLevels.length))} max={3} size="sm" />
                <span className="text-xxs text-slate-500">
                  {worldStars} / {worldLevels.length * 3} stars
                </span>
              </div>
            </div>

            {introsToShow.has(world.id) && world.intro && (
              <div className="mb-3 flex items-start gap-2">
                <ChipMascot mood="thinking" size={34} className="shrink-0" />
                <SpeechBubble tone="neutral">{world.intro}</SpeechBubble>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {worldLevels.map((level) => {
                const locked = !isAvailable(level.id, order, progress)
                const blockerId = blockedBy(level.id, order)
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    stars={starsFor(progress, level.id)}
                    locked={locked}
                    blocker={blockerId ? levels[blockerId] ?? null : null}
                    onOpen={openLevel}
                  />
                )
              })}
            </div>
          </section>
        )
      })}

      <Card className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
            <Boxes size={20} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Sandbox</h2>
            <p className="text-xxs text-slate-500">
              No objectives, every part unlocked. Build whatever you like and publish it to the showcase.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={openSandbox} iconRight={<ArrowRight size={15} />}>
          Open the sandbox
        </Button>
      </Card>
    </div>
  )
}

export default CampaignMap
