const PRECEDENCE = { or: 1, and: 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 }
const OPERATORS = { or: '||', and: '&&' }
const TYPES = { LED: 'PiLED', PWMLED: 'PiPWMLED', Button: 'PiButton' }
const SIGNATURES = {
  PiLED: [['pin', 'active_high', 'initial_value'], [null, 'true', 'false']],
  PiPWMLED: [['pin', 'active_high', 'initial_value', 'frequency'], [null, 'true', '0', '100']],
  PiButton: [['pin', 'pull_up'], [null, 'true']],
  'PiGPIO.setup': [['channel', 'direction', 'pull_up_down', 'initial'], [null, null, 'PiGPIO.PUD_OFF', '-1']],
}

export function translatePython(source) {
  const aliases = new Map()
  const variables = new Map()
  const declarations = []
  const output = []
  const lineMap = []
  const blocks = []
  let pendingBlock = false
  let line = 1
  let rangeId = 0
  const fail = (message) => { throw { line, col: 1, severity: 'error', message } }
  const emit = (code) => { output.push(code); lineMap.push(line) }

  function tokenize(text) {
    const tokens = []
    let offset = 0
    while (offset < text.length) {
      const rest = text.slice(offset)
      if (/^\s/.test(rest)) { offset += 1; continue }
      if (rest[0] === '#') break
      const string = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/.exec(rest)
      const number = /^(?:0[xX][\da-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/.exec(rest)
      const name = /^[A-Za-z_]\w*/.exec(rest)
      const operator = /^(?:==|!=|<=|>=|\+=|-=|\*=|\/=|[+*/%<>=(),.:-])/.exec(rest)
      const match = string ?? number ?? name ?? operator
      if (!match) fail(`Unsupported Python syntax near '${rest.slice(0, 16)}'. See docs/RASPBERRY_PI.md.`)
      let value = match[0]
      if (string) {
        const content = value.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, character) => ({ n: '\n', r: '\r', t: '\t' }[character] ?? character))
        if (/\\/.test(content.replace(/\\\\/g, ''))) fail('Unsupported string escape')
        value = JSON.stringify(content)
      }
      tokens.push({ value, type: string ? 'String' : number ? 'double' : 'token' })
      offset += match[0].length
    }
    return tokens
  }

  function expression(tokens) {
    let cursor = 0
    const peek = () => tokens[cursor]?.value
    const take = () => tokens[cursor++]
    const expect = (value) => { if (take()?.value !== value) fail(`Expected '${value}'`) }
    function primary() {
      const token = take()
      if (!token) fail('Expected an expression')
      if (token.type !== 'token') return { code: token.type === 'double' && Number.isInteger(Number(token.value)) ? `${Number(token.value)}.0` : token.value, type: token.type }
      if (token.value === '(') { const value = binary(0); expect(')'); return { ...value, code: `(${value.code})` } }
      if (['not', '-', '+'].includes(token.value)) {
        const value = binary(token.value === 'not' ? 3 : 7)
        return { code: `${token.value === 'not' ? '!' : token.value}(${value.code})`, type: token.value === 'not' ? 'bool' : value.type }
      }
      if (token.value === 'True' || token.value === 'False') return { code: token.value.toLowerCase(), type: 'bool' }
      const builtin = { print: '__pythonPrint', int: '__pythonInt', float: '__pythonFloat', str: '__pythonStr', abs: 'abs', min: 'min', max: 'max' }
      let code = aliases.get(token.value) ?? (variables.has(token.value) ? token.value : builtin[token.value])
      if (!code) fail(`Name '${token.value}' is not defined in the supported Python subset`)
      let type = variables.get(token.value) ?? 'double'
      while (peek() === '.' || peek() === '(') {
        if (peek() === '.') {
          take()
          const member = take()?.value
          if (!member || !/^[A-Za-z]\w*$/.test(member)) fail('Expected a public attribute name')
          if (code === 'PiZero') {
            code = TYPES[member]
            if (!code) fail(`gpiozero.${member} is not supported`)
          } else if (['value', 'is_pressed', 'is_lit', 'is_active'].includes(member)) {
            code += member === 'value' ? '.read()' : '.isActive()'
            type = member === 'value' ? 'double' : 'bool'
          } else code += `.${member}`
        } else {
          take()
          const args = []
          const named = new Map()
          let hasNamed = false
          while (peek() !== ')') {
            if (tokens[cursor + 1]?.value === '=') {
              const name = take().value
              take()
              if (named.has(name)) fail(`Duplicate argument '${name}'`)
              named.set(name, binary(0).code)
              hasNamed = true
            } else {
              if (hasNamed) fail('Positional arguments must precede keyword arguments')
              args.push(binary(0).code)
            }
            if (peek() !== ',') break
            take()
          }
          expect(')')
          const signature = SIGNATURES[code]
          if (signature) {
            const [names, defaults] = signature
            if (args.length > names.length) fail(`Too many arguments for ${code}`)
            for (const [name, value] of named) {
              const index = names.indexOf(name)
              if (index < 0 || index < args.length) fail(`Unexpected or duplicate argument '${name}'`)
              args[index] = value
            }
            for (let index = 0; index < names.length; index++) {
              if (args[index] === undefined) args[index] = defaults[index]
              if (args[index] === null) fail(`Missing argument '${names[index]}'`)
            }
          } else if (named.size) fail(`Keyword arguments are not supported for ${code}`)
          if (Object.values(TYPES).includes(code) || code === 'PiGPIO.PWM') return { deviceClass: code === 'PiGPIO.PWM' ? 'PiPWM' : code, args, code: '', type: 'object' }
          code += `(${args.join(', ')})`
        }
      }
      return { code, type }
    }
    function binary(minimum) {
      let left = primary()
      while ((PRECEDENCE[peek()] ?? -1) >= minimum) {
        const operator = take().value
        const right = binary(PRECEDENCE[operator] + 1)
        const boolean = PRECEDENCE[operator] <= 4
        left = { code: `(${left.code} ${OPERATORS[operator] ?? operator} ${right.code})`, type: boolean ? 'bool' : left.type === 'String' || right.type === 'String' ? 'String' : 'double' }
      }
      return left
    }
    const result = binary(0)
    if (cursor !== tokens.length) fail(`Unexpected '${peek()}'`)
    return result
  }

  try {
    const lines = String(source).split('\n')
    for (let index = 0; index < lines.length; index++) {
      line = index + 1
      const raw = lines[index]
      if (/^\s*$/.test(raw) || /^\s*#/.test(raw)) continue
      if (/^\s*\t/.test(raw)) fail('Use spaces for Python indentation')
      const indent = raw.length - raw.trimStart().length
      const previousIndent = blocks.at(-1) ?? 0
      if (pendingBlock) {
        if (indent <= previousIndent) fail('Expected an indented block')
        blocks.push(indent)
        pendingBlock = false
      } else {
        while (blocks.length && indent < blocks.at(-1)) { blocks.pop(); emit('}') }
        if (indent !== (blocks.at(-1) ?? 0)) fail('Unexpected indentation')
      }
      const text = raw.trim()
      const imported = /^import (RPi\.GPIO|gpiozero|time)(?: as ([A-Za-z_]\w*))?$/.exec(text)
      const fromImport = /^from (gpiozero|time) import ([A-Za-z_, ]+)$/.exec(text)
      if (imported) {
        const [, module, alias] = imported
        aliases.set(alias ?? module, module === 'RPi.GPIO' ? 'PiGPIO' : module === 'time' ? 'PiTime' : 'PiZero')
        if (module === 'RPi.GPIO' && !alias) fail('Use import RPi.GPIO as GPIO')
        continue
      }
      if (fromImport) {
        for (const name of fromImport[2].split(',').map((item) => item.trim())) {
          const target = fromImport[1] === 'gpiozero' ? TYPES[name] : name === 'sleep' ? '__pythonSleep' : null
          if (!target) fail(`Unsupported import '${name}' from ${fromImport[1]}`)
          aliases.set(name, target)
        }
        continue
      }
      if (/^(import|from)\b/.test(text)) fail('Only gpiozero, RPi.GPIO and time imports are supported; Linux and external packages are not simulated')
      const tokens = tokenize(text)
      const keyword = tokens[0]?.value
      if (['while', 'if', 'elif', 'else'].includes(keyword)) {
        if (tokens.at(-1)?.value !== ':') fail("Expected ':'")
        const condition = keyword === 'else' ? '' : ` (${expression(tokens.slice(1, -1)).code})`
        emit(`${keyword === 'elif' ? 'else if' : keyword}${condition} {`)
        pendingBlock = true
      } else if (keyword === 'for') {
        const match = /^for ([A-Za-z_]\w*) in range\((.*)\):$/.exec(text)
        if (!match) fail('Only for loops over range(...) are supported')
        const name = match[1]
        if (name.startsWith('__') || aliases.has(name)) fail('Reserved variable name')
        const args = match[2].split(',').map((part) => expression(tokenize(part)).code)
        if (args.length < 1 || args.length > 3) fail('range expects one to three arguments')
        if (!variables.has(name)) { variables.set(name, 'double'); declarations.push(`double ${name};`) }
        const end = `__rangeEnd${rangeId}`
        const step = `__rangeStep${rangeId++}`
        emit(`double ${end} = ${args.length === 1 ? args[0] : args[1]};`)
        emit(`double ${step} = __pythonRangeStep(${args[2] ?? '1'});`)
        emit(`for (${name} = ${args.length === 1 ? '0' : args[0]}; ${step} > 0 ? ${name} < ${end} : ${name} > ${end}; ${name} += ${step}) {`)
        pendingBlock = true
      } else if (['pass', 'break', 'continue'].includes(keyword) && tokens.length === 1) {
        emit(keyword === 'pass' ? ';' : `${keyword};`)
      } else {
        const assignment = tokens.findIndex((token) => ['=', '+=', '-=', '*=', '/='].includes(token.value))
        if (assignment >= 0 && (assignment === 1 || (assignment === 3 && tokens[1].value === '.'))) {
          const name = tokens[0].value
          if (!/^[A-Za-z_]\w*$/.test(name) || name.startsWith('__') || aliases.has(name)) fail('Invalid or reserved assignment target')
          const operator = tokens[assignment].value
          const value = expression(tokens.slice(assignment + 1))
          if (assignment === 3) {
            if (!variables.has(name) || tokens[2].value !== 'value' || operator !== '=') fail('Only device.value = expression is supported for attribute assignment')
            emit(`${name}.write(${value.code});`)
          } else if (value.deviceClass) {
            if (variables.has(name) || operator !== '=') fail('Create each GPIO device once')
            variables.set(name, value.deviceClass)
            declarations.push(`${value.deviceClass} ${name};`)
            emit(`${name}.init(${value.args.join(', ')});`)
          } else {
            if (!variables.has(name)) {
              if (operator !== '=') fail(`Name '${name}' is not defined`)
              variables.set(name, value.type)
              declarations.push(`${value.type} ${name};`)
            }
            emit(`${name} ${operator} ${value.code};`)
          }
        } else {
          const value = expression(tokens)
          if (value.deviceClass) fail('Assign GPIO devices to a variable')
          emit(`${value.code};`)
        }
      }
    }
    if (pendingBlock) fail('Expected an indented block')
    while (blocks.length) { blocks.pop(); emit('}') }
    emit('__pythonDone();')
    const prefix = [...declarations, 'void setup() {']
    return { ok: true, source: [...prefix, ...output, '}', 'void loop() {}'].join('\n'), lineMap: [...prefix.map(() => 1), ...lineMap, line, line] }
  } catch (error) {
    return { ok: false, errors: [{ line: error.line ?? line, col: error.col ?? 1, severity: 'error', message: error.message }], warnings: [] }
  }
}
