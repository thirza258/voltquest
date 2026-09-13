import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT, createSimulation, integratePose, wheelSpeeds, validateProject, parseProject, publishTwist, stepSimulation, startGoal, cancelGoal, resetPose, setParameters, measureRange } from './model.js'
const advance = (s, n) => { for (let i = 0; i < n; i++) stepSimulation(s); return s }
const twist = (v = 0.4, w = 0) => ({ linear: { x: v }, angular: { z: w } })
const project = patch => ({ ...structuredClone(DEFAULT_PROJECT), ...patch })

describe('deterministic robot mechanics and ROS concept delivery', () => {
  it('matches independent straight and arc solutions', () => {
    expect(wheelSpeeds(0.4, 1, DEFAULT_PROJECT.robot)).toEqual({ left: 5, right: 11 })
    expect(integratePose({ x: 0, y: 0, yaw: 0 }, 1, Math.PI / 2, 1)).toEqual({ x: 2 / Math.PI, y: (1 - Math.cos(Math.PI / 2)) * 2 / Math.PI, yaw: Math.PI / 2 })
    const s = createSimulation(); publishTwist(s, '/cmd_vel', twist()); advance(s, 20)
    expect(s.pose.x).toBeCloseTo(1.4, 10); expect(s.pose.y).toBe(1)
    advance(s, 20); expect(s.pose.x).toBeCloseTo(1.4, 10); expect(s.velocity.linear).toBe(0)
    expect(s.status).toBe('command timed out')
  })
  it('turns in place and integrates robot-frame forward motion in world y', () => {
    const s = createSimulation(project({ start: { x: 1, y: 1, yaw: Math.PI / 2 } }))
    publishTwist(s, '/cmd_vel', twist(0.3)); advance(s, 20)
    expect(s.pose.x).toBeCloseTo(1); expect(s.pose.y).toBeCloseTo(1.3)
    publishTwist(s, '/cmd_vel', twist(0, 1)); advance(s, 10)
    expect(s.pose.x).toBeCloseTo(1); expect(s.pose.y).toBeCloseTo(1.3); expect(s.pose.yaw).toBeCloseTo(Math.PI / 2 + 0.5)
  })
  it('routes only matching topics and rejects malformed messages atomically', () => {
    const s = createSimulation()
    expect(publishTwist(s, '/wrong', twist())).toBe(false); advance(s, 20); expect(s.pose).toEqual(s.project.start)
    const before = structuredClone(s)
    for (const value of [null, twist(NaN), twist(0.3, Infinity), { linear: { x: '0.4' }, angular: { z: 0 } }]) expect(() => publishTwist(s, '/cmd_vel', value)).toThrow()
    expect(s).toEqual(before)
  })
  it('casts a forward ray to the near obstacle edge and publishes 10 Hz sensor frames', () => {
    const s = createSimulation(project({ goal: { x: 4, y: 1 }, obstacles: [{ x: 2.5, y: 1, radius: 0.3 }] }))
    expect(s.range).toBeCloseTo(1.2)
    expect(measureRange(s.project, { ...s.pose, yaw: Math.PI })).toBeCloseTo(1)
    advance(s, 20)
    expect(s.messages.filter(m => m.topic === '/range')).toHaveLength(10)
    expect(s.messages.find(m => m.topic === '/odom').data).toMatchObject({ frame_id: 'odom', child_frame_id: 'base_link' })
  })
  it('limits applied speed, preserves pose on parameter changes, rejects partial invalid updates', () => {
    const s = createSimulation(); publishTwist(s, '/cmd_vel', twist()); advance(s, 4)
    const pose = structuredClone(s.pose); setParameters(s, { maxSpeed: 0.2 }); expect(s.pose).toEqual(pose)
    const before = structuredClone(s)
    expect(() => setParameters(s, { maxSpeed: 0.1, gain: 10 })).toThrow(); expect(s).toEqual(before)
    stepSimulation(s); expect(s.velocity.linear).toBe(0.2)
  })
  it('reaches an off-axis goal, reports success and stays stopped', () => {
    const s = createSimulation(project({ goal: { x: 4, y: 4 } })); startGoal(s); advance(s, 600)
    expect(s.action.status).toBe('succeeded'); expect(s.action.remaining).toBeLessThanOrEqual(0.08); expect(s.velocity).toEqual({ linear: 0, angular: 0 })
    const pose = structuredClone(s.pose); advance(s, 20); expect(s.pose).toEqual(pose)
  })
  it('blocks a waypoint at the sensor threshold and does not invent a detour', () => {
    const s = createSimulation(project({ goal: { x: 4, y: 1 }, obstacles: [{ x: 2.5, y: 1, radius: 0.3 }] }))
    startGoal(s); advance(s, 300)
    expect(s.action.status).toBe('blocked'); expect(s.range).toBeGreaterThan(0.4); expect(s.pose.y).toBe(1)
    expect(s.pose.x).toBeLessThan(2.5 - 0.3 - s.project.robot.radius)
  })
  it('cancels actions on manual takeover and reset service', () => {
    const s = createSimulation(); startGoal(s); advance(s, 10)
    publishTwist(s, '/cmd_vel', twist(0, 1)); expect(s.action.status).toBe('cancelled'); stepSimulation(s); expect(s.velocity.angular).toBe(1)
    startGoal(s); cancelGoal(s); const pose = structuredClone(s.pose); advance(s, 30); expect(s.pose).toEqual(pose)
    expect(resetPose(s)).toEqual({ success: true, message: 'Pose reset' }); expect(s.pose).toEqual(s.project.start); expect(s.action.status).toBe('idle')
  })
  it('enforces wall and obstacle collisions without tunnelling at maximum speed', () => {
    for (const obstacles of [[], [{ x: 2, y: 1, radius: 0.1 }]]) {
      const s = createSimulation(project({ obstacles, goal: { x: 4, y: 4 }, parameters: { ...DEFAULT_PROJECT.parameters, maxSpeed: 1 } }))
      for (let i = 0; i < 300; i++) { publishTwist(s, '/cmd_vel', twist(1)); stepSimulation(s) }
      expect(s.pose.x).toBeLessThanOrEqual(obstacles.length ? 1.72 : 5.82)
      expect(s.velocity.linear).toBe(0)
    }
  })
  it('is reproducible and bounds logs and trails', () => {
    const run = () => { const s = createSimulation(); startGoal(s); advance(s, 1500); return s }
    const a = run(); expect(a).toEqual(run()); expect(a.messages.length).toBeLessThanOrEqual(30); expect(a.trail.length).toBeLessThanOrEqual(600)
  })
  it('validates file versions, size, geometry, topic names and finite fields before load', () => {
    expect(parseProject(JSON.stringify(DEFAULT_PROJECT))).toEqual(DEFAULT_PROJECT)
    for (const bad of [null, {}, project({ version: 2 }), project({ robot: { ...DEFAULT_PROJECT.robot, wheelRadius: -1 } }), project({ topics: { publisher: '/', subscriber: '/cmd_vel' } }), project({ start: { x: 1, y: 1, yaw: Infinity } }), project({ obstacles: [{ x: 1, y: 1, radius: 0.2 }] }), project({ obstacles: Array(21).fill({ x: 3, y: 3, radius: 0.1 }) })]) expect(() => validateProject(bad)).toThrow()
    expect(() => parseProject('x'.repeat(30001))).toThrow(); expect(() => parseProject('{no')).toThrow()
  })
})
