# Robotics and ROS 2 concept labs

`/robotics` lists five tutorials, Easy → Intermediate. `/robotics/:lessonId` includes theory,
formulas, a guided experiment, two practice questions, a five-question exam and an editable sandbox.
`/sandbox?bench=robotics` opens free exploration; `&lesson=<id>` copies a lesson preset.
The tutorial and course hubs link to the path; the circuit Project menu links to the sandbox.

The user selected **ROS 2 concepts in an interactive browser sandbox**, not an installed ROS system.
`engine/robotics/model.js` is a deterministic, DOM-free 2D model. `stepSimulation(state)` advances
exactly 0.05 virtual seconds. The UI owns its 50 ms timer and pauses on blur/hidden document/unmount.
Run resumes time, Step advances 0.1 s, Pause freezes time, Stop clears commands and cancels an action.

The curriculum covers differential-drive motion; nodes/topics and Twist; range/odometry frames;
services/parameters; and a closed-loop waypoint action. The fixed graph has a command publisher,
drive, range sensor and waypoint controller. A publisher/subscriber name mismatch prevents delivery.
Twist accepts finite `linear.x` in ±1 m/s and `angular.z` in ±3 rad/s. The driver caps forward speed
and expires a command after one virtual second without renewal. Streaming publishes at 10 Hz.
`/odom` and `/range` previews publish at 10 Hz, and retain only the latest 30 messages.

The project format is separate from CircuitDoc and backend project records:

```js
{
  kind: 'robotics', version: 1, name: 'My mobile robot',
  robot: { wheelRadius: 0.05, wheelBase: 0.3, radius: 0.18 },
  start: { x: 1, y: 1, yaw: 0 }, goal: { x: 3, y: 1 }, obstacles: [],
  topics: { publisher: '/cmd_vel', subscriber: '/cmd_vel' },
  parameters: { maxSpeed: 0.5, gain: 1.5, stopDistance: 0.45 }
}
```

Coordinates are metres in a 6 × 6 m world; yaw is radians, positive counterclockwise. Obstacles are
`{x,y,radius}` circles, max 20. `validateProject` rejects unsupported dimensions, nonfinite values,
bad topic names, out-of-world coordinates and obstructed starts/goals, and returns a normalized copy.
Import JSON is limited to 30 KB and requires a preview confirmation before replacing/resetting state.
Save/export use the applied project, not unapplied JSON editor text. One project is stored in
`vq.robotics.project.v1`, shared by people using the browser profile; JSON export keeps extra copies.
There is no account/project API, publish, showcase or hardware port for this format.

`/reset_pose` models a short Trigger service and returns `{success,message}`. Parameter edits validate
atomically and preserve pose. Graph edits preserve pose but stop motion. A waypoint action turns toward
its goal, reduces forward speed near arrival, and succeeds within 0.08 m. It stops as `blocked` for an
obstacle or collision; it cannot plan a detour. Cancel or a delivered manual command cancels the action.

Motion assumes ideal no-slip wheels, instantaneous velocity and exact pose. Range is one forward ray
from the robot centre, capped at 4 m. Physical collision checks still protect the circular body. Range,
Odometry and action messages are reduced previews; no DDS/QoS transport, tf2 tree, Nav2, SLAM, Linux,
arbitrary code execution, encoder noise, braking dynamics or ROS middleware is claimed.

`content/robotics.json` is a frontend-only lazy catalogue, not part of the six-board tutorial API.
Lesson ids key the shared self-study progress store (`vq.courses.v1`), so changing language preserves
checks, answers and simulation state. See COURSES.md for grading and local progress boundaries.
