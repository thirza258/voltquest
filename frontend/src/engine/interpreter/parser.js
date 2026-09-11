/**
 * Parser + resolver for the Arduino-C++ subset (CONTRACTS §6).
 *
 * Produces a plain (closure-free, serialisable) program: every identifier is already resolved to a frame slot
 * or a global slot, every expression carries its static C type, and every free identifier has been collected
 * into `globalsUsed` / `classesUsed` so the runtime can check it against the board's libraries.
 *
 * Variable references use a frame chain: `{ scope:'frame', depth, index }` walks `depth` lambda captures out
 * from the current frame; `{ scope:'global', index }` addresses the persistent global frame (which also holds
 * `static` locals).
 */

import {
  DECL_SPECIFIERS, TYPE_KEYWORDS, binaryResultType, conditionalResultType, isFloatType, isIntegerType,
  normalizeType, sizeOfType, unaryResultType,
} from './types.js'
import { STRING_METHODS } from './values.js'

/** Aborts parsing; `compile` turns it into the single reported syntax error (as the Arduino IDE does). */
class ParseError extends Error {
  constructor(message, line, col) {
    super(message)
    this.name = 'ParseError'
    this.line = line
    this.col = col
  }
}

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='])
const BINARY_PRECEDENCE = {
  '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
  '==': 6, '!=': 6,
  '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
}

/** Words that may appear between the type and the name of a declaration and carry no meaning for us. */
const IGNORED_ATTRIBUTES = new Set(['PROGMEM', 'EEMEM', 'PGM_P'])

/**
 * Parses a token stream into a program.
 * @param {object[]} tokens from {@link import('./lexer.js').tokenize}
 * @param {{ intBits?: number, knownNames?: Set<string>|string[]|null }} [options]
 *   `knownNames` — identifiers the host provides (natives/globals/classes). When given, any other free
 *   identifier becomes a "was not declared in this scope" error; when omitted, free identifiers are only
 *   reported through `globalsUsed`.
 * @returns {{ program: object|null, errors: object[], warnings: object[], classesUsed: string[], globalsUsed: string[] }}
 */
