import { native, noop, clamp, integer, deviceByAddress } from './helpers.js'

const GLYPHS = {
  ' ': '0000000000', '!': '00005f0000', '.': '0060600000', ',': '0080600000', ':': '0036360000',
  '-': '0808080808', '+': '08083e0808', '/': '2010080402', '%': '2313086462', '?': '0201510906',
  '0': '3e5149453e', '1': '00427f4000', '2': '4261514946', '3': '2141454b31', '4': '1814127f10',
  '5': '2745454539', '6': '3c4a494930', '7': '0171090503', '8': '3649494936', '9': '064949291e',
  A: '7e1111117e', B: '7f49494936', C: '3e41414122', D: '7f4141221c', E: '7f49494941',
  F: '7f09090901', G: '3e41495132', H: '7f0808087f', I: '00417f4100', J: '2040413f01',
  K: '7f08142241', L: '7f40404040', M: '7f020c027f', N: '7f0408107f', O: '3e4141413e',
  P: '7f09090906', Q: '3e4151215e', R: '7f09192946', S: '4649494931', T: '01017f0101',
  U: '3f4040403f', V: '1f2040201f', W: '3f4038403f', X: '6314081463', Y: '0708700807', Z: '6151494543',
}

export function createDisplayLibrary(core) {
  function pixel(display, column, row, color) {
    column = integer(column)
    row = integer(row)
    if (column < 0 || column >= 128 || row < 0 || row >= 64) return
    const index = column + Math.floor(row / 8) * 128
    const mask = 1 << (row % 8)
    if (color === 2) display.pixels[index] ^= mask
    else if (color) display.pixels[index] |= mask
    else display.pixels[index] &= ~mask
  }
  function rectangle(display, left, top, width, height, color, fill) {
    left = integer(left)
    top = integer(top)
    width = clamp(width, 0, 128)
    height = clamp(height, 0, 64)
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        if (fill || row === 0 || column === 0 || row === height - 1 || column === width - 1) pixel(display, left + column, top + row, color)
      }
    }
  }
  function print(display, text) {
    for (const character of text) {
      if (character === '\r') continue
      if (character === '\n' || (display.wrap && display.column + 6 * display.size > 128)) {
        display.column = 0
        display.row += 8 * display.size
        if (character === '\n') continue
      }
      const glyph = GLYPHS[character.toUpperCase()] ?? GLYPHS['?']
      for (let column = 0; column < 5; column++) {
        const bits = parseInt(glyph.slice(column * 2, column * 2 + 2), 16)
        for (let row = 0; row < 7; row++) {
          if (bits & (1 << row)) rectangle(display, display.column + column * display.size, display.row + row * display.size, display.size, display.size, display.color, true)
        }
      }
      display.column += 6 * display.size
    }
    return text.length
  }
  return {
    globals: { WHITE: 1, BLACK: 0, INVERSE: 2, SSD1306_WHITE: 1, SSD1306_BLACK: 0, SSD1306_INVERSE: 2, SSD1306_SWITCHCAPVCC: 2, SSD1306_EXTERNALVCC: 1 },
    classes: { Adafruit_SSD1306: {
      construct: () => ({ __class: 'Adafruit_SSD1306', address: 0x3c, pixels: Array(1024).fill(0), column: 0, row: 0, size: 1, color: 1, wrap: true }),
      methods: {
        begin: native('bool', function ([_supply, address = 0x3c]) { this.address = address; return Boolean(deviceByAddress(core, 'oled_i2c', address)) }),
        clearDisplay: native('void', function () { this.pixels.fill(0) }),
        display: native('void', function () { core.peripheral(deviceByAddress(core, 'oled_i2c', this.address), 'oled_i2c', { width: 128, height: 64, pixels: this.pixels.slice() }) }),
        drawPixel: native('void', function (args) { pixel(this, ...args) }),
        getPixel: native('bool', function ([column, row]) { return column >= 0 && column < 128 && row >= 0 && row < 64 && Boolean(this.pixels[integer(column) + Math.floor(row / 8) * 128] & (1 << (row % 8))) }),
        fillScreen: native('void', function ([color]) { this.pixels = this.pixels.map((value) => color === 2 ? value ^ 255 : color ? 255 : 0) }),
        drawRect: native('void', function (args) { rectangle(this, ...args, false) }),
        fillRect: native('void', function (args) { rectangle(this, ...args, true) }),
        drawFastHLine: native('void', function ([column, row, width, color]) { rectangle(this, column, row, width, 1, color, true) }),
        drawFastVLine: native('void', function ([column, row, height, color]) { rectangle(this, column, row, 1, height, color, true) }),
        drawLine: native('void', function ([fromColumn, fromRow, toColumn, toRow, color]) {
          const steps = Math.min(4096, Math.max(Math.abs(toColumn - fromColumn), Math.abs(toRow - fromRow)))
          for (let step = 0; step <= steps; step++) {
            const ratio = steps ? step / steps : 0
            pixel(this, Math.round(fromColumn + ratio * (toColumn - fromColumn)), Math.round(fromRow + ratio * (toRow - fromRow)), color)
          }
        }),
        setCursor: native('void', function ([column, row]) { this.column = integer(column); this.row = integer(row) }),
        setTextSize: native('void', function ([size]) { this.size = clamp(size, 1, 16) }),
        setTextColor: native('void', function ([color]) { this.color = color }),
        setTextWrap: native('void', function ([wrap]) { this.wrap = Boolean(wrap) }),
        print: native('size_t', function (args, ctx) { return print(this, core.format(args[0], ctx.argTypes[0], args[1])) }),
        println: native('size_t', function (args, ctx) { return print(this, `${args.length ? core.format(args[0], ctx.argTypes[0], args[1]) : ''}\n`) }),
        write: native('size_t', function ([value]) { return print(this, typeof value === 'number' ? String.fromCharCode(value & 255) : String(value)) }),
        width: native('int', () => 128), height: native('int', () => 64), dim: noop,
      },
    } },
  }
}
