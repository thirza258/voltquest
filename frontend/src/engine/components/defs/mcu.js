/** MCU component definitions — footprints follow CONTRACTS §2/§4.3; pin ids === BOARDS[x].pins[].name. */
import { BOARDS } from '../../boards/index.js'
import { footprint } from './shared.js'
import { esp32Learn, esp32s3Learn, nanoLearn, unoLearn } from '../learn/mcu.js'

/**
 * Two-row footprint for a board-mounted MCU: row 1 at dy=0, row 2 at `rowGap`, both dx 0..(n-1).
 * The board's `pins` array is the concatenation of the two rows in silkscreen order.
 */
function twoRowFootprint(board, perRow, rowGap, width, height) {
  const pins = board.pins.map((p, i) => ({
    id: p.name,
    label: p.label,
    dx: i % perRow,
    dy: i < perRow ? 0 : rowGap,
  }))
  return footprint(pins, width, height)
}

/** Uno: free-mounted 27×21 pitch body; 18-pin top header and 13-pin bottom header (§4.3). */
function unoFootprint() {
  const pins = BOARDS.uno.pins.map((p, i) =>
    i < 18
      ? { id: p.name, label: p.label, dx: 2.5 + i, dy: 0.5 }
      : { id: p.name, label: p.label, dx: 8.5 + (i - 18), dy: 20.5 },
  )
  return footprint(pins, 27, 21)
}

function mcuDef(board, mount, fp, learn, catalogId) {
  return {
    type: board.componentType,
    name: board.name,
    category: 'mcu',
    mount,
    recommendedBoards: [board.id],
    board: board.id,
    footprint: fp,
    props: {},
    model: [],
    control: null,
    peripheral: null,
    learn,
    bom: { partName: board.name, catalogId },
  }
}

export const uno = mcuDef(BOARDS.uno, 'free', unoFootprint(), unoLearn, 'arduino_uno')
export const nano = mcuDef(BOARDS.nano, 'board', twoRowFootprint(BOARDS.nano, 15, 6, 15, 7), nanoLearn, 'arduino_nano')
export const esp32 = mcuDef(BOARDS.esp32, 'board', twoRowFootprint(BOARDS.esp32, 15, 10, 15, 11), esp32Learn, 'esp32_devkit_v1')
export const esp32s3 = mcuDef(BOARDS.esp32s3, 'board', twoRowFootprint(BOARDS.esp32s3, 22, 10, 22, 11), esp32s3Learn, 'esp32_s3')

function raspberryPiDef(board) {
  const pins = board.pins.map((pin, index) => ({ id: pin.name, label: pin.label, dx: 2 + Math.floor(index / 2), dy: index % 2 + 1 }))
  return mcuDef(board, 'free', footprint(pins, 34, 23), {
    summary: 'A Raspberry Pi single-board computer with a 40-pin GPIO header for Python electronics projects.',
    pinout: ['BCM17 is physical pin 11; BCM27 is physical pin 13.', '3V3: physical pins 1 and 17. 5V: physical pins 2 and 4.', 'GND: physical pins 6, 9, 14, 20, 25, 30, 34 and 39.'],
    tips: ['Use BCM pin numbers with gpiozero.', 'Use a series resistor for LEDs and a transistor driver for motors.'],
    pitfalls: ['GPIO is not 5 V tolerant.', 'Analog sensors need an external ADC; it is not simulated yet.'],
  }, board.id)
}

export const raspberrypi4 = raspberryPiDef(BOARDS.raspberrypi4)
export const raspberrypi5 = raspberryPiDef(BOARDS.raspberrypi5)
export const MCU_DEFS = [uno, nano, esp32, esp32s3, raspberrypi4, raspberrypi5]
