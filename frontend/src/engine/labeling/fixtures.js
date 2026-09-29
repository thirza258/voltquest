/**
 * Original practice data for the Label Studio path. Every item is fictional and was written for
 * VoltQuest; gold labels are the authors' answers under the guideline in the course pack.
 */

export const TICKET_LABELS = ['Battery', 'Connectivity', 'Sensor', 'Other']
const TICKET_TEXT = {
  Battery: [
    'Battery drops from 100% to 20% overnight on the weather node.',
    'The tracker shuts down whenever the cell voltage falls below 3.4 V.',
    'Charging stops at 80 percent and the LED keeps blinking orange.',
    'New lithium pack swells slightly after two weeks outdoors.',
    'Device only runs for six hours on a full charge instead of three days.',
    'Solar panel charges the cell but the pack is empty by sunrise.',
    'USB charger gets hot and the battery icon never turns green.',
    'Replacing the coin cell did not stop the low battery warning.',
    'Pack voltage reads 3.1 V after one day in deep sleep mode.',
    'The node resets every time the battery gets colder than zero degrees.',
    'Charging takes nine hours with the supplied adapter.',
    'Battery percentage jumps between 60 and 15 within a minute.',
    'Door sensor needs a new battery every two weeks.',
    'The power bank mode drains the internal cell even when switched off.',
    'After the firmware update the battery lasts half as long.',
    'Charge controller reports overcurrent when the pack is nearly full.',
    'Our trackers die in the cold storage room within a day.',
    'Battery contacts corrode on units installed near the coast.',
    'The low power alarm fires although the pack was charged this morning.',
    'Cell capacity seems to fade after only fifty charge cycles.',
    'Unit will not power on unless it stays plugged into the charger.',
    'Standby current is far higher than the datasheet promises.',
    'Please advise which replacement battery fits the soil probe.',
    'The charging port wiggles and charging stops unless I hold the cable.',
  ],
  Connectivity: [
    'Gateway loses Wi-Fi every evening and reconnects after an hour.',
    'MQTT messages arrive in bursts with ten minute gaps.',
    'The node cannot join the network after we changed the router password.',
    'Signal strength shows -92 dBm in the greenhouse and uploads fail.',
    'Dashboard says offline although the device LED shows it is connected.',
    'Pairing over Bluetooth times out on Android phones.',
    'LoRa packets from the far field never reach the gateway.',
    'Every firmware download over the air stops at 40 percent.',
    'The device keeps switching between the two access points.',
    'HTTP requests to the API return timeouts from the office network.',
    'After a power cut the sensors do not rejoin the mesh.',
    'Data only syncs when the phone app is open.',
    'Our firewall blocks port 8883 so the broker connection fails.',
    'The gateway gets a new IP address every day and the devices lose it.',
    'Cellular modem registers but no data session starts.',
    'Readings are uploaded twice whenever the connection drops.',
    'DNS lookups fail on the guest network, so no telemetry is sent.',
    'Nodes more than two walls away from the router go offline.',
    'TLS handshake with the cloud endpoint fails with a certificate error.',
    'The Wi-Fi setup page never appears when I hold the button.',
    'Latency to the broker is over five seconds during the day.',
    'Devices on the second floor show as disconnected every morning.',
    'The mobile app cannot find the device during setup.',
    'Uploads succeed on 2.4 GHz but fail on the 5 GHz network.',
  ],
  Sensor: [
    'Temperature reads 85 degrees in a room that is clearly cold.',
    'Humidity is stuck at 100 percent after rain.',
    'The soil probe reports the same moisture value for three days.',
    'CO2 levels spike to 5000 ppm when nobody is in the room.',
    'Pressure readings drift by 4 hPa every week.',
    'Distance sensor returns zero whenever the target is closer than 5 cm.',
    'Air quality index jumps randomly between good and hazardous.',
    'The light sensor saturates in direct sunlight.',
    'Accelerometer shows movement while the unit sits on a desk.',
    'Two probes in the same tank disagree by three degrees.',
    'Motion detector triggers every time the heating starts.',
    'Water level sensor reads full when the tank is half empty.',
    'The thermocouple value flickers when the pump turns on.',
    'Calibration offset resets to zero after every reboot.',
    'Particle counter shows negative values at night.',
    'Weight scale readings creep upward without any load.',
    'The compass heading is off by forty degrees near the motor.',
    'Noise sensor reports 120 dB in a quiet office.',
    'Leak detector raises an alarm on a completely dry floor.',
    'The gas sensor needs hours to warm up before readings settle.',
    'pH readings are unstable in the nutrient solution.',
    'Temperature lags the reference thermometer by twenty minutes.',
    'UV index stays at zero even at noon.',
    'Vibration readings double when the enclosure lid is closed.',
  ],
  Other: [
    'Can I get an invoice for the order placed last month?',
    'Please change the name on our account to the new company.',
    'The enclosure arrived with a cracked lid.',
    "How do I export last year's readings to a spreadsheet?",
    'We would like a quote for two hundred units.',
    'The mounting bracket screws are missing from the box.',
    'Is there a dark mode for the dashboard?',
    'Our technician needs access to the admin console.',
    'The user manual link on the website is broken.',
    'Can the device be painted to match our building?',
    'Please cancel the extended warranty on order 5521.',
    'What is the lead time for the outdoor enclosure?',
    'We need the device certificate documents for our audit.',
    'The dashboard shows dates in the wrong format.',
    'Can two teams share one account with separate permissions?',
    'The label printer template cuts off the serial number.',
    'Shipping box was damaged but the device looks fine.',
    'Where can I download the privacy policy?',
    'The app keeps logging me out after a few minutes.',
    'We want to return three unused units.',
    'Please add my colleague to the support contract.',
    'Does the price include installation on site?',
    'The screen protector peels off in the sun.',
    'How long do you keep our data after we cancel?',
  ],
}
const DEVICES = ['Weather node', 'Soil probe', 'Door sensor', 'Air monitor', 'Tracker', 'Gateway']
/** 96 tickets; ids T-001… interleave the classes so any prefix is roughly balanced. */
export const TICKETS = Array.from({ length: 24 }, (_, row) => TICKET_LABELS.map((label, column) => ({ label, text: TICKET_TEXT[label][row], row, column })))
  .flat()
  .map((item, index) => ({ id: `T-${String(index + 1).padStart(3, '0')}`, text: item.text, label: item.label, device: DEVICES[(item.row + item.column) % DEVICES.length] }))

