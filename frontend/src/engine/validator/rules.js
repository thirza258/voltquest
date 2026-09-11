/**
 * The quest rule engine — one evaluator per rule type in QUEST_SCHEMA.md.
 *
 * Every evaluator returns `{ passed, detail }`. The `detail` string is what the hint panel shows a
 * stuck player, so it must say what was actually observed ("Pin D13 toggled 2 times, needs 18"),
 * never just "failed".
 *
 * Rules that need a running sketch refuse politely while the simulation is idle rather than
 * throwing: wiring rules work at idle because the board is powered at idle, firmware rules do not.
 */
import { findPath } from '../circuit/index.js'
import {
  componentMatches,
  describeSelector,
  firstTerminal,
  matchingComponents,
  readPath,
  resolveNets,
  resolveTerminals,
  voltageAt,
} from './selectors.js'

const ok = (detail) => ({ passed: true, detail })
const no = (detail) => ({ passed: false, detail })

/** Rule types that can only be judged while the sketch is running. */
const NEEDS_RUNNING = new Set([
  'pin_toggles', 'pin_period', 'pin_pattern', 'pin_state', 'pwm_varies', 'pwm_duty_between',
  'analog_read_seen', 'touch_used', 'serial_matches', 'peripheral_state',
  'wifi_connected', 'http_route_exists', 'http_response_matches', 'mqtt_published',
])

const ms = (us) => us / 1000
const fmtMs = (us) => `${Math.round(ms(us))} ms`

/** Count of non-empty, non-comment lines — the "code length" a three-star rule measures. */
export function countCodeLines(code = '') {
  let inBlock = false
  let n = 0
  for (const raw of String(code).split('\n')) {
    let line = raw.trim()
    if (inBlock) {
      const end = line.indexOf('*/')
      if (end === -1) continue
      line = line.slice(end + 2).trim()
      inBlock = false
    }
    while (line.includes('/*')) {
      const start = line.indexOf('/*')
      const end = line.indexOf('*/', start + 2)
      if (end === -1) {
        line = line.slice(0, start).trim()
        inBlock = true
        break
      }
      line = (line.slice(0, start) + line.slice(end + 2)).trim()
    }
    if (!line || line.startsWith('//')) continue
    n++
  }
  return n
}

function regexOf(pattern, flags) {
  try {
    return new RegExp(pattern, flags ?? '')
  } catch {
    return null
  }
}

/** Trace lookups guarded so a missing trace reads as "nothing observed" instead of throwing. */
const traceOf = (ctx) => ctx.sim?.trace ?? null

