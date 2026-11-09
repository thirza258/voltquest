/**
 * The connected learning map for the hardware family: robotics, computer vision, drones and IoT
 * each connect to the other three through a bridge, and electronics and programming sit under all
 * four. This module is the only copy of those connections. Hubs draw the map from it, and lesson
 * pages ask it which bridges and foundation links pass through them.
 *
 * Step titles repeat the authored content titles on purpose, so no hub has to import another
 * hub's curriculum. learningMap.test.jsx checks every reference and title against `content/`.
 * Navigation only: nothing here changes progress, exams, certificates or sandbox presets.
 */

const PATHS = { course: '/courses', robotics: '/robotics', vision: '/vision', tutorial: '/tutorials', networking: '/networking', cyber: '/cybersecurity' }
export const STEP_KIND_LABELS = { course: 'Course', robotics: 'Robotics tutorial', vision: 'Vision lab', tutorial: 'Firmware lab', networking: 'Networking course', cyber: 'Security course' }

const ref = (kind, id, title) => ({ kind, id, title, href: `${PATHS[kind]}/${id}` })

export const MAP_TOPICS = [
  { id: 'robotics', layer: 'applied', title: 'Robotics & ROS 2', short: 'Robotics',
    hub: '/robotics', start: ref('robotics', 'robot-motion', '1. Robot motion and differential drive'),
    bench: '/sandbox?bench=robotics', benchLabel: 'Robotics sandbox' },
  { id: 'vision', layer: 'applied', title: 'Computer vision', short: 'Computer vision',
    hub: '/vision', start: ref('vision', 'opencv-foundations', '1. OpenCV fundamentals for IoT visual sensors'),
    bench: '/sandbox?bench=vision', benchLabel: 'Computer vision sandbox',
    deeper: { href: '/pytorch', title: 'PyTorch Deep Learning', note: 'Train and evaluate the kind of model a vision pipeline can run.' } },
  { id: 'iot', layer: 'applied', title: 'IoT devices', short: 'IoT',
    hub: '/courses?track=iot-parts', start: ref('course', 'iot-foundations', 'IoT fundamentals: from Arduino input to a connected device'),
    bench: '/sandbox', benchLabel: 'Circuit sandbox',
    deeper: { href: '/iot-c', title: 'Embedded IoT & Edge Systems in C', note: 'FreeRTOS tasks, lwIP sockets, MQTT and CoAP, TLS and OTA updates written in C.' } },
  { id: 'drone', layer: 'applied', title: 'Drone fundamentals', short: 'Drones',
    hub: '/courses?track=drone-foundations', start: ref('course', 'drone-foundations', 'Drone fundamentals: build, bench and first hover'),
    bench: '/sandbox?bench=drone', benchLabel: 'Custom drone sandbox' },
  { id: 'electronics', layer: 'foundation', title: 'Electrical engineering foundations', short: 'Electronics',
    hub: '/courses?track=electrical', start: ref('course', 'ee-circuits', 'Voltage, current and complete circuits'),
    bench: '/sandbox', benchLabel: 'Circuit sandbox',
    deeper: { href: '/computer-architecture', title: 'Computer Architecture & Assembly', note: 'From logic gates and adders to a small CPU you program in assembly.' } },
  { id: 'programming', layer: 'foundation', title: 'C, C++ & Arduino / ESP32 programming', short: 'Programming',
    hub: '/courses?track=programming', start: ref('course', 'programming-start', 'C, C++ and your first Arduino sketch'),
    bench: '/sandbox', benchLabel: 'Circuit sandbox',
    deeper: { href: '/avr', title: 'AVR 8-bit Assembly & Microcontrollers', note: 'The registers, status flags and I/O ports underneath an Arduino sketch.' } },
  // The security family links two tracks course by course; it is not drawn on the hardware square.
  { id: 'networking', layer: 'security', title: 'Networking', short: 'Networking',
    hub: '/networking', start: ref('networking', 'net-foundations', '1. Networks, models and your first LAN'),
    bench: '/sandbox?bench=network', benchLabel: 'Network simulator sandbox' },
  { id: 'cybersecurity', layer: 'security', title: 'Web cybersecurity', short: 'Cybersecurity',
    hub: '/cybersecurity', start: ref('cyber', 'cyber-http', '01. Read HTTP and map a web application'),
    bench: '/sandbox?bench=cybersecurity', benchLabel: 'Cybersecurity sandbox' },
]