export const FEEDBACK_TOPICS = ['Battery', 'Connectivity', 'Sensor', 'App']
export const FEEDBACK = [
  { id: 'F-01', text: 'Battery lasts a week now and the app finally shows live data.', topics: ['Battery', 'App'], sentiment: 'Positive' },
  { id: 'F-02', text: 'The humidity values are wrong and the device drops off Wi-Fi daily.', topics: ['Sensor', 'Connectivity'], sentiment: 'Negative' },
  { id: 'F-03', text: 'Setup through the app took two minutes.', topics: ['App'], sentiment: 'Positive' },
  { id: 'F-04', text: 'Readings look plausible; charging is slow but acceptable.', topics: ['Sensor', 'Battery'], sentiment: 'Neutral' },
  { id: 'F-05', text: 'Gateway reconnects on its own after outages, which saves us trips.', topics: ['Connectivity'], sentiment: 'Positive' },
  { id: 'F-06', text: 'The app crashes when I open the history chart.', topics: ['App'], sentiment: 'Negative' },
  { id: 'F-07', text: 'Temperature matches our reference probe within half a degree.', topics: ['Sensor'], sentiment: 'Positive' },
  { id: 'F-08', text: 'Delivered on time. Have not installed it yet.', topics: [], sentiment: 'Neutral' },
  { id: 'F-09', text: 'Battery died in the cold and the app never warned us.', topics: ['Battery', 'App'], sentiment: 'Negative' },
  { id: 'F-10', text: 'Signal is weak in the barn, otherwise the sensors work well.', topics: ['Connectivity', 'Sensor'], sentiment: 'Neutral' },
]

