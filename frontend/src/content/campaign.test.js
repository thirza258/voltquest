import { describe, expect, it } from 'vitest'
import { LEVELS, LEVEL_ORDER, WORLDS, nextLevelId, prevLevelId } from './index.js'
import { resolvePins } from '../engine/components/registry.js'
import { createSimulation } from '../engine/sim/index.js'
import { evaluateObjectives, RULE_TYPES } from '../engine/validator/index.js'
import { runLevelSolution } from '../engine/headless.js'
import dictionary from '../i18n/id.json'

const additions = LEVEL_ORDER.filter(id => /^w[67]-/.test(id))
const clone = value => structuredClone(value)

describe('intermediate and hard campaign content', () => {
  it('appends two complete worlds without changing the original progression', () => {
    expect(LEVEL_ORDER.slice(0, 20)).toEqual([
      'w1-l1', 'w1-l2', 'w1-l3', 'w1-l4', 'w2-l1', 'w2-l2', 'w2-l3', 'w2-l4', 'w2-l5',
      'w3-l1', 'w4-l1', 'w4-l2', 'w4-l3', 'w4-l4', 'w5-l1', 'w5-l2', 'w5-l3', 'w5-l4', 'w5-l5', 'w5-l6',
    ])
    expect(additions).toHaveLength(12)
    expect(nextLevelId('w5-l6')).toBe('w6-l1')
    expect(prevLevelId('w7-l1')).toBe('w6-l6')
    expect(nextLevelId('w7-l6')).toBeNull()
    for (const [worldId, difficulty] of [['w6', 'intermediate'], ['w7', 'hard']]) {
      const world = WORLDS.find(w => w.id === worldId)
      expect(world.levelIds).toHaveLength(6)
      world.levelIds.forEach((id, index) => {
        expect(LEVELS[id]).toMatchObject({ worldId, difficulty, order: index + 1, board: world.board })
      })
    }
  })

  it.each(additions)('%s has physical, editable wiring and complete translated guidance', id => {
    const level = LEVELS[id]
    expect(level.starterCircuit.wires).toEqual([])
    expect(level.starterCircuit.components).toEqual(level.solution.circuit.components)
    const doc = level.solution.circuit
    const occupied = new Set()
    const terminals = new Set()
    for (const part of doc.components) {
      expect(level.allowedComponents).toContain(part.type)
      const resolved = resolvePins(part, doc)
      expect(resolved.valid, part.id).toBe(true)
      for (const [name, pin] of Object.entries(resolved.pins)) {
        terminals.add(`${part.id}:${name}`)
        if (!pin.hole) continue
        expect(occupied.has(pin.hole), `overlapping leg ${pin.hole}`).toBe(false)
        occupied.add(pin.hole)
      }
    }
    for (const wire of doc.wires) {
      for (const end of [wire.from, wire.to]) {
        if (!end.startsWith('bb')) { expect(terminals.has(end), end).toBe(true); continue }
        expect(occupied.has(end), `occupied cable plug ${end}`).toBe(false)
        occupied.add(end)
      }
    }
    expect(new Set(level.objectives.map(o => o.id)).size).toBe(level.objectives.length)
    for (const objective of level.objectives) {
      expect(objective.rules.length).toBeGreaterThan(0)
      expect(objective.hints.tier3).toBe(true)
      for (const rule of objective.rules) expect(RULE_TYPES).toContain(rule.type)
    }
    const prose = [level.title, level.summary, level.learn.title, level.learn.body, level.successText,
      level.starCriteria.threeText, ...level.briefing.map(b => b.text),
      ...level.objectives.flatMap(o => [o.text, o.hints.tier1, o.hints.tier2.text])]
    for (const text of prose) expect(dictionary[text], text).toBeTruthy()
  })

  it.each(additions)('%s starts with an unsolved, compilable challenge', async id => {
    const level = LEVELS[id]
    const result = await runLevelSolution({ ...level, solution: { circuit: level.starterCircuit, code: level.starterCode } }, { runMs: 100 })
    expect(result.error).toBeNull()
    expect(result.allPassed).toBe(false)
    expect(result.stars).toBe(0)
  })
})

