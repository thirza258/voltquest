/**
 * Blockly → Arduino C++ generator (package H2, CONTRACTS §11.2 "Blockly policy").
 *
 * One-way: blocks are the source of truth in `blocks` mode and the text editor shows the generated
 * sketch read-only. The generator is a plain `Blockly.CodeGenerator` subclass so the built-in
 * logic/loops/math/text/variables/functions blocks get correct operator precedence from
 * `valueToCode`, and so it runs on a headless `new Blockly.Workspace()` (no DOM) in tests.
 *
 * Declarations are hoisted: `#include`s, library objects (`WebServer server(80);`), user variables
 * and user functions are emitted above `setup()`, and the plumbing that the network blocks imply
 * (`server.begin()`, `server.handleClient()`, `mqttClient.loop()`) is woven into setup/loop.
 */
import * as Blockly from 'blockly'
import { defineVoltQuestBlocks } from './blocks.js'

defineVoltQuestBlocks()

/** C++ operator precedence, lowest number binds tightest. */
export const ORDER = {
  ATOMIC: 0,
  UNARY_POSTFIX: 1, // () [] . ->  and function calls
  UNARY_PREFIX: 2, // ! ~ unary - ++ -- (cast)
  MULTIPLICATIVE: 3,
  ADDITIVE: 4,
  SHIFT: 5,
  RELATIONAL: 6,
  EQUALITY: 7,
  BITWISE_AND: 8,
  BITWISE_XOR: 9,
  BITWISE_OR: 10,
  LOGICAL_AND: 11,
  LOGICAL_OR: 12,
  CONDITIONAL: 13,
  ASSIGNMENT: 14,
  COMMA: 15,
  NONE: 99,
}

const RESERVED = [
  'setup', 'loop', 'int', 'long', 'float', 'double', 'char', 'byte', 'bool', 'boolean', 'void', 'String',
  'const', 'static', 'volatile', 'unsigned', 'short', 'if', 'else', 'for', 'while', 'do', 'switch', 'case',
  'default', 'break', 'continue', 'return', 'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP',
  'INPUT_PULLDOWN', 'LED_BUILTIN', 'PI', 'server', 'wifiClient', 'mqttClient', 'WiFi', 'Serial', 'sizeof',
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite', 'delay', 'millis', 'map', 'tone',
  'noTone', 'random', 'constrain', 'min', 'max', 'abs', 'pow', 'sqrt', 'floor', 'ceil', 'round',
].join(',')

/** Include order in the emitted file (stable, dependency-first). */
const INCLUDE_ORDER = ['WiFi.h', 'WebServer.h', 'PubSubClient.h']

const MQTT_CLIENT_ID = 'voltquest-blocks'
const MQTT_HOST = 'broker.voltquest.local'

/** Sketch emitted for an empty (or missing) workspace — the same skeleton the text editor starts at. */
export const EMPTY_SKETCH = 'void setup() {\n\n}\n\nvoid loop() {\n\n}\n'

