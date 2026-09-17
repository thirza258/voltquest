/** A small MATLAB grammar. Source is parsed, never translated to host JavaScript. */
export function parse(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > 32768) throw new Error('Keep MATLAB scripts within 32 KiB.')
  const tokens = []
  let i = 0, line = 1, gap = false
  const push = (type, value) => { tokens.push({ type, value, line, gap }); gap = false }
  while (i < source.length) {
    const c = source[i]
    if (c === '\r' || c === ' ' || c === '\t') { i++; gap = true; continue }
    if (c === '%' || source.slice(i, i + 3) === '...') {
      const continuation = c !== '%'
      while (i < source.length && source[i] !== '\n') i++
      if (continuation && source[i] === '\n') { i++; line++ }
      gap = true; continue
    }
    if (c === '\n') { push('sep', '\n'); line++; i++; continue }
    const previous = tokens.at(-1)
    const transpose = c === "'" && !gap && previous && (['number', 'id'].includes(previous.type) || [')', ']', "'", ".'"].includes(previous.value))
    if (c === '"' || (c === "'" && !transpose)) {
      const quote = c; let value = ''; i++
      while (i < source.length) {
        if (source[i] === quote) { if (source[i + 1] === quote) { value += quote; i += 2; continue } break }
        if (source[i] === '\n') throw new Error(`Line ${line}: close the string before the next line.`)
        value += source[i++]
      }
      if (source[i] !== quote) throw new Error(`Line ${line}: unterminated string.`)
      i++; push('string', value); continue
    }
    const number = source.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)
    if (number) {
      // In 2.*x the dot belongs to the operator, not the numeric literal.
      let raw = number[0]
      if (raw.endsWith('.') && /[*/^\\']/.test(source[i + raw.length] ?? ' ')) raw = raw.slice(0, -1)
      push('number', Number(raw)); i += raw.length; continue
    }
    const name = source.slice(i).match(/^[A-Za-z][A-Za-z0-9_]*/)
    if (name) { push('id', name[0]); i += name[0].length; continue }
    const pair = source.slice(i, i + 2)
    if (['.*', './', '.^', '.\\', ".'", '<=', '>=', '==', '~=', '&&', '||'].includes(pair)) { push('op', pair); i += 2; continue }
    if ('+-*/\\^<>&|~=:,;()[]@\''.includes(c)) { push(c === ';' ? 'sep' : 'op', c); i++; continue }
    throw new Error(`Line ${line}: unsupported character ${JSON.stringify(c)}. This sandbox accepts numerical MATLAB-style scripts.`)
  }
  if (tokens.length > 12000) throw new Error('The script has too many tokens. Split it into smaller experiments.')
  tokens.push({ type: 'eof', value: 'EOF', line })
  let pos = 0, depth = 0
  const peek = () => tokens[pos] ?? tokens.at(-1)
  const take = () => tokens[pos++]
  const fail = message => { throw new Error(`Line ${peek().line}: ${message}`) }
  const accept = value => peek().value === value ? take() : null
  const need = value => { if (!accept(value)) fail(`expected ${value}, found ${peek().value}.`) }
  const separators = () => { while (peek().type === 'sep' || peek().value === ',') take() }
  const newline = () => { while (peek().value === '\n') take() }
  const precedence = { '||': 1, '&&': 2, '|': 3, '&': 4, '==': 5, '~=': 5, '<': 5, '>': 5, '<=': 5, '>=': 5, ':': 6, '+': 7, '-': 7, '*': 8, '/': 8, '\\': 8, '.*': 8, './': 8, '.\\': 8, '^': 10, '.^': 10 }
  function expression(min = 0, inMatrix = false) {
    if (++depth > 64) fail('expression nesting exceeds 64 levels.')
    const token = take(); let node
    if (token.type === 'number' || token.type === 'string') node = { type: token.type, value: token.value }
    else if (['+', '-', '~'].includes(token.value)) node = { type: 'unary', op: token.value, value: expression(9, inMatrix) }
    else if (token.value === '(') { newline(); node = expression(); newline(); need(')') }
    else if (token.value === ':') node = { type: 'all' }
    else if (token.value === '@') {
      need('('); const params = []
      do { const param = take(); if (param.type !== 'id') fail('anonymous function parameters must be names.'); params.push(param.value) } while (accept(','))
      need(')')
      if (new Set(params).size !== params.length) fail('function parameters must be distinct.')
      node = { type: 'lambda', params, body: expression(0, inMatrix) }
    } else if (token.value === '[') {
      const rows = []; let row = []
      while (!accept(']')) {
        if (peek().type === 'eof') fail('close the array with ].')
        if (peek().type === 'sep') { take(); if (row.length) { rows.push(row); row = [] } continue }
        row.push(expression(0, true))
        if (accept(',')) continue
        if (peek().value !== ']' && peek().type !== 'sep' && !peek().gap) fail('separate array elements with spaces or commas.')
      }
      if (row.length) rows.push(row)
      node = { type: 'array', rows }
    } else if (token.type === 'id') node = { type: 'name', name: token.value }
    else fail(`expected a numerical expression, found ${token.value}.`)
    while (true) {
      if (peek().value === '(' && node.type === 'name') {
        take(); newline(); const args = []
        if (!accept(')')) { do { newline(); args.push(expression()); newline() } while (accept(',')); need(')') }
        node = { type: 'call', name: node.name, args }; continue
      }
      if (["'", ".'"].includes(peek().value)) { take(); node = { type: 'transpose', value: node }; continue }
      const op = peek().value, power = precedence[op]
      if (power === undefined || power < min) break
      // MATLAB [1 -2] is two elements, while [1 - 2] is subtraction.
      if (inMatrix && ['+', '-'].includes(op) && peek().gap && !tokens[pos + 1]?.gap) break
      take()
      const right = expression(power + 1, inMatrix)
      if (op === ':') {
        node = accept(':') ? { type: 'range', start: node, step: right, end: expression(power + 1, inMatrix) }
          : { type: 'range', start: node, end: right }
      } else node = { type: 'binary', op, left: node, right }
    }
    depth--; return node
  }
  function block(level = 0) {
    if (level > 32) fail('control nesting exceeds 32 levels.')
    const statements = []; separators()
    while (peek().type !== 'eof' && !['end', 'else', 'elseif'].includes(peek().value)) {
      const start = peek(); let node
      if (['for', 'while', 'if'].includes(start.value)) {
        take()
        if (start.value === 'for') {
          const name = take(); if (name.type !== 'id') fail('a for loop needs a variable name.')
          need('='); const values = expression(); separatorRequired()
          node = { type: 'for', name: name.value, values, body: block(level + 1) }
        } else if (start.value === 'while') {
          const condition = expression(); separatorRequired(); node = { type: 'while', condition, body: block(level + 1) }
        } else {
          const condition = expression(); separatorRequired()
          const branches = [{ condition, body: block(level + 1) }]
          while (accept('elseif')) { const condition = expression(); separatorRequired(); branches.push({ condition, body: block(level + 1) }) }
          let otherwise = []
          if (accept('else')) { separatorRequired(); otherwise = block(level + 1) }
          node = { type: 'if', branches, otherwise }
        }
        need('end')
      } else if (['break', 'continue', 'clear', 'clc'].includes(start.value)) {
        take(); node = { type: start.value }
        if (accept('(')) need(')')
      } else {
        const left = expression()
        if (accept('=')) {
          if (!['name', 'call'].includes(left.type)) fail('assign to a name or existing array indices; multiple outputs are desktop-only.')
          node = { type: 'assign', target: left, value: expression() }
        } else node = { type: 'expression', value: left }
      }
      node.line = start.line; node.silent = peek().value === ';'
      statements.push(node)
      if (peek().type !== 'eof') separatorRequired()
      separators()
    }
    return statements
  }
  function separatorRequired() {
    if (peek().type !== 'sep' && peek().value !== ',') fail('separate statements and block headers with a newline or semicolon.')
    separators()
  }
  const ast = block()
  if (peek().type !== 'eof') fail(`unexpected ${peek().value}.`)
  return ast
}
