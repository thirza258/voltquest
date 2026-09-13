import { expect, it } from 'vitest'
import { createSimulation } from '../../engine/sim/index.js'
import { createSimulation as createRobot } from '../../engine/robotics/model.js'
import { TUTORIALS } from '../../content/index.js'
import { tutorialCircuit, tutorialCode } from '../tutorials/circuits.js'
import { deviceMessages, observationFromResult, robotResponse, VISION_ESC_CODE } from './integration.js'

it('routes actual measured observations through HTTP firmware, props-off drone firmware and robot mechanics', async () => {
  const iot = createSimulation(), drone = createSimulation(), robot = createRobot()
  const web = TUTORIALS.find(t => t.id === 'iot-web-control'), esc = TUTORIALS.find(t => t.id === 'drone-esc-basics')
  try {
    iot.setDocument(tutorialCircuit(web, 'esp32')); iot.setCode(tutorialCode(web, 'esp32')); await iot.run(); iot.advance(1500)
    drone.setDocument(tutorialCircuit(esc, 'esp32')); drone.setCode(VISION_ESC_CODE); await drone.run(); drone.advance(1500)
    for (const [detected, error, expectedPulse, expectedBody] of [[true, 0, 1200, 'LED on'], [true, 0.4, 1250, 'LED on'], [true, -0.4, 1150, 'LED on'], [false, 0, 1000, 'LED off']]) {
      const observation = observationFromResult({ metrics: { count: detected ? 100 : 0, fraction: detected ? 0.1 : 0, errorX: detected ? error : null } }, 'color')
      const msg = deviceMessages(observation)
      const request = iot.httpRequest(msg.iot); iot.advance(200); const response = await request
      expect(response).toMatchObject({ status: 200, body: expectedBody })
      drone.setSticks({ arm: msg.drone.arm, throttle: 0, signal: true }); drone.serialWrite(msg.drone.serial); drone.advance(500)
      expect(drone.getState().flight.pulses[0]).toBe(expectedPulse)
      if (detected) expect(drone.getState().flight.rpm[0]).toBeGreaterThan(0)
      const previous = { ...robot.pose }; robotResponse(observation, robot)
      if (detected) expect(robot.pose).not.toEqual(previous)
      else { expect(robot.pose).toEqual(previous); expect(drone.getState().flight.armed).toBe(false) }
      expect(drone.getState().runtimeError).toBeNull(); expect(iot.getState().runtimeError).toBeNull()
    }
  } finally { iot.dispose(); drone.dispose() }
})
it('rejects attention-only results and malformed observations instead of inventing control output', () => {
  expect(observationFromResult({ metrics: { count: 100, fraction: 0.1, errorX: 0.2 } }, 'attention')).toBeNull()
  expect(observationFromResult(null, 'threshold')).toBeNull()
  expect(() => deviceMessages({ detected: true, normalized_x: Infinity })).toThrow()
  expect(deviceMessages({ detected: false, normalized_x: 0 }).robot).toEqual({ linear: { x: 0 }, angular: { z: 0 } })
})
