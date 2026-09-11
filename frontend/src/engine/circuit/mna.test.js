/**
 * Solver unit tests: conductance floors, LU + block partitioning, branch currents and the piecewise-linear
 * iteration cap (CONTRACTS §5.2).
 */
import { describe, it, expect } from 'vitest'
import { makeDoc, place, wire } from '../components/seeds.js'
import { MAX_CONDUCTANCE, branchCurrent, conductance, gBranch, iBranch, solveBranches, vccsBranch } from './mna.js'
import { compileCircuit } from './netlist.js'
import { evaluateCircuit } from './evaluate.js'

const GND = 0

describe('conductance', () => {
  it('inverts a resistance and floors it at 1e3 S', () => {
    expect(conductance(220)).toBeCloseTo(1 / 220, 12)
    expect(conductance(0)).toBe(MAX_CONDUCTANCE)
    expect(conductance(-5)).toBe(MAX_CONDUCTANCE)
    expect(conductance(Number.NaN)).toBe(MAX_CONDUCTANCE)
    expect(conductance(1e-9)).toBe(MAX_CONDUCTANCE)
  })
})

describe('solveBranches', () => {
  it('solves a Thevenin source feeding a divider', () => {
    const branches = [
      gBranch(1, GND, conductance(0.1), 5), // 5 V supply with 0.1 Ω series resistance
      gBranch(1, 2, conductance(1000)),
      gBranch(2, GND, conductance(2200)),
    ]
    const { voltages, ok } = solveBranches(branches, 3, GND)

    expect(ok).toBe(true)
    expect(voltages[1]).toBeCloseTo(5 * (3200 / 3200.1), 4)
    expect(voltages[2]).toBeCloseTo(5 * (2200 / 3200.1), 4)
    expect(branchCurrent(branches[1], voltages)).toBeCloseTo(5 / 3200.1, 8)
  })

  it('solves independent sub-circuits in one call and leaves isolated nets at 0 V', () => {
    const branches = [
      gBranch(1, GND, conductance(0.1), 5),
      gBranch(1, 2, conductance(1000)),
      gBranch(2, GND, conductance(1000)),
      gBranch(3, GND, conductance(0.1), 3.3),
      gBranch(3, 4, conductance(100)),
      gBranch(4, GND, conductance(100)),
    ]
    const { voltages } = solveBranches(branches, 6, GND)

    expect(voltages[2]).toBeCloseTo(5 * (1000 / 2000.1), 6)
    expect(voltages[4]).toBeCloseTo(3.3 * (100 / 200.1), 6)
    expect(voltages[5]).toBe(0) // nothing attached
  })

  it('stamps independent and voltage-controlled current sources', () => {
    const current = iBranch(GND, 1, 0.001) // 1 mA into node 1
    const load = gBranch(1, GND, conductance(1000))
    const { voltages } = solveBranches([current, load], 2, GND)
    expect(voltages[1]).toBeCloseTo(1, 6)
    expect(branchCurrent(current, voltages)).toBe(0.001)

    const source = gBranch(1, GND, conductance(1000), 1)
    const vccs = vccsBranch(2, GND, 1, GND, 0.01)
    const sink = gBranch(2, GND, conductance(100))
    const solved = solveBranches([source, vccs, sink], 3, GND)
    expect(solved.voltages[1]).toBeCloseTo(1, 6)
    expect(solved.voltages[2]).toBeCloseTo(-1, 6)
    expect(branchCurrent(vccs, solved.voltages)).toBeCloseTo(0.01, 9)
  })

  it('survives a circuit with no reference node', () => {
    const { voltages, ok } = solveBranches([gBranch(0, 1, conductance(100))], 2, -1)
    expect(ok).toBe(true)
    expect(Array.from(voltages).every(Number.isFinite)).toBe(true)
  })
})

describe('piecewise-linear iteration cap', () => {
  it('reports solver_unstable instead of hanging when the search runs out of flips', () => {
    // 140 LEDs in parallel: the contract allows one region flip per iteration and at most 64 iterations,
    // so this bank cannot be fully resolved — the engine returns the least-violating solve and says so.
    const doc = makeDoc({ mcu: 'uno' })
    for (let i = 0; i < 140; i++) place(doc, 'led', 'bb1', 'a1', { color: 'red' }, 0, `c_led${i}`)
    wire(doc, 'c_uno:5V', 'bb1:b1')
    wire(doc, 'bb1:b2', 'c_uno:GND')
    const evaluation = evaluateCircuit(compileCircuit(doc), {
      powered: true,
      mcuPins: {},
      controls: {},
      damaged: {},
      burntPins: {},
      moduleOutputs: {},
    })

    expect(evaluation.converged).toBe(false)
    expect(evaluation.ok).toBe(false)
    expect(evaluation.warnings.map((w) => w.code)).toContain('solver_unstable')
    expect(Object.values(evaluation.nodeVoltages).every(Number.isFinite)).toBe(true)
  })
})
