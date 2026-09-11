import { native, integer } from './helpers.js'

export function createRaspberryPiLibrary(core) {
  let numbering = null
  const configured = new Set()
  const constants = { BCM: 11, BOARD: 10, OUT: 0, IN: 1, HIGH: 1, LOW: 0, PUD_OFF: 20, PUD_DOWN: 21, PUD_UP: 22 }

  function resolve(pin, mode = numbering) {
    if (mode === null) throw new Error('Set GPIO numbering with GPIO.setmode(GPIO.BCM) or GPIO.BOARD first')
    const definition = mode === constants.BOARD ? core.board.pins[integer(pin) - 1] : core.board.pins.find((entry) => entry.number === Number(pin))
    if (!definition?.caps.includes('digital')) throw new Error(`Pin ${pin} is not a GPIO pin in ${mode === constants.BOARD ? 'BOARD' : 'BCM'} mode`)
    return definition.name
  }
  function read(pin) {
    const state = core.pinState(pin)
    return state.mode === 'output' || state.mode === 'pwm' ? state.level : (core.env.digital[pin] ?? (state.mode === 'input_pullup' ? 1 : 0))
  }
  function write(device, value) {
    if (!device.pin) throw new Error('GPIO device is not initialized')
    device.value = Math.max(0, Math.min(1, Number(value)))
    const duty = device.activeHigh ? device.value : 1 - device.value
    if (device.pwm) core.setPwm(device.pin, duty, device.frequency)
    else { core.setMode(device.pin, 'output'); core.setLevel(device.pin, duty ? 1 : 0) }
  }
  function outputClass(className, pwm) {
    return {
      construct: () => ({ __class: className, pin: null, pwm, value: 0, activeHigh: true, frequency: 100 }),
      methods: {
        init: native('void', function ([pin, activeHigh = true, initialValue = 0, frequency = 100]) {
          this.pin = resolve(pin, constants.BCM)
          this.activeHigh = Boolean(activeHigh)
          this.frequency = Math.max(1, Number(frequency))
          configured.add(this.pin)
          write(this, initialValue)
        }),
        on: native('void', function () { write(this, 1) }),
        off: native('void', function () { write(this, 0) }),
        toggle: native('void', function () { write(this, 1 - this.value) }),
        write: native('void', function ([value]) { write(this, value) }),
        read: native('double', function () { return this.value }),
        isActive: native('bool', function () { return this.value > 0 }),
        close: native('void', function () { if (this.pin) core.setMode(this.pin, 'input'); this.pin = null }),
      },
    }
  }
  const sleep = native('void', function* ([seconds], ctx) {
    if (!Number.isFinite(Number(seconds)) || seconds < 0) throw new Error('sleep length must be finite and non-negative')
    yield ctx.sleep(Number(seconds) * 1000000)
  })
  return {
    globals: { PiGPIO: { __class: 'PiGPIOClass', ...constants }, PiTime: { __class: 'PiTimeClass' } },
    natives: {
      __pythonSleep: sleep,
      __pythonPrint: native('void', (args, ctx) => core.queueSerial(`${args.map((value, index) => ctx.argTypes[index] === 'bool' ? (value ? 'True' : 'False') : String(value)).join(' ')}\n`)),
      __pythonInt: native('long', ([value]) => integer(value)),
      __pythonFloat: native('double', ([value]) => Number(value)),
      __pythonStr: native('String', ([value]) => String(value)),
      __pythonRangeStep: native('double', ([value]) => {
        if (!Number.isInteger(value) || value === 0) throw new Error('range step must be a non-zero integer')
        return value
      }),
      __pythonDone: native('void', function* (args, ctx) { core.shared.pythonDone = true; yield ctx.sleep(0) }),
    },
    classes: {
      PiTimeClass: { construct: () => ({ __class: 'PiTimeClass' }), methods: { sleep, monotonic: native('double', () => core.now() / 1000000) } },
      PiLED: outputClass('PiLED', false), PiPWMLED: outputClass('PiPWMLED', true),
      PiButton: {
        construct: () => ({ __class: 'PiButton', pin: null, pullUp: true }),
        methods: {
          init: native('void', function ([pin, pullUp = true]) {
            this.pin = resolve(pin, constants.BCM)
            this.pullUp = Boolean(pullUp)
            configured.add(this.pin)
            core.setMode(this.pin, this.pullUp ? 'input_pullup' : 'input_pulldown')
          }),
          read: native('double', function () { return read(this.pin) === (this.pullUp ? 0 : 1) ? 1 : 0 }),
          isActive: native('bool', function () { return read(this.pin) === (this.pullUp ? 0 : 1) }),
          close: native('void', function () { core.setMode(this.pin, 'input'); this.pin = null }),
        },
      },
      PiPWM: {
        construct: () => ({ __class: 'PiPWM', pin: null, frequency: 100, duty: 0 }),
        methods: {
          init: native('void', function ([pin, frequency]) {
            this.pin = resolve(pin)
            if (core.pinState(this.pin).mode !== 'output') throw new Error('Set up the PWM pin as GPIO.OUT first')
            this.frequency = Number(frequency)
            if (!(this.frequency > 0)) throw new Error('PWM frequency must be positive')
          }),
          start: native('void', function ([duty]) { this.duty = Math.max(0, Math.min(100, duty)); core.setPwm(this.pin, this.duty / 100, this.frequency) }),
          ChangeDutyCycle: native('void', function ([duty]) { this.duty = Math.max(0, Math.min(100, duty)); core.setPwm(this.pin, this.duty / 100, this.frequency) }),
          ChangeFrequency: native('void', function ([frequency]) { if (!(frequency > 0)) throw new Error('PWM frequency must be positive'); this.frequency = frequency; core.setPwm(this.pin, this.duty / 100, frequency) }),
          stop: native('void', function () { this.duty = 0; core.setMode(this.pin, 'output'); core.setLevel(this.pin, 0) }),
        },
      },
      PiGPIOClass: {
        construct: () => ({ __class: 'PiGPIOClass', ...constants }),
        methods: {
          setmode: native('void', ([mode]) => { if (![10, 11].includes(mode)) throw new Error('Expected GPIO.BCM or GPIO.BOARD'); numbering = mode }),
          setwarnings: native('void', () => undefined),
          setup: native('void', ([pin, direction, pull = constants.PUD_OFF, initial = -1]) => {
            const name = resolve(pin)
            if (![constants.IN, constants.OUT].includes(direction)) throw new Error('Expected GPIO.IN or GPIO.OUT')
            configured.add(name)
            core.setMode(name, direction === constants.OUT ? 'output' : pull === constants.PUD_UP ? 'input_pullup' : pull === constants.PUD_DOWN ? 'input_pulldown' : 'input')
            if (direction === constants.OUT) core.setLevel(name, initial > 0 ? 1 : 0)
          }),
          output: native('void', ([pin, value]) => {
            const name = resolve(pin)
            if (core.pinState(name).mode !== 'output') throw new Error('Set up the pin as GPIO.OUT before writing')
            core.setLevel(name, value ? 1 : 0)
          }),
          input: native('int', ([pin]) => read(resolve(pin))),
          cleanup: native('void', ([pin]) => {
            const selected = pin === undefined ? [...configured] : [resolve(pin)]
            for (const name of selected) { core.setMode(name, 'input'); configured.delete(name) }
            if (pin === undefined) numbering = null
          }),
        },
      },
    },
  }
}
