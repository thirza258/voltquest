/**
 * Device library registry — every class a sketch can instantiate (CONTRACTS §7.4).
 *
 * `registerLibraries` hands the runtime one bundle of `classes` (native classes the interpreter can
 * `construct`), `globals` (singletons such as `Wire`/`WiFi`/`ESP` and the library constants) and `natives`
 * (the ESP32-only free functions). Everything talks to the shared runtime `core`, so the libraries never
 * touch the VM, the scheduler or `postMessage` directly.
 */

import { createServoLibrary } from './servo.js'
import { createWireLibrary } from './wire.js'
import { createLcdLibrary } from './lcd.js'
import { createNeoPixelLibrary } from './neopixel.js'
import { createDhtLibrary } from './dht.js'
import { createBme280Library } from './bme280.js'
import { createDisplayLibrary } from './ssd1306.js'
import { createWifiLibrary } from './wifi.js'
import { createWebServerLibrary } from './webserver.js'
import { createMqttLibrary } from './mqtt.js'
import { createEsp32Extras } from './esp32.js'
import { createRaspberryPiLibrary } from './raspberrypi.js'
import { createFlightLibrary } from './flight.js'

/**
 * @param {object} core runtime core (see `../index.js`)
 * @param {{ adc: object, network: object }} deps
 * @returns {{ classes: object, globals: object, natives: object, reset: () => void }}
 */
export function registerLibraries(core, { adc, network } = {}) {
  if (core.board.family === 'raspberrypi') return createRaspberryPiLibrary(core)
  const classes = {}
  const globals = {}
  const natives = {}
  const resets = []

  const add = (lib) => {
    if (!lib) return
    Object.assign(classes, lib.classes)
    Object.assign(globals, lib.globals)
    Object.assign(natives, lib.natives)
    if (lib.reset) resets.push(lib.reset)
  }

  // Available on every board.
  add(createServoLibrary(core))
  add(createWireLibrary(core))
  add(createLcdLibrary(core))
  add(createNeoPixelLibrary(core))
  add(createDhtLibrary(core))
  add(createBme280Library(core))
  add(createDisplayLibrary(core))

  // ESP32 family only — `load()` rejects sketches that reach for these on an AVR board.
  if (core.board.family === 'esp32') {
    add(createFlightLibrary(core))
    add(createWifiLibrary(core, network))
    add(createWebServerLibrary(core, network))
    add(createMqttLibrary(core, network))
    add(createEsp32Extras(core, adc))
  }

  return {
    classes,
    globals,
    natives,
    reset() { for (const fn of resets) fn() },
  }
}
