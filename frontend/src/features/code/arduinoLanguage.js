/**
 * Monaco language support for the Arduino C++ subset (package H2).
 *
 * Pure data plus two registration helpers, kept out of `MonacoEditor.jsx` so the Monarch rules and
 * the formatter can be reasoned about (and reused) without mounting an editor.
 * The keyword/identifier lists mirror the interpreter subset in CONTRACTS §6 and the runtime API in
 * §7.4 — anything highlighted here actually runs.
 */

export const LANGUAGE_ID = 'arduino'
export const THEME_ID = 'voltquest-light'

/** C/C++ control and storage keywords supported by the interpreter. */
export const KEYWORDS = [
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'goto', 'sizeof', 'struct', 'enum', 'typedef', 'class', 'public', 'private', 'new', 'delete',
  'const', 'static', 'volatile', 'extern', 'inline', 'PROGMEM', 'F',
]

/** Types the interpreter understands (CONTRACTS §6). */
export const TYPES = [
  'void', 'bool', 'boolean', 'char', 'byte', 'word', 'int', 'unsigned', 'short', 'long', 'float',
  'double', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t', 'int32_t', 'size_t', 'String',
  'IPAddress', 'Servo', 'LiquidCrystal_I2C', 'Adafruit_NeoPixel', 'Adafruit_SSD1306', 'Adafruit_BME280',
  'DHT', 'WebServer', 'WiFiClient', 'PubSubClient',
]

/** Constants exported by the runtime. */
export const CONSTANTS = [
  'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'INPUT_PULLDOWN', 'LED_BUILTIN', 'true', 'false',
  'PI', 'HALF_PI', 'TWO_PI', 'DEG_TO_RAD', 'RAD_TO_DEG', 'RISING', 'FALLING', 'CHANGE',
  'DEC', 'HEX', 'OCT', 'BIN', 'NULL', 'nullptr',
  'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
  'T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9',
  'WL_CONNECTED', 'WL_NO_SSID_AVAIL', 'WL_IDLE_STATUS', 'WL_CONNECT_FAILED', 'WL_DISCONNECTED',
  'WIFI_STA', 'WIFI_AP', 'HTTP_GET', 'HTTP_POST', 'HTTP_ANY',
  'DHT11', 'DHT22', 'WHITE', 'BLACK', 'SSD1306_WHITE',
  'ADC_0db', 'ADC_2_5db', 'ADC_6db', 'ADC_11db',
]

/** Arduino core + library functions, highlighted so a typo is visible before pressing Run. */
export const API_FUNCTIONS = [
  'setup', 'loop', 'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite',
  'analogReadResolution', 'analogWriteResolution', 'delay', 'delayMicroseconds', 'millis', 'micros',
  'tone', 'noTone', 'pulseIn', 'map', 'constrain', 'min', 'max', 'abs', 'pow', 'sqrt', 'sq', 'round',
  'floor', 'ceil', 'sin', 'cos', 'tan', 'random', 'randomSeed', 'bit', 'bitRead', 'bitWrite',
  'bitSet', 'bitClear', 'lowByte', 'highByte', 'isDigit', 'isAlpha', 'isSpace', 'attachInterrupt',
  'detachInterrupt', 'digitalPinToInterrupt', 'interrupts', 'noInterrupts', 'yield',
  'snprintf', 'sprintf', 'dtostrf', 'itoa',
  'touchRead', 'ledcSetup', 'ledcAttachPin', 'ledcWrite', 'ledcAttach', 'ledcDetach', 'dacWrite',
  'hallRead', 'esp_random', 'analogSetAttenuation', 'analogSetPinAttenuation', 'analogReadMilliVolts',
]

/** Objects that get the "library" colour when they appear before a dot. */
export const API_OBJECTS = ['Serial', 'WiFi', 'Wire', 'SPI', 'ESP', 'server', 'client']

/**
 * Monarch tokenizer for the Arduino subset. Distinguishes preprocessor lines, the Arduino API,
 * types and constants so the editor reads like the Arduino IDE without a full C++ grammar.
 */