const CAPSTONE = ref('vision', 'vision-integration', '12. Capstone: connect vision, IoT, drones and robotics')

/**
 * One bridge per pair of applied topics. `joined` is true only when a single lab passes data from one
 * side into the other (the vision capstone sends its observation to each device). Otherwise the card
 * says so and `tryIt` is a comparison across each side's own labs.
 */
export const MAP_BRIDGES = [
  {
    id: 'robotics-vision', between: ['robotics', 'vision'], joined: true,
    title: 'Camera-guided steering',
    flow: 'Line offset x → Twist on /cmd_vel: linear.x = 0.15 m/s, angular.z = −x rad/s',
    summary: 'OpenCV finds a line boundary and how far it sits from the image centre. A ROS 2 node turns that offset into a velocity request, and the drive decides what a missing or stale request means.',
    steps: [
      { ...ref('robotics', 'ros2-topics', '2. ROS 2 nodes, topics and messages'), note: 'Learn the message the drive accepts: a Twist on /cmd_vel that expires one virtual second after the last request.' },
      { ...ref('vision', 'opencv-robotics', '3. OpenCV edges and ROS 2 robot integration'), note: 'Extract the line edge with Canny and turn the horizontal error into a steering request.' },
      { ...CAPSTONE, note: 'Send one observation and read the robot pose after one second in the differential-drive model.' },
    ],
    tryIt: 'In the capstone, move the target to the right of centre and predict the sign of angular.z before you send. Then remove the target and check that the robot receives zero velocity.',
  },
  {
    id: 'iot-vision', between: ['vision', 'iot'], joined: true,
    title: 'A camera as an IoT sensor',
    flow: 'Mask → detected when at least 16 pixels are selected → GET /on or /off on the virtual ESP32',
    summary: 'A camera is a dense light sensor. OpenCV reduces each frame to one small observation, and the IoT device acts on that event instead of raw pixels. Heavy image work belongs on a companion computer; the controller receives compact messages.',
    steps: [
      { ...ref('course', 'iot-foundations', 'IoT fundamentals: from Arduino input to a connected device'), note: 'The four jobs of an IoT node: sense, decide, act and communicate.' },
      { ...ref('vision', 'opencv-foundations', '1. OpenCV fundamentals for IoT visual sensors'), note: 'Threshold an image and reduce the mask to a detected event.' },
      { ...ref('tutorial', 'iot-web-control', 'IoT lab: command and verify over HTTP'), note: 'Command the ESP32 with /on, /off and /status, then read its state back.' },
      { ...CAPSTONE, note: 'Send the observation and read the actual HTTP response from the virtual ESP32.' },
    ],
    tryIt: 'Darken the scene in the OpenCV lab while keeping the threshold fixed, and note when the detected event flips. Write down the /status reply you expect after each send, then check it in the capstone.',
  },
  {
    id: 'drone-vision', between: ['vision', 'drone'], joined: true,
    title: 'Visual landing-pad alignment',
    flow: 'HSV centroid offset → serial L, C or R → 1150, 1200 or 1250 µs on one props-off ESC',
    summary: 'Colour segmentation finds the landing pad and reports its offset from the image centre. The drone side treats that offset as a request, not a motor command: a real aircraft also needs camera calibration and a flight controller with failsafes.',
    steps: [
      { ...ref('course', 'drone-foundations', 'Drone fundamentals: build, bench and first hover'), note: 'Follow power, commands and thrust, and run bench checks with the props off.' },
      { ...ref('tutorial', 'drone-esc-basics', 'Drone lab: a props-off motor signal test'), note: 'Arm at 1000 µs, then drive only motor 1 on the clamped stand.' },
      { ...ref('vision', 'opencv-drone', '2. OpenCV color segmentation for drone alignment'), note: 'Select the green pad in HSV and normalise its offset to the range −1 to 1.' },
      { ...CAPSTONE, note: 'Send left, centre and right observations and read the measured ESC pulse and motor RPM.' },
    ],
    tryIt: 'Move the pad from left to right and record the serial letter and pulse width each position produces. Then exclude green with the hue controls: no target must send X and disarm.',
  },
  {
    id: 'robotics-iot', between: ['robotics', 'iot'], joined: false,
    title: 'Robot telemetry and remote commands',
    flow: 'ROS 2 topic ⇄ MQTT topic · 1 s drive timeout ⇄ 2 s command lease',
    summary: 'ROS 2 and MQTT both publish named message streams, and both treat a command as a request that must expire. A robot that reports to a dashboard needs the same rules on both sides: exact names, units in every payload, and a stop when commands go stale.',
    steps: [
      { ...ref('robotics', 'ros2-topics', '2. ROS 2 nodes, topics and messages'), note: 'Publishers and subscribers connect by exact topic name and message type.' },
      { ...ref('robotics', 'robot-sensors', '3. Sensor messages, frames and odometry'), note: 'Decide what the robot reports: range and odometry are different evidence.' },
      { ...ref('tutorial', 'esp32-mqtt', 'Publish readings with MQTT'), note: 'Publish a reading on an MQTT topic and design separate topics for data and commands.' },
      { ...ref('course', 'programming-mqtt', 'MQTT and the connected-controller capstone'), note: 'Validate a command and let it expire: an ON lease ends two seconds after the last valid renewal.' },
    ],
    tryIt: 'Write a topic map for a remote robot: which ROS 2 topics (/cmd_vel, /range, odometry) become which MQTT topics, with a unit in every payload. Then state what each side does when commands stop: the drive stops after one second, the MQTT lease after two.',
  },
  {
    id: 'robotics-drone', between: ['robotics', 'drone'], joined: false,
    title: 'Two robots, one feedback loop',
    flow: 'Pose (x, y, yaw) ⇄ attitude (roll, pitch, yaw) · heading gain ⇄ hover height hold',
    summary: 'A ground robot and a drone both estimate their state and correct errors with feedback. The robot integrates wheel motion into a pose in the odom frame; the drone reads roll and pitch from an IMU and needs feedback just to hover.',
    steps: [
      { ...ref('robotics', 'robot-sensors', '3. Sensor messages, frames and odometry'), note: 'Frames and odometry: what x, y and yaw mean for a ground robot.' },
      { ...ref('tutorial', 'drone-imu-basics', 'Drone lab: inspect attitude on the bench'), note: 'Tilt the clamped, props-off stand and compare the roll and pitch telemetry.' },
      { ...ref('robotics', 'ros2-services', '4. Services and controller parameters'), note: 'A proportional gain turns heading error into a turn rate, capped at 2 rad/s.' },
      { ...ref('tutorial', 'drone-hover-basics', 'Drone lab: first assisted hover and landing'), note: 'At 50% throttle the assisted mode holds height; watch height and vertical speed as you descend.' },
      { ...CAPSTONE, note: 'One camera observation drives both the drone bench and the robot model, but the two do not exchange messages.' },
    ],
    tryIt: 'Make a two-column table for the robot and the drone: what is measured, which error is corrected, and what happens when feedback stops. Use the robot’s heading error and the drone’s height during hover.',
  },
  {
    id: 'drone-iot', between: ['drone', 'iot'], joined: false,
    title: 'A connected aircraft',
    flow: 'ESP32 controller · radio link with acknowledgements · regulated power and battery',
    summary: 'The drone labs run on an ESP32, the same controller family as the IoT labs. Telemetry, radio links, power paths and lost-link behaviour are IoT design questions before they are flight questions.',
    steps: [
      { ...ref('course', 'iot-controllers', 'Choose a controller: Arduino, ESP32 or Raspberry Pi'), note: 'Choose a controller by its interfaces and operating budget; the drone labs use ESP32.' },
      { ...ref('course', 'iot-connectivity', 'WiFi, Bluetooth LE and LoRa communication parts'), note: 'A radio link is not the whole application: plan acknowledgements, timeouts and stale-data checks.' },
      { ...ref('course', 'iot-power-integration', 'Power modules, batteries and an IoT parts capstone'), note: 'Regulators and battery management are separate functions; the flight controller runs from a regulated branch.' },
      { ...ref('tutorial', 'drone-imu-basics', 'Drone lab: inspect attitude on the bench'), note: 'The attitude report is telemetry: change its interval and count the reports per second.' },
    ],
    tryIt: 'Design the drone’s telemetry message: roll, pitch, battery voltage and armed state, each with a unit. Then decide what the aircraft does when commands stop arriving; the vision capstone disarms on serial X.',
  },
]