/** Drive the real VM and solver at explicit virtual times, independently of the authored actions. */
async function exercise(id, run) {
  const level = LEVELS[id]
  const doc = clone(level.solution.circuit)
  const sim = createSimulation({ inline: true })
  let elapsed = 0
  try {
    sim.setDocument(doc)
    sim.setCode(level.solution.code)
    expect((await sim.run()).ok).toBe(true)
    const advance = async ms => { sim.advance(ms); elapsed += ms; await Promise.resolve() }
    const set = (type, patch) => sim.setControl(doc.components.find(c => c.type === type).id, patch)
    const state = () => sim.getState()
    const pin = name => state().mcuPins[name]
    const data = type => state().peripherals[doc.components.find(c => c.type === type).id]?.data
    const text = () => state().trace.serialText
    const request = async path => {
      const pending = sim.httpRequest({ method: 'GET', path })
      await advance(20)
      return pending
    }
    const publish = async (topic, payload) => { sim.mqttPublish(topic, payload); await advance(40) }
    await run({ sim, doc, level, advance, set, state, pin, data, text, request, publish, time: () => elapsed })
    expect(state().runtimeError).toBeNull()
    expect(state().events.filter(e => ['blow', 'burnt_pin'].includes(e.type))).toEqual([])
  } finally { sim.dispose() }
}