export const ENTITY_LABELS = ['Device', 'Component', 'Measurement', 'Location']
const LOGS = [
  ['Technician replaced the battery pack on Weather Node 7 at Roof A.', [['battery pack', 'Component'], ['Weather Node 7', 'Device'], ['Roof A', 'Location']], [['Weather Node 7', 'Roof A', 'located_at']]],
  ['Soil Probe 3 in Greenhouse B reported 41% moisture.', [['Soil Probe 3', 'Device'], ['Greenhouse B', 'Location'], ['41% moisture', 'Measurement']], [['Soil Probe 3', 'Greenhouse B', 'located_at'], ['41% moisture', 'Soil Probe 3', 'measured_on']]],
  ['The antenna on Gateway 2 was tightened after RSSI dropped to -95 dBm.', [['antenna', 'Component'], ['Gateway 2', 'Device'], ['-95 dBm', 'Measurement']], [['-95 dBm', 'Gateway 2', 'measured_on']]],
  ['Air Monitor 5 in the lobby shows 900 ppm CO2.', [['Air Monitor 5', 'Device'], ['lobby', 'Location'], ['900 ppm CO2', 'Measurement']], [['Air Monitor 5', 'lobby', 'located_at'], ['900 ppm CO2', 'Air Monitor 5', 'measured_on']]],
  ['Cleaned the lens of Camera 1 at the loading dock.', [['lens', 'Component'], ['Camera 1', 'Device'], ['loading dock', 'Location']], [['Camera 1', 'loading dock', 'located_at']]],
  ['Door Sensor 14 at the east entrance needs a new reed switch.', [['Door Sensor 14', 'Device'], ['east entrance', 'Location'], ['reed switch', 'Component']], [['Door Sensor 14', 'east entrance', 'located_at']]],
  ['Tank Level 2 read 3.2 m while the pump was running.', [['Tank Level 2', 'Device'], ['3.2 m', 'Measurement'], ['pump', 'Component']], [['3.2 m', 'Tank Level 2', 'measured_on']]],
  ['Replaced the fan in Gateway 4 after it reached 71 C in the server room.', [['fan', 'Component'], ['Gateway 4', 'Device'], ['71 C', 'Measurement'], ['server room', 'Location']], [['Gateway 4', 'server room', 'located_at'], ['71 C', 'Gateway 4', 'measured_on']]],
  ['The humidity sensor on Weather Node 2 read 12% at the parking lot.', [['humidity sensor', 'Component'], ['Weather Node 2', 'Device'], ['12%', 'Measurement'], ['parking lot', 'Location']], [['Weather Node 2', 'parking lot', 'located_at'], ['12%', 'Weather Node 2', 'measured_on']]],
  ['Tracker 9 lost its GPS module near Warehouse C.', [['Tracker 9', 'Device'], ['GPS module', 'Component'], ['Warehouse C', 'Location']], [['Tracker 9', 'Warehouse C', 'located_at']]],
]
/** Maintenance logs with gold spans as [start, end) offsets and relations between span texts. */
export const MAINTENANCE_LOGS = LOGS.map(([text, entities, relations], index) => {
  let cursor = 0
  const spans = entities.map(([phrase, label]) => {
    const start = text.indexOf(phrase, cursor)
    if (start < 0) throw new Error(`Fixture phrase not found: ${phrase}`)
    cursor = start + phrase.length
    return { start, end: start + phrase.length, text: phrase, label }
  })
  return { id: `L-${String(index + 1).padStart(2, '0')}`, text, spans, relations: relations.map(([from, to, label]) => ({ from, to, label })) }
})

