/**
 * One ordered source for the connected electronics → robotics → vision path.
 * A stage's prerequisite is always the stage before it, so the three hubs
 * cannot drift apart or advertise a link the course no longer offers.
 */
export const CONNECTED_PATH = [
  {
    id: 'electronics',
    title: 'Electrical engineering foundations',
    summary: 'Circuits, Ohm’s law, power, measurement and motor drivers: the hardware layer the robot and its camera are built on.',
    href: '/courses?track=electrical',
    startHref: '/courses/ee-circuits',
    startLabel: 'Start with circuits',
    labHref: '/sandbox',
    labLabel: 'Circuit sandbox',
  },
  {
    id: 'robotics',
    title: 'Robotics & ROS 2 learning path',
    summary: 'Differential drive, nodes and topics, frames and odometry, then services, parameters and waypoint actions.',
    href: '/robotics',
    startHref: '/robotics/robot-motion',
    startLabel: 'Start with robot motion',
    labHref: '/sandbox?bench=robotics',
    labLabel: 'Robotics sandbox',
  },
  {
    id: 'vision',
    title: 'Computer vision: OpenCV, transformers & integration',
    summary: 'OpenCV filtering and contours, drone markers, ROS 2 steering, patch attention, then the multi-device capstone.',
    href: '/vision',
    startHref: '/vision/opencv-foundations',
    startLabel: 'Start with OpenCV foundations',
    labHref: '/sandbox?bench=vision',
    labLabel: 'Vision sandbox',
  },
]

export function getPathStage(id) {
  return CONNECTED_PATH.find(stage => stage.id === id) ?? null
}

/** The stage a learner should already have studied, or null at the start. */
export function prerequisiteOf(id) {
  const index = CONNECTED_PATH.findIndex(stage => stage.id === id)
  return index > 0 ? CONNECTED_PATH[index - 1] : null
}

/** The stage that follows, or null at the end of the path. */
export function nextStepOf(id) {
  const index = CONNECTED_PATH.findIndex(stage => stage.id === id)
  return index >= 0 && index < CONNECTED_PATH.length - 1 ? CONNECTED_PATH[index + 1] : null
}