const RULES = {
  component_present(rule, ctx) {
    const min = rule.min ?? 1
    const found = matchingComponents(ctx.doc, rule).length
    return found >= min
      ? ok(`Found ${found} × ${rule.componentType}`)
      : no(`Needs ${min} × ${describeSelector(rule)}, found ${found}`)
  },

  component_absent(rule, ctx) {
    const found = matchingComponents(ctx.doc, rule).length
    return found === 0 ? ok(`No ${rule.componentType} on the board`) : no(`Remove the ${rule.componentType} (${found} placed)`)
  },

  mcu_is(rule, ctx) {
    const board = ctx.compiled?.mcu?.board?.id ?? ctx.doc?.mcu ?? null
    return board === rule.board
      ? ok(`Board is ${rule.board}`)
      : no(`Needs the ${rule.board} board${board ? `, found ${board}` : ' — no board placed'}`)
  },

  path(rule, ctx) {
    const from = firstTerminal(rule.from, ctx)
    const to = firstTerminal(rule.to, ctx)
    if (!from) return no(`Cannot find ${describeSelector(rule.from)}`)
    if (!to) return no(`Cannot find ${describeSelector(rule.to)}`)
    const through = (rule.through ?? []).map((t) => ({ type: t.componentType, props: t.props }))
    const found = findPath(ctx.compiled, from, to, { through, exact: rule.exact ?? false, maxHops: rule.maxHops ?? 6 })
    if (found) return ok(`${describeSelector(rule.from)} reaches ${describeSelector(rule.to)}`)
    const via = through.length
      ? ` through ${through.map((t) => (t.props?.ohms ? `a ${t.props.ohms} Ω ${t.type}` : `a ${t.type}`)).join(', then ')}`
      : ''
    return no(`No connection from ${describeSelector(rule.from)} to ${describeSelector(rule.to)}${via}`)
  },

  net_has(rule, ctx) {
    const nets = resolveNets(rule.net, ctx)
    if (!nets.length) return no(`Cannot find the net for ${describeSelector(rule.net)}`)
    const wanted = resolveTerminals(rule.contains, ctx)
    if (!wanted.length) return no(`Cannot find ${describeSelector(rule.contains)}`)
    const hit = wanted.find((t) => nets.includes(ctx.compiled?.terminalToNet?.[t]))
    return hit
      ? ok(`${describeSelector(rule.contains)} is on the ${describeSelector(rule.net)} net`)
      : no(`${describeSelector(rule.contains)} is not connected to ${describeSelector(rule.net)}`)
  },

  pin_connected_to(rule, ctx) {
    return RULES.net_has(
      { net: { mcuPin: rule.pin }, contains: { componentType: rule.componentType, pin: rule.componentPin } },
      ctx,
    )
  },

  pin_toggles(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    const since = rule.windowMs ? Math.max(0, trace.nowUs() - rule.windowMs * 1000) : 0
    const edges = trace.edgesOf(rule.pin, since)
    const window = rule.windowMs ? ` within ${rule.windowMs} ms` : ''
    return edges >= rule.minEdges
      ? ok(`${rule.pin} toggled ${edges} times${window}`)
      : no(`${rule.pin} toggled ${edges} times${window}, needs ${rule.minEdges}`)
  },

  pin_period(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    const minCycles = rule.minCycles ?? 2
    const edges = trace.edgesOf(rule.pin)
    if (edges < minCycles * 2) return no(`${rule.pin} has only ${edges} edges — let it run a little longer`)
    const period = trace.periodOf(rule.pin)
    if (period == null) return no(`${rule.pin} is not blinking at a steady rate yet`)
    const tolerance = rule.toleranceMs ?? 100
    const delta = Math.abs(ms(period) - rule.periodMs)
    return delta <= tolerance
      ? ok(`${rule.pin} blinks every ${fmtMs(period)}`)
      : no(`${rule.pin} blinks every ${fmtMs(period)}, needs ${rule.periodMs} ms ± ${tolerance} ms`)
  },

  pin_pattern(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    const segments = trace.segmentsOf(rule.pin)
    const pattern = rule.pattern ?? []
    if (!pattern.length) return ok('No pattern required')
    if (segments.length < pattern.length) {
      return no(`${rule.pin} has ${segments.length} level changes, the pattern needs ${pattern.length}`)
    }
    const tol = rule.toleranceRatio ?? 0.35
    // Slide the pattern over the trace; a single match anywhere is enough.
    for (let start = 0; start + pattern.length <= segments.length; start++) {
      let matched = true
      for (let i = 0; i < pattern.length; i++) {
        const seg = segments[start + i]
        const want = pattern[i]
        const duration = ms(seg.toUs - seg.fromUs)
        if (seg.level !== want.level) { matched = false; break }
        // The final segment may still be open-ended, so only require it to be long enough.
        const last = start + i === segments.length - 1
        const lo = want.ms * (1 - tol)
        const hi = want.ms * (1 + tol)
        if (duration < lo || (!last && duration > hi)) { matched = false; break }
      }
      if (matched) return ok(`${rule.pin} matched the ${pattern.length}-step pattern`)
    }
    const seen = segments.slice(0, Math.min(6, segments.length)).map((s) => `${s.level ? 'on' : 'off'} ${fmtMs(s.toUs - s.fromUs)}`).join(', ')
    return no(`${rule.pin} did not match the required rhythm (saw ${seen || 'nothing'})`)
  },

  pin_state(rule, ctx) {
    const state = ctx.sim?.mcuPins?.[rule.pin]
    if (!state) return no(`${rule.pin} has not been driven`)
    if (state.level !== rule.level) return no(`${rule.pin} is ${state.level ? 'HIGH' : 'LOW'}, needs ${rule.level ? 'HIGH' : 'LOW'}`)
    if (rule.forMs) {
      const trace = traceOf(ctx)
      const held = trace ? ms(trace.nowUs() - (trace.pinEvents.filter((e) => e.pin === rule.pin).at(-1)?.t ?? 0)) : 0
      if (held < rule.forMs) return no(`${rule.pin} held for ${Math.round(held)} ms, needs ${rule.forMs} ms`)
    }
    return ok(`${rule.pin} is ${rule.level ? 'HIGH' : 'LOW'}`)
  },

  pwm_varies(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    const duties = trace.distinctDuties(rule.pin)
    const need = rule.minDistinctDuties ?? 3
    return duties.length >= need
      ? ok(`${rule.pin} used ${duties.length} different brightness levels`)
      : no(`${rule.pin} used ${duties.length} brightness level${duties.length === 1 ? '' : 's'}, needs ${need}`)
  },

  pwm_duty_between(rule, ctx) {
    const duty = ctx.sim?.mcuPins?.[rule.pin]?.duty
    if (typeof duty !== 'number') return no(`${rule.pin} is not producing PWM`)
    return duty >= rule.min && duty <= rule.max
      ? ok(`${rule.pin} duty is ${(duty * 100).toFixed(0)} %`)
      : no(`${rule.pin} duty is ${(duty * 100).toFixed(0)} %, needs ${(rule.min * 100).toFixed(0)}–${(rule.max * 100).toFixed(0)} %`)
  },

  analog_read_seen(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    let samples = trace.analogReads.filter((r) => r.pin === rule.pin)
    const before = samples.length
    if (typeof rule.min === 'number') samples = samples.filter((r) => r.value >= rule.min)
    if (typeof rule.max === 'number') samples = samples.filter((r) => r.value <= rule.max)
    const need = rule.minSamples ?? 1
    if (samples.length >= need) return ok(`Read ${rule.pin} ${samples.length} times`)
    if (!before) return no(`Nothing has called analogRead(${rule.pin}) yet`)
    const range = [rule.min != null ? `≥ ${rule.min}` : null, rule.max != null ? `≤ ${rule.max}` : null].filter(Boolean).join(' and ')
    return no(`${rule.pin} was read ${before} times but ${samples.length} reading(s) were ${range || 'in range'}, needs ${need}`)
  },

  touch_used(rule, ctx) {
    const trace = traceOf(ctx)
    if (!trace) return no('No simulation trace yet')
    const reads = rule.pin ? trace.touchReads.filter((r) => r.pin === rule.pin) : trace.touchReads
    const where = rule.pin ? ` on ${rule.pin}` : ''
    return reads.length > 0
      ? ok(`touchRead${where} called ${reads.length} times`)
      : no(`Nothing has called touchRead${where} yet`)
  },

  serial_matches(rule, ctx) {
    const re = regexOf(rule.pattern, rule.flags)
    if (!re) return no(`Invalid serial pattern: ${rule.pattern}`)
    const text = traceOf(ctx)?.serialText ?? ''
    if (re.test(text)) return ok('Serial output matched')
    const tail = text.trim().split('\n').slice(-1)[0] ?? ''
    return no(text ? `Serial output does not match /${rule.pattern}/ (last line: "${tail}")` : 'Nothing printed to Serial yet')
  },

  code_matches(rule, ctx) {
    const re = regexOf(rule.pattern, rule.flags)
    if (!re) return no(`Invalid code pattern: ${rule.pattern}`)
    return re.test(ctx.code ?? '') ? ok('Sketch uses the expected code') : no(`Your sketch needs ${rule.hint ?? `something matching /${rule.pattern}/`}`)
  },

  code_not_matches(rule, ctx) {
    const re = regexOf(rule.pattern, rule.flags)
    if (!re) return no(`Invalid code pattern: ${rule.pattern}`)
    return re.test(ctx.code ?? '') ? no(`Your sketch should not use /${rule.pattern}/`) : ok('Sketch avoids the forbidden code')
  },

  code_max_lines(rule, ctx) {
    const lines = countCodeLines(ctx.code)
    return lines <= rule.max ? ok(`${lines} lines of code`) : no(`${lines} lines of code, needs ${rule.max} or fewer`)
  },

  max_components(rule, ctx) {
    const exclude = new Set(rule.excludeTypes ?? [])
    const count = (ctx.doc?.components ?? []).filter((c) => !exclude.has(c.type) && !isMcuType(c.type, ctx)).length
    return count <= rule.max ? ok(`${count} components used`) : no(`${count} components used, needs ${rule.max} or fewer`)
  },

  led_lit(rule, ctx) {
    const states = ctx.sim?.evaluation?.componentStates ?? {}
    const min = rule.minBrightness ?? 0.2
    const want = rule.count ?? 1
    const leds = (ctx.doc?.components ?? []).filter((c) => c.type === 'led' || c.type === 'rgb_led')
    const matching = rule.props ? leds.filter((c) => componentMatches(c, { componentType: c.type, props: rule.props })) : leds
    const lit = matching.filter((c) => (states[c.id]?.brightness ?? 0) >= min)
    if (lit.length >= want) return ok(`${lit.length} LED${lit.length === 1 ? '' : 's'} lit`)
    if (!matching.length) return no('No LED on the board yet')
    const brightest = Math.max(...matching.map((c) => states[c.id]?.brightness ?? 0))
    const blown = matching.some((c) => states[c.id]?.state === 'blown')
    if (blown) return no('The LED is blown — press Reset sim and protect it with a resistor')
    return no(`Needs ${want} lit LED${want === 1 ? '' : 's'}; the brightest is at ${(brightest * 100).toFixed(0)} %`)
  },

  component_blown(rule, ctx) {
    const ids = new Set(matchingComponents(ctx.doc, rule).map((c) => c.id))
    const blew = (ctx.sim?.events ?? []).some((e) => e.type === 'blow' && ids.has(e.componentId))
    const states = ctx.sim?.evaluation?.componentStates ?? {}
    const isBlown = [...ids].some((id) => states[id]?.state === 'blown')
    return blew || isBlown
      ? ok(`The ${rule.componentType} let out its magic smoke`)
      : no(`The ${rule.componentType} has not blown yet`)
  },

  no_damage(_rule, ctx) {
    const events = (ctx.sim?.events ?? []).filter((e) => e.type === 'blow' || e.type === 'burnt_pin')
    return events.length === 0
      ? ok('Nothing has been damaged')
      : no(`${events.length} component${events.length === 1 ? '' : 's'} damaged — press Reset sim after fixing the circuit`)
  },

  no_warning(rule, ctx) {
    const count = ctx.sim?.warningCodesSeen?.[rule.code] ?? 0
    return count === 0 ? ok(`No ${rule.code} warning`) : no(warningText(rule.code, ctx))
  },

  warning_seen(rule, ctx) {
    const count = ctx.sim?.warningCodesSeen?.[rule.code] ?? 0
    return count > 0 ? ok(`Saw the ${rule.code} warning`) : no(`The ${rule.code} warning has not happened yet`)
  },

  voltage_between(rule, ctx) {
    const v = voltageAt(rule.at, ctx)
    if (v == null) return no(`Cannot measure ${describeSelector(rule.at)}`)
    return v >= rule.min && v <= rule.max
      ? ok(`${describeSelector(rule.at)} is at ${v.toFixed(2)} V`)
      : no(`${describeSelector(rule.at)} is at ${v.toFixed(2)} V, needs ${rule.min}–${rule.max} V`)
  },

  peripheral_state(rule, ctx) {
    const components = matchingComponents(ctx.doc, rule)
    if (!components.length) return no(`No ${rule.componentType} on the board`)
    for (const component of components) {
      const entry = ctx.sim?.peripherals?.[component.id]
      if (!entry) continue
      const value = readPath(entry, rule.path)
      if (value === undefined) continue
      if (rule.equals !== undefined) {
        if (value === rule.equals) return ok(`${rule.componentType} ${rule.path} is ${JSON.stringify(value)}`)
        continue
      }
      const numeric = Number(value)
      if (Number.isNaN(numeric)) continue
      if (typeof rule.min === 'number' && numeric < rule.min) continue
      if (typeof rule.max === 'number' && numeric > rule.max) continue
      return ok(`${rule.componentType} ${rule.path} is ${numeric}`)
    }
    const seen = components.map((c) => readPath(ctx.sim?.peripherals?.[c.id], rule.path)).find((v) => v !== undefined)
    return no(
      seen === undefined
        ? `The ${rule.componentType} has not reported anything yet`
        : `${rule.componentType} ${rule.path} is ${JSON.stringify(seen)}, which is outside the required range`,
    )
  },

  wifi_connected(_rule, ctx) {
    const status = ctx.sim?.wifi?.status
    if (status === 'connected' || status === 'ap') return ok(`Wi-Fi ${status} (${ctx.sim.wifi.ip ?? 'no ip'})`)
    return no(status === 'connecting' ? 'Still joining the network…' : 'The ESP32 has not joined VoltNet yet')
  },

  http_route_exists(rule, ctx) {
    const routes = ctx.sim?.http?.routes ?? []
    if (routes.includes(rule.path)) return ok(`Serving ${rule.path}`)
    if (!ctx.sim?.http?.started) return no('No web server is running — call server.begin()')
    return no(`No handler for ${rule.path} (serving: ${routes.join(', ') || 'nothing'})`)
  },

  http_response_matches(rule, ctx) {
    const re = regexOf(rule.pattern, rule.flags)
    if (!re) return no(`Invalid response pattern: ${rule.pattern}`)
    const entries = (ctx.sim?.http?.log ?? []).filter((e) => e.path === rule.path || e.path?.startsWith(`${rule.path}?`))
    if (!entries.length) return no(`Nothing has requested ${rule.path} yet`)
    return entries.some((e) => re.test(e.body ?? ''))
      ? ok(`${rule.path} answered with the expected content`)
      : no(`${rule.path} answered, but nothing matched /${rule.pattern}/`)
  },

  mqtt_published(rule, ctx) {
    const re = rule.pattern ? regexOf(rule.pattern, rule.flags) : null
    const published = (ctx.sim?.mqtt?.log ?? []).filter((e) => e.dir === 'pub' && e.topic === rule.topic)
    const matching = re ? published.filter((e) => re.test(String(e.payload ?? ''))) : published
    const need = rule.minCount ?? 1
    if (matching.length >= need) return ok(`Published ${matching.length} message${matching.length === 1 ? '' : 's'} to ${rule.topic}`)
    if (!published.length) return no(`Nothing published to ${rule.topic} yet`)
    return no(`Published ${matching.length} matching message(s) to ${rule.topic}, needs ${need}`)
  },

  control_state(rule, ctx) {
    const components = matchingComponents(ctx.doc, rule)
    if (!components.length) return no(`No ${rule.componentType} on the board`)
    const hit = components.find((c) => (ctx.sim?.controls?.[c.id] ?? {})[rule.field] === rule.equals)
    return hit
      ? ok(`${rule.componentType} ${rule.field} is ${JSON.stringify(rule.equals)}`)
      : no(`Set the ${rule.componentType}'s ${rule.field} to ${JSON.stringify(rule.equals)}`)
  },

  all_of(rule, ctx) {
    const results = (rule.rules ?? []).map((r) => evaluateRule(r, ctx))
    const failed = results.find((r) => !r.passed)
    return failed ? no(failed.detail) : ok(results.map((r) => r.detail).filter(Boolean).join('; '))
  },

  any_of(rule, ctx) {
    const results = (rule.rules ?? []).map((r) => evaluateRule(r, ctx))
    const passed = results.find((r) => r.passed)
    if (passed) return ok(passed.detail)
    return no(results.map((r) => r.detail).filter(Boolean).join(' — or — ') || 'None of the alternatives are satisfied')
  },

  not(rule, ctx) {
    const inner = evaluateRule(rule.rule, ctx)
    return inner.passed ? no(`Should not be true: ${inner.detail}`) : ok('Condition correctly absent')
  },
}

