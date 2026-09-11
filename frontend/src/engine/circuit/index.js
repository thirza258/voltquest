/**
 * Circuit engine — CONTRACTS §5.
 *
 * `compileCircuit` turns a CircuitDoc into nets, a netlist and a peripheral map; `evaluateCircuit` solves the
 * DC operating point for a set of MCU pin states and user controls and reports voltages, currents, component
 * states, warnings and damage events. `findPath` / `describeNet` / `terminalsOfComponent` answer the
 * connectivity questions the quest validator and the canvas tooltips ask.
 */
export { compileCircuit } from './netlist.js'
export { evaluateCircuit } from './evaluate.js'
export { describeNet, findPath, terminalsOfComponent } from './path.js'
export { GND_NET } from './nets.js'
