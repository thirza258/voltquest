import { native, noop, clamp, deviceByAddress } from './helpers.js'

export function createLcdLibrary(core) {
  function emit(display) {
    core.peripheral(deviceByAddress(core, 'lcd_i2c', display.address), 'lcd_i2c', { lines: display.lines.slice(), backlight: display.lit })
  }
  function print(display, text) {
    for (const character of text) {
      if (character === '\n') { display.row = (display.row + 1) % display.rows; display.column = 0; continue }
      if (display.column >= display.columns) continue
      const line = display.lines[display.row]
      display.lines[display.row] = line.slice(0, display.column) + character + line.slice(display.column + 1)
      display.column += 1
    }
    emit(display)
    return text.length
  }
  return { classes: { LiquidCrystal_I2C: {
    construct: ([address = 0x27, columns = 16, rows = 2]) => {
      const width = clamp(columns, 1, 40)
      const height = clamp(rows, 1, 4)
      return { __class: 'LiquidCrystal_I2C', address, columns: width, rows: height, column: 0, row: 0, lit: true, lines: Array(height).fill(' '.repeat(width)) }
    },
    methods: {
      init: native('void', function () { emit(this) }), begin: native('void', function () { emit(this) }),
      clear: native('void', function () { this.lines.fill(' '.repeat(this.columns)); this.row = 0; this.column = 0; emit(this) }),
      home: native('void', function () { this.column = 0; this.row = 0 }),
      setCursor: native('void', function ([column, row]) { this.column = clamp(column, 0, this.columns - 1); this.row = clamp(row, 0, this.rows - 1) }),
      print: native('size_t', function (args, ctx) { return print(this, core.format(args[0], ctx.argTypes[0], args[1])) }),
      println: native('size_t', function (args, ctx) { return print(this, `${core.format(args[0], ctx.argTypes[0], args[1])}\n`) }),
      write: native('size_t', function ([value]) { return print(this, typeof value === 'number' ? String.fromCharCode(value & 255) : String(value)) }),
      backlight: native('void', function () { this.lit = true; emit(this) }),
      noBacklight: native('void', function () { this.lit = false; emit(this) }),
      cursor: noop, noCursor: noop, blink: noop, noBlink: noop, display: noop, noDisplay: noop,
    },
  } } }
}
