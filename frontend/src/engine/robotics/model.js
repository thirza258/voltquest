/** Deterministic 2D ROS 2 concept model. No ROS runtime, DDS, host timers or arbitrary code. */
export const DEFAULT_PROJECT = {
  kind: 'robotics', version: 1, name: 'My mobile robot',
  robot: { wheelRadius: 0.05, wheelBase: 0.3, radius: 0.18 },
  start: { x: 1, y: 1, yaw: 0 }, goal: { x: 3, y: 1 }, obstacles: [],
  topics: { publisher: '/cmd_vel', subscriber: '/cmd_vel' },
  parameters: { maxSpeed: 0.5, gain: 1.5, stopDistance: 0.45 },
}
export const WORLD_SIZE = 6
export const STEP_SECONDS = 0.05
const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
export const wrapAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle))
const topicValid = value => typeof value === 'string' && /^\/(?:[A-Za-z_][A-Za-z_0-9]*)(?:\/[A-Za-z_][A-Za-z_0-9]*)*$/.test(value) && value.length <= 80
const copy = value => JSON.parse(JSON.stringify(value))

/** Normalize only the documented schema. Invalid imports never partially mutate a running world. */
export function validateProject(input) {
  if (!input || input.kind !== 'robotics' || input.version !== 1) throw new Error('Expected a VoltQuest robotics project, version 1.')
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) throw new Error('Use a project name between 1 and 80 characters.')
  const { robot, start, goal, obstacles, topics, parameters } = input
  if (!robot || !finite(robot.wheelRadius, 0.02, 0.15) || !finite(robot.wheelBase, 0.15, 0.6) || !finite(robot.radius, 0.12, 0.35)) throw new Error('Robot dimensions are outside the supported range.')
  const point = p => p && finite(p.x, robot.radius, WORLD_SIZE - robot.radius) && finite(p.y, robot.radius, WORLD_SIZE - robot.radius)
  if (!point(start) || !finite(start.yaw, -Math.PI, Math.PI) || !point(goal)) throw new Error('Start and goal must fit inside the 6 m world; yaw must be between −π and π.')
  if (!Array.isArray(obstacles) || obstacles.length > 20 || obstacles.some(o => !o || !finite(o.radius, 0.1, 0.6) || !finite(o.x, o.radius, WORLD_SIZE - o.radius) || !finite(o.y, o.radius, WORLD_SIZE - o.radius))) throw new Error('Use at most 20 circular obstacles inside the world.')
  if (obstacles.some(o => [start, goal].some(p => Math.hypot(p.x - o.x, p.y - o.y) <= robot.radius + o.radius))) throw new Error('Start and goal must be clear of obstacles.')
  if (!topics || !topicValid(topics.publisher) || !topicValid(topics.subscriber)) throw new Error('Use absolute topic names such as /cmd_vel.')
  if (!parameters || !finite(parameters.maxSpeed, 0.05, 1) || !finite(parameters.gain, 0.1, 4) || !finite(parameters.stopDistance, 0.2, 2)) throw new Error('Parameters: speed 0.05–1 m/s, gain 0.1–4 s⁻¹, stop distance 0.2–2 m.')
  return { kind: 'robotics', version: 1, name: input.name.trim(),
    robot: { wheelRadius: robot.wheelRadius, wheelBase: robot.wheelBase, radius: robot.radius },
    start: { x: start.x, y: start.y, yaw: start.yaw }, goal: { x: goal.x, y: goal.y },
    obstacles: obstacles.map(o => ({ x: o.x, y: o.y, radius: o.radius })),
    topics: { publisher: topics.publisher, subscriber: topics.subscriber },
    parameters: { maxSpeed: parameters.maxSpeed, gain: parameters.gain, stopDistance: parameters.stopDistance } }
}
export function parseProject(text) {
  if (typeof text !== 'string' || text.length > 30000) throw new Error('Robotics files must be smaller than 30 KB.')
  let value
  try { value = JSON.parse(text) } catch { throw new Error('The project is not valid JSON.') }
  return validateProject(value)
}

