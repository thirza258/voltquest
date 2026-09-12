/**
 * The virtual machine (CONTRACTS §6).
 *
 * `createVM` lowers the resolved program into a tree of JS closures. Leaf statements that cannot block compile
 * to plain functions; every control-flow construct compiles to a generator, so the VM is preemptible at
 * statement granularity: `step(maxStatements)` never runs more statements than its budget and a `while (true) {}`
 * simply returns `'running'`.
 *
 * Virtual time is an integer: `now() = floor(statementCount × statementCostUs) + accumulated sleeps`, so
 * `micros()` never returns a fraction on an ESP32 (`statementCostUs` 0.25).
 */

import {
  binaryResultType, conditionalResultType, isIntegerType, isNumericType, isUnsignedType, unaryResultType,
  widthOf, wrapToType,
} from './types.js'
import { STRING_METHODS, charArrayToString, formatValue, stringCast, toNumber, toText, truthy } from './values.js'

/** Yielded at least every 64 statements so the scheduler can preempt. */
const TICK = Object.freeze({ type: 'tick' })

/** Completion signals bubbling out of statement executors. */
const BREAK = Object.freeze({ signal: 'break' })
const CONTINUE = Object.freeze({ signal: 'continue' })
const RETURN = Object.freeze({ signal: 'return' })

const MAX_CALL_DEPTH = 512
const TICK_INTERVAL = 64

/** A sketch error with the source line that produced it. */
export class RuntimeError extends Error {
  constructor(message, line) {
    super(message)
    this.name = 'RuntimeError'
    this.line = line
  }
}

const isGen = (v) => v != null && typeof v === 'object' && typeof v.next === 'function' && typeof v.throw === 'function'
const isYieldObject = (v) => v != null && typeof v === 'object' && (v.type === 'sleep' || v.type === 'tick')

/**
 * Instantiates a VM for a compiled program.
 * @param {object} program from `compile()`
 * @param {{ intBits?: number, statementCostUs?: number, natives?: object, globals?: object, classes?: object,
 *           onError?: (err: {message: string, line: number}) => void, callBudget?: number }} [host]
 * @returns {object} VM (see CONTRACTS §6)
 */
