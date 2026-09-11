/**
 * VoltQuest Blockly block definitions, toolbox and starter workspaces (package H2).
 *
 * Pure data + one idempotent `defineVoltQuestBlocks()` call, deliberately separate from
 * `BlocklyEditor.jsx` so the generator and its tests can run on a headless `new Blockly.Workspace()`
 * without touching the DOM injection path.
 *
 * Colour hues follow docs/DESIGN.md: teal for the sketch frame, blue for I/O, amber for timing,
 * purple for serial, rose for sound, indigo for the ESP32 network blocks.
 */
import * as Blockly from 'blockly'
import * as En from 'blockly/msg/en'

let localeReady = false
let blocksDefined = false

/** Baud rates offered by `serial_begin` — the same list the Serial Monitor exposes. */
export const BAUD_RATES = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]

const HUE = {
  program: 174,
  io: 210,
  timing: 40,
  serial: 285,
  sound: 340,
  math: 230,
  net: 250,
}

/**
 * Every custom block, as Blockly JSON. Pin fields are free text (`field_input`) rather than
 * dropdowns so a learner can type `13`, `A0`, `LED_BUILTIN` or `T0` — the runtime resolves all of
 * them through `resolvePinNumber`/`resolvePinName`.
 */
export const VOLTQUEST_BLOCKS = [
  {
    type: 'arduino_program',
    message0: 'Arduino sketch',
    message1: 'setup — runs once %1',
    args1: [{ type: 'input_statement', name: 'SETUP' }],
    message2: 'loop — runs forever %1',
    args2: [{ type: 'input_statement', name: 'LOOP' }],
    colour: HUE.program,
    tooltip: 'Everything in setup runs once when the board powers up; loop repeats for ever.',
    helpUrl: '',
  },
  {
    type: 'pin_mode',
    message0: 'set pin %1 as %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '13' },
      {
        type: 'field_dropdown',
        name: 'MODE',
        options: [
          ['output', 'OUTPUT'],
          ['input', 'INPUT'],
          ['input with pull-up', 'INPUT_PULLUP'],
          ['input with pull-down', 'INPUT_PULLDOWN'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.io,
    tooltip: 'pinMode(pin, mode) — tell the board whether a pin drives or senses.',
  },
  {
    type: 'digital_write',
    message0: 'digital write pin %1 %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '13' },
      {
        type: 'field_dropdown',
        name: 'STATE',
        options: [
          ['HIGH', 'HIGH'],
          ['LOW', 'LOW'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.io,
    tooltip: 'digitalWrite(pin, value) — drive a pin to Vcc (HIGH) or 0 V (LOW).',
  },
  {
    type: 'digital_read',
    message0: 'digital read pin %1',
    args0: [{ type: 'field_input', name: 'PIN', text: '2' }],
    output: 'Number',
    colour: HUE.io,
    tooltip: 'digitalRead(pin) — 1 when the pin is above ~0.6 × Vcc, else 0.',
  },
  {
    type: 'analog_read',
    message0: 'analog read pin %1',
    args0: [{ type: 'field_input', name: 'PIN', text: 'A0' }],
    output: 'Number',
    colour: HUE.io,
    tooltip: 'analogRead(pin) — 0…1023 on the Uno, 0…4095 on the ESP32.',
  },
  {
    type: 'analog_write',
    message0: 'analog write pin %1 value %2',
    args0: [
      { type: 'field_input', name: 'PIN', text: '9' },
      { type: 'input_value', name: 'VALUE', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: HUE.io,
    tooltip: 'analogWrite(pin, duty) — PWM duty 0…255.',
  },
  {
    type: 'delay_ms',
    message0: 'wait %1 ms',
    args0: [{ type: 'input_value', name: 'MS', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: HUE.timing,
    tooltip: 'delay(ms) — pause the sketch.',
  },
  {
    type: 'millis',
    message0: 'milliseconds since start',
    output: 'Number',
    colour: HUE.timing,
    tooltip: 'millis() — milliseconds since the board booted.',
  },
  {
    type: 'serial_begin',
    message0: 'Serial begin %1 baud',
    args0: [{ type: 'field_dropdown', name: 'BAUD', options: BAUD_RATES.map((b) => [String(b), String(b)]) }],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.serial,
    tooltip: 'Serial.begin(baud) — open the serial port. The monitor must use the same baud.',
  },
  {
    type: 'serial_print',
    message0: 'Serial print %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: HUE.serial,
    tooltip: 'Serial.print(value) — no newline.',
  },
  {
    type: 'serial_println',
    message0: 'Serial print line %1',
    args0: [{ type: 'input_value', name: 'TEXT' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: HUE.serial,
    tooltip: 'Serial.println(value) — prints and ends the line.',
  },
  {
    type: 'tone',
    message0: 'play tone on pin %1 at %2 Hz',
    args0: [
      { type: 'field_input', name: 'PIN', text: '8' },
      { type: 'input_value', name: 'FREQ', check: 'Number' },
    ],
    message1: 'for %1 ms (optional)',
    args1: [{ type: 'input_value', name: 'DURATION', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: HUE.sound,
    tooltip: 'tone(pin, frequency[, duration]) — square wave on a buzzer.',
  },
  {
    type: 'no_tone',
    message0: 'stop tone on pin %1',
    args0: [{ type: 'field_input', name: 'PIN', text: '8' }],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.sound,
    tooltip: 'noTone(pin) — silence the buzzer.',
  },
  {
    type: 'map',
    message0: 'map %1 from %2 .. %3 to %4 .. %5',
    args0: [
      { type: 'input_value', name: 'VALUE', check: 'Number' },
      { type: 'input_value', name: 'FROM_LOW', check: 'Number' },
      { type: 'input_value', name: 'FROM_HIGH', check: 'Number' },
      { type: 'input_value', name: 'TO_LOW', check: 'Number' },
      { type: 'input_value', name: 'TO_HIGH', check: 'Number' },
    ],
    inputsInline: true,
    output: 'Number',
    colour: HUE.math,
    tooltip: 'map(value, fromLow, fromHigh, toLow, toHigh) — rescale a reading.',
  },

  // ---- ESP32 -------------------------------------------------------------
  {
    type: 'touch_read',
    message0: 'touch read pin %1',
    args0: [{ type: 'field_input', name: 'PIN', text: 'T0' }],
    output: 'Number',
    colour: HUE.net,
    tooltip: 'touchRead(pin) — ESP32 only. Lower values mean a finger is closer.',
  },
  {
    type: 'wifi_begin',
    message0: 'connect WiFi to %1 password %2',
    args0: [
      { type: 'field_input', name: 'SSID', text: 'VoltNet-Guest' },
      { type: 'field_input', name: 'PASSWORD', text: 'voltquest' },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.net,
    tooltip: 'WiFi.begin(ssid, password) then wait until the board is connected.',
  },
  {
    type: 'server_on_send',
    message0: 'web page at %1 type %2',
    args0: [
      { type: 'field_input', name: 'PATH', text: '/' },
      {
        type: 'field_dropdown',
        name: 'CONTENT_TYPE',
        options: [
          ['HTML', 'text/html'],
          ['plain text', 'text/plain'],
          ['JSON', 'application/json'],
        ],
      },
    ],
    message1: 'send %1',
    args1: [{ type: 'input_value', name: 'BODY' }],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.net,
    tooltip: 'server.on(path, handler) — answer a browser request with this body.',
  },
  {
    type: 'mqtt_publish',
    message0: 'MQTT publish to %1',
    args0: [{ type: 'field_input', name: 'TOPIC', text: 'voltquest/sensor' }],
    message1: 'payload %1',
    args1: [{ type: 'input_value', name: 'PAYLOAD' }],
    previousStatement: null,
    nextStatement: null,
    colour: HUE.net,
    tooltip: 'Publish a value to the virtual MQTT broker.',
  },
]

/** Register the English locale and every custom block. Safe to call repeatedly. */
export function defineVoltQuestBlocks() {
  if (!localeReady) {
    Blockly.setLocale(En)
    localeReady = true
  }
  if (blocksDefined) return
  Blockly.common.defineBlocksWithJsonArray(VOLTQUEST_BLOCKS)
  blocksDefined = true
}

const shadowNumber = (value) => ({ shadow: { type: 'math_number', fields: { NUM: value } } })
const shadowText = (value) => ({ shadow: { type: 'text', fields: { TEXT: value } } })

/** Toolbox for AVR boards; `esp32: true` appends the network category. */
export function buildToolbox({ esp32 = false } = {}) {
  const categories = [
    {
      kind: 'category',
      name: 'Sketch',
      colour: String(HUE.program),
      contents: [{ kind: 'block', type: 'arduino_program' }],
    },
    {
      kind: 'category',
      name: 'Pins',
      colour: String(HUE.io),
      contents: [
        { kind: 'block', type: 'pin_mode' },
        { kind: 'block', type: 'digital_write' },
        { kind: 'block', type: 'digital_read' },
        { kind: 'block', type: 'analog_read' },
        { kind: 'block', type: 'analog_write', inputs: { VALUE: shadowNumber(128) } },
        { kind: 'block', type: 'map', inputs: { VALUE: shadowNumber(0), FROM_LOW: shadowNumber(0), FROM_HIGH: shadowNumber(1023), TO_LOW: shadowNumber(0), TO_HIGH: shadowNumber(255) } },
      ],
    },
    {
      kind: 'category',
      name: 'Timing',
      colour: String(HUE.timing),
      contents: [
        { kind: 'block', type: 'delay_ms', inputs: { MS: shadowNumber(1000) } },
        { kind: 'block', type: 'millis' },
      ],
    },
    {
      kind: 'category',
      name: 'Serial',
      colour: String(HUE.serial),
      contents: [
        { kind: 'block', type: 'serial_begin', fields: { BAUD: '9600' } },
        { kind: 'block', type: 'serial_print', inputs: { TEXT: shadowText('value') } },
        { kind: 'block', type: 'serial_println', inputs: { TEXT: shadowText('value') } },
      ],
    },
    {
      kind: 'category',
      name: 'Sound',
      colour: String(HUE.sound),
      contents: [
        { kind: 'block', type: 'tone', inputs: { FREQ: shadowNumber(440) } },
        { kind: 'block', type: 'no_tone' },
      ],
    },
    { kind: 'sep' },
    {
      kind: 'category',
      name: 'Logic',
      colour: '210',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_ternary' },
      ],
    },
    {
      kind: 'category',
      name: 'Loops',
      colour: '120',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNumber(10) } },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for', inputs: { FROM: shadowNumber(1), TO: shadowNumber(10), BY: shadowNumber(1) } },
        { kind: 'block', type: 'controls_flow_statements' },
      ],
    },
    {
      kind: 'category',
      name: 'Math',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic', inputs: { A: shadowNumber(1), B: shadowNumber(1) } },
        { kind: 'block', type: 'math_single', inputs: { NUM: shadowNumber(9) } },
        { kind: 'block', type: 'math_trig', inputs: { NUM: shadowNumber(45) } },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_number_property', inputs: { NUMBER_TO_CHECK: shadowNumber(0) } },
        { kind: 'block', type: 'math_round', inputs: { NUM: shadowNumber(3.1) } },
        { kind: 'block', type: 'math_modulo', inputs: { DIVIDEND: shadowNumber(64), DIVISOR: shadowNumber(10) } },
        { kind: 'block', type: 'math_constrain', inputs: { VALUE: shadowNumber(50), LOW: shadowNumber(1), HIGH: shadowNumber(100) } },
        { kind: 'block', type: 'math_random_int', inputs: { FROM: shadowNumber(1), TO: shadowNumber(100) } },
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      colour: '160',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_length', inputs: { VALUE: shadowText('abc') } },
        { kind: 'block', type: 'text_isEmpty', inputs: { VALUE: shadowText('') } },
      ],
    },
    { kind: 'sep' },
    { kind: 'category', name: 'Variables', colour: '330', custom: 'VARIABLE' },
    { kind: 'category', name: 'Functions', colour: '290', custom: 'PROCEDURE' },
  ]

  if (esp32) {
    categories.splice(5, 0, {
      kind: 'category',
      name: 'Network',
      colour: String(HUE.net),
      contents: [
        { kind: 'block', type: 'touch_read' },
        { kind: 'block', type: 'wifi_begin' },
        { kind: 'block', type: 'server_on_send', inputs: { BODY: shadowText('<h1>Hello from VoltQuest</h1>') } },
        { kind: 'block', type: 'mqtt_publish', inputs: { PAYLOAD: shadowText('1') } },
      ],
    })
  }

  return { kind: 'categoryToolbox', contents: categories }
}

/** Blink starter used whenever a level ships no `starterBlocklyXml`. */
export const STARTER_BLOCKLY_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="arduino_program" x="40" y="40">
    <statement name="SETUP">
      <block type="pin_mode">
        <field name="PIN">13</field>
        <field name="MODE">OUTPUT</field>
      </block>
    </statement>
    <statement name="LOOP">
      <block type="digital_write">
        <field name="PIN">13</field>
        <field name="STATE">HIGH</field>
        <next>
          <block type="delay_ms">
            <value name="MS">
              <shadow type="math_number"><field name="NUM">1000</field></shadow>
            </value>
            <next>
              <block type="digital_write">
                <field name="PIN">13</field>
                <field name="STATE">LOW</field>
                <next>
                  <block type="delay_ms">
                    <value name="MS">
                      <shadow type="math_number"><field name="NUM">1000</field></shadow>
                    </value>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`

export default VOLTQUEST_BLOCKS