/**
 * Networking ↔ web security, course by course. The network simulator and the security console are
 * separate labs that never exchange traffic, so none of these bridges is `joined`: each exercise is a
 * comparison of what each layer can and cannot see.
 */
export const SECURITY_BRIDGES = [
  {
    id: 'packets-to-requests', between: ['networking', 'cybersecurity'], joined: false,
    title: 'From packets to requests',
    flow: 'Ethernet frame → IP packet → TCP port 80 → HTTP request line, headers and body',
    summary: 'Every request in the security labs rides on the layers the networking track builds: an address, a route, a TCP connection to port 80, then the HTTP text the application parses. Knowing which layer carries what tells you where each defense can act.',
    steps: [
      { ...ref('networking', 'net-foundations', '1. Networks, models and your first LAN'), note: 'Layers and encapsulation: each layer wraps the one above it with its own header.' },
      { ...ref('networking', 'net-services', '8. DHCP and DNS services'), note: 'A browser first asks DNS for an address, then opens TCP port 80 and sends the request.' },
      { ...ref('cyber', 'cyber-http', '01. Read HTTP and map a web application'), note: 'The request line, headers and body that the application finally reads.' },
    ],
    tryIt: 'In the network simulator, open a web page by name in Simulation mode and find the DNS query, the TCP SYN and the HTTP GET. Then send the same kind of request from the security console and name what each layer added.',
  },
  {
    id: 'filter-then-fix', between: ['networking', 'cybersecurity'], joined: false,
    title: 'Filter who connects, fix what they can do',
    flow: 'Extended access list on TCP 80 ⇄ input handling inside the application',
    summary: 'An access list decides which hosts may open a connection to port 80. It never sees the SQL inside a permitted request. The security track’s repairs work inside the application, on exactly the traffic the access list allowed.',
    steps: [
      { ...ref('networking', 'net-acl', '9. Access control lists'), note: 'Permit or deny by address, protocol and port; the first match wins and the rest is denied.' },
      { ...ref('cyber', 'cyber-sql', '04. Find and repair SQL injection'), note: 'The flaw lives in how the application builds a query, after the connection was allowed.' },
      { ...ref('cyber', 'cyber-capstone', '10. Investigate and harden VoltShop'), note: 'Hardening combines controls at several layers; none replaces the application fix.' },
    ],
    tryIt: 'Block one guest host from the web server with an extended access list and confirm that ping still works. Then list two VoltShop findings that the access list could never stop, and say why.',
  },
  {
    id: 'segmentation-ssrf', between: ['networking', 'cybersecurity'], joined: false,
    title: 'Segmentation limits what a tricked server can reach',
    flow: 'VLANs and an access list on the server’s traffic ⇄ the SSRF destination check',
    summary: 'In server-side request forgery, an attacker makes the server send requests for them, for example to inventory.internal. Validating the parsed destination is the application fix. Separate VLANs and filtering what the web server may reach limit the damage if that check fails.',
    steps: [
      { ...ref('networking', 'net-vlans', '5. VLANs and 802.1Q trunks'), note: 'Separate broadcast domains: hosts in different VLANs need a router to talk.' },
      { ...ref('networking', 'net-acl', '9. Access control lists'), note: 'Filter the traffic a server starts, not only the traffic it receives.' },
      { ...ref('cyber', 'cyber-ssrf', '08. Constrain server-side URL destinations'), note: 'Validate the destination the server actually parsed before it connects.' },
    ],
    tryIt: 'Put a web server and an internal server in different VLANs, then write an access list that lets users reach the web server but stops the web server from connecting to the internal one. Compare it with the SSRF course’s destination check.',
  },
  {
    id: 'names-and-origins', between: ['networking', 'cybersecurity'], joined: false,
    title: 'Names, addresses and the parsed origin',
    flow: 'DNS A record: name → address ⇄ the host a server-side request really reaches',
    summary: 'A host name only points at an address, and the record can change. A destination check that trusts how a URL looks can be fooled; the check has to cover where the request actually goes.',
    steps: [
      { ...ref('networking', 'net-services', '8. DHCP and DNS services'), note: 'Edit a DNS record and watch the same name resolve to a different server.' },
      { ...ref('cyber', 'cyber-ssrf', '08. Constrain server-side URL destinations'), note: 'Allow destinations by the parsed origin, not by matching text.' },
    ],
    tryIt: 'Point a friendly name at an internal server by changing its DNS record. Explain why an allowlist of names alone would be fooled, and what the SSRF course checks instead.',
  },
  {
    id: 'nat-not-identity', between: ['networking', 'cybersecurity'], joined: false,
    title: 'NAT hides addresses, not authorization',
    flow: 'Many inside local addresses → one inside global address ⇄ identity from the session',
    summary: 'Port address translation lets many inside hosts share one public address, so a server cannot tell them apart by IP and should not try. Authorization has to come from the authenticated session, which the object-authorization course enforces in the handler.',
    steps: [
      { ...ref('networking', 'net-nat', '10. NAT, PAT and a secure branch capstone'), note: 'Read the translation table: different inside hosts share one outside address.' },
      { ...ref('cyber', 'cyber-idor', '02. Find broken object authorization'), note: 'Check each object against the session’s user, never against a client address.' },
    ],
    tryIt: 'Ping the outside server from two inside PCs and read show ip nat translations: both appear as one address. Then state why the security course checks ownership against the session instead.',
  },
]

