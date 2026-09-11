// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:5173" }
import { beforeEach, describe, expect, it } from 'vitest'
import * as Blockly from 'blockly'
import { STARTER_BLOCKLY_XML, defineVoltQuestBlocks } from './blocks.js'
import { cppString, generateArduinoFromWorkspace, inferVariableTypes } from './generator.js'

defineVoltQuestBlocks()

/** Build a headless workspace from XML — no DOM injection, which keeps these tests fast. */
function workspaceFromXml(xml) {
  const workspace = new Blockly.Workspace()
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(xml), workspace)
  return workspace
}

const wrap = (setup, loop) =>
  `<xml xmlns="https://developers.google.com/blockly/xml"><block type="arduino_program" x="0" y="0">` +
  `<statement name="SETUP">${setup}</statement><statement name="LOOP">${loop}</statement></block></xml>`

describe('generateArduinoFromWorkspace', () => {
  let workspace

  beforeEach(() => {
    workspace = null
  })

  it('generates the canonical blink sketch from the blink starter', () => {
    workspace = workspaceFromXml(STARTER_BLOCKLY_XML)
    expect(generateArduinoFromWorkspace(workspace)).toBe(
      [
        'void setup() {',
        '  pinMode(13, OUTPUT);',
        '}',
        '',
        'void loop() {',
        '  digitalWrite(13, HIGH);',
        '  delay(1000);',
        '  digitalWrite(13, LOW);',
        '  delay(1000);',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('returns an empty sketch skeleton for an empty or missing workspace', () => {
    expect(generateArduinoFromWorkspace(null)).toBe('void setup() {\n\n}\n\nvoid loop() {\n\n}\n')
    expect(generateArduinoFromWorkspace(new Blockly.Workspace())).toBe('void setup() {\n\n}\n\nvoid loop() {\n\n}\n')
  })

  it('nests control flow and respects operator precedence', () => {
    workspace = workspaceFromXml(
      wrap(
        '<block type="serial_begin"><field name="BAUD">115200</field></block>',
        `<block type="controls_if">
           <value name="IF0">
             <block type="logic_compare">
               <field name="OP">GT</field>
               <value name="A"><block type="analog_read"><field name="PIN">A0</field></block></value>
               <value name="B">
                 <block type="math_arithmetic">
                   <field name="OP">MULTIPLY</field>
                   <value name="A"><block type="math_number"><field name="NUM">100</field></block></value>
                   <value name="B"><block type="math_number"><field name="NUM">5</field></block></value>
                 </block>
               </value>
             </block>
           </value>
           <statement name="DO0"><block type="digital_write"><field name="PIN">13</field><field name="STATE">HIGH</field></block></statement>
         </block>`,
      ),
    )
    const code = generateArduinoFromWorkspace(workspace)
    expect(code).toContain('  Serial.begin(115200);')
    expect(code).toContain('  if (analogRead(A0) > 100 * 5) {')
    expect(code).toContain('    digitalWrite(13, HIGH);')
  })

  it('hoists includes, the WebServer object and its plumbing for the ESP32 web blocks', () => {
    workspace = workspaceFromXml(
      wrap(
        `<block type="wifi_begin">
           <field name="SSID">VoltNet-Guest</field>
           <field name="PASSWORD">voltquest</field>
           <next>
             <block type="server_on_send">
               <field name="PATH">/</field>
               <field name="CONTENT_TYPE">text/html</field>
               <value name="BODY"><block type="text"><field name="TEXT">Hi</field></block></value>
             </block>
           </next>
         </block>`,
        '',
      ),
    )
    const code = generateArduinoFromWorkspace(workspace)
    expect(code.startsWith('#include <WiFi.h>\n#include <WebServer.h>\n\nWebServer server(80);\n')).toBe(true)
    expect(code).toContain('  WiFi.begin("VoltNet-Guest", "voltquest");')
    expect(code).toContain('  server.on("/", [](){')
    expect(code).toContain('    server.send(200, "text/html", "Hi");')
    expect(code).toContain('  server.begin();')
    expect(code).toContain('void loop() {\n  server.handleClient();\n}')
  })

  it('declares MQTT globals and keeps the client connected from loop()', () => {
    workspace = workspaceFromXml(
      wrap(
        '',
        `<block type="mqtt_publish">
           <field name="TOPIC">voltquest/temp</field>
           <value name="PAYLOAD"><block type="analog_read"><field name="PIN">A0</field></block></value>
         </block>`,
      ),
    )
    const code = generateArduinoFromWorkspace(workspace)
    expect(code).toContain('#include <PubSubClient.h>')
    expect(code).toContain('WiFiClient wifiClient;\nPubSubClient mqttClient(wifiClient);')
    expect(code).toContain('  mqttClient.setServer("broker.voltquest.local", 1883);')
    expect(code).toContain('  if (!mqttClient.connected()) mqttClient.connect("voltquest-blocks");')
    expect(code).toContain('  mqttClient.publish("voltquest/temp", String(analogRead(A0)).c_str());')
  })

  it('hoists variables above setup with an inferred type', () => {
    const xml = wrap(
      '',
      `<block type="variables_set">
         <field name="VAR" id="v1">count</field>
         <value name="VALUE"><block type="math_number"><field name="NUM">0</field></block></value>
       </block>`,
    )
    workspace = workspaceFromXml(xml.replace('<block type="arduino_program"', '<variables><variable id="v1">count</variable></variables><block type="arduino_program"'))
    const code = generateArduinoFromWorkspace(workspace)
    expect(code).toContain('int count = 0;')
    expect(code.indexOf('int count = 0;')).toBeLessThan(code.indexOf('void setup()'))
    expect(Object.values(inferVariableTypes(workspace))).toEqual(['int'])
  })

  it('emits a user function above setup and calls it from loop', () => {
    workspace = workspaceFromXml(
      `<xml xmlns="https://developers.google.com/blockly/xml">
         <block type="procedures_defnoreturn" x="0" y="200">
           <field name="NAME">beep</field>
           <statement name="STACK"><block type="no_tone"><field name="PIN">8</field></block></statement>
         </block>
         <block type="arduino_program" x="0" y="0">
           <statement name="LOOP"><block type="procedures_callnoreturn"><mutation name="beep"></mutation></block></statement>
         </block>
       </xml>`,
    )
    const code = generateArduinoFromWorkspace(workspace)
    expect(code).toContain('void beep() {\n  noTone(8);\n}')
    expect(code).toContain('void loop() {\n  beep();\n}')
    expect(code.indexOf('void beep()')).toBeLessThan(code.indexOf('void setup()'))
  })

  it('escapes C++ string literals', () => {
    expect(cppString('say "hi"\n')).toBe('"say \\"hi\\"\\n"')
  })
})