function isMcuType(type, ctx) {
  return ctx.registry?.getDef?.(type)?.category === 'mcu'
}

/** Friendly text for a warning code, used by `no_warning` failures. */
function warningText(code, ctx) {
  const live = (ctx.sim?.warnings ?? []).find((w) => w.code === code)
  if (live?.message) return live.hint ? `${live.message} ${live.hint}` : live.message
  const fallback = {
    overvoltage_gpio: 'An ESP32 GPIO saw more than 3.3 V — add a voltage divider or a level shifter.',
    short_circuit: 'Power is shorted to ground — check for a wire joining the two rails.',
    overcurrent_pin: 'A pin is sourcing more current than it can handle — add a series resistor.',
    floating_input: 'An input pin is floating — add a pull-up or pull-down resistor, or use INPUT_PULLUP.',
    led_no_resistor: 'An LED has no current-limiting resistor.',
  }
  return fallback[code] ?? `The ${code} warning happened in this run`
}

/** Evaluate one rule. Unknown types fail loudly so bad content is obvious rather than silently passing. */
export function evaluateRule(rule, ctx) {
  if (!rule || typeof rule !== 'object' || !rule.type) return no('Malformed rule')
  const evaluator = RULES[rule.type]
  if (!evaluator) return no(`Unknown rule type "${rule.type}"`)
  if (NEEDS_RUNNING.has(rule.type) && ctx.sim?.status !== 'running') {
    return no('Press Run to check this step')
  }
  try {
    return evaluator(rule, ctx)
  } catch (error) {
    return no(`Could not check this step (${error.message})`)
  }
}

export const RULE_TYPES = Object.keys(RULES)