describe('campaign behavior beyond the reference input sequence', () => {
  it('debounces short pulses and counts holds once, including release bounce', async () => {
    await exercise('w6-l1', async ({ advance, set, text, pin }) => {
      await advance(100)
      for (const pressed of [true, false, true, false]) { set('pushbutton', { pressed }); await advance(10) }
      expect(text()).toBe('')
      set('pushbutton', { pressed: true }); await advance(60)
      expect(text()).toBe('COUNT=1\n')
      await advance(600)
      expect(text()).toBe('COUNT=1\n')
      expect(pin('D9').level).toBe(1)
      for (const pressed of [false, true, false]) { set('pushbutton', { pressed }); await advance(10) }
      await advance(40)
      set('pushbutton', { pressed: true }); await advance(60)
      expect(text()).toBe('COUNT=1\nCOUNT=2\n')
      expect(pin('D9').level).toBe(0)
    })
  })

  it('retains either hysteresis state through the dead band', async () => {
    await exercise('w6-l2', async ({ advance, set, pin }) => {
      for (const [value, expected] of [[0.65, 0], [0.72, 1], [0.6, 1], [0.32, 1], [0.25, 0], [0.6, 0]]) {
        set('potentiometer', { value }); await advance(60)
        expect(pin('D9').level, `knob ${value}`).toBe(expected)
      }
    })
  })

  it('reads a brief button press between independent clock deadlines', async () => {
    await exercise('w6-l3', async ({ advance, set, pin, text }) => {
      await advance(237)
      set('pushbutton', { pressed: true }); await advance(30)
      expect(text()).toBe('PRESS=1\n')
      set('pushbutton', { pressed: false }); await advance(100)
      expect(pin('D9').level).toBe(1)
      expect(pin('D10').level).toBe(1)
      await advance(60)
      expect(pin('D9').level).toBe(0)
      expect(pin('D10').level).toBe(1)
    })
  })

  it('maps intermediate servo positions and gives release priority', async () => {
    await exercise('w6-l4', async ({ advance, set, data }) => {
      set('pushbutton', { pressed: true }); set('potentiometer', { value: 0.25 }); await advance(40)
      expect(data('servo').angle).toBeGreaterThanOrEqual(44)
      expect(data('servo').angle).toBeLessThanOrEqual(45)
      set('potentiometer', { value: 1 }); await advance(30)
      expect(data('servo').angle).toBe(150)
      set('pushbutton', { pressed: false }); await advance(30)
      expect(data('servo').angle).toBe(90)
    })
  })

  it('replaces longer LCD values with fresh shorter readings without leftover digits', async () => {
    await exercise('w6-l5', async ({ advance, set, data }) => {
      await advance(350)
      expect(data('lcd16x2_i2c').lines[0]).toBe('T=24.5 C        ')
      set('bme280', { temperatureC: 9.5, humidity: 8 }); await advance(300)
      expect(data('lcd16x2_i2c').lines).toEqual(['T=9.5 C         ', 'H=8.0 %         '])
    })
  })

  it('keeps traffic and pedestrians mutually exclusive and ignores a held request', async () => {
    await exercise('w6-l6', async ({ advance, set, pin, text }) => {
      await advance(100); set('pushbutton', { pressed: true })
      for (let i = 0; i < 160; i++) {
        await advance(20)
        expect(pin('D9').level && pin('D11').level).toBeFalsy()
        if (pin('D11').level) expect(pin('D10').level).toBe(1)
      }
      expect(text()).toBe('READY\nWAIT\nCROSS\nCLEAR\nREADY\n')
      set('pushbutton', { pressed: false }); await advance(40)
      set('pushbutton', { pressed: true }); await advance(40)
      expect(text()).toBe('READY\nWAIT\nCROSS\nCLEAR\nREADY\nWAIT\n')
    })
  })

  it('waits for serial framing, rejects bad tokens and overflow, and accepts both PWM bounds', async () => {
    await exercise('w7-l1', async ({ sim, advance, pin, text }) => {
      await advance(20)
      sim.serialWrite('SET 17'); await advance(40)
      expect(pin('GPIO18').duty).toBe(0)
      expect(text()).toBe('')
      sim.serialWrite('\r\n'); await advance(40)
      expect(pin('GPIO18').duty).toBeCloseTo(17 / 255)
      for (const invalid of ['SET -1', 'SET 256', 'SET 1x', 'SET  2', 'SET', 'x'.repeat(30)]) {
        sim.serialWrite(`${invalid}\n`); await advance(30)
        expect(pin('GPIO18').duty).toBeCloseTo(17 / 255)
      }
      for (const duty of [0, 255]) {
        sim.serialWrite(`SET ${duty}\n`); await advance(30)
        expect(pin('GPIO18').duty).toBeCloseTo(duty / 255)
      }
      expect(text()).toBe(`OK=17\n${'ERR\n'.repeat(6)}OK=0\nOK=255\n`)
    })
  })

  it('renews the HTTP lease only on /on and supports immediate /off', async () => {
    await exercise('w7-l2', async ({ advance, request, pin, text }) => {
      await advance(100)
      expect(await request('/on')).toMatchObject({ status: 200, body: 'ON' })
      await advance(500)
      await request('/on')
      await advance(500)
      expect(await request('/status')).toMatchObject({ body: 'ON' })
      await advance(300)
      expect(await request('/status')).toMatchObject({ body: 'OFF' })
      expect(pin('GPIO18').level).toBe(0)
      expect(text()).toBe('EXPIRED\n')
      await request('/on'); await request('/off')
      expect(pin('GPIO18').level).toBe(0)
      await advance(800)
      expect(text()).toBe('EXPIRED\n')
      expect(await request('/unknown')).toMatchObject({ status: 404 })
    })
  }, 15000)

  it('validates complete MQTT payloads and acknowledges only applied commands', async () => {
    await exercise('w7-l3', async ({ advance, publish, state, pin }) => {
      await advance(1000)
      await publish('bench/lamp/set', 'ON')
      expect(pin('GPIO18').level).toBe(1)
      for (const payload of ['ONLY', 'OFF!', '']) {
        await publish('bench/lamp/set', payload)
        expect(pin('GPIO18').level).toBe(1)
      }
      await publish('bench/lamp/set', 'OFF')
      expect(pin('GPIO18').level).toBe(0)
      const published = state().mqtt.log.filter(e => e.dir === 'pub')
      expect(published.filter(e => e.topic === 'bench/lamp/state').map(e => e.payload)).toEqual(['ON', 'OFF'])
      expect(published.filter(e => e.topic === 'bench/lamp/error').map(e => e.payload)).toEqual(['INVALID', 'INVALID', 'INVALID'])
    })
  })

  it('uses a changing ADC1 setpoint and both hysteresis exit conditions under WiFi', async () => {
    await exercise('w7-l4', async ({ advance, set, pin, state, request }) => {
      set('potentiometer', { value: 0.9 }); set('dht22', { temperatureC: 34, humidity: 75 }); await advance(650)
      expect(pin('GPIO18').level).toBe(0)
      set('dht22', { temperatureC: 40 }); await advance(150)
      expect(pin('GPIO18').level).toBe(1)
      set('dht22', { temperatureC: 37, humidity: 68 }); await advance(150)
      expect(pin('GPIO18').level).toBe(1)
      set('dht22', { temperatureC: 35 }); await advance(150)
      expect(pin('GPIO18').level).toBe(0)
      set('dht22', { temperatureC: 40, humidity: 75 }); await advance(150)
      expect(pin('GPIO18').level).toBe(1)
      set('dht22', { humidity: 60 }); await advance(150)
      expect(pin('GPIO18').level).toBe(0)
      expect((await request('/status')).body).toBe('t=40.0;limit=38;h=60.0;alarm=OFF')
      expect(state().warningCodesSeen.adc2_wifi).toBeUndefined()
    })
  })

  it('rejects a single range outlier, detects sustained proximity and clears on sensor loss', async () => {
    await exercise('w7-l5', async ({ sim, doc, advance, set, pin }) => {
      set('ultrasonic_hcsr04', { distanceCm: 120 }); await advance(600)
      expect(pin('GPIO23').level).toBe(0)
      set('ultrasonic_hcsr04', { distanceCm: 20 }); await advance(60)
      expect(pin('GPIO23').level).toBe(0)
      set('ultrasonic_hcsr04', { distanceCm: 120 }); await advance(350)
      expect(pin('GPIO23').level).toBe(0)
      set('ultrasonic_hcsr04', { distanceCm: 20 }); await advance(250)
      expect(pin('GPIO23').level).toBe(1)
      const disconnected = clone(doc)
      const supplyNet = sim.getState().compiled.mcu.pinNet.VIN
      disconnected.wires = disconnected.wires.filter(w => sim.getState().compiled.terminalToNet[w.from] !== supplyNet)
      sim.setDocument(disconnected); await advance(200)
      expect(pin('GPIO23').level).toBe(0)
    })
  })

  it('honors both manual vent overrides, rejects bad modes and reports the applied state', async () => {
    await exercise('w7-l6', async ({ advance, set, publish, request, data, pin, state }) => {
      set('bme280', { temperatureC: 26 }); await advance(1000)
      await publish('greenhouse/mode', 'OPEN')
      expect(data('servo').angle).toBe(150)
      expect(pin('GPIO23').level).toBe(1)
      await publish('greenhouse/mode', 'OPEN!')
      expect((await request('/status')).body).toBe('mode=OPEN;temp=26.0;vent=OPEN')
      await publish('greenhouse/mode', 'AUTO')
      expect(data('servo').angle).toBe(30)
      set('bme280', { temperatureC: 31 }); await advance(150)
      expect(data('servo').angle).toBe(150)
      set('bme280', { temperatureC: 28 }); await advance(150)
      expect(data('servo').angle).toBe(150)
      await publish('greenhouse/mode', 'CLOSE'); await advance(550)
      expect(data('servo').angle).toBe(30)
      const status = (await request('/status')).body
      expect(status).toBe('mode=CLOSE;temp=28.0;vent=CLOSED')
      expect(state().mqtt.log.filter(e => e.dir === 'pub' && e.topic === 'greenhouse/status').at(-1).payload).toBe(status)
    })
  }, 15000)

  it('does not award the hysteresis objectives to a one-threshold alarm', async () => {
    const level = clone(LEVELS['w6-l2'])
    level.solution.code = level.solution.code.replace('if (reading <= 300)', 'if (reading < 700)')
    const result = await runLevelSolution(level, { runMs: 3300 })
    expect(result.error).toBeNull()
    expect(result.allPassed).toBe(false)
    expect(result.objectives.find(o => o.id === 'middle_on').passed).toBe(false)
  })

  it('requires actual I²C wiring for the display objectives', async () => {
    await exercise('w6-l5', async ({ sim, doc, level, advance }) => {
      const disconnected = { ...doc, wires: [] }
      sim.setDocument(disconnected)
      await advance(600)
      const result = evaluateObjectives(level, { doc: disconnected, sim: sim.getState(), code: level.solution.code })
      expect(result.objectives.find(o => o.id === 'initial').passed).toBe(false)
      expect(result.objectives.find(o => o.id === 'changed').passed).toBe(false)
    })
  })
})