/**
 * Foundation courses applied in a specific lesson. Electronics and programming show these as
 * "used in"; the applied lesson shows them as "built on".
 */
export const FOUNDATION_LINKS = [
  { foundation: 'electronics', topic: 'robotics', course: ref('course', 'ee-drivers', 'Diodes, transistors and load drivers'),
    lesson: ref('robotics', 'robot-motion', '1. Robot motion and differential drive'),
    note: 'Each wheel motor needs a driver: a small logic signal switches the larger motor current.' },
  { foundation: 'electronics', topic: 'robotics', course: ref('course', 'ee-power', 'Power, energy and battery budgets'),
    lesson: ref('robotics', 'robot-motion', '1. Robot motion and differential drive'),
    note: 'Average current predicts how long a mobile robot runs; peak motor current sizes its supply.' },
  { foundation: 'programming', topic: 'robotics', course: ref('course', 'programming-time', 'Responsive timing, debounce and rollover'),
    lesson: ref('robotics', 'ros2-topics', '2. ROS 2 nodes, topics and messages'),
    note: 'A command timeout is an elapsed-time check, polled without blocking the loop.' },
  { foundation: 'programming', topic: 'robotics', course: ref('course', 'programming-state', 'State machines and a local controller capstone'),
    lesson: ref('robotics', 'robot-waypoints', '5. Waypoint actions and feedback control'),
    note: 'A waypoint goal ends as succeeded, blocked or cancelled: explicit states with tested transitions.' },
  { foundation: 'electronics', topic: 'vision', course: ref('course', 'ee-signals', 'Analog signals, ADCs and PWM'),
    lesson: ref('vision', 'opencv-foundations', '1. OpenCV fundamentals for IoT visual sensors'),
    note: 'An ADC turns a voltage into a number; each pixel channel is a number from 0 to 255, and a threshold works on both.' },
  { foundation: 'programming', topic: 'vision', course: ref('course', 'programming-arrays', 'Arrays, C strings, memory and bit flags'),
    lesson: ref('vision', 'opencv-foundations', '1. OpenCV fundamentals for IoT visual sensors'),
    note: 'An image is a fixed-size array of bytes: height × width × channels.' },
  { foundation: 'electronics', topic: 'iot', course: ref('course', 'ee-reliable-node', 'Signal conditioning and a reliable IoT node'),
    lesson: ref('course', 'iot-foundations', 'IoT fundamentals: from Arduino input to a connected device'),
    note: 'Sampling, hysteresis and freshness checks keep a connected node’s decisions trustworthy.' },
  { foundation: 'electronics', topic: 'iot', course: ref('course', 'ee-logic', 'Logic levels, pull-ups and shared buses'),
    lesson: ref('course', 'iot-environment', 'Temperature, humidity and pressure sensors'),
    note: 'Sensors such as the BME280 share an I2C bus: match the logic levels and fit pull-ups.' },
  { foundation: 'programming', topic: 'iot', course: ref('course', 'programming-esp32', 'ESP32 C++: Wi-Fi and HTTP device control'),
    lesson: ref('tutorial', 'iot-web-control', 'IoT lab: command and verify over HTTP'),
    note: 'Register HTTP handlers and report the state the device actually applied.' },
  { foundation: 'programming', topic: 'iot', course: ref('course', 'programming-mqtt', 'MQTT and the connected-controller capstone'),
    lesson: ref('tutorial', 'esp32-mqtt', 'Publish readings with MQTT'),
    note: 'Telemetry, validated commands and command expiry over MQTT.' },
  { foundation: 'electronics', topic: 'drone', course: ref('course', 'ee-power', 'Power, energy and battery budgets'),
    lesson: ref('course', 'drone-foundations', 'Drone fundamentals: build, bench and first hover'),
    note: 'Battery power reaches the motors through the ESCs; peak current sizes that supply.' },
  { foundation: 'electronics', topic: 'drone', course: ref('course', 'ee-logic', 'Logic levels, pull-ups and shared buses'),
    lesson: ref('tutorial', 'drone-imu-basics', 'Drone lab: inspect attitude on the bench'),
    note: 'The IMU connects through SDA and SCL, an open-drain I2C bus that needs pull-ups.' },
  { foundation: 'programming', topic: 'drone', course: ref('course', 'programming-serial', 'Serial protocols and systematic debugging'),
    lesson: ref('tutorial', 'drone-esc-basics', 'Drone lab: a props-off motor signal test'),
    note: 'The motor test takes bounded serial commands: 1 requests 1250 µs and 0 returns to 1000 µs.' },
]