/** A single forward ray, measured from the robot centre, capped at 4 m. No scanning LiDAR. */
export function measureRange(project, pose) {
  const dx = Math.cos(pose.yaw), dy = Math.sin(pose.yaw)
  let distance = 4
  for (const [position, direction] of [[pose.x, dx], [pose.y, dy]]) {
    if (direction > 1e-9) distance = Math.min(distance, (WORLD_SIZE - position) / direction)
    if (direction < -1e-9) distance = Math.min(distance, -position / direction)
  }
  for (const obstacle of project.obstacles) {
    const x = obstacle.x - pose.x, y = obstacle.y - pose.y
    const projection = x * dx + y * dy
    const discriminant = obstacle.radius ** 2 - (x * x + y * y - projection ** 2)
    if (projection >= 0 && discriminant >= 0) distance = Math.min(distance, Math.max(0, projection - Math.sqrt(discriminant)))
  }
  return clamp(distance, 0, 4)
}
function collision(project, pose) {
  const r = project.robot.radius
  return pose.x < r || pose.y < r || pose.x > WORLD_SIZE - r || pose.y > WORLD_SIZE - r ||
    project.obstacles.some(o => Math.hypot(pose.x - o.x, pose.y - o.y) <= r + o.radius)
}
export function wheelSpeeds(v, w, robot) {
  return { left: (v - w * robot.wheelBase / 2) / robot.wheelRadius, right: (v + w * robot.wheelBase / 2) / robot.wheelRadius }
}
export function integratePose(pose, v, w, dt) {
  const nextYaw = pose.yaw + w * dt
  const x = Math.abs(w) < 1e-9 ? pose.x + v * Math.cos(pose.yaw) * dt : pose.x + v / w * (Math.sin(nextYaw) - Math.sin(pose.yaw))
  const y = Math.abs(w) < 1e-9 ? pose.y + v * Math.sin(pose.yaw) * dt : pose.y - v / w * (Math.cos(nextYaw) - Math.cos(pose.yaw))
  return { x, y, yaw: wrapAngle(nextYaw) }
}
export function createSimulation(input = DEFAULT_PROJECT) {
  const project = validateProject(input)
  return { project, time: 0, pose: copy(project.start), velocity: { linear: 0, angular: 0 }, wheels: { left: 0, right: 0 },
    command: null, range: measureRange(project, project.start), ticks: 0, trail: [copy(project.start)], messages: [],
    action: { status: 'idle', remaining: Math.hypot(project.goal.x - project.start.x, project.goal.y - project.start.y) }, status: 'ready' }
}
function record(state, topic, type, data, delivered = true) {
  state.messages = [...state.messages.slice(-29), { time: state.time, topic, type, data, delivered }]
}
/** Twist uses linear.x (m/s) and angular.z (rad/s); names must match for delivery. */
export function publishTwist(state, topic, payload, source = 'manual') {
  if (!topicValid(topic) || !payload || !finite(payload.linear?.x, -1, 1) || !finite(payload.angular?.z, -3, 3)) throw new Error('Twist needs linear.x from −1 to 1 m/s and angular.z from −3 to 3 rad/s.')
  const delivered = topic === state.project.topics.subscriber
  record(state, topic, 'geometry_msgs/msg/Twist', copy(payload), delivered)
  if (delivered) {
    if (source === 'manual' && state.action.status === 'active') state.action.status = 'cancelled'
    state.command = { linear: payload.linear.x, angular: payload.angular.z, expires: state.time + 1, source }
    state.status = 'command received'
  } else state.status = 'no matching subscriber'
  return delivered
}
export function cancelGoal(state) {
  if (state.action.status === 'active') state.action.status = 'cancelled'
  state.command = null; state.velocity = { linear: 0, angular: 0 }; state.wheels = { left: 0, right: 0 }
}
export function startGoal(state) {
  state.action = { status: 'active', remaining: Math.hypot(state.project.goal.x - state.pose.x, state.project.goal.y - state.pose.y) }
  state.command = null
}
export function setParameters(state, patch) {
  const next = validateProject({ ...state.project, parameters: { ...state.project.parameters, ...patch } })
  state.project = next
  record(state, '/controller/parameters', 'parameter update', copy(next.parameters))
}
/** Short request/response resets pose and cancels any action, retaining graph and parameters. */
export function resetPose(state) {
  const fresh = createSimulation(state.project)
  Object.assign(state, fresh)
  record(state, '/reset_pose', 'std_srvs/srv/Trigger', { success: true, message: 'Pose reset' })
  return { success: true, message: 'Pose reset' }
}
/** Advance exactly 50 ms. Caller owns scheduling. State is deliberately local to one sandbox. */
export function stepSimulation(state) {
  const { project, pose } = state
  const dt = STEP_SECONDS
  state.range = measureRange(project, pose)
  if (state.action.status === 'active') {
    const dx = project.goal.x - pose.x, dy = project.goal.y - pose.y
    const distance = Math.hypot(dx, dy), error = wrapAngle(Math.atan2(dy, dx) - pose.yaw)
    state.action.remaining = distance
    if (distance <= 0.08) { state.action.status = 'succeeded'; state.command = null; state.status = 'goal reached' }
    else {
      const v = Math.abs(error) < 0.4 ? Math.min(project.parameters.maxSpeed, distance) : 0
      if (v > 0 && state.range <= Math.max(project.parameters.stopDistance, project.robot.radius + 0.05)) {
        state.action.status = 'blocked'; state.command = null; state.status = 'obstacle blocks goal'
      } else publishTwist(state, project.topics.publisher, { linear: { x: v }, angular: { z: clamp(project.parameters.gain * error, -2, 2) } }, 'controller')
    }
  }
  let v = 0, w = 0
  if (state.command && state.time < state.command.expires - 1e-9) {
    v = clamp(state.command.linear, -project.parameters.maxSpeed, project.parameters.maxSpeed); w = state.command.angular
  } else if (state.command) { state.command = null; state.status = 'command timed out' }
  const candidate = integratePose(pose, v, w, dt)
  if (collision(project, candidate)) {
    v = 0; w = 0; state.command = null; state.status = 'collision stopped motion'
    if (state.action.status === 'active') state.action.status = 'blocked'
  } else state.pose = candidate
  state.velocity = { linear: v, angular: w }; state.wheels = wheelSpeeds(v, w, project.robot)
  state.ticks += 1; state.time = state.ticks * dt; state.range = measureRange(project, state.pose)
  state.action.remaining = Math.hypot(project.goal.x - state.pose.x, project.goal.y - state.pose.y)
  if (state.ticks % 2 === 0) {
    record(state, '/odom', 'nav_msgs/msg/Odometry', { frame_id: 'odom', child_frame_id: 'base_link', x: state.pose.x, y: state.pose.y, yaw: state.pose.yaw })
    record(state, '/range', 'sensor_msgs/msg/Range', { frame_id: 'base_link', range: state.range, min_range: 0, max_range: 4 })
    state.trail = [...state.trail.slice(-599), copy(state.pose)]
  }
  return state
}
