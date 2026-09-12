import { native, noop, clamp, deviceByPin } from './helpers.js'

export function createServoLibrary(core) {
  function emit(servo) {
    const esc = core.bindings.byPin('esc', 'signal', core.pins.resolve(servo.pin)?.name)
    if (esc) { core.peripheral(esc, 'esc', { us: servo.us ?? 1000 }); return }
    core.peripheral(deviceByPin(core, 'servo', 'signal', servo.pin), 'servo', { angle: servo.angle })
  }
  return { classes: { Servo: {
    construct: () => ({ __class: 'Servo', pin: null, angle: 90 }),
    methods: {
      attach: native('int', function ([pin]) { this.pin = pin; emit(this); return 1 }),
      detach: native('void', function () { this.pin = null }),
      attached: native('bool', function () { return this.pin !== null }),
      write: native('void', function ([angle]) { this.angle = clamp(angle, 0, 180); if (this.pin !== null) emit(this) }),
      writeMicroseconds: native('void', function ([duration]) { this.us = duration; this.angle = clamp((duration - 544) * 180 / (2400 - 544), 0, 180); if (this.pin !== null) emit(this) }),
      read: native('int', function () { return this.angle }),
      readMicroseconds: native('int', function () { return Math.round(544 + this.angle * (2400 - 544) / 180) }),
      setPeriodHertz: noop,
    },
  } } }
}
