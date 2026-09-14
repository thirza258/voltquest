import { describe, expect, it } from 'vitest'
import { COURSES, getCourse } from './content.js'
import { TUTORIALS } from '../../content/index.js'
import { createSimulation } from '../../engine/sim/index.js'
import { tutorialCircuit } from '../tutorials/circuits.js'
import { fundamentalsForCourse } from './fundamentals.js'

const programming = COURSES.filter(course => course.track === 'programming')
const serialText = sim => sim.getState().serial.map(entry => entry.text).join('')
function advance(sim, ms) {
  for (let remaining = ms; remaining > 0; remaining -= 25) sim.advance(Math.min(25, remaining))
  expect(sim.getState().runtimeError).toBeNull()
}
async function start(id, board) {
  const example = getCourse(id).codeExample
  const tutorial = TUTORIALS.find(entry => entry.id === example.tutorialId)
  const sim = createSimulation({ inline: true })
  sim.setDocument(tutorialCircuit(tutorial, board))
  sim.setCode(example.code)
  const result = await sim.run()
  expect(result.errors).toEqual([])
  expect(result.ok).toBe(true)
  return sim
}
const brightness = sim => sim.getState().evaluation.componentStates.c_led.brightness

it('links every programming course to translated guides and supported example boards', () => {
  expect(programming).toHaveLength(12)
  for (const course of programming) {
    expect(fundamentalsForCourse(course.id).length).toBeGreaterThan(0)
    const example = course.codeExample
    const tutorial = TUTORIALS.find(entry => entry.id === example.tutorialId)
    expect(example.boards.length).toBeGreaterThan(0)
    for (const board of example.boards) expect(tutorial.boards).toContain(board)
    expect(example.explanation.length).toBeGreaterThan(80)
    expect(example.exercise.length).toBeGreaterThan(80)
  }
})

it.each(programming.flatMap(course => course.codeExample.boards.map(board => [course.id, board])))('%s produces its explained output on %s in the real lab circuit', async (id, board) => {
  const sim = await start(id, board)
  try {
    advance(sim, 1250)
    if (id === 'programming-serial') { sim.serialWrite('ON;ONX;OFF;'); advance(sim, 100) }
    if (id === 'programming-mqtt') { sim.serialWrite('1'); advance(sim, 2100) }
    expect(serialText(sim)).toContain(getCourse(id).codeExample.output)
    const state = sim.getState()
    expect(state.events.filter(event => ['blow', 'burnt_pin', 'short'].includes(event.type))).toEqual([])
    expect(state.warningCodesSeen.unbound_device).toBeUndefined()
  } finally { sim.dispose() }
})

describe.each(['uno', 'nano', 'esp32', 'esp32s3'])('programming boundary behavior on %s', board => {
  it('waits for a complete serial frame, rejects oversized tails and recovers at the delimiter', async () => {
    const sim = await start('programming-serial', board)
    try {
      advance(sim, 25)
      sim.serialWrite('O'); advance(sim, 25)
      expect(serialText(sim)).toBe('Ready\n')
      sim.serialWrite('N\r\n'); advance(sim, 25)
      expect(serialText(sim)).toBe('Ready\nAccepted ON\n')
      sim.serialWrite('123456789ON;OFF;\nONX;'); advance(sim, 100)
      expect(serialText(sim)).toBe('Ready\nAccepted ON\nToo long\nAccepted OFF\nUnknown\n')
    } finally { sim.dispose() }
  })

  it('observes state durations and returns to STOP without repeated entry actions', async () => {
    const sim = await start('programming-state', board)
    try {
      advance(sim, 290); expect(serialText(sim)).toBe('STOP\n')
      advance(sim, 30); expect(serialText(sim)).toBe('STOP\nGO\n')
      advance(sim, 170); expect(serialText(sim)).toBe('STOP\nGO\n')
      advance(sim, 30); expect(serialText(sim)).toBe('STOP\nGO\nWAIT\n')
      advance(sim, 100); expect(serialText(sim)).toBe('STOP\nGO\nWAIT\nSTOP\n')
    } finally { sim.dispose() }
  })

  it('calculates unsigned rollover and leaves the periodic work responsive', async () => {
    const sim = await start('programming-time', board)
    try {
      advance(sim, 490); expect(serialText(sim)).toBe('11\n')
      advance(sim, 30); expect(serialText(sim)).toBe('11\nBeat\n')
      advance(sim, 500); expect(serialText(sim)).toBe('11\nBeat\nBeat\n')
    } finally { sim.dispose() }
  })
})

describe.each(['esp32', 'esp32s3'])('connected programming examples on %s', board => {
  it('keeps explicit HTTP commands repeatable and status consistent with the solved LED', async () => {
    const sim = await start('programming-esp32', board)
    try {
      advance(sim, 25)
      for (const [path, status, body, on] of [['/status', 200, 'OFF', false], ['/on', 200, 'ON', true], ['/on', 200, 'ON', true], ['/status', 200, 'ON', true], ['/off', 200, 'OFF', false], ['/missing', 404, null, false]]) {
        const response = sim.httpRequest({ method: 'GET', path })
        advance(sim, 25)
        const result = await response
        expect(result.status).toBe(status)
        if (body) expect(result.body).toBe(body)
        expect(brightness(sim) > 0.1).toBe(on)
        expect(sim.getState().mcuPins.GPIO18.level).toBe(on ? 1 : 0)
      }
    } finally { sim.dispose() }
  })

  it('shares MQTT and serial control, renews only valid commands and expires to a matching OFF report', async () => {
    const sim = await start('programming-mqtt', board)
    try {
      advance(sim, 800)
      expect(serialText(sim)).toBe('MQTT ready\n')
      const send = (topic, payload) => { sim.mqttPublish(topic, payload); advance(sim, 25) }
      send('course/cmd', 'ON')
      expect(brightness(sim)).toBeGreaterThan(0.1)
      advance(sim, 1200)
      send('course/cmd', 'ON')
      advance(sim, 1000)
      expect(brightness(sim)).toBeGreaterThan(0.1)
      for (const payload of ['ONX', 'ON\n', ' ON', 'ON extra', '']) send('course/cmd', payload)
      send('course/other', 'ON')
      sim.serialWrite('x'); advance(sim, 25)
      advance(sim, 850)
      expect(brightness(sim)).toBe(0)
      expect(serialText(sim)).toBe('MQTT ready\nON\nON\nOFF\n')
      expect(sim.getState().mqtt.log.some(entry => entry.topic === 'course/state' && entry.payload === 'OFF')).toBe(true)
      sim.serialWrite('1'); advance(sim, 25)
      expect(brightness(sim)).toBeGreaterThan(0.1)
      send('course/cmd', 'OFF')
      expect(brightness(sim)).toBe(0)
    } finally { sim.dispose() }
  })
})