export function arduinoMonarchLanguage() {
  return {
    defaultToken: '',
    tokenPostfix: '.ino',
    keywords: KEYWORDS,
    typeKeywords: TYPES,
    constants: CONSTANTS,
    apiFunctions: API_FUNCTIONS,
    apiObjects: API_OBJECTS,
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' },
    ],
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>='],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|[0-7]{1,3})/,
    tokenizer: {
      root: [
        [/^\s*#\s*\w+/, 'keyword.directive'],
        [/[A-Za-z_]\w*(?=\s*\()/, { cases: { '@apiFunctions': 'support.function', '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier.function' } }],
        [/[A-Za-z_]\w*/, {
          cases: {
            '@typeKeywords': 'type',
            '@keywords': 'keyword',
            '@constants': 'constant',
            '@apiObjects': 'support.class',
            '@default': 'identifier',
          },
        }],
        { include: '@whitespace' },
        [/[{}()[\]]/, '@brackets'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
        [/\d*\.\d+([eE][-+]?\d+)?[fF]?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+[uUlL]*/, 'number.hex'],
        [/0[bB][01]+/, 'number.binary'],
        [/\d+[uUlL]*/, 'number'],
        [/[;,.]/, 'delimiter'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/'[^\\']'/, 'string'],
        [/(')(@escapes)(')/, ['string', 'string.escape', 'string']],
        [/'/, 'string.invalid'],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/@escapes/, 'string.escape'],
        [/\\./, 'string.escape.invalid'],
        [/"/, 'string', '@pop'],
      ],
    },
  }
}

/** Auto-closing pairs, comment tokens and indentation rules. */
export function arduinoLanguageConfiguration() {
  return {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: '/*', close: ' */', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}"']*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  }
}

/** Light theme matching docs/DESIGN.md (ink #0F172A on panel white, teal keywords, amber constants). */
export function voltquestTheme() {
  return {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '0F172A' },
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0D9488', fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: '7C3AED' },
      { token: 'type', foreground: '0F766E' },
      { token: 'constant', foreground: 'B45309' },
      { token: 'number', foreground: 'B45309' },
      { token: 'number.float', foreground: 'B45309' },
      { token: 'number.hex', foreground: 'B45309' },
      { token: 'number.binary', foreground: 'B45309' },
      { token: 'string', foreground: '2563EB' },
      { token: 'string.escape', foreground: '1D4ED8' },
      { token: 'support.function', foreground: '1D4ED8' },
      { token: 'support.class', foreground: '9333EA' },
      { token: 'identifier.function', foreground: '0F172A' },
      { token: 'identifier', foreground: '0F172A' },
      { token: 'operator', foreground: '475569' },
      { token: 'delimiter', foreground: '475569' },
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#0F172A',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#0D9488',
      'editor.lineHighlightBackground': '#F8FAFC',
      'editor.selectionBackground': '#CCFBF1',
      'editor.inactiveSelectionBackground': '#F1F5F9',
      'editorCursor.foreground': '#0D9488',
      'editorIndentGuide.background1': '#E2E8F0',
      'editorIndentGuide.activeBackground1': '#CBD5E1',
      'editorBracketMatch.background': '#CCFBF1',
      'editorBracketMatch.border': '#0D9488',
      'editorGutter.background': '#FFFFFF',
      'editorWidget.background': '#FFFFFF',
      'editorWidget.border': '#E2E8F0',
      'editorError.foreground': '#E11D48',
      'editorWarning.foreground': '#D97706',
      'editorOverviewRuler.border': '#E2E8F0',
    },
  }
}

const BLOCK_COMMENT_OPEN = /\/\*/
const BLOCK_COMMENT_CLOSE = /\*\//

/**
 * Brace-driven re-indent (Shift+Alt+F). Deliberately simple: it never reflows or reorders code, it
 * only fixes indentation, so a learner's sketch always survives a format.
 *
 * @param {string} source
 * @param {string} [indent='  ']
 * @returns {string}
 */
export function formatArduino(source, indent = '  ') {
  const lines = String(source ?? '').split('\n')
  const out = []
  let depth = 0
  let inBlockComment = false

  for (const raw of lines) {
    const line = raw.trim()
    if (inBlockComment) {
      out.push(raw.replace(/\s+$/, ''))
      if (BLOCK_COMMENT_CLOSE.test(line)) inBlockComment = false
      continue
    }
    if (line === '') {
      out.push('')
      continue
    }
    // Ignore braces that live inside strings, chars or comments when counting depth.
    const stripped = line
      .replace(/\/\/.*$/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/"([^"\\]|\\.)*"/g, '""')
      .replace(/'([^'\\]|\\.)*'/g, "''")

    const startsClosed = /^[}\])]/.test(stripped)
    const isLabel = /^(case\b|default\b|public:|private:|protected:)/.test(stripped)
    const openDelta = (stripped.match(/[{([]/g) ?? []).length - (stripped.match(/[})\]]/g) ?? []).length

    let level = depth
    if (startsClosed) level = Math.max(0, depth - 1)
    else if (isLabel) level = Math.max(0, depth - 1)
    if (line.startsWith('#')) level = 0

    out.push(level > 0 ? indent.repeat(level) + line : line)
    depth = Math.max(0, depth + openDelta)
    if (BLOCK_COMMENT_OPEN.test(line) && !BLOCK_COMMENT_CLOSE.test(line)) inBlockComment = true
  }

  return out.join('\n')
}

/**
 * Register the language, its configuration and the theme on a Monaco namespace. Idempotent.
 * @param {object} monaco the `monaco-editor` namespace
 */
export function registerArduinoLanguage(monaco) {
  if (!monaco?.languages) return
  const known = monaco.languages.getLanguages?.() ?? []
  if (!known.some((l) => l.id === LANGUAGE_ID)) {
    monaco.languages.register({ id: LANGUAGE_ID, extensions: ['.ino', '.cpp', '.h'], aliases: ['Arduino', 'arduino'] })
    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, arduinoMonarchLanguage())
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, arduinoLanguageConfiguration())
    monaco.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, {
      provideDocumentFormattingEdits(model) {
        return [{ range: model.getFullModelRange(), text: formatArduino(model.getValue()) }]
      },
    })
  }
  monaco.editor.defineTheme(THEME_ID, voltquestTheme())
}

/**
 * Turn engine diagnostics (CONTRACTS §6 `Diagnostic { line, col, message, severity }`) into Monaco
 * markers. Lines are 1-based in both worlds; a missing column marks the whole line.
 */
export function diagnosticsToMarkers(diagnostics, monaco, model) {
  if (!Array.isArray(diagnostics) || !monaco?.MarkerSeverity) return []
  const lineCount = model?.getLineCount?.() ?? Number.MAX_SAFE_INTEGER
  return diagnostics.map((d) => {
    const line = Math.min(Math.max(1, Number(d.line) || 1), lineCount)
    const col = Math.max(1, Number(d.col) || 1)
    const endCol = model?.getLineMaxColumn ? model.getLineMaxColumn(line) : col + 1
    return {
      severity: d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
      message: d.message ?? 'Error',
      startLineNumber: line,
      startColumn: col,
      endLineNumber: line,
      endColumn: Math.max(col + 1, endCol),
      source: 'VoltQuest',
    }
  })
}
