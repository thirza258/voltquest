import { describe, it, expect } from 'vitest'
import { sketch } from './testHarness.js'
import { translatePython } from './python.js'
import { createRuntime } from './index.js'
import { getBoard } from '../boards/index.js'

describe('Raspberry Pi Python GPIO subset', () => {
  it.each(['raspberrypi4', 'raspberrypi5'])('blinks a gpiozero LED on %s', (board) => {
    const run = sketch('from gpiozero import LED\nfrom time import sleep\nled = LED(17)\nwhile True:\n    led.on()\n    sleep(0.1)\n    led.off()\n    sleep(0.1)', { board })
    run.advance(250)
    expect(run.runtime.getPinStates().GPIO17).toMatchObject({ mode: 'output', level: 1 })
    const edges = run.ofType('pins').flatMap((message) => message.changes).filter((entry) => entry.level !== undefined)
    expect(edges.map((entry) => entry.level)).toEqual([1, 0, 1])
    expect(edges[1].t - edges[0].t).toBeGreaterThanOrEqual(100000)
  })

  it('reads a pull-up button and writes PWMLED values', () => {
    const run = sketch('from gpiozero import Button, PWMLED\nfrom time import sleep\nbutton = Button(27)\nled = PWMLED(18, frequency=200)\nwhile True:\n    if button.is_pressed:\n        led.value = 0.25\n    else:\n        led.off()\n    sleep(0.01)', { board: 'raspberrypi4', env: { digital: { GPIO27: 0 } } })
    run.advance(1)
    expect(run.runtime.getPinStates()).toMatchObject({ GPIO27: { mode: 'input_pullup' }, GPIO18: { mode: 'pwm', duty: 0.25, freq: 200 } })
    run.runtime.handle({ type: 'env', digital: { GPIO27: 1 } })
    run.advance(20)
    expect(run.runtime.getPinStates().GPIO18.duty).toBe(0)
  })

  it.each([['BCM', 17], ['BOARD', 11]])('maps RPi.GPIO %s numbering to GPIO17', (mode, pin) => {
    const run = sketch(`import RPi.GPIO as GPIO\nimport time\nGPIO.setmode(GPIO.${mode})\nGPIO.setup(${pin}, GPIO.OUT, initial=GPIO.HIGH)\nprint(GPIO.input(${pin}))\ntime.sleep(0.01)\nGPIO.cleanup()`, { board: 'raspberrypi4' })
    run.advance(1)
    expect(run.runtime.getPinStates().GPIO17.level).toBe(1)
    expect(run.text()).toBe('1\n')
    run.advance(20)
    expect(run.runtime.getPinStates().GPIO17.mode).toBe('input')
    expect(run.runtime.getSnapshot().status).toBe('halted')
  })

  it('supports RPi.GPIO PWM and finite Python loops', () => {
    const run = sketch('import RPi.GPIO as GPIO\nGPIO.setmode(GPIO.BCM)\nGPIO.setup(18, GPIO.OUT)\npwm = GPIO.PWM(18, 100)\npwm.start(0)\nfor duty in range(0, 76, 25):\n    pwm.ChangeDutyCycle(duty)\n    print(duty)\nprint(5 / 2)', { board: 'raspberrypi5' })
    run.advance(1)
    expect(run.text()).toBe('0\n25\n50\n75\n2.5\n')
    expect(run.runtime.getPinStates().GPIO18.duty).toBe(0.75)
    expect(run.runtime.getSnapshot().status).toBe('halted')
  })

  it('reports runtime errors at the original Python source line', () => {
    const run = sketch('import RPi.GPIO as GPIO\nGPIO.setmode(GPIO.BOARD)\nGPIO.setup(1, GPIO.OUT)', { board: 'raspberrypi4' })
    run.runtime.advance(1)
    expect(run.runtime.getSnapshot()).toMatchObject({ status: 'error', error: { line: 3 } })
    expect(run.runtime.getSnapshot().error.message).toContain('not a GPIO pin')
  })

  it.each(['import os\nos.system("bad")', 'from gpiozero import Camera', 'while True:\nprint(1)', 'print(1); digitalWrite(17, 1)', 'def function():\n    pass'])('rejects unsupported Python explicitly', (source) => {
    const runtime = createRuntime({ board: getBoard('raspberrypi4'), realtime: false })
    const result = runtime.load(source)
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatchObject({ severity: 'error', line: expect.any(Number) })
  })

  it('preserves comments inside Python strings', () => {
    const run = sketch('print("light #1") # message', { board: 'raspberrypi4' })
    run.advance(1)
    expect(run.text()).toBe('light #1\n')
    expect(translatePython('while True:\n    pass').ok).toBe(true)
  })
})
