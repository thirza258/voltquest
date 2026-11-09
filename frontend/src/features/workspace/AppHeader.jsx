import { useI18n } from '../../i18n/index.jsx'
/**
 * The 48 px shell header shared by every page (DESIGN.md "Header shell", CONTRACTS §11.1).
 *
 * Left is fixed (logo + mode nav), centre and right-hand `actions` are supplied by the page, and the
 * shared right-hand cluster (board switcher, power, hint, reset, overflow, Run/Stop, avatar) is
 * rendered here so campaign and sandbox behave identically.
 */
import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Info,
  KeyboardIcon,
  Lightbulb,
  LogIn,
  LogOut,
  MoreVertical,
  Play,
  Power,
  RotateCcw,
  RefreshCw,
  Square,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { Badge, Button, IconButton, Menu, SegmentedControl, Select, Tooltip, cx } from '../../ui/index.js'
import { usePlayerStore } from '../../store/playerStore.js'
import { LanguageSelect } from '../../i18n/index.jsx'

const NAV_OPTIONS = [
  { value: 'campaign', label: 'Campaign' },
  { value: 'tutorials', label: 'Tutorials' },
  { value: 'sandbox', label: 'Sandbox' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'community', label: 'Community' },
]

const NAV_PATH = { campaign: '/campaign', tutorials: '/tutorials', sandbox: '/sandbox', showcase: '/showcase', community: '/community' }

/** Which nav segment a pathname belongs to. */
export function navSectionFor(pathname = '/') {
  if (pathname.startsWith('/certificates')) return 'tutorials'
  if (pathname.startsWith('/tutorials') || pathname.startsWith('/courses') || pathname.startsWith('/robotics') || pathname.startsWith('/vision') || pathname.startsWith('/hpc') || pathname.startsWith('/ai-agents') || pathname.startsWith('/matlab') || pathname.startsWith('/cybersecurity') || pathname.startsWith('/computer-architecture') || pathname.startsWith('/avr') || pathname.startsWith('/cuda') || pathname.startsWith('/pytorch') || pathname.startsWith('/kernel') || pathname.startsWith('/loadbalancer') || pathname.startsWith('/distributed') || pathname.startsWith('/kubernetes') || pathname.startsWith('/game-modding') || pathname.startsWith('/iot-c') || pathname.startsWith('/excel') || pathname.startsWith('/networking') || pathname.startsWith('/qt') || pathname.startsWith('/winui')) return 'tutorials'
  if (pathname.startsWith('/sandbox')) return 'sandbox'
  if (pathname.startsWith('/showcase')) return 'showcase'
  if (pathname.startsWith('/community')) return 'community'
  if (pathname.startsWith('/campaign') || pathname.startsWith('/play')) return 'campaign'
  return ''
}

/** Bolt in a rounded teal square — the VoltQuest mark. */
export function LogoMark({ size = 24 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-brand-600 text-white"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Zap size={Math.round(size * 0.62)} strokeWidth={2.5} fill="currentColor" />
    </span>
  )
}

/** Three dots showing how far the hint ladder has been climbed. */
function TierDots({ tier = 0, max = 3 }) {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={cx('h-1.5 w-1.5 rounded-full', i < tier ? 'bg-volt-500' : 'bg-line-strong')}
        />
      ))}
    </span>
  )
}

/**
 * @param {object} props
 * @param {React.ReactNode} [props.center] mode-specific centre block
 * @param {React.ReactNode} [props.actions] mode-specific right-hand actions, before the shared cluster
 * @param {boolean} [props.workspaceControls] show board/power/hint/reset/run
 */
