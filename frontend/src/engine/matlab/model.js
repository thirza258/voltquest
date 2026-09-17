import { parse } from './parser.js'
import { createNumeric, isMatrix, scalar, LIMITS } from './numeric.js'
import { createFunctions } from './functions.js'

export { SIGNATURES } from './functions.js'
export { LIMITS } from './numeric.js'

export const formatNumber = value => Number.isInteger(value) ? String(value) : Number(value.toPrecision(8)).toString()
export function formatValue(value) {
  if (typeof value === 'string') return value
  if (value?.kind === 'function') return `@(${value.params.join(',')}) …`
  if (!isMatrix(value)) return ''
  const rows = Math.min(value.rows, 12), cols = Math.min(value.cols, 12)
  const text = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => formatNumber(value.data[c * value.rows + r])).join('  ') + (cols < value.cols ? '  …' : '')).join('\n')
  return text + (rows < value.rows ? '\n…' : '')
}

/** A fresh deterministic workspace for each script. No host objects enter its environment. */
export function runMatlab(source) {
  const ast = parse(source)
  let operations = 0, allocated = 0, randomState = 1, callDepth = 0, outputTruncated = false
  const budget = {
    tick(count = 1) { operations += count; if (operations > LIMITS.operations) throw new Error('Execution limit reached. Reduce loop counts or array sizes.') },
    allocate(count) { allocated += count; if (allocated > LIMITS.allocations) throw new Error('Allocation limit reached. Use smaller arrays or fewer iterations.') },
  }
  const n = createNumeric(budget), env = Object.create(null), output = []
  const context = {
    budget, plots: [], labels: { title: '', xlabel: '', ylabel: '' }, holding: false,
    seed(value) { randomState = value >>> 0 },
    random() { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296 },
    print(value, label = '') { if (output.length < LIMITS.output) output.push((label ? `${label} =\n` : '') + formatValue(value)); else outputTruncated = true },
    truth(value) { n.numeric(value); return value.data.length > 0 && value.data.every(Boolean) },
    call(fn, args) {
      if (++callDepth > 32) throw new Error('Function call nesting exceeds 32 levels.')
      try {
        if (args.length !== fn.params.length) throw new Error('Anonymous function argument count does not match its parameters.')
        const scope = Object.assign(Object.create(null), fn.scope)
        fn.params.forEach((name, i) => { scope[name] = args[i] })
        return evaluate(fn.body, scope)
      } finally { callDepth-- }
    },
  }
  const functions = createFunctions(n, context)
  function set(scope, name, value) {
    if (value === null || value === undefined) throw new Error('This statement does not return a value to assign.')
    if (!Object.hasOwn(scope, name) && Object.keys(scope).length >= LIMITS.variables) throw new Error('Keep the workspace within 128 variables.')
    scope[name] = value
  }
  function argsFor(node, scope, array, endValue) {
    return node.args.map((arg, i) => evaluate(arg, scope, array ? (node.args.length === 1 ? array.data.length : i === 0 ? array.rows : array.cols) : endValue))
  }
  function evaluate(node, scope, endValue) {
    budget.tick()
    switch (node.type) {
      case 'number': return n.num(node.value)
      case 'string': return node.value
      case 'all': return ':'
      case 'name': {
        if (node.name === 'end' && endValue !== undefined) return n.num(endValue)
        if (Object.hasOwn(scope, node.name)) return scope[node.name]
        if (node.name === 'pi') return n.num(Math.PI)
        if (node.name === 'eps') return n.num(Number.EPSILON)
        if (node.name === 'true' || node.name === 'false') return { ...n.num(Number(node.name === 'true')), logical: true }
        throw new Error(`Unknown variable ${node.name}. Assign it before use; call functions with parentheses.`)
      }
      case 'lambda': return { kind: 'function', params: node.params, body: node.body, scope: { ...scope } }
      case 'transpose': return n.transpose(evaluate(node.value, scope, endValue))
      case 'range': return n.range(scalar(evaluate(node.start, scope, endValue)), node.step ? scalar(evaluate(node.step, scope, endValue)) : 1, scalar(evaluate(node.end, scope, endValue)))
      case 'unary': return n.map(evaluate(node.value, scope, endValue), x => node.op === '-' ? -x : node.op === '~' ? Number(!x) : x, node.op === '~')
      case 'array': {
        const groups = node.rows.map(row => row.map(value => n.numeric(evaluate(value, scope, endValue))))
        const widths = groups.map(row => row.reduce((sum, a) => sum + a.cols, 0))
        if (new Set(widths).size > 1 || groups.some(row => new Set(row.map(a => a.rows)).size > 1)) throw new Error('Array concatenation dimensions do not match.')
        const heights = groups.map(row => row[0]?.rows ?? 0)
        return n.mat(heights.reduce((a, b) => a + b, 0), widths[0] ?? 0, (r, c) => {
          let group = 0, row = r
          while (row >= heights[group]) row -= heights[group++]
          let part = 0, col = c
          while (col >= groups[group][part].cols) col -= groups[group][part++].cols
          return n.at(groups[group][part], row, col)
        }, groups.length > 0 && groups.every(row => row.every(a => a.logical)))
      }
      case 'call': {
        if (Object.hasOwn(scope, node.name)) {
          const value = scope[node.name], args = argsFor(node, scope, isMatrix(value) ? value : null)
          if (value?.kind === 'function') return context.call(value, args)
          const selection = n.selection(value, args)
          return n.mat(selection.rows, selection.cols, selection.idx.map(i => value.data[i]), value.logical)
        }
        if (!Object.hasOwn(functions, node.name)) throw new Error(`${node.name} is not supported in this browser subset. Check the function reference for desktop MATLAB guidance.`)
        return functions[node.name](argsFor(node, scope, null, endValue))
      }
      case 'binary': {
        const left = evaluate(node.left, scope, endValue)
        if (node.op === '&&' || node.op === '||') {
          const a = scalar(left)
          if ((node.op === '&&' && !a) || (node.op === '||' && a)) return { ...n.num(Number(Boolean(a))), logical: true }
          return { ...n.num(Number(Boolean(scalar(evaluate(node.right, scope, endValue))))), logical: true }
        }
        const right = evaluate(node.right, scope, endValue)
        const binary = { '+': (a, b) => a + b, '-': (a, b) => a - b, '.*': (a, b) => a * b, './': (a, b) => a / b, '.\\': (a, b) => b / a,
          '.^': (a, b) => a ** b, '<': (a, b) => Number(a < b), '>': (a, b) => Number(a > b), '<=': (a, b) => Number(a <= b), '>=': (a, b) => Number(a >= b),
          '==': (a, b) => Number(a === b), '~=': (a, b) => Number(a !== b), '&': (a, b) => Number(Boolean(a) && Boolean(b)), '|': (a, b) => Number(Boolean(a) || Boolean(b)) }
        if (Object.hasOwn(binary, node.op)) return n.pair(left, right, binary[node.op], ['<', '>', '<=', '>=', '==', '~=', '&', '|'].includes(node.op))
        if (node.op === '*') return n.multiply(left, right)
        if (node.op === '\\') return left.data?.length === 1 ? n.pair(right, left, (a, b) => a / b) : n.solve(left, right)
        if (node.op === '/') {
          if (right.data?.length === 1) return n.pair(left, right, (a, b) => a / b)
          throw new Error('Matrix right division is desktop-only. Use A\\b for a linear system or ./ for element-wise division.')
        }
        if (node.op === '^') {
          const power = scalar(right)
          if (left.data?.length === 1) return n.num(scalar(left) ** power)
          n.numeric(left)
          if (left.rows !== left.cols || !Number.isInteger(power) || power < 0 || power > 32) throw new Error('Matrix powers require a square matrix and an integer exponent 0–32. Use .^ for element-wise powers.')
          let answer = n.mat(left.rows, left.cols, (r, c) => Number(r === c))
          for (let i = 0; i < power; i++) answer = n.multiply(answer, left)
          return answer
        }
        throw new Error('Unsupported operator.')
      }
      default: throw new Error('Unsupported expression.')
    }
  }
  function execute(statements, loopDepth = 0) {
    for (const node of statements) {
      budget.tick()
      try {
        if (node.type === 'assign') {
          const value = evaluate(node.value, env)
          if (node.target.type === 'name') set(env, node.target.name, value)
          else {
            const current = env[node.target.name]
            if (!isMatrix(current)) throw new Error('Preallocate a numeric array before assigning its elements.')
            n.numeric(value)
            const selection = n.selection(current, argsFor(node.target, env, current))
            if (value.data.length !== 1 && value.data.length !== selection.idx.length) throw new Error('The number of assigned elements must match the index selection.')
            if (node.target.args.length === 2 && value.data.length !== 1 && (value.rows !== selection.rows || value.cols !== selection.cols)) throw new Error('The assigned array must match the selected row and column dimensions.')
            const copy = n.mat(current.rows, current.cols, current.data, current.logical)
            selection.idx.forEach((index, i) => { const entry = value.data.length === 1 ? value.data[0] : value.data[i]; copy.data[index] = current.logical ? Number(Boolean(entry)) : entry })
            set(env, node.target.name, copy)
          }
          if (!node.silent) context.print(env[node.target.name], node.target.name)
        } else if (node.type === 'expression') {
          const value = evaluate(node.value, env)
          if (value !== null) { set(env, 'ans', value); if (!node.silent) context.print(value, 'ans') }
        } else if (node.type === 'if') {
          const branch = node.branches.find(branch => context.truth(evaluate(branch.condition, env)))
          const signal = execute(branch?.body ?? node.otherwise, loopDepth); if (signal) return signal
        } else if (node.type === 'for') {
          const values = n.numeric(evaluate(node.values, env))
          for (let c = 0; c < values.cols; c++) {
            budget.tick(); set(env, node.name, n.mat(values.rows, 1, values.data.slice(c * values.rows, (c + 1) * values.rows)))
            if (execute(node.body, loopDepth + 1) === 'break') break
          }
        } else if (node.type === 'while') {
          while (context.truth(evaluate(node.condition, env))) { budget.tick(); if (execute(node.body, loopDepth + 1) === 'break') break }
        } else if (node.type === 'break' || node.type === 'continue') {
          if (!loopDepth) throw new Error(`${node.type} needs an enclosing loop.`)
          return node.type
        } else if (node.type === 'clear') { for (const key of Object.keys(env)) delete env[key] }
        else if (node.type === 'clc') { output.length = 0; outputTruncated = false }
      } catch (error) { if (/^Line \d+:/.test(error.message)) throw error; throw new Error(`Line ${node.line}: ${error.message}`) }
    }
    return null
  }
  execute(ast)
  return {
    source, output, outputTruncated, plots: context.plots, labels: context.labels,
    workspace: Object.entries(env).map(([name, value]) => isMatrix(value)
      ? { name, type: value.logical ? 'logical' : 'double', rows: value.rows, cols: value.cols, values: value.data.slice(0, 256), truncated: value.data.length > 256 }
      : { name, type: typeof value === 'string' ? 'text' : 'function', text: formatValue(value) }),
    operations,
  }
}
