import { describe, expect, it } from 'vitest'
import { TUTORIALS } from '../../content/index.js'
import { createSimulation } from '../../engine/sim/index.js'
import { tutorialCircuit, tutorialCode } from './circuits.js'

async function run(id, board, action) {
  const tutorial = TUTORIALS.find(item => item.id === id)
  const sim = createSimulation({ inline: true })
  try {
    sim.setDocument(tutorialCircuit(tutorial, board))
    sim.setCode(tutorialCode(tutorial, board))
    expect((await sim.run()).ok).toBe(true)
    await action(sim)
    expect(sim.getState().runtimeError).toBeNull()
  } finally { sim.dispose() }
}
function advance(sim, ms) { for (let i = 0; i < ms; i += 50) sim.advance(Math.min(50, ms - i)) }

it.each(['uno', 'nano', 'esp32', 'esp32s3'])('IoT hysteresis and labelled telemetry behave as explained on %s', async board => {
  const pin = board.startsWith('esp32') ? 'GPIO18' : 'D9'
  await run('iot-sense-act', board, sim => {
    for (const [value, expected] of [[0.8, 1], [0.5, 1], [0.2, 0], [0.5, 0]]) {
      sim.setControl('c_pot', { value }); advance(sim, 250)
      expect(sim.getState().mcuPins[pin].level).toBe(expected)
    }
  })
  await run('iot-telemetry', board, sim => {
    sim.setControl('c_pot', { value: 0.5 }); advance(sim, 700)
    const output = sim.getState().serial.map(entry => entry.text).join('')
    expect(output).toContain(board.startsWith('esp32') ? 'max=4095' : 'max=1023')
    expect(output).toMatch(/adc=\d+ unit=count/)
  })
})

describe.each(['esp32', 'esp32s3'])('%s foundation labs', board => {
  it('executes HTTP commands and read-only status requests', async () => {
    await run('iot-web-control', board, async sim => {
      advance(sim, 1300)
      for (const [path, body, expected] of [['/on', 'LED on', 1], ['/status', 'led=1', 1], ['/off', 'LED off', 0], ['/status', 'led=0', 0]]) {
        const response = sim.httpRequest({ method: 'GET', path }); advance(sim, 100)
        expect(await response).toMatchObject({ status: 200, body })
        expect(sim.getState().mcuPins.GPIO18.level).toBe(expected)
      }
    })
  })
  it('reads controlled bench attitude with no motor drive', async () => {
    await run('drone-imu-basics', board, sim => {
      sim.setBenchTilt({ roll: 15, pitch: -10 }); advance(sim, 700)
      const flight = sim.getState().flight
      expect(flight.attitude[0]).toBeCloseTo(15, 0)
      expect(flight.attitude[1]).toBeCloseTo(-10, 0)
      expect(flight.rpm).toEqual([0, 0, 0, 0])
      expect(sim.getState().serial.map(entry => entry.text).join('')).toMatch(/Roll: 15\.\d Pitch: -10\.\d/)
    })
  })
  it('arms at low command and spins only motor 1 with props removed', async () => {
    await run('drone-esc-basics', board, sim => {
      advance(sim, 1300); sim.setSticks({ arm: true, throttle: 0 }); advance(sim, 100)
      sim.serialWrite('1'); advance(sim, 1000)
      expect(sim.getState().flight.rpm[0]).toBeGreaterThan(100)
      expect(sim.getState().flight.rpm.slice(1)).toEqual([0, 0, 0])
      expect(sim.getState().flight.position[2]).toBe(0)
      sim.serialWrite('0'); advance(sim, 2000)
      expect(sim.getState().flight.rpm[0]).toBeLessThan(1)
      expect(sim.getState().flight.crashed).toBe(false)
    })
  })
  it('takes off, holds height and lands without a crash', async () => {
    await run('drone-hover-basics', board, sim => {
      advance(sim, 1300); sim.setSticks({ arm: true, throttle: 0 }); advance(sim, 100)
      sim.setSticks({ throttle: 0.65 }); advance(sim, 2200)
      expect(sim.getState().flight.position[2]).toBeGreaterThan(0.4)
      sim.setSticks({ throttle: 0.5 }); advance(sim, 1500)
      expect(Math.abs(sim.getState().flight.velocity[2])).toBeLessThan(0.25)
      sim.setSticks({ throttle: 0.35 }); advance(sim, 6000)
      expect(sim.getState().flight.landed).toBe(true)
      expect(sim.getState().flight.crashed).toBe(false)
      sim.setSticks({ throttle: 0, arm: false }); advance(sim, 100)
      expect(sim.getState().flight.armed).toBe(false)
    })
  })
})
