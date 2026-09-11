import { motion } from 'framer-motion'
import { cx, prefersReducedMotion, TONE_SOFT } from './tokens.js'

/** Per-mood eye, mouth and antenna treatment. Body art is shared. */
const MOODS = {
  happy: { eye: 'open', mouth: 'smile', spark: true },
  thinking: { eye: 'squint', mouth: 'flat', spark: false },
  alert: { eye: 'wide', mouth: 'o', spark: true },
  celebrate: { eye: 'happy', mouth: 'grin', spark: true },
  sleepy: { eye: 'closed', mouth: 'small', spark: false },
}

const TEAL = '#0D9488'
const TEAL_DARK = '#0F766E'
const AMBER = '#FBBF24'
const INK = '#0F172A'
const PANEL = '#FFFFFF'

/** Eyes for one mood, drawn at the two eye centres. */
function Eyes({ kind }) {
  const cx1 = 26
  const cx2 = 38
  const cy = 30
  if (kind === 'closed') {
    return (
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d={`M${cx1 - 4} ${cy} q4 3 8 0`} />
        <path d={`M${cx2 - 4} ${cy} q4 3 8 0`} />
      </g>
    )
  }
  if (kind === 'squint') {
    return (
      <g fill={INK}>
        <rect x={cx1 - 4} y={cy - 1.5} width="8" height="3" rx="1.5" />
        <rect x={cx2 - 4} y={cy - 1.5} width="8" height="3" rx="1.5" />
      </g>
    )
  }
  if (kind === 'happy') {
    return (
      <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
        <path d={`M${cx1 - 4} ${cy + 1} q4 -5 8 0`} />
        <path d={`M${cx2 - 4} ${cy + 1} q4 -5 8 0`} />
      </g>
    )
  }
  const r = kind === 'wide' ? 4.6 : 3.6
  return (
    <g>
      <circle cx={cx1} cy={cy} r={r} fill={INK} />
      <circle cx={cx2} cy={cy} r={r} fill={INK} />
      <circle cx={cx1 + 1.2} cy={cy - 1.2} r="1.1" fill={PANEL} />
      <circle cx={cx2 + 1.2} cy={cy - 1.2} r="1.1" fill={PANEL} />
    </g>
  )
}

/** Mouth for one mood. */
function Mouth({ kind }) {
  if (kind === 'o') return <circle cx="32" cy="40" r="3" fill={INK} />
  if (kind === 'flat') return <path d="M27 40 h10" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
  if (kind === 'small') return <path d="M30 40 h4" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
  if (kind === 'grin')
    return (
      <g>
        <path d="M25 38 q7 8 14 0 z" fill={INK} />
        <path d="M27.5 40.2 h9" stroke={PANEL} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    )
  return <path d="M26 38 q6 6 12 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
}

/**
 * Chip, the VoltQuest mascot: a retro robot with a rounded-square head, round
 * eyes, a bolt-tipped antenna, a teal body and amber accents. Moods change the
 * eyes, mouth and antenna spark only.
 *
 * @param {{ mood?: 'happy'|'thinking'|'alert'|'celebrate'|'sleepy', size?: number, className?: string }} props
 */
export function ChipMascot({ mood = 'happy', size = 64, className = '', ...rest }) {
  const m = MOODS[mood] || MOODS.happy
  const float = !prefersReducedMotion()
  const Wrapper = float ? motion.svg : 'svg'
  const anim = float
    ? {
        animate: { y: [0, -3, 0] },
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
      }
    : {}

  return (
    <Wrapper
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Chip the robot, ${mood}`}
      className={cx('shrink-0', className)}
      {...anim}
      {...rest}
    >
      {/* antenna */}
      <line x1="32" y1="12" x2="32" y2="18" stroke={TEAL_DARK} strokeWidth="2" strokeLinecap="round" />
      <path
        d="M32 4 l-4 7 h3.2 l-1.6 5.5 l5.4 -7.5 h-3.2 l2.2 -5 z"
        fill={m.spark ? AMBER : '#CBD5E1'}
        stroke={TEAL_DARK}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {/* head */}
      <rect x="14" y="18" width="36" height="30" rx="9" fill={PANEL} stroke={TEAL} strokeWidth="2.5" />
      <rect x="18" y="22" width="28" height="22" rx="7" fill="#F0FDFA" />
      <Eyes kind={m.eye} />
      <Mouth kind={m.mouth} />
      {/* cheek LEDs */}
      <circle cx="19.5" cy="36" r="1.6" fill={AMBER} opacity={mood === 'sleepy' ? 0.35 : 0.9} />
      <circle cx="44.5" cy="36" r="1.6" fill={AMBER} opacity={mood === 'sleepy' ? 0.35 : 0.9} />
      {/* body */}
      <rect x="20" y="48" width="24" height="12" rx="5" fill={TEAL} />
      <rect x="26" y="52" width="12" height="4" rx="2" fill={AMBER} />
      {/* arms */}
      <path d="M20 52 h-6" stroke={TEAL_DARK} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 52 h6" stroke={TEAL_DARK} strokeWidth="2.5" strokeLinecap="round" />
    </Wrapper>
  )
}

/**
 * Rounded speech bubble with a small tail on the left, for Chip's hints and
 * briefings.
 *
 * @param {{ children: React.ReactNode, tone?: 'neutral'|'brand'|'success'|'warning'|'danger'|'volt'|'info', className?: string }} props
 */
export function SpeechBubble({ children, tone = 'neutral', className = '', ...rest }) {
  const toneClass = TONE_SOFT[tone] || TONE_SOFT.neutral
  return (
    <div className={cx('relative', className)} {...rest}>
      <div className={cx('rounded-lg border px-3 py-2 text-xxs leading-relaxed', toneClass)}>{children}</div>
      {/* tail: a rotated square sharing the bubble's border + fill */}
      <span
        aria-hidden="true"
        className={cx('absolute left-3 -bottom-1 h-2 w-2 rotate-45 border-b border-r', toneClass)}
      />
    </div>
  )
}
