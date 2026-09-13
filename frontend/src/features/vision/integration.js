import { createSimulation, publishTwist, stepSimulation } from '../../engine/robotics/model.js'

export const VISION_ESC_CODE = `#include <ESP32Servo.h>
Servo esc;
void setup() {
  Serial.begin(115200);
  esc.attach(18);
  esc.writeMicroseconds(1000);
}
void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'X') esc.writeMicroseconds(1000);
    if (c == 'L') esc.writeMicroseconds(1150);
    if (c == 'C') esc.writeMicroseconds(1200);
    if (c == 'R') esc.writeMicroseconds(1250);
  }
  delay(10);
}
`
/** A deliberate adapter: perception produces one bounded observation; each device has its own port. */
export function observationFromResult(result, mode) {
  if (mode === 'attention') return null
  const metrics = result?.metrics
  if (!metrics || !Number.isFinite(metrics.count) || !Number.isFinite(metrics.fraction)) return null
  const detected = metrics.count >= 16 && Number.isFinite(metrics.errorX)
  return { detected, normalized_x: detected ? Math.max(-1, Math.min(1, metrics.errorX)) : 0, area_fraction: Math.max(0, Math.min(1, metrics.fraction)) }
}
export function deviceMessages(observation) {
  if (!observation || typeof observation.detected !== 'boolean' || !Number.isFinite(observation.normalized_x) || Math.abs(observation.normalized_x) > 1) throw new Error('A valid vision observation is required.')
  const { detected, normalized_x: x } = observation
  return { iot: { method: 'GET', path: detected ? '/on' : '/off' },
    drone: { serial: !detected ? 'X' : x < -0.1 ? 'L' : x > 0.1 ? 'R' : 'C', arm: detected },
    robot: { linear: { x: detected ? 0.15 : 0 }, angular: { z: detected ? Number((-x).toFixed(3)) : 0 } } }
}
export function robotResponse(observation, simulation = createSimulation()) {
  const message = deviceMessages(observation).robot
  publishTwist(simulation, '/cmd_vel', message)
  for (let i = 0; i < 20; i++) stepSimulation(simulation)
  return simulation
}