export function parse(tokens, { intBits = 16, knownNames = null } = {}) {
  const known = knownNames == null ? null : (knownNames instanceof Set ? knownNames : new Set(knownNames))
  const errors = []
  const warnings = []
  const classesUsed = new Set()
  const globalsUsed = new Set()

  let pos = 0
  let globalCount = 0
  let staticCount = 0
  const globalScope = new Map()
  const functions = []
  const functionIndex = new Map()
  const structs = new Map()
  /** Enumerators by name, plus `enum:<Name>` and `typedef:<Name>` markers for the type resolver. */
  const enumConstants = new Map()
  const typeNames = new Set()
  const globalInit = []
  /** @type {{parent: object|null, frameSize: number, blocks: Map[]}|null} */
  let fn = null
  let loopDepth = 0
  let switchDepth = 0
  let currentReturnType = 'void'

  // ---------------------------------------------------------------------------------------- token helpers

  const peek = (k = 0) => tokens[Math.min(pos + k, tokens.length - 1)]
  const at = (value, k = 0) => { const t = peek(k); return (t.type === 'punct' || t.type === 'ident') && t.value === value }
  const atIdent = (k = 0) => peek(k).type === 'ident'
  const next = () => tokens[pos++]

  function describe(t) {
    if (t.type === 'eof') return 'end of input'
    if (t.type === 'string') return `"${t.value}"`
    return String(t.value)
  }

  function fail(message, token = peek()) {
    throw new ParseError(message, token.line, token.col)
  }

  function expect(value) {
    if (at(value)) return next()
    return fail(`expected '${value}' before '${describe(peek())}'`)
  }

  function eat(value) {
    if (at(value)) { next(); return true }
    return false
  }

  function expectIdent(what = 'identifier') {
    if (!atIdent()) fail(`expected ${what} before '${describe(peek())}'`)
    return next()
  }

  // ---------------------------------------------------------------------------------------- scope helpers

  function pushFn(parent) {
    fn = { parent, frameSize: 0, blocks: [new Map()] }
    return fn
  }
  function popFn(saved) { const done = fn; fn = saved; return done }
  function pushBlock() { fn.blocks.push(new Map()) }
  function popBlock() { fn.blocks.pop() }

  /** Declares a variable in the innermost scope (a new frame slot, or a global slot at file scope). */
  function declare(name, info) {
    if (fn) {
      const index = fn.frameSize++
      const entry = { ...info, scope: 'frame', index, depth: 0 }
      fn.blocks[fn.blocks.length - 1].set(name, entry)
      return entry
    }
    const entry = { ...info, scope: 'global', index: globalCount++ }
    globalScope.set(name, entry)
    return entry
  }

  /** Declares a `static` local: a persistent global slot plus a one-shot initialisation flag. */
  function declareStatic(name, info) {
    const entry = { ...info, scope: 'global', index: globalCount++, staticId: staticCount++ }
    fn.blocks[fn.blocks.length - 1].set(name, entry)
    return entry
  }

  function lookup(name) {
    let depth = 0
    for (let s = fn; s; s = s.parent, depth++) {
      for (let b = s.blocks.length - 1; b >= 0; b--) {
        const hit = s.blocks[b].get(name)
        if (hit) return hit.scope === 'global' ? hit : { ...hit, depth }
      }
    }
    return globalScope.get(name) ?? null
  }

  // ---------------------------------------------------------------------------------------- type helpers

  /** Reads `const unsigned long`, `uint8_t`, `String`, a struct/enum name … plus any `*`/`&` suffix. */
  function parseTypeSpec() {
    let isStatic = false
    let isConst = false
    const words = []
    let tagged = false
    for (;;) {
      const t = peek()
      if (t.type !== 'ident') break
      if (t.value === 'struct' || t.value === 'enum' || t.value === 'class') {
        next()
        eat('class')
        if (atIdent()) { words.push(next().value); tagged = true }
        break
      }
      if (DECL_SPECIFIERS.has(t.value)) {
        if (t.value === 'static') isStatic = true
        if (t.value === 'const' || t.value === 'constexpr') isConst = true
        next()
        continue
      }
      if (TYPE_KEYWORDS.has(t.value) || (words.length === 0 && (typeNames.has(t.value) || isClassLikeName(t.value)))) {
        words.push(t.value)
        next()
        // `unsigned`/`signed`/`long`/`short` may be followed by more type words.
        if (!['unsigned', 'signed', 'long', 'short'].includes(t.value)) break
        continue
      }
      break
    }
    if (words.length === 0) return null
    let pointer = 0
    while (at('*')) { next(); pointer++ }
    while (at('&')) next()
    const raw = words.join(' ')
    let ctype = normalizeType(raw)
    let structName = null
    if (ctype === 'auto') ctype = 'unknown'
    if (structs.has(ctype)) { structName = ctype; ctype = 'object' }
    else if (enumConstants.has(`enum:${ctype}`)) ctype = 'int'
    else if (enumConstants.has(`typedef:${ctype}`)) ctype = enumConstants.get(`typedef:${ctype}`)
    else if ((tagged || !TYPE_KEYWORDS.has(words[0])) && !isIntegerType(ctype) && !isFloatType(ctype)
             && ctype !== 'String' && ctype !== 'void' && ctype !== 'unknown') {
      classesUsed.add(ctype)
      structName = ctype
      ctype = 'object'
    }
    let base = ctype
    if (pointer > 0) ctype = base === 'char' ? 'String' : 'array'
    return { ctype, base, pointer, isStatic, isConst, structName, name: raw }
  }

  /**
   * Folds a compile-time constant expression (array sizes, enumerators). Returns `null` when the expression is
   * not constant.
   */
  function foldConst(e) {
    if (!e) return null
    if (e.k === 'num') return e.v
    if (e.k === 'var') return e.ref?.constValue ?? null
    if (e.k === 'cast') return foldConst(e.e)
    if (e.k === 'un') {
      const v = foldConst(e.e)
      if (v === null) return null
      return e.op === '-' ? -v : e.op === '+' ? v : e.op === '~' ? ~v : v ? 0 : 1
    }
    if (e.k === 'bin') {
      const l = foldConst(e.l)
      const r = foldConst(e.r)
      if (l === null || r === null) return null
      switch (e.op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return r === 0 ? null : (isIntegerType(e.t) ? Math.trunc(l / r) : l / r)
        case '%': return r === 0 ? null : l % r
        case '<<': return l << r
        case '>>': return l >> r
        case '&': return l & r
        case '|': return l | r
        case '^': return l ^ r
        default: return null
      }
    }
    return null
  }

  /** Heuristic for `Servo s;` — a capitalised identifier that is not a variable or function is a class name. */
  function isClassLikeName(name) {
    if (TYPE_KEYWORDS.has(name)) return false
    if (lookup(name) || functionIndex.has(name) || enumConstants.has(name)) return false
    return /^[A-Za-z_]/.test(name)
  }

  /** True when the tokens at `pos` begin a declaration rather than an expression. */
  function looksLikeDeclaration() {
    let k = 0
    while (peek(k).type === 'ident' && DECL_SPECIFIERS.has(peek(k).value)) k++
    const t = peek(k)
    if (t.type !== 'ident') return false
    if (TYPE_KEYWORDS.has(t.value) || typeNames.has(t.value)) return true
    if (lookup(t.value) || functionIndex.has(t.value) || enumConstants.has(t.value)) return false
    // `Ident [*&] Ident` followed by `; = ( [ ,` — an object/variable declaration.
    let j = k + 1
    while (at('*', j) || at('&', j)) j++
    if (peek(j).type !== 'ident') return false
    if (TYPE_KEYWORDS.has(peek(j).value)) return false
    const after = peek(j + 1)
    return after.type === 'punct' && [';', '=', '(', '[', ','].includes(after.value)
  }

  // ---------------------------------------------------------------------------------------- expressions

  const num = (v, t) => ({ k: 'num', v, t })

  function parseExpression() {
    let e = parseAssign()
    while (at(',')) {
      next()
      const r = parseAssign()
      e = { k: 'comma', l: e, r, t: r.t }
    }
    return e
  }

  function parseAssign() {
    const left = parseConditional()
    const t = peek()
    if (t.type === 'punct' && ASSIGN_OPS.has(t.value)) {
      next()
      const value = parseAssign()
      requireLValue(left, 'assignment', t)
      return { k: 'assign', op: t.value, target: left, value, t: left.t }
    }
    return left
  }

  function isLValue(e) {
    return e.k === 'var' || e.k === 'index' || e.k === 'member'
  }

  /**
   * Writing to an identifier the sketch never declared is always an error, whatever the host provides —
   * it is the classic Arduino "'x' was not declared in this scope".
   */
  function requireLValue(e, what, token) {
    if (isLValue(e)) return
    if (e.k === 'free') fail(`'${e.name}' was not declared in this scope`, { line: e.line, col: e.col })
    fail(`lvalue required as left operand of ${what}`, token)
  }

  function parseConditional() {
    const c = parseBinary(1)
    if (!at('?')) return c
    next()
    const a = parseAssign()
    expect(':')
    const b = parseConditional()
    return { k: 'cond', c, a, b, t: conditionalResultType(a.t, b.t, intBits) }
  }

  function parseBinary(minPrec) {
    let left = parseUnary()
    for (;;) {
      const t = peek()
      if (t.type !== 'punct') break
      const prec = BINARY_PRECEDENCE[t.value]
      if (prec === undefined || prec < minPrec) break
      next()
      const right = parseBinary(prec + 1)
      const op = t.value
      if (op === '&&' || op === '||') left = { k: 'logical', op, l: left, r: right, t: 'bool' }
      else left = { k: 'bin', op, l: left, r: right, t: binaryResultType(op, left.t, right.t, intBits) }
    }
    return left
  }

  function parseUnary() {
    const t = peek()
    if (t.type === 'punct') {
      if (t.value === '++' || t.value === '--') {
        next()
        const e = parseUnary()
        requireLValue(e, t.value === '++' ? 'increment' : 'decrement', t)
        return { k: 'preinc', op: t.value, target: e, t: e.t }
      }
      if (['!', '~', '-', '+'].includes(t.value)) {
        next()
        const e = parseUnary()
        if (t.value === '-' && e.k === 'num') return num(-e.v, e.t)
        return { k: 'un', op: t.value, e, t: unaryResultType(t.value, e.t, intBits) }
      }
      if (t.value === '&') { next(); return parseUnary() }          // address-of: our arrays are handles already
      if (t.value === '*') {                                        // dereference: element 0 of the handle
        next()
        const e = parseUnary()
        return { k: 'index', arr: e, idx: num(0, 'int'), t: e.arrayInfo?.base ?? 'unknown' }
      }
      if (t.value === '(' && isCastAhead()) {
        next()
        const spec = parseTypeSpec()
        expect(')')
        const e = parseUnary()
        return castNode(spec.ctype, e, spec)
      }
    }
    if (t.type === 'ident' && t.value === 'sizeof') { next(); return parseSizeof() }
    return parsePostfix(parsePrimary())
  }

  /** `(int)` / `(unsigned long)` / `(const char*)` in prefix position. */
  function isCastAhead() {
    let k = 1
    while (peek(k).type === 'ident' && DECL_SPECIFIERS.has(peek(k).value)) k++
    const t = peek(k)
    if (t.type !== 'ident') return false
    if (!TYPE_KEYWORDS.has(t.value) && !typeNames.has(t.value)) return false
    while (peek(k).type === 'ident' && (TYPE_KEYWORDS.has(peek(k).value) || typeNames.has(peek(k).value))) k++
    while (at('*', k) || at('&', k)) k++
    return at(')', k)
  }

  function castNode(ctype, e, spec) {
    if (ctype === 'String') return { k: 'cast', to: 'String', e, args: [], t: 'String' }
    if (ctype === 'object' || ctype === 'array') return { k: 'cast', to: ctype, e, t: ctype, arrayInfo: e.arrayInfo }
    void spec
    return { k: 'cast', to: ctype, e, t: ctype }
  }

  function parseSizeof() {
    const start = peek()
    let inner
    if (at('(')) {
      // sizeof(type) or sizeof(expr)
      if (isTypeOnlyAhead()) {
        next()
        const spec = parseTypeSpec()
        expect(')')
        return num(spec.pointer > 0 ? sizeOfType('array', intBits) : sizeOfType(spec.ctype, intBits), 'size_t')
      }
      next()
      inner = parseExpression()
      expect(')')
    } else {
      inner = parseUnary()
    }
    return num(sizeOfExpr(inner, start), 'size_t')
  }

  function isTypeOnlyAhead() {
    let k = 1
    while (peek(k).type === 'ident' && DECL_SPECIFIERS.has(peek(k).value)) k++
    if (peek(k).type !== 'ident') return false
    if (!TYPE_KEYWORDS.has(peek(k).value) && !typeNames.has(peek(k).value)) return false
    while (peek(k).type === 'ident' && (TYPE_KEYWORDS.has(peek(k).value) || typeNames.has(peek(k).value) || DECL_SPECIFIERS.has(peek(k).value))) k++
    while (at('*', k) || at('&', k)) k++
    return at(')', k)
  }

  /** `sizeof(a) / sizeof(a[0])` is the idiom that has to work; arrays carry their dimensions for it. */
  function sizeOfExpr(e, token) {
    if (e.arrayInfo) {
      const { base, dims } = e.arrayInfo
      if (dims.some((d) => d == null)) {
        warnings.push({ line: token.line, col: token.col, message: 'sizeof on an array of unknown size', severity: 'warning' })
        return sizeOfType('array', intBits)
      }
      return dims.reduce((a, b) => a * b, 1) * sizeOfType(base, intBits)
    }
    return sizeOfType(e.t, intBits)
  }

  function parsePostfix(e) {
    for (;;) {
      if (at('[')) {
        next()
        const idx = parseExpression()
        expect(']')
        const info = e.arrayInfo
        const t = info ? (info.dims.length > 1 ? 'array' : info.base) : (e.t === 'String' ? 'char' : 'unknown')
        const node = { k: 'index', arr: e, idx, t }
        if (info?.structName) node.structName = info.structName
        if (info && info.dims.length > 1) node.arrayInfo = { base: info.base, dims: info.dims.slice(1), structName: info.structName }
        e = node
        continue
      }
      if (at('(')) {
        const args = parseArgs()
        e = makeCall(e, args)
        continue
      }
      if (at('.') || at('->')) {
        next()
        const name = expectIdent('member name').value
        if (at('(')) {
          const args = parseArgs()
          e = makeMemberCall(e, name, args)
        } else {
          e = { k: 'member', obj: e, name, t: memberType(e, name) }
        }
        continue
      }
      if (at('++') || at('--')) {
        const op = next().value
        requireLValue(e, 'increment', peek())
        e = { k: 'postinc', op, target: e, t: e.t }
        continue
      }
      break
    }
    return e
  }

  function memberType(obj, name) {
    if (obj.structName && structs.has(obj.structName)) {
      const f = structs.get(obj.structName).fields.find((x) => x.name === name)
      if (f) return f.ctype
    }
    return 'unknown'
  }

  function parseArgs() {
    expect('(')
    const args = []
    if (!at(')')) {
      do { args.push(parseAssign()) } while (eat(','))
    }
    expect(')')
    return args
  }

  function makeCall(callee, args) {
    if (callee.k === 'typeref') {
      // Functional cast: int(x), byte(x), String(x), String(f, 2)
      if (callee.ctype === 'String') return { k: 'cast', to: 'String', e: args[0] ?? num(0, 'int'), args: args.slice(1), t: 'String' }
      return { k: 'cast', to: callee.ctype, e: args[0] ?? num(0, 'int'), t: callee.ctype }
    }
    if (callee.k === 'fnref') {
      const f = functions[callee.index]
      f.used = true
      return { k: 'call', target: { kind: 'func', index: callee.index }, args, t: f.returnType }
    }
    if (callee.k === 'free') {
      if (callee.name === 'F' || callee.name === 'PSTR' || callee.name === 'FPSTR') {
        globalsUsed.delete(callee.name)
        return args[0] ?? num(0, 'int')   // F("x") is a no-op for us
      }
      return { k: 'call', target: { kind: 'native', name: callee.name }, args, t: 'unknown' }
    }
    return { k: 'call', target: { kind: 'value', expr: callee }, args, t: 'unknown' }
  }

  function makeMemberCall(obj, name, args) {
    if (obj.k === 'free') {
      classesUsed.add(obj.name)
      return { k: 'mcall', owner: obj.name, obj: null, name, args, t: 'unknown' }
    }
    const t = obj.t === 'String' ? (STRING_METHODS[name]?.returns ?? 'unknown') : 'unknown'
    return { k: 'mcall', owner: null, obj, name, args, t }
  }

  function parsePrimary() {
    const t = peek()
    if (t.type === 'number') { next(); return num(t.value, t.ctype) }
    if (t.type === 'string') { next(); return { k: 'str', v: t.value, t: 'String' } }
    if (at('(')) {
      next()
      const e = parseExpression()
      expect(')')
      return e
    }
    if (at('[')) return parseLambda()
    if (t.type === 'ident') {
      if (t.value === 'true') { next(); return num(1, 'bool') }
      if (t.value === 'false') { next(); return num(0, 'bool') }
      if (t.value === 'nullptr' || t.value === 'NULL') { next(); return num(0, 'int') }
      if (t.value === 'new' || t.value === 'delete') fail(`'${t.value}' is not supported in VoltQuest sketches`)
      if ((TYPE_KEYWORDS.has(t.value) || typeNames.has(t.value)) && at('(', 1)) {
        next()
        const ctype = normalizeType(t.value)
        return { k: 'typeref', ctype: structs.has(ctype) ? 'object' : ctype, t: ctype }
      }
      next()
      const local = lookup(t.value)
      if (local) {
        const node = { k: 'var', ref: local, name: t.value, t: local.ctype, structName: local.structName }
        if (local.dims) node.arrayInfo = { base: local.base ?? local.ctype, dims: local.dims, structName: local.structName }
        return node
      }
      if (enumConstants.has(t.value)) return num(enumConstants.get(t.value), 'int')
      if (functionIndex.has(t.value)) {
        const index = functionIndex.get(t.value)
        if (!at('(')) functions[index].used = true
        return { k: 'fnref', index, t: 'function' }
      }
      globalsUsed.add(t.value)
      if (known && !known.has(t.value)) {
        errors.push({ line: t.line, col: t.col, message: `'${t.value}' was not declared in this scope`, severity: 'error' })
      }
      return { k: 'free', name: t.value, t: 'unknown', line: t.line, col: t.col }
    }
    return fail(`expected expression before '${describe(t)}'`)
  }

  function parseLambda() {
    const start = expect('[')
    let byValue = true
    if (at('&')) { next(); byValue = false }
    else if (at('=')) { next(); byValue = true }
    if (!at(']')) fail('only [], [&] and [=] lambda captures are supported', start)
    expect(']')
    const saved = fn
    const scope = pushFn(saved)
    const params = []
    expect('(')
    if (!at(')')) {
      do {
        const spec = parseTypeSpec() ?? { ctype: 'unknown', base: 'unknown', pointer: 0 }
        const nameTok = atIdent() ? next() : null
        const dims = parseArrayDims()
        const info = { ctype: dims ? 'array' : spec.ctype, base: dims ? spec.ctype : spec.base, structName: spec.structName }
        if (dims) info.dims = dims
        const entry = declare(nameTok ? nameTok.value : `__arg${params.length}`, info)
        params.push({ name: nameTok?.value ?? '', ctype: info.ctype, index: entry.index })
      } while (eat(','))
    }
    expect(')')
    if (eat('->')) parseTypeSpec()
    const savedReturn = currentReturnType
    currentReturnType = 'unknown'
    const body = parseBlock()
    currentReturnType = savedReturn
    popFn(saved)
    const index = functions.length
    functions.push({ name: '<lambda>', returnType: 'unknown', params, body, frameSize: scope.frameSize, isLambda: true })
    return { k: 'lambda', index, byValue, t: 'function' }
  }

  // ---------------------------------------------------------------------------------------- statements

  function parseBlock() {
    expect('{')
    pushBlock()
    const body = []
    while (!at('}') && peek().type !== 'eof') body.push(parseStatement())
    popBlock()
    expect('}')
    return body
  }

  function parseStatement() {
    const t = peek()
    const line = t.line
    if (at('{')) return { k: 'block', body: parseBlock(), line }
    if (at(';')) { next(); return { k: 'empty', line } }

    if (t.type === 'ident') {
      switch (t.value) {
        case 'if': return parseIf()
        case 'for': return parseFor()
        case 'while': return parseWhile()
        case 'do': return parseDo()
        case 'switch': return parseSwitch()
        case 'return': {
          next()
          const e = at(';') ? null : parseExpression()
          expect(';')
          return { k: 'return', e, rtype: currentReturnType, line }
        }
        case 'break': {
          next()
          if (loopDepth === 0 && switchDepth === 0) fail('break statement not within loop or switch', t)
          expect(';')
          return { k: 'break', line }
        }
        case 'continue': {
          next()
          if (loopDepth === 0) fail('continue statement not within a loop', t)
          expect(';')
          return { k: 'continue', line }
        }
        case 'struct': case 'enum': case 'class': case 'typedef':
          return parseTypeDeclaration()
        default: break
      }
      if (looksLikeDeclaration()) return parseDeclaration(line)
    }
    const e = parseExpression()
    expect(';')
    return { k: 'expr', e, line }
  }

  function parseIf() {
    const line = next().line
    expect('(')
    const c = parseExpression()
    expect(')')
    const then = parseStatement()
    let alt = null
    if (at('else')) { next(); alt = parseStatement() }
    return { k: 'if', c, then, alt, line }
  }

  function parseWhile() {
    const line = next().line
    expect('(')
    const c = parseExpression()
    expect(')')
    loopDepth++
    const body = parseStatement()
    loopDepth--
    return { k: 'while', c, body, line }
  }

  function parseDo() {
    const line = next().line
    loopDepth++
    const body = parseStatement()
    loopDepth--
    if (!at('while')) fail(`expected 'while' before '${describe(peek())}'`)
    next()
    expect('(')
    const c = parseExpression()
    expect(')')
    expect(';')
    return { k: 'do', body, c, line }
  }

  function parseFor() {
    const line = next().line
    expect('(')
    pushBlockIfFn()
    let init = null
    if (!at(';')) {
      if (looksLikeDeclaration()) init = parseDeclaration(line)
      else { init = { k: 'expr', e: parseExpression(), line }; expect(';') }
    } else next()
    const cond = at(';') ? null : parseExpression()
    expect(';')
    const step = at(')') ? null : parseExpression()
    expect(')')
    loopDepth++
    const body = parseStatement()
    loopDepth--
    popBlockIfFn()
    return { k: 'for', init, cond, step, body, line }
  }

  function pushBlockIfFn() { if (fn) pushBlock() }
  function popBlockIfFn() { if (fn) popBlock() }

  function parseSwitch() {
    const line = next().line
    expect('(')
    const disc = parseExpression()
    expect(')')
    expect('{')
    pushBlockIfFn()
    switchDepth++
    const body = []
    const cases = []
    let defaultIndex = -1
    while (!at('}') && peek().type !== 'eof') {
      if (at('case')) {
        next()
        const value = parseConditional()
        expect(':')
        cases.push({ value, index: body.length })
        continue
      }
      if (at('default')) {
        next()
        expect(':')
        defaultIndex = body.length
        continue
      }
      body.push(parseStatement())
    }
    switchDepth--
    popBlockIfFn()
    expect('}')
    return { k: 'switch', disc, cases, defaultIndex, body, line }
  }

  /** `struct P { int x; };`, `enum Color { RED, GREEN };`, `typedef unsigned char u8;` */
  function parseTypeDeclaration() {
    const kw = next()
    const line = kw.line
    if (kw.value === 'typedef') {
      const spec = parseTypeSpec()
      const alias = expectIdent('type name').value
      parseArrayDims()
      expect(';')
      typeNames.add(alias)
      if (spec && structs.has(spec.structName)) structs.set(alias, structs.get(spec.structName))
      else if (spec) enumConstants.set(`typedef:${alias}`, spec.ctype)
      return { k: 'empty', line }
    }
    if (kw.value === 'enum') {
      eat('class')
      const name = atIdent() && !at('{') ? next().value : null
      if (name) { typeNames.add(name); enumConstants.set(`enum:${name}`, true) }
      if (eat('{')) {
        let value = 0
        while (!at('}') && peek().type !== 'eof') {
          const id = expectIdent('enumerator').value
          if (eat('=')) {
            const tok = peek()
            const folded = foldConst(parseConditional())
            if (folded === null) fail('enumerator value must be a constant expression', tok)
            value = Math.trunc(folded)
          }
          enumConstants.set(id, value)
          value++
          if (!eat(',')) break
        }
        expect('}')
      }
      const varName = atIdent() ? next().value : null
      expect(';')
      if (varName) declare(varName, { ctype: 'int' })
      return { k: 'empty', line }
    }
    // struct / class
    const name = atIdent() ? next().value : `__anon${structs.size}`
    typeNames.add(name)
    const fields = []
    if (eat('{')) {
      while (!at('}') && peek().type !== 'eof') {
        const spec = parseTypeSpec()
        if (!spec) fail(`expected member type before '${describe(peek())}'`)
        do {
          const fname = expectIdent('member name').value
          const dims = parseArrayDims()
          fields.push({ name: fname, ctype: dims ? 'array' : spec.ctype, base: dims ? spec.ctype : spec.base, dims: dims ?? null, structName: spec.structName })
        } while (eat(','))
        expect(';')
      }
      expect('}')
    }
    structs.set(name, { name, fields })
    const varName = atIdent() ? next().value : null
    expect(';')
    if (varName) {
      const entry = declare(varName, { ctype: 'object', structName: name })
      return { k: 'decl', items: [{ ref: entry, ctype: 'object', structName: name, init: null, dims: null }], line }
    }
    return { k: 'empty', line }
  }

  /** `int a[]` / `int m[2][3]` — returns the dimension list, or null when there are no brackets. */
  function parseArrayDims() {
    if (!at('[')) return null
    const dims = []
    while (at('[')) {
      next()
      if (at(']')) dims.push(null)
      else {
        const tok = peek()
        const folded = foldConst(parseConditional())
        if (folded === null) fail('array size must be a constant expression', tok)
        dims.push(Math.trunc(folded))
      }
      expect(']')
    }
    return dims
  }

  function parseDeclaration(line) {
    const spec = parseTypeSpec()
    if (!spec) fail(`expected type before '${describe(peek())}'`)
    const items = []
    do {
      while (atIdent() && IGNORED_ATTRIBUTES.has(peek().value)) next()
      const nameTok = expectIdent('declarator')
      while (atIdent() && IGNORED_ATTRIBUTES.has(peek().value)) next()
      const dims = parseArrayDims()
      let init = null
      let ctorArgs = null
      if (eat('=')) init = at('{') ? parseInitializerList() : parseAssign()
      else if (at('(') && spec.ctype === 'object') ctorArgs = parseArgs()
      else if (at('{') && (dims || spec.ctype === 'object')) init = parseInitializerList()
      let ctype = spec.ctype
      const element = spec.ctype
      if (dims) ctype = 'array'
      if (dims && dims[0] == null && init) dims[0] = inferFirstDim(init)
      if (ctype === 'unknown' && init && (init.k === 'lambda' || init.k === 'fnref')) ctype = 'function'
      const info = { ctype, base: dims ? element : spec.base, structName: spec.structName }
      if (dims) info.dims = dims
      const entry = spec.isStatic && fn ? declareStatic(nameTok.value, info) : declare(nameTok.value, info)
      if (spec.isConst && !dims && init && init.k === 'num') entry.constValue = init.v
      items.push({
        ref: entry, ctype, base: dims ? element : spec.base, dims: dims ?? null, init, ctorArgs,
        className: spec.ctype === 'object' && !structs.has(spec.structName) ? spec.structName : null,
        structName: structs.has(spec.structName) ? spec.structName : null,
        staticId: entry.staticId ?? null, name: nameTok.value,
      })
    } while (eat(','))
    expect(';')
    return { k: 'decl', items, line }
  }

  function inferFirstDim(init) {
    if (init.k === 'initlist') return init.items.length
    if (init.k === 'str') return init.v.length + 1
    return null
  }

  function parseInitializerList() {
    expect('{')
    const items = []
    if (!at('}')) {
      do {
        if (at('}')) break
        items.push(at('{') ? parseInitializerList() : parseAssign())
      } while (eat(','))
    }
    expect('}')
    return { k: 'initlist', items, t: 'array' }
  }

  // ---------------------------------------------------------------------------------------- top level

  /** Registers a function so calls can be resolved before its definition is parsed (C++ needs a prototype; we hoist). */
  function declareFunction(name, returnType, params) {
    if (functionIndex.has(name)) {
      const idx = functionIndex.get(name)
      const f = functions[idx]
      f.returnType = returnType
      f.params = params
      return idx
    }
    const index = functions.length
    functions.push({ name, returnType, params, body: null, frameSize: 0, defined: false })
    functionIndex.set(name, index)
    return index
  }

  /** Pre-scan: record every function signature so bodies may call functions declared later in the file. */
  function hoistFunctions() {
    const saved = pos
    let depth = 0
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.type === 'punct' && t.value === '{') { depth++; continue }
      if (t.type === 'punct' && t.value === '}') { depth = Math.max(0, depth - 1); continue }
      if (depth !== 0) continue
      if (t.type !== 'ident') continue
      if (!TYPE_KEYWORDS.has(t.value) && !DECL_SPECIFIERS.has(t.value)) continue
      let k = i
      const words = []
      while (tokens[k].type === 'ident' && (TYPE_KEYWORDS.has(tokens[k].value) || DECL_SPECIFIERS.has(tokens[k].value))) {
        if (!DECL_SPECIFIERS.has(tokens[k].value)) words.push(tokens[k].value)
        k++
      }
      let stars = 0
      while (tokens[k].type === 'punct' && (tokens[k].value === '*' || tokens[k].value === '&')) { stars++; k++ }
      if (tokens[k].type !== 'ident') continue
      const name = tokens[k].value
      if (tokens[k + 1]?.type !== 'punct' || tokens[k + 1].value !== '(') continue
      let returnType = normalizeType(words.join(' '))
      if (returnType === 'auto' || !words.length) returnType = 'unknown'
      if (stars > 0) returnType = returnType === 'char' ? 'String' : 'array'
      if (!functionIndex.has(name)) {
        const index = functions.length
        functions.push({ name, returnType, params: [], body: null, frameSize: 0, defined: false, line: tokens[k].line })
        functionIndex.set(name, index)
      }
      i = k
    }
    pos = saved
  }

  function parseTopLevel() {
    while (peek().type !== 'eof') {
      const t = peek()
      if (at(';')) { next(); continue }
      if (t.type === 'ident' && ['struct', 'enum', 'class', 'typedef'].includes(t.value)) {
        const stmt = parseTypeDeclaration()
        if (stmt.k === 'decl') globalInit.push(stmt)
        continue
      }
      if (t.type === 'ident' && t.value === 'using') {                 // `using namespace std;`
        while (!at(';') && peek().type !== 'eof') next()
        expect(';')
        continue
      }
      if (isFunctionAhead()) { parseFunction(); continue }
      if (looksLikeDeclaration()) { globalInit.push(parseDeclaration(t.line)); continue }
      fail(`expected declaration before '${describe(t)}'`)
    }
  }

  function isFunctionAhead() {
    let k = 0
    while (peek(k).type === 'ident' && DECL_SPECIFIERS.has(peek(k).value)) k++
    if (peek(k).type !== 'ident') return false
    if (!TYPE_KEYWORDS.has(peek(k).value) && !typeNames.has(peek(k).value)) return false
    while (peek(k).type === 'ident' && (TYPE_KEYWORDS.has(peek(k).value) || typeNames.has(peek(k).value) || DECL_SPECIFIERS.has(peek(k).value))) k++
    while (at('*', k) || at('&', k)) k++
    if (peek(k).type !== 'ident') return false
    return at('(', k + 1)
  }

  function parseFunction() {
    const spec = parseTypeSpec()
    const nameTok = expectIdent('function name')
    const saved = fn
    const scope = pushFn(null)
    expect('(')
    const params = []
    if (!at(')') && !(atIdent() && peek().value === 'void' && at(')', 1))) {
      do {
        const pspec = parseTypeSpec() ?? { ctype: 'unknown', base: 'unknown', pointer: 0 }
        const pname = atIdent() ? next().value : `__arg${params.length}`
        const dims = parseArrayDims()
        const info = { ctype: dims ? 'array' : pspec.ctype, base: dims ? pspec.ctype : pspec.base, structName: pspec.structName }
        if (dims) info.dims = dims
        const entry = declare(pname, info)
        params.push({ name: pname, ctype: info.ctype, index: entry.index })
      } while (eat(','))
    } else if (atIdent() && peek().value === 'void') next()
    expect(')')
    while (atIdent() && (IGNORED_ATTRIBUTES.has(peek().value) || peek().value === 'const')) next()

    const returnType = spec.ctype === 'auto' ? 'unknown' : spec.ctype
    const index = declareFunction(nameTok.value, returnType, params)

    if (eat(';')) { popFn(saved); return }                             // prototype
    const savedReturn = currentReturnType
    currentReturnType = returnType
    const body = parseBlock()
    currentReturnType = savedReturn
    popFn(saved)
    const f = functions[index]
    if (f.defined) {
      errors.push({ line: nameTok.line, col: nameTok.col, message: `redefinition of '${nameTok.value}'`, severity: 'error' })
    }
    f.returnType = returnType
    f.params = params
    f.body = body
    f.frameSize = scope.frameSize
    f.defined = true
    f.line = nameTok.line
  }

  // ---------------------------------------------------------------------------------------- run

  try {
    hoistFunctions()
    parseTopLevel()
  } catch (err) {
    if (!(err instanceof ParseError)) throw err
    errors.push({ line: err.line, col: err.col, message: err.message, severity: 'error' })
    return { program: null, errors, warnings, classesUsed: [...classesUsed], globalsUsed: [...globalsUsed] }
  }

  for (const f of functions) {
    if (!f.defined && !f.isLambda && f.used) {
      errors.push({ line: f.line ?? 1, col: 1, message: `'${f.name}' was not declared in this scope`, severity: 'error' })
    }
  }
  for (const name of ['setup', 'loop']) {
    const idx = functionIndex.get(name)
    if (idx === undefined || !functions[idx].defined) {
      errors.push({ line: 1, col: 1, message: `${name}() not defined`, severity: 'error' })
    }
  }

  const program = {
    intBits,
    functions,
    functionIndex: Object.fromEntries(functionIndex),
    globalInit,
    globalCount,
    staticCount,
    globalNames: Object.fromEntries([...globalScope].map(([name, e]) => [name, e.index])),
    globalTypes: Object.fromEntries([...globalScope].map(([name, e]) => [name, e.ctype])),
    structs: Object.fromEntries(structs),
    setup: functionIndex.get('setup') ?? null,
    loop: functionIndex.get('loop') ?? null,
  }
  return { program, errors, warnings, classesUsed: [...classesUsed], globalsUsed: [...globalsUsed] }
}