export const getTopic = id => MAP_TOPICS.find(topic => topic.id === id) ?? null
export const isAppliedTopic = id => getTopic(id)?.layer === 'applied'

/** The topic on the other end of a bridge. */
export const otherEnd = (bridge, topicId) => getTopic(bridge.between.find(id => id !== topicId))

/** Bridges touching a topic, in the order the bridges are authored. Foundations have none. */
export const bridgesOf = topicId => MAP_BRIDGES.filter(bridge => bridge.between.includes(topicId))

export const bridgeBetween = (a, b) => MAP_BRIDGES.find(bridge => bridge.between.includes(a) && bridge.between.includes(b) && a !== b) ?? null

/** Foundation links into an applied topic, or out of a foundation topic. */
export const foundationLinksOf = topicId => FOUNDATION_LINKS.filter(link => link.topic === topicId || link.foundation === topicId)

/**
 * /courses?track=… → the topic that track belongs to. The unfiltered page counts as electronics, as
 * the old path did; a track with no topic (ethics) marks nothing.
 */
const TRACK_TOPICS = { electrical: 'electronics', programming: 'programming', 'iot-parts': 'iot', 'iot-foundations': 'iot', 'drone-foundations': 'drone' }
export const topicForTrack = track => TRACK_TOPICS[track] ?? (track ? null : 'electronics')

/**
 * Everything that passes through one lesson page, keyed by its route (`/robotics/ros2-topics`):
 * the bridges it is a step of, the applied lessons it supports, and the foundations it is built on.
 */
export function connectionsAt(href) {
  return {
    bridges: [...MAP_BRIDGES, ...SECURITY_BRIDGES].flatMap(bridge => bridge.steps.flatMap((step, index) => step.href === href
      ? [{ bridge, index, previous: bridge.steps[index - 1] ?? null, next: bridge.steps[index + 1] ?? null }] : [])),
    usedIn: FOUNDATION_LINKS.filter(link => link.course.href === href),
    builtOn: FOUNDATION_LINKS.filter(link => link.lesson.href === href),
  }
}

/** True when a lesson route sits on the map, so its page can offer a "Connected courses" panel. */
export function hasConnections(href) {
  const { bridges, usedIn, builtOn } = connectionsAt(href)
  return bridges.length + usedIn.length + builtOn.length > 0
}