/** Quote a JS string as a C++ string literal. */
export function cppString(text) {
  return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`
}

/** A pin field may be a number, an alias (`A0`, `T0`) or a constant (`LED_BUILTIN`); pass it through. */
function pinExpression(raw) {
  const text = String(raw ?? '').trim()
  return text === '' ? '0' : text
}

class ArduinoGenerator extends Blockly.CodeGenerator {
  constructor() {
    super('Arduino')
    this.INDENT = '  '
    this.addReservedWords(RESERVED)
    this.resetBuffers()
  }

  resetBuffers() {
    /** `#include <…>` names required by the blocks that were used. */
    this.includes = new Set()
    /** Library objects declared above setup(), in insertion order. */
    this.libGlobals = []
    /** Statements appended to the end of setup() (one indent level, no trailing newline). */
    this.setupTail = []
    /** Statements prepended to the start of loop(). */
    this.loopHead = []
  }

  init(workspace) {
    this.resetBuffers()
    if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_)
    else this.nameDB_.reset()
    this.nameDB_.setVariableMap(workspace.getVariableMap())
    this.nameDB_.populateVariables(workspace)
    this.nameDB_.populateProcedures(workspace)
    this.isInitialized = true
  }

  /** Statement blocks chain through `next`; the base class only emits the block itself. */
  scrub_(block, code, thisOnly) {
    if (thisOnly || code == null) return code
    const next = block.nextConnection && block.nextConnection.targetBlock()
    if (!next) return code
    const nextCode = this.blockToCode(next)
    return code + (typeof nextCode === 'string' ? nextCode : nextCode[0])
  }

  /** A block type with no generator must not take the whole sketch down. */
  blockToCode(block, thisOnly) {
    if (block && !this.forBlock[block.type]) {
      return block.outputConnection ? ['0', ORDER.ATOMIC] : `${this.INDENT}// unsupported block: ${block.type}\n`
    }
    return super.blockToCode(block, thisOnly)
  }

  scrubNakedValue(line) {
    return `${line};\n`
  }

  need(include) {
    this.includes.add(include)
  }

  declare(line) {
    if (!this.libGlobals.includes(line)) this.libGlobals.push(line)
  }

  addSetupTail(line) {
    if (!this.setupTail.includes(line)) this.setupTail.push(line)
  }

  addLoopHead(line) {
    if (!this.loopHead.includes(line)) this.loopHead.push(line)
  }

  /** Declare the WebServer instance and its begin/handleClient plumbing exactly once. */
  useWebServer() {
    this.need('WiFi.h')
    this.need('WebServer.h')
    this.declare('WebServer server(80);')
    this.addSetupTail('server.begin();')
    this.addLoopHead('server.handleClient();')
  }

  /** Declare the MQTT client and keep it connected from loop(). */
  useMqtt() {
    this.need('WiFi.h')
    this.need('PubSubClient.h')
    this.declare('WiFiClient wifiClient;')
    this.declare('PubSubClient mqttClient(wifiClient);')
    this.addSetupTail(`mqttClient.setServer(${cppString(MQTT_HOST)}, 1883);`)
    this.addLoopHead(`if (!mqttClient.connected()) mqttClient.connect(${cppString(MQTT_CLIENT_ID)});`)
    this.addLoopHead('mqttClient.loop();')
  }
}

export const arduinoGenerator = new ArduinoGenerator()
const G = arduinoGenerator.forBlock

// ---------------------------------------------------------------------------
// VoltQuest blocks
// ---------------------------------------------------------------------------

G['arduino_program'] = () => ''

G['pin_mode'] = (block) => `pinMode(${pinExpression(block.getFieldValue('PIN'))}, ${block.getFieldValue('MODE')});\n`

G['digital_write'] = (block) => `digitalWrite(${pinExpression(block.getFieldValue('PIN'))}, ${block.getFieldValue('STATE')});\n`

G['digital_read'] = (block) => [`digitalRead(${pinExpression(block.getFieldValue('PIN'))})`, ORDER.UNARY_POSTFIX]

G['analog_read'] = (block) => [`analogRead(${pinExpression(block.getFieldValue('PIN'))})`, ORDER.UNARY_POSTFIX]

G['analog_write'] = (block, gen) => {
  const value = gen.valueToCode(block, 'VALUE', ORDER.COMMA) || '0'
  return `analogWrite(${pinExpression(block.getFieldValue('PIN'))}, ${value});\n`
}

G['delay_ms'] = (block, gen) => `delay(${gen.valueToCode(block, 'MS', ORDER.COMMA) || '0'});\n`

G['millis'] = () => ['millis()', ORDER.UNARY_POSTFIX]

G['serial_begin'] = (block) => `Serial.begin(${block.getFieldValue('BAUD')});\n`

G['serial_print'] = (block, gen) => `Serial.print(${gen.valueToCode(block, 'TEXT', ORDER.COMMA) || '""'});\n`

G['serial_println'] = (block, gen) => `Serial.println(${gen.valueToCode(block, 'TEXT', ORDER.COMMA) || '""'});\n`

G['tone'] = (block, gen) => {
  const pin = pinExpression(block.getFieldValue('PIN'))
  const freq = gen.valueToCode(block, 'FREQ', ORDER.COMMA) || '440'
  const duration = gen.valueToCode(block, 'DURATION', ORDER.COMMA)
  return duration ? `tone(${pin}, ${freq}, ${duration});\n` : `tone(${pin}, ${freq});\n`
}

G['no_tone'] = (block) => `noTone(${pinExpression(block.getFieldValue('PIN'))});\n`

