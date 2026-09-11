/**
 * MCU board profiles — CONTRACTS §2.
 *
 * `pins` is in silkscreen order and doubles as the MCU footprint pin order (§4.2). Every pin-keyed
 * field elsewhere in the app uses `PinDef.name`; labels and aliases are for display and sketch lookup only.
 */
import { uno } from './uno.js'
import { nano } from './nano.js'
import { esp32 } from './esp32.js'
import { esp32s3 } from './esp32s3.js'
import { raspberrypi4, raspberrypi5 } from './raspberrypi.js'

/**
 * @typedef PinDef
 * @property {string} name          canonical PinName ('D13', 'A0', 'GPIO4', '5V', 'GND2')
 * @property {string} label         silkscreen text ('D4' for GPIO4 on the DevKit V1)
 * @property {'digital'|'analog'|'power'|'ground'|'other'} kind
 * @property {number|null} number   Arduino pin number used in sketches (Uno A0 → 14; ESP32 GPIO4 → 4)
 * @property {string[]} aliases     sketch names that resolve to this pin ('LED_BUILTIN', 'T0', 'A0', 'SDA')
 * @property {string[]} caps
 * @property {number|null} adcChannel
 * @property {1|2|null} adcUnit     ESP32 ADC unit (ADC2 is unavailable while WiFi is connected); 1 on AVR
 * @property {number|null} touchChannel
 * @property {number|null} dacChannel
 * @property {number|null} volts    fixed voltage of a `power` pin
 * @property {string|null} tiedTo   another PinName this header pin is internally the same signal as (Uno SCL → A5)
 * @property {'left'|'right'|'top'|'bottom'} side
 * @property {number} index         position within its header row
 */

/** @typedef {typeof uno} BoardProfile */

export const BOARDS = { uno, nano, esp32, esp32s3, raspberrypi4, raspberrypi5 }
export const BOARD_IDS = Object.keys(BOARDS)

/** Accept either a board id or a BoardProfile. */
function toBoard(board) {
  if (board == null) return null
  return typeof board === 'string' ? (BOARDS[board] ?? null) : board
}

/**
 * Board profile by id.
 * @param {string} boardId
 * @returns {BoardProfile|null}
 */
export function getBoard(boardId) {
  return BOARDS[boardId] ?? null
}

/**
 * Arduino pin number → pin (Uno 14 → A0; ESP32 4 → GPIO4). Numeric strings are accepted.
 * @param {BoardProfile|string} board
 * @param {number|string} n
 * @returns {PinDef|null}
 */
export function resolvePinNumber(board, n) {
  const b = toBoard(board)
  const num = typeof n === 'string' ? Number(n) : n
  if (!b || !Number.isInteger(num)) return null
  return b.pins.find((p) => p.number === num) ?? null
}

/**
 * Pin by canonical name or alias ('D13' | 'LED_BUILTIN' | 'A0' | 'T0' | 'GPIO4'). Exact match first,
 * then case-insensitive so `led_builtin`/`gnd` still resolve.
 * @param {BoardProfile|string} board
 * @param {string} nameOrAlias
 * @returns {PinDef|null}
 */
export function resolvePinName(board, nameOrAlias) {
  const b = toBoard(board)
  if (!b || typeof nameOrAlias !== 'string' || nameOrAlias === '') return null
  const exact = b.pins.find((p) => p.name === nameOrAlias) ?? b.pins.find((p) => p.aliases.includes(nameOrAlias))
  if (exact) return exact
  const lower = nameOrAlias.toLowerCase()
  return (
    b.pins.find((p) => p.name.toLowerCase() === lower) ??
    b.pins.find((p) => p.aliases.some((a) => a.toLowerCase() === lower)) ??
    null
  )
}

/**
 * Silkscreen label for a PinName (falls back to the name itself for unknown pins).
 * @param {BoardProfile|string} board
 * @param {string} pinName
 */
export function pinLabel(board, pinName) {
  const b = toBoard(board)
  return b?.pins.find((p) => p.name === pinName)?.label ?? pinName
}

/**
 * All ground pin names of a board in silkscreen order ('GND', 'GND2', ...).
 * @param {BoardProfile|string} board
 * @returns {string[]}
 */
export function groundPins(board) {
  const b = toBoard(board)
  return b ? b.pins.filter((p) => p.kind === 'ground').map((p) => p.name) : []
}