export function createVM(program, host = {}) {
  if (!program || !Array.isArray(program.functions)) throw new Error('createVM: invalid program')

  const intBits = program.intBits ?? host.intBits ?? 16
  const costUs = Number(host.statementCostUs ?? 1) || 1
  const natives = host.natives ?? {}
  const hostGlobals = host.globals ?? {}
  const classes = host.classes ?? {}
  const structs = program.structs ?? {}
  const callBudget = host.callBudget ?? 2000000

  const S = {
    count: 0, checkAt: Infinity, sleepUs: 0, line: 0, depth: 0,
    halted: false, error: null, ret: undefined, started: false, wakeAtUs: null,
  }
  let globals = new Array(program.globalCount ?? 0)
  let staticsDone = new Uint8Array(program.staticCount ?? 0)
  let iterator = null
  const emptyEnv = { slots: [], parent: null }

  // --------------------------------------------------------------------------------------- helpers

  const now = () => Math.floor(S.count * costUs) + S.sleepUs
  const rt = (message) => new RuntimeError(message, S.line)

  /** Per-type store conversion, or `null` when the type needs none. */
  function wrapperFor(t) {
    switch (t) {
      case 'bool': return (v) => (truthy(v) ? 1 : 0)
      case 'char': case 'byte': case 'uint8_t': return (v) => v & 0xFF
      case 'int8_t': return (v) => (v << 24) >> 24
      case 'short': case 'int16_t': return (v) => (v << 16) >> 16
      case 'unsigned short': case 'uint16_t': case 'word': return (v) => v & 0xFFFF
      case 'long': case 'int32_t': return (v) => v | 0
      case 'unsigned long': case 'uint32_t': case 'size_t': return (v) => v >>> 0
      case 'int': return intBits === 16 ? (v) => (v << 16) >> 16 : (v) => v | 0
      case 'unsigned int': return intBits === 16 ? (v) => v & 0xFFFF : (v) => v >>> 0
      case 'float': return (v) => Math.fround(v)
      case 'double': return intBits === 16 ? (v) => Math.fround(v) : (v) => +v
      default: return null
    }
  }

  /** Converts a value being stored into a variable of type `t` (numeric wrap, or Arduino String conversion). */
  function converterFor(t, sourceType) {
    if (t === 'String') return (v) => (typeof v === 'string' ? v : Array.isArray(v) ? charArrayToString(v) : toText(v, sourceType, intBits))
    const w = wrapperFor(t)
    if (!w) return null
    if (isNumericType(sourceType) || sourceType === undefined) return w
    return (v) => w(toNumber(v))
  }

  const applyConv = (conv, v) => (conv ? conv(v) : v)

  /** Zero value for a declaration without an initialiser. */
  function defaultValue(ctype, structName) {
    if (ctype === 'String') return ''
    if (ctype === 'object') return structName && structs[structName] ? makeStruct(structName) : null
    if (ctype === 'array') return []
    if (isNumericType(ctype)) return 0
    return undefined
  }

  function makeStruct(name) {
    const def = structs[name]
    const obj = { __struct: name }
    if (def) for (const f of def.fields) {
      obj[f.name] = f.dims ? makeArray(f.dims, f.base ?? f.ctype, f.structName) : defaultValue(f.ctype, f.structName)
    }
    return obj
  }

  function makeArray(dims, element, structName) {
    const n = dims[0] ?? 0
    const out = new Array(n)
    if (dims.length > 1) {
      for (let i = 0; i < n; i++) out[i] = makeArray(dims.slice(1), element, structName)
    } else if (element === 'object' || element === 'array') {
      // Structs and nested arrays need one fresh value per slot, never a shared reference.
      for (let i = 0; i < n; i++) out[i] = defaultValue(element, structName)
    } else {
      out.fill(defaultValue(element, structName))
    }
    return out
  }

  // --------------------------------------------------------------------------------------- expressions

  // Wraps a pure expression so it can be `yield*`-delegated from inside a generator. It never yields — that is
  // exactly the point — so `require-yield` is disabled here.
  // eslint-disable-next-line require-yield
  const asGen = (e) => (e.pure ? function* (env) { return e.fn(env) } : e.fn)

  /** Lowers an expression to `{ pure, fn, t }`; `t` is the *effective* static type (natives refine it). */
  function lowerExpr(node) {
    switch (node.k) {
      case 'num': return { pure: true, t: node.t, fn: () => node.v }
      case 'str': return { pure: true, t: 'String', fn: () => node.v }
      case 'var': return lowerVarRead(node)
      case 'address': {
        const read = lowerVarRead(node.e).fn, store = storeFor(node.e), wrap = wrapperFor(node.e.t) ?? (v => v)
        return { pure: true, t: 'array', fn: env => {
          const ref = [0]
          Object.defineProperty(ref, '0', { get: () => read(env), set: value => { store(env, wrap(value)) }, enumerable: true })
          return ref
        } }
      }
      case 'free': return lowerFree(node)
      case 'bin': return lowerBinary(node)
      case 'logical': return lowerLogical(node)
      case 'un': return lowerUnary(node)
      case 'cond': return lowerConditional(node)
      case 'comma': return lowerComma(node)
      case 'assign': return lowerAssign(node)
      case 'preinc': case 'postinc': return lowerIncDec(node)
      case 'index': return lowerIndex(node)
      case 'member': return lowerMemberRead(node)
      case 'mcall': return lowerMethodCall(node)
      case 'call': return lowerCall(node)
      case 'cast': return lowerCast(node)
      case 'lambda': return { pure: true, t: 'function', fn: (env) => makeCallable(node.index, node.byValue ? snapshot(env) : env) }
      case 'fnref': return { pure: true, t: 'function', fn: () => makeCallable(node.index, null) }
      case 'initlist': return lowerInitList(node)
      case 'typeref': return { pure: true, t: node.ctype, fn: () => 0 }
      default: throw new Error(`cannot lower expression '${node.k}'`)
    }
  }

  function lowerVarRead(node) {
    const ref = node.ref
    const t = ref.ctype ?? node.t
    if (ref.scope === 'global') {
      const i = ref.index
      return { pure: true, t, fn: () => globals[i] }
    }
    const i = ref.index
    if (!ref.depth) return { pure: true, t, fn: (env) => env.slots[i] }
    const d = ref.depth
    return { pure: true, t, fn: (env) => { let e = env; for (let k = 0; k < d; k++) e = e.parent; return e.slots[i] } }
  }

  function storeFor(node) {
    if (node.k === 'var') {
      const ref = node.ref
      if (ref.scope === 'global') { const i = ref.index; return (env, v) => { globals[i] = v } }
      const i = ref.index
      if (!ref.depth) return (env, v) => { env.slots[i] = v }
      const d = ref.depth
      return (env, v) => { let e = env; for (let k = 0; k < d; k++) e = e.parent; e.slots[i] = v }
    }
    return null
  }

  function lowerFree(node) {
    const name = node.name
    return {
      pure: true,
      t: 'unknown',
      fn: () => {
        const v = hostGlobals[name]
        if (v === undefined && !(name in hostGlobals)) throw rt(`'${name}' was not declared in this scope`)
        return v
      },
    }
  }

  /** Builds the `(a, b) => value` kernel for a binary operator, including the result wrap. */
  function binaryKernel(op, lt, rt2, res) {
    if (op === '+' && res === 'String') return (a, b) => toText(a, lt, intBits) + toText(b, rt2, intBits)
    const textual = lt === 'String' || rt2 === 'String'
    switch (op) {
      case '==': return textual ? (a, b) => (toText(a, lt, intBits) === toText(b, rt2, intBits) ? 1 : 0) : (a, b) => (a === b ? 1 : 0)
      case '!=': return textual ? (a, b) => (toText(a, lt, intBits) !== toText(b, rt2, intBits) ? 1 : 0) : (a, b) => (a !== b ? 1 : 0)
      case '<': return (a, b) => (a < b ? 1 : 0)
      case '>': return (a, b) => (a > b ? 1 : 0)
      case '<=': return (a, b) => (a <= b ? 1 : 0)
      case '>=': return (a, b) => (a >= b ? 1 : 0)
      default: break
    }
    const w = wrapperFor(res) ?? ((v) => v)
    const int = isIntegerType(res)
    const width = widthOf(res, intBits)
    let kernel
    switch (op) {
      case '+': kernel = (a, b) => w(a + b); break
      case '-': kernel = (a, b) => w(a - b); break
      case '*': kernel = int && width === 32 ? (a, b) => w(Math.imul(a, b)) : (a, b) => w(a * b); break
      case '/':
        kernel = int
          ? (a, b) => { if (b === 0) throw rt('division by zero'); return w(Math.trunc(a / b)) }
          : (a, b) => w(a / b)
        break
      case '%':
        kernel = int
          ? (a, b) => { if (b === 0) throw rt('division by zero'); return w(a % b) }
          : (a, b) => w(a % b)
        break
      case '<<': kernel = (a, b) => w(b < 0 || b >= 32 ? 0 : a << b); break
      case '>>':
        kernel = isUnsignedType(res)
          ? (a, b) => w(b < 0 || b >= 32 ? 0 : a >>> b)
          : (a, b) => w(b < 0 || b >= 32 ? (a < 0 ? -1 : 0) : a >> b)
        break
      case '&': kernel = (a, b) => w(a & b); break
      case '|': kernel = (a, b) => w(a | b); break
      case '^': kernel = (a, b) => w(a ^ b); break
      case ',': kernel = (a, b) => b; break
      default: throw new Error(`unsupported operator '${op}'`)
    }
    if (op !== ',' && (!isNumericType(lt) || !isNumericType(rt2))) {
      const inner = kernel
      kernel = (a, b) => inner(toNumber(a), toNumber(b))
    }
    return kernel
  }

  function lowerBinary(node) {
    const L = lowerExpr(node.l)
    const R = lowerExpr(node.r)
    const t = binaryResultType(node.op, L.t, R.t, intBits)
    const kernel = binaryKernel(node.op, L.t, R.t, t)
    if (L.pure && R.pure) {
      const lf = L.fn
      const rf = R.fn
      return { pure: true, t, fn: (env) => kernel(lf(env), rf(env)) }
    }
    const gl = asGen(L)
    const gr = asGen(R)
    return { pure: false, t, fn: function* (env) { const a = yield* gl(env); const b = yield* gr(env); return kernel(a, b) } }
  }

  function lowerLogical(node) {
    const L = lowerExpr(node.l)
    const R = lowerExpr(node.r)
    const or = node.op === '||'
    if (L.pure && R.pure) {
      const lf = L.fn
      const rf = R.fn
      return or
        ? { pure: true, t: 'bool', fn: (env) => (truthy(lf(env)) || truthy(rf(env)) ? 1 : 0) }
        : { pure: true, t: 'bool', fn: (env) => (truthy(lf(env)) && truthy(rf(env)) ? 1 : 0) }
    }
    const gl = asGen(L)
    const gr = asGen(R)
    return {
      pure: false,
      t: 'bool',
      fn: function* (env) {
        const a = truthy(yield* gl(env))
        if (or ? a : !a) return a ? 1 : 0
        return truthy(yield* gr(env)) ? 1 : 0
      },
    }
  }

  function lowerUnary(node) {
    const E = lowerExpr(node.e)
    const t = unaryResultType(node.op, E.t, intBits)
    const w = wrapperFor(t) ?? ((v) => v)
    let kernel
    switch (node.op) {
      case '!': kernel = (v) => (truthy(v) ? 0 : 1); break
      case '-': kernel = (v) => w(-toNumber(v)); break
      case '+': kernel = (v) => w(toNumber(v)); break
      case '~': kernel = (v) => w(~toNumber(v)); break
      default: throw new Error(`unsupported unary operator '${node.op}'`)
    }
    if (E.pure) { const f = E.fn; return { pure: true, t, fn: (env) => kernel(f(env)) } }
    const g = E.fn
    return { pure: false, t, fn: function* (env) { return kernel(yield* g(env)) } }
  }

  function lowerConditional(node) {
    const C = lowerExpr(node.c)
    const A = lowerExpr(node.a)
    const B = lowerExpr(node.b)
    const t = conditionalResultType(A.t, B.t, intBits)
    if (C.pure && A.pure && B.pure) {
      const cf = C.fn
      const af = A.fn
      const bf = B.fn
      return { pure: true, t, fn: (env) => (truthy(cf(env)) ? af(env) : bf(env)) }
    }
    const gc = asGen(C)
    const ga = asGen(A)
    const gb = asGen(B)
    return { pure: false, t, fn: function* (env) { return truthy(yield* gc(env)) ? yield* ga(env) : yield* gb(env) } }
  }

  function lowerComma(node) {
    const L = lowerExpr(node.l)
    const R = lowerExpr(node.r)
    if (L.pure && R.pure) { const lf = L.fn; const rf = R.fn; return { pure: true, t: R.t, fn: (env) => { lf(env); return rf(env) } } }
    const gl = asGen(L)
    const gr = asGen(R)
    return { pure: false, t: R.t, fn: function* (env) { yield* gl(env); return yield* gr(env) } }
  }

  function lowerIndex(node) {
    const A = lowerExpr(node.arr)
    const I = lowerExpr(node.idx)
    const t = node.t === 'unknown' && A.t === 'String' ? 'char' : node.t
    const read = (a, i) => {
      if (typeof a === 'string') {
        if (i < 0 || i > a.length) throw rt('string index out of bounds')
        return i === a.length ? 0 : a.charCodeAt(i)
      }
      if (!Array.isArray(a)) throw rt('subscripted value is not an array')
      if (i < 0 || i >= a.length) throw rt(`array index ${i} out of bounds (size ${a.length})`)
      return a[i]
    }
    if (A.pure && I.pure) { const af = A.fn; const inf = I.fn; return { pure: true, t, arrayInfo: node.arrayInfo, fn: (env) => read(af(env), inf(env) | 0) } }
    const ga = asGen(A)
    const gi = asGen(I)
    return { pure: false, t, arrayInfo: node.arrayInfo, fn: function* (env) { const a = yield* ga(env); const i = yield* gi(env); return read(a, i | 0) } }
  }

  function lowerInitList(node) {
    const items = node.items.map(lowerExpr)
    if (items.every((x) => x.pure)) return { pure: true, t: 'array', fn: (env) => items.map((x) => x.fn(env)) }
    const gens = items.map(asGen)
    return {
      pure: false,
      t: 'array',
      fn: function* (env) { const out = []; for (const g of gens) out.push(yield* g(env)); return out },
    }
  }

  // --------------------------------------------------------------------------------------- assignment

  function lowerAssign(node) {
    const target = node.target
    const V = lowerExpr(node.value)
    const targetType = targetTypeOf(target)
    const compound = node.op !== '='
    const binOp = compound ? node.op.slice(0, -1) : null
    const conv = converterFor(targetType, compound ? binaryResultType(binOp, targetType, V.t, intBits) : V.t)

    if (target.k === 'var') {
      const read = lowerVarRead(target).fn
      const store = storeFor(target)
      const kernel = compound ? binaryKernel(binOp, targetType, V.t, binaryResultType(binOp, targetType, V.t, intBits)) : null
      if (V.pure) {
        const vf = V.fn
        return {
          pure: true,
          t: targetType,
          fn: (env) => {
            const v = applyConv(conv, kernel ? kernel(read(env), vf(env)) : vf(env))
            store(env, v)
            return v
          },
        }
      }
      const gv = V.fn
      return {
        pure: false,
        t: targetType,
        fn: function* (env) {
          const raw = yield* gv(env)
          const v = applyConv(conv, kernel ? kernel(read(env), raw) : raw)
          store(env, v)
          return v
        },
      }
    }

    if (target.k === 'index') {
      const A = lowerExpr(target.arr)
      const I = lowerExpr(target.idx)
      const kernel = compound ? binaryKernel(binOp, targetType, V.t, binaryResultType(binOp, targetType, V.t, intBits)) : null
      const put = (a, i, raw) => {
        if (!Array.isArray(a)) throw rt('subscripted value is not an array')
        if (i < 0 || i >= a.length) throw rt(`array index ${i} out of bounds (size ${a.length})`)
        const v = applyConv(conv, kernel ? kernel(a[i], raw) : raw)
        a[i] = v
        return v
      }
      if (A.pure && I.pure && V.pure) {
        const af = A.fn
        const inf = I.fn
        const vf = V.fn
        return { pure: true, t: targetType, fn: (env) => put(af(env), inf(env) | 0, vf(env)) }
      }
      const ga = asGen(A)
      const gi = asGen(I)
      const gv = asGen(V)
      return {
        pure: false,
        t: targetType,
        fn: function* (env) { const a = yield* ga(env); const i = yield* gi(env); const raw = yield* gv(env); return put(a, i | 0, raw) },
      }
    }

    if (target.k === 'member') {
      const O = lowerExpr(target.obj)
      const name = target.name
      const kernel = compound ? binaryKernel(binOp, targetType, V.t, binaryResultType(binOp, targetType, V.t, intBits)) : null
      const put = (obj, raw) => {
        if (obj == null || typeof obj !== 'object') throw rt(`request for member '${name}' in something not a structure`)
        const v = applyConv(conv, kernel ? kernel(obj[name], raw) : raw)
        obj[name] = v
        return v
      }
      if (O.pure && V.pure) { const of2 = O.fn; const vf = V.fn; return { pure: true, t: targetType, fn: (env) => put(of2(env), vf(env)) } }
      const go = asGen(O)
      const gv = asGen(V)
      return { pure: false, t: targetType, fn: function* (env) { const o = yield* go(env); const raw = yield* gv(env); return put(o, raw) } }
    }

    throw new Error('invalid assignment target')
  }

  function targetTypeOf(target) {
    if (target.k === 'var') return target.ref.ctype ?? target.t
    if (target.k === 'index') {
      const info = target.arr.arrayInfo
      if (info) return info.dims.length > 1 ? 'array' : info.base
      return target.t
    }
    if (target.k === 'member') {
      const sn = target.obj.structName
      const def = sn ? structs[sn] : null
      const f = def?.fields.find((x) => x.name === target.name)
      return f ? f.ctype : target.t
    }
    return target.t
  }

  function lowerIncDec(node) {
    const target = node.target
    const delta = node.op === '++' ? 1 : -1
    const post = node.k === 'postinc'
    const t = targetTypeOf(target)
    const w = wrapperFor(t) ?? ((v) => v)

    if (target.k === 'var') {
      const read = lowerVarRead(target).fn
      const store = storeFor(target)
      return {
        pure: true,
        t,
        fn: (env) => {
          const old = toNumber(read(env))
          const next = w(old + delta)
          store(env, next)
          return post ? old : next
        },
      }
    }
    if (target.k === 'index') {
      const A = lowerExpr(target.arr)
      const I = lowerExpr(target.idx)
      const bump = (a, i) => {
        if (!Array.isArray(a)) throw rt('subscripted value is not an array')
        if (i < 0 || i >= a.length) throw rt(`array index ${i} out of bounds (size ${a.length})`)
        const old = toNumber(a[i])
        const next = w(old + delta)
        a[i] = next
        return post ? old : next
      }
      if (A.pure && I.pure) { const af = A.fn; const inf = I.fn; return { pure: true, t, fn: (env) => bump(af(env), inf(env) | 0) } }
      const ga = asGen(A)
      const gi = asGen(I)
      return { pure: false, t, fn: function* (env) { const a = yield* ga(env); const i = yield* gi(env); return bump(a, i | 0) } }
    }
    if (target.k === 'member') {
      const O = lowerExpr(target.obj)
      const name = target.name
      const bump = (obj) => {
        if (obj == null || typeof obj !== 'object') throw rt(`request for member '${name}' in something not a structure`)
        const old = toNumber(obj[name])
        const next = w(old + delta)
        obj[name] = next
        return post ? old : next
      }
      if (O.pure) { const of2 = O.fn; return { pure: true, t, fn: (env) => bump(of2(env)) } }
      const go = O.fn
      return { pure: false, t, fn: function* (env) { return bump(yield* go(env)) } }
    }
    throw new Error('invalid increment target')
  }

  function lowerCast(node) {
    const E = lowerExpr(node.e)
    if (node.to === 'String') {
      const A = node.args?.length ? lowerExpr(node.args[0]) : null
      const st = E.t
      const kernel = (v, arg) => stringCast(v, st, arg, intBits)
      if (E.pure && (!A || A.pure)) {
        const ef = E.fn
        const af = A?.fn
        return { pure: true, t: 'String', fn: (env) => kernel(ef(env), af ? af(env) : undefined) }
      }
      const ge = asGen(E)
      const ga = A ? asGen(A) : null
      return { pure: false, t: 'String', fn: function* (env) { const v = yield* ge(env); const a = ga ? yield* ga(env) : undefined; return kernel(v, a) } }
    }
    if (node.to === 'array' || node.to === 'object' || node.to === 'void' || node.to === 'unknown') {
      return { pure: E.pure, t: node.to, arrayInfo: node.arrayInfo, fn: E.fn }
    }
    const w = wrapperFor(node.to) ?? ((v) => v)
    const kernel = (v) => w(toNumber(v))
    if (E.pure) { const ef = E.fn; return { pure: true, t: node.to, fn: (env) => kernel(ef(env)) } }
    const ge = E.fn
    return { pure: false, t: node.to, fn: function* (env) { return kernel(yield* ge(env)) } }
  }

  // --------------------------------------------------------------------------------------- calls

  /** Lowers an argument list into `{ pure, run }`; `run` is plain when every argument is pure. */
  function lowerArgs(args) {
    const list = args.map(lowerExpr)
    const types = list.map((a) => a.t)
    if (list.every((a) => a.pure)) {
      const fns = list.map((a) => a.fn)
      const n = fns.length
      return { pure: true, types, run: (env) => { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = fns[i](env); return out } }
    }
    const gens = list.map(asGen)
    return {
      pure: false,
      types,
      run: function* (env) { const out = new Array(gens.length); for (let i = 0; i < gens.length; i++) out[i] = yield* gens[i](env); return out },
    }
  }

  function nativeReturnType(nf) {
    return nf && typeof nf === 'object' && typeof nf.returns === 'string' ? nf.returns : 'unknown'
  }

  function lowerCall(node) {
    const A = lowerArgs(node.args)
    if (node.target.kind === 'func') {
      const index = node.target.index
      const t = program.functions[index]?.returnType ?? 'unknown'
      const gargs = A.pure ? null : A.run
      const pargs = A.pure ? A.run : null
      return {
        pure: false,
        t,
        fn: function* (env) {
          const args = pargs ? pargs(env) : yield* gargs(env)
          return yield* callFunction(index, args)
        },
      }
    }
    if (node.target.kind === 'native') {
      const name = node.target.name
      const t = nativeReturnType(natives[name])
      const pargs = A.pure ? A.run : null
      const gargs = A.pure ? null : A.run
      const types = A.types
      return {
        pure: false,
        t,
        fn: function* (env) {
          const args = pargs ? pargs(env) : yield* gargs(env)
          return yield* callNative(name, natives[name], args, types, null)
        },
      }
    }
    const C = lowerExpr(node.target.expr)
    const gc = asGen(C)
    const pargs = A.pure ? A.run : null
    const gargs = A.pure ? null : A.run
    const types = A.types
    return {
      pure: false,
      t: 'unknown',
      fn: function* (env) {
        const callee = yield* gc(env)
        const args = pargs ? pargs(env) : yield* gargs(env)
        return yield* invokeValue(callee, args, types)
      },
    }
  }

  /** `obj.method(args)` and `Owner.method(args)` where `Owner` is a host class or global. */
  function lowerMethodCall(node) {
    const A = lowerArgs(node.args)
    const name = node.name
    const types = A.types
    const pargs = A.pure ? A.run : null
    const gargs = A.pure ? null : A.run

    if (node.owner) {
      const owner = node.owner
      const dotted = `${owner}.${name}`
      const t = natives[dotted] ? nativeReturnType(natives[dotted])
        : nativeReturnType(classes[owner]?.methods?.[name])
      return {
        pure: false,
        t,
        fn: function* (env) {
          const args = pargs ? pargs(env) : yield* gargs(env)
          return yield* callStatic(owner, name, args, types)
        },
      }
    }

    const O = lowerExpr(node.obj)
    const go = asGen(O)
    const sm = STRING_METHODS[name]
    const store = sm?.mutates ? storeFor(node.obj) : null
    const className = node.obj.structName
    const t = O.t === 'String' && sm ? sm.returns
      : nativeReturnType(className ? classes[className]?.methods?.[name] : null)
    return {
      pure: false,
      t,
      fn: function* (env) {
        const self = yield* go(env)
        const args = pargs ? pargs(env) : yield* gargs(env)
        if (typeof self === 'string') {
          if (!sm) throw rt(`'class String' has no member named '${name}'`)
          const result = sm.fn(self, args, types, intBits)
          if (sm.mutates && store) store(env, result)
          return result
        }
        return yield* callInstance(self, name, args, types, className)
      },
    }
  }

  function* callStatic(owner, name, args, types) {
    const dotted = `${owner}.${name}`
    if (natives[dotted]) return yield* callNative(dotted, natives[dotted], args, types, null)
    if (owner in hostGlobals) {
      const self = hostGlobals[owner]
      if (typeof self === 'string') {
        const sm = STRING_METHODS[name]
        if (sm) return sm.fn(self, args, types, intBits)
      }
      return yield* callInstance(self, name, args, types, null)
    }
    const cls = classes[owner]
    if (cls?.methods?.[name]) return yield* callNative(dotted, cls.methods[name], args, types, null)
    if (cls?.statics?.[name]) return yield* callNative(dotted, cls.statics[name], args, types, null)
    throw rt(`'${owner}' was not declared in this scope`)
  }

  /** Methods first, then `fields(self)`, then own properties — CONTRACTS §6. */
  function* callInstance(self, name, args, types, className) {
    if (self == null) throw rt(`request for member '${name}' in a null object`)
    if (typeof self !== 'object') throw rt(`request for member '${name}' in something not a structure`)
    const cls = classes[self.__class] ?? (className ? classes[className] : null)
    const method = cls?.methods?.[name]
    if (method) return yield* callNative(`${self.__class ?? className}.${name}`, method, args, types, self)
    const fields = cls?.fields ? cls.fields(self) : null
    if (fields && typeof fields[name] === 'function') return yield* callNative(name, fields[name], args, types, self)
    if (typeof self[name] === 'function') {
      const r = self[name](args, makeCtx(types, self))
      return isGen(r) ? yield* r : r
    }
    if (self.__struct) throw rt(`'struct ${self.__struct}' has no member function '${name}'`)
    throw rt(`class has no member named '${name}'`)
  }

  function lowerMemberRead(node) {
    const O = lowerExpr(node.obj)
    const name = node.name
    const className = node.obj.structName
    const read = (self) => {
      if (typeof self === 'string') {
        const sm = STRING_METHODS[name]
        if (sm) return sm.fn(self, [], [], intBits)
        throw rt(`'class String' has no member named '${name}'`)
      }
      if (self == null || typeof self !== 'object') throw rt(`request for member '${name}' in something not a structure`)
      if (self.__struct) {
        if (!(name in self)) throw rt(`'struct ${self.__struct}' has no member named '${name}'`)
        return self[name]
      }
      const cls = classes[self.__class] ?? (className ? classes[className] : null)
      if (cls?.methods?.[name]) return { __callable: true, self, method: name, cls }
      const fields = cls?.fields ? cls.fields(self) : null
      if (fields && name in fields) return fields[name]
      if (name in self) return self[name]
      throw rt(`class has no member named '${name}'`)
    }
    const t = targetTypeOf(node)
    if (O.pure) { const of2 = O.fn; return { pure: true, t, fn: (env) => read(of2(env)) } }
    const go = O.fn
    return { pure: false, t, fn: function* (env) { return read(yield* go(env)) } }
  }

  // --------------------------------------------------------------------------------------- native bridge

  /**
   * The NativeCtx handed to every native (CONTRACTS §6), plus three additions the runtime needs:
   * `self` (the receiver of a method call), `intBits` and `format` — a `formatValue` already bound to the
   * board's `int` width, so `Serial.print(-1, HEX)` renders "FFFF" on an Uno and "FFFFFFFF" on an ESP32.
   */
  function makeCtx(argTypes, self) {
    return {
      vm,
      argTypes,
      self,
      line: S.line,
      intBits,
      now,
      sleep,
      invoke: (callable, args) => invokeValue(callable, args ?? [], []),
      format: (value, type, base) => formatValue(value, type, base, intBits),
      halt,
    }
  }

  /** `ctx.sleep(us)` — the Yield a native returns/yields to suspend the sketch. */
  function sleep(us) {
    const d = Number(us)
    return { type: 'sleep', untilUs: now() + (Number.isFinite(d) ? Math.max(0, Math.round(d)) : 0) }
  }

  function* callNative(name, nf, args, types, self) {
    if (!nf) throw rt(`'${name}' was not declared in this scope`)
    const fn = typeof nf === 'function' ? nf : nf.fn
    if (typeof fn !== 'function') throw rt(`'${name}' is not a function`)
    if (nf.params) {
      for (let i = 0; i < nf.params.length && i < args.length; i++) {
        args[i] = wrapToType(args[i], nf.params[i], intBits)
      }
    }
    const ctx = makeCtx(types, self)
    const r = fn.call(self ?? null, args, ctx)
    if (isGen(r)) return yield* r
    if (isYieldObject(r)) { yield r; return undefined }
    return r
  }

  function makeCallable(index, env) {
    return { __callable: true, fnIndex: index, env }
  }

  /** Copies the frame chain so a `[=]` lambda sees the values as they were at creation. */
  function snapshot(env) {
    if (!env) return null
    return { slots: env.slots.slice(), parent: snapshot(env.parent) }
  }

  function* invokeValue(callee, args, types) {
    if (callee == null) throw rt('called object is not a function')
    if (typeof callee === 'function') {
      const r = callee(args, makeCtx(types, null))
      return isGen(r) ? yield* r : r
    }
    if (typeof callee === 'object') {
      if (typeof callee.fnIndex === 'number') return yield* callFunction(callee.fnIndex, args, callee.env)
      if (callee.__callable && callee.method) return yield* callInstance(callee.self, callee.method, args, types, null)
      if (typeof callee.fn === 'function' || typeof callee.call === 'function') {
        return yield* callNative('callback', typeof callee.fn === 'function' ? callee : { fn: callee.call }, args, types, callee.self ?? null)
      }
    }
    throw rt('called object is not a function')
  }

  // --------------------------------------------------------------------------------------- statements

  /**
   * Lowers a statement. `pure: true` means it cannot block, so the driver that owns it performs the statement
   * count and tick check. Compound statements are always generators — `while (true) {}` must stay preemptible.
   */
  function lowerStmt(node) {
    switch (node.k) {
      case 'empty': return { pure: true, line: node.line, fn: () => undefined }
      case 'expr': return lowerExprStmt(node)
      case 'decl': return lowerDecl(node)
      case 'break': return { pure: true, line: node.line, fn: () => BREAK }
      case 'continue': return { pure: true, line: node.line, fn: () => CONTINUE }
      case 'return': return lowerReturn(node)
      case 'block': return { pure: false, line: node.line, fn: blockDriver(node.body.map(lowerStmt)) }
      case 'if': return lowerIf(node)
      case 'while': return lowerWhile(node)
      case 'do': return lowerDoWhile(node)
      case 'for': return lowerFor(node)
      case 'switch': return lowerSwitch(node)
      default: throw new Error(`cannot lower statement '${node.k}'`)
    }
  }

  function lowerExprStmt(node) {
    const E = lowerExpr(node.e)
    const line = node.line
    if (E.pure) { const f = E.fn; return { pure: true, line, fn: (env) => { f(env); return undefined } } }
    const g = E.fn
    return {
      pure: false,
      line,
      fn: function* (env) {
        S.line = line
        if (++S.count >= S.checkAt) yield TICK
        yield* g(env)
        return undefined
      },
    }
  }

  function lowerReturn(node) {
    const line = node.line
    const rtype = node.rtype
    if (!node.e) return { pure: true, line, fn: () => { S.ret = undefined; return RETURN } }
    const E = lowerExpr(node.e)
    const conv = converterFor(rtype, E.t)
    if (E.pure) {
      const f = E.fn
      return { pure: true, line, fn: (env) => { S.ret = applyConv(conv, f(env)); return RETURN } }
    }
    const g = E.fn
    return {
      pure: false,
      line,
      fn: function* (env) {
        S.line = line
        if (++S.count >= S.checkAt) yield TICK
        S.ret = applyConv(conv, yield* g(env))
        return RETURN
      },
    }
  }

  /** One declared variable: array/struct/object construction, initialiser conversion, `static` one-shot init. */
  function lowerDeclItem(item) {
    const ref = item.ref
    const store = storeFor({ k: 'var', ref })
    const staticId = item.staticId
    const dims = item.dims
    const element = item.base ?? item.ctype
    const className = item.className
    const structName = item.structName

    // `Servo s(9);` — construct through the host class.
    if (className) {
      const A = lowerArgs(item.ctorArgs ?? [])
      const pargs = A.pure ? A.run : null
      const gargs = A.pure ? null : A.run
      return {
        pure: false,
        fn: function* (env) {
          if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 }
          const args = pargs ? pargs(env) : yield* gargs(env)
          const cls = classes[className]
          if (!cls || typeof cls.construct !== 'function') {
            throw rt(`'${className}' does not name a type; did you forget an #include?`)
          }
          const obj = cls.construct(args, makeCtx(A.types, null))
          if (obj && typeof obj === 'object' && obj.__class === undefined) obj.__class = className
          store(env, obj)
        },
      }
    }

    if (dims) {
      const init = item.init ? lowerExpr(item.init) : null
      const fill = () => makeArray(dims.map((d) => d ?? 0), element, structName)
      const conv = converterFor(element, undefined)
      const assign = (env, value) => {
        const arr = fill()
        if (value !== undefined) fillArray(arr, value, dims, conv, element, structName)
        store(env, arr)
      }
      if (!init) return { pure: true, fn: (env) => { if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 } assign(env, undefined) } }
      if (init.pure) {
        const f = init.fn
        return { pure: true, fn: (env) => { if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 } assign(env, f(env)) } }
      }
      const g = init.fn
      return {
        pure: false,
        fn: function* (env) {
          if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 }
          assign(env, yield* g(env))
        },
      }
    }

    if (item.ctype === 'object' && structName) {
      const init = item.init ? lowerExpr(item.init) : null
      const assign = (env, value) => {
        const obj = makeStruct(structName)
        if (value !== undefined) assignStruct(obj, value, structName)
        store(env, obj)
      }
      if (!init) return { pure: true, fn: (env) => { if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 } assign(env, undefined) } }
      if (init.pure) { const f = init.fn; return { pure: true, fn: (env) => { if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 } assign(env, f(env)) } } }
      const g = init.fn
      return { pure: false, fn: function* (env) { if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 } assign(env, yield* g(env)) } }
    }

    const init = item.init ? lowerExpr(item.init) : null
    const conv = converterFor(item.ctype, init?.t)
    const fallback = defaultValue(item.ctype, structName)
    if (!init) {
      return {
        pure: true,
        fn: (env) => {
          if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 }
          store(env, fallback)
        },
      }
    }
    if (init.pure) {
      const f = init.fn
      return {
        pure: true,
        fn: (env) => {
          if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 }
          store(env, applyConv(conv, f(env)))
        },
      }
    }
    const g = init.fn
    return {
      pure: false,
      fn: function* (env) {
        if (staticId != null) { if (staticsDone[staticId]) return; staticsDone[staticId] = 1 }
        store(env, applyConv(conv, yield* g(env)))
      },
    }
  }

  /** Copies an initialiser (list, or string for `char[]`) into a freshly-made array. */
  function fillArray(arr, value, dims, conv, element, structName) {
    if (typeof value === 'string' && element === 'char') {
      for (let i = 0; i < arr.length; i++) arr[i] = i < value.length ? value.charCodeAt(i) & 0xFF : 0
      return
    }
    if (!Array.isArray(value)) return
    for (let i = 0; i < arr.length && i < value.length; i++) {
      if (dims.length > 1 && Array.isArray(arr[i])) fillArray(arr[i], value[i], dims.slice(1), conv, element, structName)
      else if (element === 'object' && structName && arr[i] && typeof arr[i] === 'object') assignStruct(arr[i], value[i], structName)
      else arr[i] = conv ? conv(value[i]) : value[i]
    }
  }

  /** Applies `{1, 2}` (or another object) to a struct instance, field by field. */
  function assignStruct(obj, value, structName) {
    const def = structs[structName]
    if (Array.isArray(value) && def) {
      for (let i = 0; i < def.fields.length && i < value.length; i++) {
        obj[def.fields[i].name] = wrapToType(value[i], def.fields[i].ctype, intBits)
      }
    } else if (value && typeof value === 'object') {
      Object.assign(obj, value)
    }
    return obj
  }

  function lowerDecl(node) {
    const items = node.items.map(lowerDeclItem)
    const line = node.line
    if (items.every((x) => x.pure)) {
      const fns = items.map((x) => x.fn)
      return { pure: true, line, fn: (env) => { for (let i = 0; i < fns.length; i++) fns[i](env); return undefined } }
    }
    return {
      pure: false,
      line,
      fn: function* (env) {
        S.line = line
        if (++S.count >= S.checkAt) yield TICK
        for (const item of items) {
          if (item.pure) item.fn(env)
          else yield* item.fn(env)
        }
        return undefined
      },
    }
  }

  /** Executes a statement list, counting each statement exactly once. */
  function blockDriver(list) {
    return function* (env) {
      for (let i = 0; i < list.length; i++) {
        const s = list[i]
        if (s.pure) {
          S.line = s.line
          if (++S.count >= S.checkAt) yield TICK
          const sig = s.fn(env)
          if (sig !== undefined) return sig
        } else {
          const sig = yield* s.fn(env)
          if (sig !== undefined) return sig
        }
      }
      return undefined
    }
  }

  /**
   * A statement used as a loop/branch body: either a flat list of pure leaves (inlined by the caller, keeping
   * the per-statement count) or a generator.
   */
  function lowerBody(stmt) {
    if (!stmt) return { list: [], gen: null }
    const flat = stmt.k === 'block' ? stmt.body : [stmt]
    const lowered = flat.map(lowerStmt)
    if (lowered.every((s) => s.pure)) return { list: lowered, gen: null }
    return { list: null, gen: blockDriver(lowered) }
  }

  function lowerIf(node) {
    const C = lowerExpr(node.c)
    const cond = C.pure ? C.fn : null
    const gcond = C.pure ? null : C.fn
    const thenB = lowerBody(node.then)
    const elseB = node.alt ? lowerBody(node.alt) : null
    const line = node.line
    return {
      pure: false,
      line,
      fn: function* (env) {
        S.line = line
        if (++S.count >= S.checkAt) yield TICK
        const test = truthy(cond ? cond(env) : yield* gcond(env))
        const body = test ? thenB : elseB
        if (!body) return undefined
        if (body.list) {
          for (let i = 0; i < body.list.length; i++) {
            const s = body.list[i]
            S.line = s.line
            if (++S.count >= S.checkAt) yield TICK
            const sig = s.fn(env)
            if (sig !== undefined) return sig
          }
          return undefined
        }
        return yield* body.gen(env)
      },
    }
  }

  function lowerWhile(node) {
    const C = lowerExpr(node.c)
    const cond = C.pure ? C.fn : null
    const gcond = C.pure ? null : C.fn
    const body = lowerBody(node.body)
    const line = node.line
    return {
      pure: false,
      line,
      fn: function* (env) {
        for (;;) {
          S.line = line
          if (++S.count >= S.checkAt) yield TICK
          if (!truthy(cond ? cond(env) : yield* gcond(env))) return undefined
          let sig
          if (body.list) {
            sig = undefined
            for (let i = 0; i < body.list.length; i++) {
              const s = body.list[i]
              S.line = s.line
              if (++S.count >= S.checkAt) yield TICK
              const r = s.fn(env)
              if (r !== undefined) { sig = r; break }
            }
          } else {
            sig = yield* body.gen(env)
          }
          if (sig === BREAK) return undefined
          if (sig === RETURN) return sig
        }
      },
    }
  }

  function lowerDoWhile(node) {
    const C = lowerExpr(node.c)
    const cond = C.pure ? C.fn : null
    const gcond = C.pure ? null : C.fn
    const body = lowerBody(node.body)
    const line = node.line
    return {
      pure: false,
      line,
      fn: function* (env) {
        for (;;) {
          let sig
          if (body.list) {
            sig = undefined
            for (let i = 0; i < body.list.length; i++) {
              const s = body.list[i]
              S.line = s.line
              if (++S.count >= S.checkAt) yield TICK
              const r = s.fn(env)
              if (r !== undefined) { sig = r; break }
            }
          } else {
            sig = yield* body.gen(env)
          }
          if (sig === BREAK) return undefined
          if (sig === RETURN) return sig
          S.line = line
          if (++S.count >= S.checkAt) yield TICK
          if (!truthy(cond ? cond(env) : yield* gcond(env))) return undefined
        }
      },
    }
  }

  function lowerFor(node) {
    const init = node.init ? lowerStmt(node.init) : null
    const C = node.cond ? lowerExpr(node.cond) : null
    const cond = C && C.pure ? C.fn : null
    const gcond = C && !C.pure ? C.fn : null
    const ST = node.step ? lowerExpr(node.step) : null
    const step = ST && ST.pure ? ST.fn : null
    const gstep = ST && !ST.pure ? ST.fn : null
    const body = lowerBody(node.body)
    const line = node.line
    return {
      pure: false,
      line,
      fn: function* (env) {
        if (init) {
          if (init.pure) {
            S.line = init.line
            if (++S.count >= S.checkAt) yield TICK
            init.fn(env)
          } else {
            yield* init.fn(env)
          }
        }
        for (;;) {
          S.line = line
          if (++S.count >= S.checkAt) yield TICK
          if (C && !truthy(cond ? cond(env) : yield* gcond(env))) return undefined
          let sig
          if (body.list) {
            sig = undefined
            for (let i = 0; i < body.list.length; i++) {
              const s = body.list[i]
              S.line = s.line
              if (++S.count >= S.checkAt) yield TICK
              const r = s.fn(env)
              if (r !== undefined) { sig = r; break }
            }
          } else {
            sig = yield* body.gen(env)
          }
          if (sig === BREAK) return undefined
          if (sig === RETURN) return sig
          if (ST) { if (step) step(env); else yield* gstep(env) }
        }
      },
    }
  }

  function lowerSwitch(node) {
    const D = lowerExpr(node.disc)
    const disc = D.pure ? D.fn : null
    const gdisc = D.pure ? null : D.fn
    const cases = node.cases.map((c) => ({ index: c.index, e: lowerExpr(c.value) }))
    const list = node.body.map(lowerStmt)
    const defaultIndex = node.defaultIndex
    const line = node.line
    const textual = D.t === 'String'
    return {
      pure: false,
      line,
      fn: function* (env) {
        S.line = line
        if (++S.count >= S.checkAt) yield TICK
        const d = disc ? disc(env) : yield* gdisc(env)
        let start = defaultIndex
        for (const c of cases) {
          const v = c.e.pure ? c.e.fn(env) : yield* c.e.fn(env)
          const hit = textual ? toText(d, D.t, intBits) === toText(v, c.e.t, intBits) : d === v
          if (hit) { start = c.index; break }
        }
        if (start < 0) return undefined
        for (let i = start; i < list.length; i++) {
          const s = list[i]
          let sig
          if (s.pure) {
            S.line = s.line
            if (++S.count >= S.checkAt) yield TICK
            sig = s.fn(env)
          } else {
            sig = yield* s.fn(env)
          }
          if (sig === BREAK) return undefined
          if (sig === CONTINUE || sig === RETURN) return sig
        }
        return undefined
      },
    }
  }

  // --------------------------------------------------------------------------------------- functions

  const lowered = program.functions.map(() => null)

  function loweredFunction(index) {
    let f = lowered[index]
    if (f) return f
    const decl = program.functions[index]
    if (!decl || !decl.body) return null
    f = {
      name: decl.name,
      frameSize: decl.frameSize,
      params: decl.params.map((p) => ({ index: p.index, conv: converterFor(p.ctype, undefined) })),
      exec: blockDriver(decl.body.map(lowerStmt)),
    }
    lowered[index] = f
    return f
  }

  function* callFunction(index, args, closureEnv = null) {
    const f = loweredFunction(index)
    if (!f) throw rt(`'${program.functions[index]?.name ?? 'function'}' was not declared in this scope`)
    // The call itself costs a statement, which also guarantees the scheduler always makes progress.
    if (++S.count >= S.checkAt) yield TICK
    if (++S.depth > MAX_CALL_DEPTH) {
      S.depth--
      throw rt(`call depth exceeded ${MAX_CALL_DEPTH} — infinite recursion?`)
    }
    const env = { slots: new Array(f.frameSize), parent: closureEnv }
    for (let i = 0; i < f.params.length; i++) {
      const p = f.params[i]
      const v = args[i]
      env.slots[p.index] = p.conv ? p.conv(v === undefined ? 0 : v) : v
    }
    S.ret = undefined
    const sig = yield* f.exec(env)
    S.depth--
    return sig === RETURN ? S.ret : undefined
  }

  // --------------------------------------------------------------------------------------- scheduler

  let globalInitExec = null

  function* mainLoop() {
    if (!globalInitExec) globalInitExec = blockDriver(program.globalInit.map(lowerStmt))
    yield* globalInitExec(emptyEnv)
    if (program.setup != null) yield* callFunction(program.setup, [])
    if (program.loop == null) return
    for (;;) {
      yield* callFunction(program.loop, [])
      yield TICK
    }
  }

  function toError(e) {
    if (e instanceof RuntimeError) return { message: e.message, line: e.line }
    return { message: e && e.message ? String(e.message) : String(e), line: S.line }
  }

  function halt() { S.halted = true }

  /** Resets the machine and prepares the `setup()` → `loop()` sequence. */
  function start() {
    globals = new Array(program.globalCount ?? 0)
    staticsDone = new Uint8Array(program.staticCount ?? 0)
    S.count = 0
    S.sleepUs = 0
    S.line = 0
    S.depth = 0
    S.halted = false
    S.error = null
    S.ret = undefined
    S.started = true
    S.checkAt = Infinity
    S.wakeAtUs = null
    iterator = mainLoop()
  }

  /**
   * Runs at most `maxStatements` statements.
   * @returns {{ status: 'running'|'sleeping'|'halted'|'error', wakeAtUs?: number, error?: {message,line} }}
   */
  function step(maxStatements = 1000) {
    if (S.error) return { status: 'error', error: S.error }
    if (S.halted) return { status: 'halted' }
    if (!iterator) start()
    // Still sleeping: the sketch must not resume (and must not lose the delay) until virtual time has caught up.
    if (S.wakeAtUs !== null) {
      if (now() < S.wakeAtUs) return { status: 'sleeping', wakeAtUs: S.wakeAtUs }
      S.wakeAtUs = null
    }
    const budget = Math.max(0, Math.trunc(Number(maxStatements) || 0))
    if (budget === 0) return { status: 'running' }
    const end = S.count + budget
    S.checkAt = Math.min(S.count + TICK_INTERVAL, end)
    for (;;) {
      let r
      try {
        r = iterator.next()
      } catch (e) {
        S.checkAt = Infinity
        S.halted = true
        S.error = toError(e)
        try { host.onError?.(S.error) } catch { /* a failing error hook must not mask the error */ }
        return { status: 'error', error: S.error }
      }
      if (r.done || S.halted) {
        S.checkAt = Infinity
        S.halted = true
        return { status: 'halted' }
      }
      const y = r.value
      if (y !== TICK && y && y.type === 'sleep') {
        S.checkAt = Infinity
        S.wakeAtUs = y.untilUs
        return { status: 'sleeping', wakeAtUs: y.untilUs }
      }
      if (S.count >= end) {
        S.checkAt = Infinity
        return { status: 'running' }
      }
      S.checkAt = Math.min(S.count + TICK_INTERVAL, end)
    }
  }

  /** Moves virtual time forward (used to satisfy a `sleeping` status). */
  function advanceTo(us) {
    const target = Math.trunc(Number(us))
    if (!Number.isFinite(target)) return
    const cur = now()
    if (target > cur) S.sleepUs += target - cur
  }

  /**
   * Runs a callable to completion right now (ISRs, HTTP handlers, MQTT callbacks). Nested sleeps advance
   * virtual time inline instead of suspending.
   */
  function call(callable, args = []) {
    const savedDepth = S.depth
    const savedCheck = S.checkAt
    const deadline = S.count + callBudget
    S.checkAt = Infinity
    try {
      const it = invokeValue(callable, args, [])
      let r = it.next()
      while (!r.done) {
        const y = r.value
        if (y && y.type === 'sleep') advanceTo(y.untilUs)
        if (S.count > deadline) throw rt('callback did not return')
        r = it.next()
      }
      return { status: 'ok', value: r.value }
    } catch (e) {
      S.depth = savedDepth
      const err = toError(e)
      try { host.onError?.(err) } catch { /* ignore */ }
      return { status: 'error', error: err }
    } finally {
      S.depth = savedDepth
      S.checkAt = savedCheck
    }
  }

  function globalIndex(name) {
    const i = program.globalNames?.[name]
    return typeof i === 'number' ? i : -1
  }

  const vm = {
    start,
    step,
    now,
    advanceTo,
    call,
    getGlobal(name) {
      const i = globalIndex(name)
      return i < 0 ? undefined : globals[i]
    },
    setGlobal(name, value) {
      const i = globalIndex(name)
      if (i < 0) return false
      const t = program.globalTypes?.[name]
      globals[i] = t ? wrapToType(value, t, intBits) : value
      return true
    },
    halt,
    get halted() { return S.halted },
    get lastLine() { return S.line },
    get statementCount() { return S.count },
    get error() { return S.error },
    /** Exposed for tests and the runtime: the statement counter drives virtual time. */
    get intBits() { return intBits },
  }
  return vm
}
