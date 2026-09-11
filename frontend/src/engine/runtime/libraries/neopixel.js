import { native, noop, clamp, deviceByPin } from './helpers.js'

export function createNeoPixelLibrary(core) {
  const color = ([red, green, blue]) => ((clamp(red, 0, 255) << 16) | (clamp(green, 0, 255) << 8) | clamp(blue, 0, 255)) >>> 0
  return {
    globals: { NEO_GRB: 0x52, NEO_RGB: 0x06, NEO_KHZ800: 0, NEO_KHZ400: 0x100 },
    classes: { Adafruit_NeoPixel: {
      construct: ([count = 12, pin = 6]) => ({ __class: 'Adafruit_NeoPixel', pin, brightness: 255, pixels: Array.from({ length: clamp(count, 0, 1024) }, () => [0, 0, 0]) }),
      methods: {
        begin: noop,
        setPin: native('void', function ([pin]) { this.pin = pin }),
        Color: native('unsigned long', color),
        setPixelColor: native('void', function ([index, ...values]) {
          if (!this.pixels[index]) return
          const packed = values.length === 1 ? values[0] : color(values)
          this.pixels[index] = [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255]
        }),
        getPixelColor: native('unsigned long', function ([index]) { return color(this.pixels[index] ?? [0, 0, 0]) }),
        numPixels: native('int', function () { return this.pixels.length }),
        clear: native('void', function () { this.pixels = this.pixels.map(() => [0, 0, 0]) }),
        setBrightness: native('void', function ([value]) { this.brightness = clamp(value, 0, 255) }),
        getBrightness: native('int', function () { return this.brightness }),
        show: native('void', function () {
          core.peripheral(deviceByPin(core, 'neopixel', 'din', this.pin), 'neopixel', { pixels: this.pixels.map((pixel) => pixel.slice()), brightness: this.brightness })
        }),
      },
    } },
  }
}