export function AppHeader({
  center = null,
  actions = null,
  workspaceControls = false,
  boardId = null,
  boardOptions = [],
  boardSwitcherEnabled = false,
  onBoardChange,
  powered = true,
  powerLabel,
  onPoweredChange,
  hintTier = 0,
  hintMax = 3,
  hintDisabled = false,
  showHint = true,
  onHint,
  onResetSim,
  onRestartLevel,
  onShortcuts,
  extraMenuItems = [],
  status = 'idle',
  onRunStop,
  runDisabled = false,
  className = '',
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const player = usePlayerStore((s) => s.player)
  const settings = usePlayerStore((s) => s.settings)
  const setSettings = usePlayerStore((s) => s.setSettings)
  const logout = usePlayerStore((s) => s.logout)

  const section = navSectionFor(location.pathname)
  const running = status === 'running' || status === 'compiling'
  const audioOn = settings?.audio !== false
  const claimed = !!player?.username

  const overflowItems = useMemo(() => {
    const items = [...extraMenuItems]
    if (onRestartLevel) items.push({ label: 'Restart level', icon: <RefreshCw size={14} />, onSelect: onRestartLevel })
    if (onShortcuts) items.push({ label: 'Shortcuts  ?', icon: <KeyboardIcon size={14} />, onSelect: onShortcuts })
    return items
  }, [extraMenuItems, onRestartLevel, onShortcuts])

  const avatarItems = useMemo(
    () => [
      { label: 'Profile', icon: <User size={14} />, onSelect: () => navigate('/profile') },
      claimed
        ? { label: 'Log in as someone else', icon: <LogIn size={14} />, onSelect: () => navigate('/profile#account') }
        : { label: 'Claim account / Log in', icon: <LogIn size={14} />, onSelect: () => navigate('/profile#account') },
      {
        label: audioOn ? 'Audio: on' : 'Audio: off',
        icon: audioOn ? <Volume2 size={14} /> : <VolumeX size={14} />,
        onSelect: () => setSettings({ audio: !audioOn }),
      },
      { label: 'Log out', icon: <LogOut size={14} />, danger: true, onSelect: () => logout() },
    ],
    [audioOn, claimed, logout, navigate, setSettings],
  )

  return (
    <header
      className={cx(
        'flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface-panel px-3',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <Link
          to="/"
          aria-label={t("VoltQuest")}
          className="flex items-center gap-2 rounded-md px-1 py-0.5 font-semibold text-ink ring-brand-500 ring-offset-1 focus:outline-none focus-visible:ring-2"
        >
          <LogoMark />
          <span className="hidden sm:inline">{t("VoltQuest")}</span>
        </Link>
        {/* Five segments plus the logo and right cluster overflow a 640 px header, so the
            row starts at md:; 640–767 px falls back to the select below, as mobile does. */}
        <div className="hidden md:block">
          <SegmentedControl
            size="sm"
            options={NAV_OPTIONS}
            value={section}
            onChange={(value) => navigate(NAV_PATH[value] ?? '/')}
            aria-label={t("Section")}
          />
        </div>
        <select
          aria-label={t("Section navigation")}
          value={section}
          onChange={(event) => navigate(NAV_PATH[event.target.value] ?? '/')}
          className="h-8 max-w-[110px] rounded-md border border-line-strong bg-white px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 md:hidden"
        >
          <option value="">{t("Home")}</option>
          {NAV_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
        </select>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">{center}</div>

      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <LanguageSelect />

        {workspaceControls && (
          <>
            {boardOptions.length > 0 && (
              <Select
                size="sm"
                className="w-32"
                value={boardId ?? ''}
                onChange={onBoardChange}
                options={boardOptions}
                disabled={!boardSwitcherEnabled}
                aria-label={t("Board")}
              />
            )}

            <Tooltip content={powered ? t(powerLabel ? "Pack power is on" : "USB power is on") : t("The board has no power")}>
              <button
                type="button"
                onClick={() => onPoweredChange?.(!powered)}
                aria-pressed={powered}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface-panel px-2 text-xxs font-medium text-ink ring-brand-500 ring-offset-1 transition-colors duration-150 hover:bg-surface-sunken focus:outline-none focus-visible:ring-2"
              >
                <Power size={13} className={powered ? 'text-emerald-600' : 'text-slate-500'} />
                {powered ? (powerLabel ?? t("USB 5 V")) : t("Power off")}
              </button>
            </Tooltip>

            {showHint && <Button
              size="sm"
              variant="secondary"
              icon={<Lightbulb size={14} />}
              onClick={onHint}
              disabled={hintDisabled || hintTier >= hintMax}
            >
              <span className="inline-flex items-center">{t("Hint ")}{hintTier}/{hintMax}
                <TierDots tier={hintTier} max={hintMax} />
              </span>
            </Button>}

            <Tooltip content={t("Clears damage, serial and timers; keeps your circuit")}>
              <IconButton size="md" icon={<RotateCcw size={15} />} label={t("Reset sim")} onClick={onResetSim} />
            </Tooltip>
          </>
        )}

        {overflowItems.length > 0 && (
          <Menu align="right" label={t("More actions")} trigger={<MoreVertical size={15} />} items={overflowItems} />
        )}

        {workspaceControls && (
          <Button
            size="sm"
            variant={running ? 'danger' : 'primary'}
            icon={running ? <Square size={14} /> : <Play size={14} />}
            onClick={onRunStop}
            disabled={runDisabled}
          >
            {running ? t("Stop") : t("Run")}
          </Button>
        )}

        <Menu
          align="right"
          label={t("Account")}
          trigger={
            <span className="flex items-center gap-1.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xxs font-semibold text-brand-700"
                aria-hidden="true"
              >
                {(player?.display_name ?? 'Cadet').slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-28 truncate text-xxs font-medium text-ink md:inline">
                {player?.display_name ?? t("Cadet")}
              </span>
              <Badge tone="volt">{t("Lv ")}{player?.level ?? 1}</Badge>
            </span>
          }
          items={avatarItems}
        />
      </div>
    </header>
  )
}

/**
 * Campaign centre block: `codeName · title`, the board voltage badge and the briefing re-opener.
 */
export function LevelHeaderCenter({ level, boardVcc, onBriefing }) {
  const { t } = useI18n()
  if (!level) return null
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xxs font-medium uppercase tracking-wide text-slate-500">{level.codeName}</span>
      <span className="text-line-strong" aria-hidden="true">
        ·
      </span>
      <span className="truncate text-sm font-semibold text-ink">{t(level.title)}</span>
      {boardVcc != null && <Badge tone={boardVcc >= 5 ? 'volt' : 'info'}>{boardVcc}{t(" V board")}</Badge>}
      {onBriefing && (
        <IconButton size="sm" icon={<Info size={14} />} label={t("Re-open the briefing")} onClick={onBriefing} />
      )}
    </div>
  )
}

export default AppHeader