/** 640 × 480 workbench scenes. Boxes are pixels; panels are polygons; rotors are keypoints. */
export const SCENE_SIZE = { width: 640, height: 480 }
export const SCENES = [
  { id: 'scene-01', status: 'Ready', objects: [['Drone', 176, 120, 272, 196], ['Battery', 488, 318, 104, 58]], panels: [], seed: 3 },
  { id: 'scene-02', status: 'Needs repair', objects: [['Drone', 64, 64, 232, 170], ['Sensor', 404, 96, 76, 60], ['Battery', 380, 300, 118, 64]], panels: [[[420, 220], [600, 206], [612, 280], [430, 296]]], seed: 5 },
  { id: 'scene-03', status: 'Ready', objects: [['Sensor', 96, 300, 84, 66], ['Sensor', 232, 316, 84, 66], ['Drone', 344, 60, 248, 182]], panels: [], seed: 7 },
  { id: 'scene-04', status: 'Needs repair', objects: [['Battery', 70, 90, 120, 66], ['Battery', 70, 190, 120, 66], ['Drone', 280, 190, 262, 190]], panels: [[[300, 40], [560, 40], [560, 150], [300, 150]]], seed: 11 },
  { id: 'scene-05', status: 'Ready', objects: [['Drone', 210, 150, 220, 164], ['Sensor', 60, 70, 70, 56]], panels: [[[440, 330], [610, 312], [620, 430], [452, 446]]], seed: 13 },
  { id: 'scene-06', status: 'Needs repair', objects: [['Battery', 470, 70, 110, 60], ['Sensor', 486, 170, 78, 60], ['Drone', 60, 170, 290, 214]], panels: [], seed: 17 },
].map(scene => ({ ...scene, path: `/data/local-files/?d=voltquest/scenes/${scene.id}.svg`, file: `scenes/${scene.id}.svg`,
  boxes: scene.objects.map(([label, x, y, width, height]) => ({ label, x, y, width, height })),
  rotors: scene.objects.filter(([label]) => label === 'Drone').flatMap(([, x, y, width, height]) => [[x + width * 0.16, y + height * 0.2], [x + width * 0.84, y + height * 0.2], [x + width * 0.16, y + height * 0.8], [x + width * 0.84, y + height * 0.8]]) }))
export function sceneByPath(path) {
  return SCENES.find(scene => scene.path === path || scene.file === path || path?.endsWith?.(`/${scene.id}.svg`)) ?? null
}

/** Deterministic temperature traces (index = sample) with gold event ranges. */
export const SIGNAL_LABELS = ['Spike', 'Dropout', 'Drift']
function signal(id, events, base = 21, seed = 1) {
  const temperature = []
  for (let i = 0; i < 120; i++) {
    let value = base + Math.sin((i + seed) / 9) * 0.8 + ((i * 7919 + seed * 104729) % 17) / 40
    for (const [label, start, end] of events) {
      if (i < start || i > end) continue
      if (label === 'Spike') value += 9 - Math.abs(i - (start + end) / 2) * 2
      if (label === 'Dropout') value = 0
      if (label === 'Drift') value += (i - start) * 0.12
    }
    temperature.push(Math.round(value * 100) / 100)
  }
  return { id, series: { time: Array.from({ length: 120 }, (_, i) => i), temperature }, events: events.map(([label, start, end]) => ({ label, start, end })) }
}
export const SIGNALS = [
  signal('S-1', [['Spike', 30, 34], ['Dropout', 80, 86]], 21, 2),
  signal('S-2', [['Drift', 40, 95]], 19, 5),
  signal('S-3', [['Spike', 12, 15], ['Spike', 70, 73]], 23, 9),
  signal('S-4', [['Dropout', 50, 58], ['Drift', 90, 119]], 20, 4),
]

export const DIALOGUES = [
  { id: 'D-1', prompt: [{ author: 'user', text: 'My soil probe reads 0% moisture after I watered the pots. What should I check first?' }],
    answer_a: 'Check that the probe is fully inserted and that its cable is seated, then compare with a second probe in the same pot. A reading of exactly 0% usually means no contact or a disconnected sensor rather than dry soil.',
    answer_b: 'Soil can dry out quickly. Water the plants again and wait a day.', preferred: 'left' },
  { id: 'D-2', prompt: [{ author: 'user', text: 'Write one sentence explaining what an annotation guideline is.' }],
    answer_a: 'Guidelines are important.',
    answer_b: 'An annotation guideline is the shared rulebook that defines each label, shows examples and counterexamples, and says how to handle edge cases so different annotators make the same decision.', preferred: 'right' },
  { id: 'D-3', prompt: [{ author: 'user', text: 'Is it safe to charge a swollen lithium battery pack?' }],
    answer_a: 'No. Stop using and charging a swollen pack, keep it away from flammable material, and follow your local battery disposal rules.',
    answer_b: 'Yes, as long as you use the original charger and stay nearby.', preferred: 'left' },
  { id: 'D-4', prompt: [{ author: 'user', text: 'Summarise: the gateway lost Wi-Fi twice overnight and recovered each time within five minutes.' }],
    answer_a: 'The gateway failed permanently overnight.',
    answer_b: 'The gateway briefly lost Wi-Fi twice overnight and reconnected within five minutes each time.', preferred: 'right' },
]