G['map'] = (block, gen) => {
  const args = ['VALUE', 'FROM_LOW', 'FROM_HIGH', 'TO_LOW', 'TO_HIGH'].map((name) => gen.valueToCode(block, name, ORDER.COMMA) || '0')
  return [`map(${args.join(', ')})`, ORDER.UNARY_POSTFIX]
}

G['touch_read'] = (block) => [`touchRead(${pinExpression(block.getFieldValue('PIN'))})`, ORDER.UNARY_POSTFIX]

G['wifi_begin'] = (block, gen) => {
  gen.need('WiFi.h')
  const ssid = cppString(block.getFieldValue('SSID'))
  const password = cppString(block.getFieldValue('PASSWORD'))
  return `WiFi.begin(${ssid}, ${password});\nwhile (WiFi.status() != WL_CONNECTED) {\n${gen.INDENT}delay(100);\n}\n`
}

G['server_on_send'] = (block, gen) => {
  gen.useWebServer()
  const path = cppString(block.getFieldValue('PATH') || '/')
  const type = cppString(block.getFieldValue('CONTENT_TYPE') || 'text/html')
  const body = gen.valueToCode(block, 'BODY', ORDER.COMMA) || '""'
  return `server.on(${path}, [](){\n${gen.INDENT}server.send(200, ${type}, ${body});\n});\n`
}

G['mqtt_publish'] = (block, gen) => {
  gen.useMqtt()
  const topic = cppString(block.getFieldValue('TOPIC') || 'voltquest')
  const payload = gen.valueToCode(block, 'PAYLOAD', ORDER.COMMA) || '""'
  return `mqttClient.publish(${topic}, String(${payload}).c_str());\n`
}

// ---------------------------------------------------------------------------
// Built-in: logic
// ---------------------------------------------------------------------------

G['controls_if'] = (block, gen) => {
  let n = 0
  let code = ''
  do {
    const condition = gen.valueToCode(block, `IF${n}`, ORDER.NONE) || 'false'
    const branch = gen.statementToCode(block, `DO${n}`)
    code += `${n > 0 ? ' else ' : ''}if (${condition}) {\n${branch}}`
    n += 1
  } while (block.getInput(`IF${n}`))
  if (block.getInput('ELSE')) code += ` else {\n${gen.statementToCode(block, 'ELSE')}}`
  return `${code}\n`
}
G['controls_ifelse'] = G['controls_if']

G['logic_compare'] = (block, gen) => {
  const operator = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }[block.getFieldValue('OP')]
  const order = operator === '==' || operator === '!=' ? ORDER.EQUALITY : ORDER.RELATIONAL
  const a = gen.valueToCode(block, 'A', order) || '0'
  const b = gen.valueToCode(block, 'B', order) || '0'
  return [`${a} ${operator} ${b}`, order]
}

G['logic_operation'] = (block, gen) => {
  const and = block.getFieldValue('OP') === 'AND'
  const operator = and ? '&&' : '||'
  const order = and ? ORDER.LOGICAL_AND : ORDER.LOGICAL_OR
  const a = gen.valueToCode(block, 'A', order) || (and ? 'true' : 'false')
  const b = gen.valueToCode(block, 'B', order) || (and ? 'true' : 'false')
  return [`${a} ${operator} ${b}`, order]
}

G['logic_negate'] = (block, gen) => [`!${gen.valueToCode(block, 'BOOL', ORDER.UNARY_PREFIX) || 'true'}`, ORDER.UNARY_PREFIX]

G['logic_boolean'] = (block) => [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', ORDER.ATOMIC]

G['logic_null'] = () => ['0', ORDER.ATOMIC]

G['logic_ternary'] = (block, gen) => {
  const test = gen.valueToCode(block, 'IF', ORDER.CONDITIONAL) || 'false'
  const then = gen.valueToCode(block, 'THEN', ORDER.CONDITIONAL) || '0'
  const other = gen.valueToCode(block, 'ELSE', ORDER.CONDITIONAL) || '0'
  return [`${test} ? ${then} : ${other}`, ORDER.CONDITIONAL]
}

// ---------------------------------------------------------------------------
// Built-in: loops
// ---------------------------------------------------------------------------

G['controls_repeat_ext'] = (block, gen) => {
  const times = gen.valueToCode(block, 'TIMES', ORDER.RELATIONAL) || '0'
  const branch = gen.statementToCode(block, 'DO')
  const i = gen.nameDB_.getDistinctName('i', Blockly.Names.NameType.VARIABLE)
  return `for (int ${i} = 0; ${i} < ${times}; ${i}++) {\n${branch}}\n`
}
G['controls_repeat'] = G['controls_repeat_ext']

G['controls_whileUntil'] = (block, gen) => {
  const until = block.getFieldValue('MODE') === 'UNTIL'
  let condition = gen.valueToCode(block, 'BOOL', until ? ORDER.UNARY_PREFIX : ORDER.NONE) || 'false'
  if (until) condition = `!${condition}`
  return `while (${condition}) {\n${gen.statementToCode(block, 'DO')}}\n`
}

G['controls_for'] = (block, gen) => {
  const name = gen.getVariableName(block.getFieldValue('VAR'))
  const from = gen.valueToCode(block, 'FROM', ORDER.ASSIGNMENT) || '0'
  const to = gen.valueToCode(block, 'TO', ORDER.RELATIONAL) || '0'
  const by = gen.valueToCode(block, 'BY', ORDER.ASSIGNMENT) || '1'
  const branch = gen.statementToCode(block, 'DO')
  return `for (${name} = ${from}; ${name} <= ${to}; ${name} += ${by}) {\n${branch}}\n`
}

G['controls_flow_statements'] = (block) => (block.getFieldValue('FLOW') === 'BREAK' ? 'break;\n' : 'continue;\n')

// ---------------------------------------------------------------------------
// Built-in: math
// ---------------------------------------------------------------------------

G['math_number'] = (block) => {
  const value = Number(block.getFieldValue('NUM'))
  const text = Number.isInteger(value) ? String(value) : String(value)
  return [text, value < 0 ? ORDER.UNARY_PREFIX : ORDER.ATOMIC]
}

G['math_arithmetic'] = (block, gen) => {
  const ops = {
    ADD: ['+', ORDER.ADDITIVE],
    MINUS: ['-', ORDER.ADDITIVE],
    MULTIPLY: ['*', ORDER.MULTIPLICATIVE],
    DIVIDE: ['/', ORDER.MULTIPLICATIVE],
    POWER: [null, ORDER.UNARY_POSTFIX],
  }
  const [operator, order] = ops[block.getFieldValue('OP')] ?? ops.ADD
  const a = gen.valueToCode(block, 'A', order) || '0'
  const b = gen.valueToCode(block, 'B', order) || '0'
  if (!operator) return [`pow(${a}, ${b})`, ORDER.UNARY_POSTFIX]
  return [`${a} ${operator} ${b}`, order]
}

G['math_single'] = (block, gen) => {
  const op = block.getFieldValue('OP')
  if (op === 'NEG') {
    const value = gen.valueToCode(block, 'NUM', ORDER.UNARY_PREFIX) || '0'
    return [`-${value}`, ORDER.UNARY_PREFIX]
  }
  const value = gen.valueToCode(block, 'NUM', ORDER.COMMA) || '0'
  const fns = { ABS: 'abs', ROOT: 'sqrt', LN: 'log', LOG10: 'log10', EXP: 'exp', POW10: null }
  if (op === 'POW10') return [`pow(10, ${value})`, ORDER.UNARY_POSTFIX]
  return [`${fns[op] ?? 'abs'}(${value})`, ORDER.UNARY_POSTFIX]
}

G['math_trig'] = (block, gen) => {
  const value = gen.valueToCode(block, 'NUM', ORDER.MULTIPLICATIVE) || '0'
  const op = block.getFieldValue('OP')
  const direct = { SIN: 'sin', COS: 'cos', TAN: 'tan' }[op]
  if (direct) return [`${direct}(${value} * DEG_TO_RAD)`, ORDER.UNARY_POSTFIX]
  const inverse = { ASIN: 'asin', ACOS: 'acos', ATAN: 'atan' }[op] ?? 'atan'
  return [`(${inverse}(${value}) * RAD_TO_DEG)`, ORDER.UNARY_POSTFIX]
}

G['math_constant'] = (block) => {
  const constants = {
    PI: ['PI', ORDER.ATOMIC],
    E: ['2.718281828459045', ORDER.ATOMIC],
    GOLDEN_RATIO: ['1.618033988749895', ORDER.ATOMIC],
    SQRT2: ['1.4142135623730951', ORDER.ATOMIC],
    SQRT1_2: ['0.7071067811865476', ORDER.ATOMIC],
    INFINITY: ['INFINITY', ORDER.ATOMIC],
  }
  return constants[block.getFieldValue('CONSTANT')] ?? constants.PI
}

G['math_number_property'] = (block, gen) => {
  const value = gen.valueToCode(block, 'NUMBER_TO_CHECK', ORDER.MULTIPLICATIVE) || '0'
  const property = block.getFieldValue('PROPERTY')
  switch (property) {
    case 'EVEN':
      return [`(${value}) % 2 == 0`, ORDER.EQUALITY]
    case 'ODD':
      return [`(${value}) % 2 == 1`, ORDER.EQUALITY]
    case 'POSITIVE':
      return [`${value} > 0`, ORDER.RELATIONAL]
    case 'NEGATIVE':
      return [`${value} < 0`, ORDER.RELATIONAL]
    case 'DIVISIBLE_BY': {
      const divisor = gen.valueToCode(block, 'DIVISOR', ORDER.MULTIPLICATIVE) || '1'
      return [`(${value}) % (${divisor}) == 0`, ORDER.EQUALITY]
    }
    default:
      return [`${value} == 0`, ORDER.EQUALITY]
  }
}

G['math_round'] = (block, gen) => {
  const value = gen.valueToCode(block, 'NUM', ORDER.COMMA) || '0'
  const fn = { ROUND: 'round', ROUNDUP: 'ceil', ROUNDDOWN: 'floor' }[block.getFieldValue('OP')] ?? 'round'
  return [`${fn}(${value})`, ORDER.UNARY_POSTFIX]
}

G['math_modulo'] = (block, gen) => {
  const dividend = gen.valueToCode(block, 'DIVIDEND', ORDER.MULTIPLICATIVE) || '0'
  const divisor = gen.valueToCode(block, 'DIVISOR', ORDER.MULTIPLICATIVE) || '1'
  return [`${dividend} % ${divisor}`, ORDER.MULTIPLICATIVE]
}

G['math_constrain'] = (block, gen) => {
  const value = gen.valueToCode(block, 'VALUE', ORDER.COMMA) || '0'
  const low = gen.valueToCode(block, 'LOW', ORDER.COMMA) || '0'
  const high = gen.valueToCode(block, 'HIGH', ORDER.COMMA) || '0'
  return [`constrain(${value}, ${low}, ${high})`, ORDER.UNARY_POSTFIX]
}

G['math_random_int'] = (block, gen) => {
  const from = gen.valueToCode(block, 'FROM', ORDER.COMMA) || '0'
  const to = gen.valueToCode(block, 'TO', ORDER.ADDITIVE) || '0'
  return [`random(${from}, ${to} + 1)`, ORDER.UNARY_POSTFIX]
}

G['math_random_float'] = () => ['(random(0, 10000) / 10000.0)', ORDER.MULTIPLICATIVE]

G['math_change'] = (block, gen) => {
  const delta = gen.valueToCode(block, 'DELTA', ORDER.ADDITIVE) || '0'
  return `${gen.getVariableName(block.getFieldValue('VAR'))} += ${delta};\n`
}

// ---------------------------------------------------------------------------
// Built-in: text
// ---------------------------------------------------------------------------

G['text'] = (block) => [cppString(block.getFieldValue('TEXT')), ORDER.ATOMIC]

G['text_join'] = (block, gen) => {
  const n = block.itemCount_ ?? 0
  if (!n) return ['String("")', ORDER.UNARY_POSTFIX]
  const parts = []
  for (let i = 0; i < n; i += 1) parts.push(gen.valueToCode(block, `ADD${i}`, ORDER.ADDITIVE) || '""')
  return [`String(${parts[0]})${parts.slice(1).map((p) => ` + String(${p})`).join('')}`, ORDER.ADDITIVE]
}

G['text_length'] = (block, gen) => [`String(${gen.valueToCode(block, 'VALUE', ORDER.COMMA) || '""'}).length()`, ORDER.UNARY_POSTFIX]

G['text_isEmpty'] = (block, gen) => [`String(${gen.valueToCode(block, 'VALUE', ORDER.COMMA) || '""'}).length() == 0`, ORDER.EQUALITY]

G['text_print'] = (block, gen) => `Serial.println(${gen.valueToCode(block, 'TEXT', ORDER.COMMA) || '""'});\n`

G['text_trim'] = (block, gen) => {
  const value = gen.valueToCode(block, 'TEXT', ORDER.COMMA) || '""'
  return [`String(${value})`, ORDER.UNARY_POSTFIX]
}

G['text_changeCase'] = (block, gen) => {
  const value = gen.valueToCode(block, 'TEXT', ORDER.COMMA) || '""'
  const mode = block.getFieldValue('CASE')
  if (mode === 'UPPERCASE') return [`voltquestUpper(String(${value}))`, ORDER.UNARY_POSTFIX]
  return [`String(${value})`, ORDER.UNARY_POSTFIX]
}

// ---------------------------------------------------------------------------
// Built-in: variables & procedures
// ---------------------------------------------------------------------------

G['variables_get'] = (block, gen) => [gen.getVariableName(block.getFieldValue('VAR')), ORDER.ATOMIC]

G['variables_set'] = (block, gen) => {
  const value = gen.valueToCode(block, 'VALUE', ORDER.ASSIGNMENT) || '0'
  return `${gen.getVariableName(block.getFieldValue('VAR'))} = ${value};\n`
}

G['procedures_defnoreturn'] = (block, gen) => {
  const name = gen.getProcedureName(block.getFieldValue('NAME'))
  const args = block.getVars().map((v) => `int ${gen.getVariableName(v)}`)
  const body = gen.statementToCode(block, 'STACK')
  return `void ${name}(${args.join(', ')}) {\n${body}}\n`
}

G['procedures_defreturn'] = (block, gen) => {
  const name = gen.getProcedureName(block.getFieldValue('NAME'))
  const args = block.getVars().map((v) => `int ${gen.getVariableName(v)}`)
  const body = gen.statementToCode(block, 'STACK')
  const returnValue = gen.valueToCode(block, 'RETURN', ORDER.NONE) || '0'
  return `int ${name}(${args.join(', ')}) {\n${body}${gen.INDENT}return ${returnValue};\n}\n`
}

G['procedures_callnoreturn'] = (block, gen) => {
  const name = gen.getProcedureName(block.getFieldValue('NAME'))
  const args = block.getVars().map((_v, i) => gen.valueToCode(block, `ARG${i}`, ORDER.COMMA) || '0')
  return `${name}(${args.join(', ')});\n`
}

G['procedures_callreturn'] = (block, gen) => {
  const name = gen.getProcedureName(block.getFieldValue('NAME'))
  const args = block.getVars().map((_v, i) => gen.valueToCode(block, `ARG${i}`, ORDER.COMMA) || '0')
  return [`${name}(${args.join(', ')})`, ORDER.UNARY_POSTFIX]
}

G['procedures_ifreturn'] = (block, gen) => {
  const condition = gen.valueToCode(block, 'CONDITION', ORDER.NONE) || 'false'
  const value = block.hasReturnValue_ ? gen.valueToCode(block, 'VALUE', ORDER.NONE) || '0' : ''
  return `if (${condition}) return${value ? ` ${value}` : ''};\n`
}

// ---------------------------------------------------------------------------
// Variable type inference and assembly
// ---------------------------------------------------------------------------

const STRING_BLOCKS = new Set(['text', 'text_join', 'text_changeCase', 'text_trim'])
const BOOL_BLOCKS = new Set(['logic_boolean', 'logic_compare', 'logic_operation', 'logic_negate'])
const FLOAT_BLOCKS = new Set(['math_trig', 'math_constant', 'math_random_float'])

/** Rank so a variable written as both a number and a string ends up a String. */
const TYPE_RANK = { bool: 0, int: 1, float: 2, String: 3 }

function typeOfValueBlock(block) {
  if (!block) return null
  if (STRING_BLOCKS.has(block.type)) return 'String'
  if (BOOL_BLOCKS.has(block.type)) return 'bool'
  if (FLOAT_BLOCKS.has(block.type)) return 'float'
  if (block.type === 'math_number') return Number.isInteger(Number(block.getFieldValue('NUM'))) ? 'int' : 'float'
  if (block.type === 'math_single') return block.getFieldValue('OP') === 'ABS' ? 'int' : 'float'
  if (block.type === 'math_arithmetic') return block.getFieldValue('OP') === 'DIVIDE' ? 'float' : 'int'
  return 'int'
}

/**
 * Guess a C type per Blockly variable from how it is assigned. Blockly variables are untyped, so
 * the sketch would not compile without this; `int` is the safe default for pin/sensor work.
 */
export function inferVariableTypes(workspace) {
  const types = {}
  for (const block of workspace.getAllBlocks(false)) {
    if (block.type !== 'variables_set' && block.type !== 'math_change') continue
    const id = block.getFieldValue('VAR')
    const found = block.type === 'math_change' ? 'int' : typeOfValueBlock(block.getInputTargetBlock('VALUE'))
    if (!found) continue
    const current = types[id]
    if (!current || TYPE_RANK[found] > TYPE_RANK[current]) types[id] = found
  }
  return types
}

const INITIAL_VALUE = { int: '0', float: '0', bool: 'false', String: '""' }

function declareVariables(workspace, gen) {
  const types = inferVariableTypes(workspace)
  const lines = []
  for (const variable of workspace.getAllVariables()) {
    const type = types[variable.getId()] ?? 'int'
    lines.push(`${type} ${gen.getVariableName(variable.getId())} = ${INITIAL_VALUE[type]};`)
  }
  return lines
}

/** Wrap a body (already newline-terminated, one indent level) in a function. */
function wrapFunction(signature, body) {
  const trimmed = body.replace(/\n+$/, '')
  return trimmed ? `${signature} {\n${trimmed}\n}\n` : `${signature} {\n\n}\n`
}

/**
 * Generate a complete Arduino sketch from a Blockly workspace.
 *
 * @param {object|null} workspace a Blockly workspace (headless is fine)
 * @returns {string} formatted C++ ending in a newline
 */
export function generateArduinoFromWorkspace(workspace) {
  if (!workspace || typeof workspace.getTopBlocks !== 'function') return EMPTY_SKETCH
  const gen = arduinoGenerator
  gen.init(workspace)

  const topBlocks = workspace.getTopBlocks(true)
  const programs = topBlocks.filter((b) => b.type === 'arduino_program' && !b.isInsertionMarker?.())
  const definitions = topBlocks.filter((b) => b.type === 'procedures_defnoreturn' || b.type === 'procedures_defreturn')

  // Functions first: they may pull in includes/globals that the hoisted section must show.
  const functions = definitions.map((block) => {
    const code = gen.blockToCode(block, true)
    return (typeof code === 'string' ? code : code[0]).replace(/\n+$/, '')
  })

  let setupBody = ''
  let loopBody = ''
  for (const program of programs) {
    setupBody += gen.statementToCode(program, 'SETUP')
    loopBody += gen.statementToCode(program, 'LOOP')
  }

  // Loose statement stacks (a user dragging blocks outside the sketch frame) still run in loop().
  for (const block of topBlocks) {
    if (block === null) continue
    if (block.type === 'arduino_program') continue
    if (block.type === 'procedures_defnoreturn' || block.type === 'procedures_defreturn') continue
    if (!block.previousConnection && !block.nextConnection) continue
    const code = gen.blockToCode(block)
    const text = typeof code === 'string' ? code : code[0]
    loopBody += gen.prefixLines(text.replace(/\n+$/, ''), gen.INDENT) + '\n'
  }

  const setupTail = gen.setupTail.map((line) => gen.INDENT + line).join('\n')
  const loopHead = gen.loopHead.map((line) => gen.INDENT + line).join('\n')
  const fullSetup = [setupBody.replace(/\n+$/, ''), setupTail].filter(Boolean).join('\n')
  const fullLoop = [loopHead, loopBody.replace(/\n+$/, '')].filter(Boolean).join('\n')

  const sections = []
  const includes = INCLUDE_ORDER.filter((name) => gen.includes.has(name))
  for (const name of [...gen.includes].sort()) if (!includes.includes(name)) includes.push(name)
  if (includes.length) sections.push(includes.map((name) => `#include <${name}>`).join('\n'))
  if (gen.libGlobals.length) sections.push(gen.libGlobals.join('\n'))

  const variables = declareVariables(workspace, gen)
  if (variables.length) sections.push(variables.join('\n'))
  for (const fn of functions) sections.push(fn)

  sections.push(wrapFunction('void setup()', fullSetup ? `${fullSetup}\n` : ''))
  sections.push(wrapFunction('void loop()', fullLoop ? `${fullLoop}\n` : ''))

  return `${sections.map((s) => s.replace(/\n+$/, '')).join('\n\n')}\n`
}

export default generateArduinoFromWorkspace
