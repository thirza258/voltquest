import { describe, expect, it } from 'vitest'
import { MATLAB_COURSES } from './project.js'
import reference from '@content/matlab-functions.json'
import { runMatlab } from '../../engine/matlab/model.js'
import { commandFromExample } from './MatlabHelp.jsx'
import { analyzeMatlab, clearsCommandWindow, desktopFileName, folderName, scriptFileName, tokenizeMatlab } from './matlabSyntax.js'

const types = source => tokenizeMatlab(source).filter(run => run.type).map(run => [run.type, run.text])

describe('MATLAB editor syntax', () => {
  it('reproduces every preset exactly and highlights only lexer-supported syntax', () => {
    for (const course of MATLAB_COURSES) {
      expect(tokenizeMatlab(course.code).map(run => run.text).join('')).toBe(course.code)
      expect(tokenizeMatlab(course.code).some(run => run.type === 'invalid')).toBe(false)
    }
    expect(types("%% Setup\nx = [1 2]'; % note\nif x(1) > 0, disp('a''b'); end")).toEqual([
      ['section', '%% Setup'], ['number', '1'], ['number', '2'], ['comment', '% note'], ['keyword', 'if'], ['number', '1'], ['number', '0'], ['string', "'a''b'"], ['keyword', 'end'],
    ])
  })

  it('separates transpose from strings with the parser rule and marks unsupported input', () => {
    expect(types("y = x';")).toEqual([])
    expect(types("y = x ';")).toEqual([['string-open', "';"]])
    expect(types('s = "open')).toEqual([['string-open', '"open']])
    expect(types('a = 1 + ...  continued\n2;')).toEqual([['number', '1'], ['comment', '...  continued'], ['number', '2']])
    expect(types('function y = f(x)\nz = {1};')).toEqual([['unsupported', 'function'], ['invalid', '{'], ['number', '1'], ['invalid', '}']])
  })

  it('reports parser errors and desktop-only calls without executing code', () => {
    expect(analyzeMatlab('x = 1;\ny = (2;')).toEqual([{ severity: 'error', line: 2, message: expect.stringContaining('expected )') }])
    const issues = analyzeMatlab('x = 1:4;\ny = fft(x);\nswitch x\nend')
    expect(issues.map(issue => [issue.severity, issue.line])).toEqual(expect.arrayContaining([['warning', 2], ['warning', 3]]))
    expect(issues.find(issue => issue.line === 2).message).toContain('fft needs desktop MATLAB')
    expect(analyzeMatlab('fft = 3;\ndisp(fft(1));')).toEqual([])
    for (const course of MATLAB_COURSES) expect(analyzeMatlab(course.code).filter(issue => issue.severity === 'error')).toEqual([])
  })

  it('names files as valid MATLAB identifiers and finds clc outside strings', () => {
    expect(scriptFileName('matlab-linear-algebra')).toBe('matlab_linear_algebra.m')
    expect(desktopFileName('matlab-ode')).toBe('matlab_ode_desktop.m')
    expect(folderName(MATLAB_COURSES[5])).toBe('06_linear_algebra')
    expect(clearsCommandWindow('x = 1; clc')).toBe(true)
    expect(clearsCommandWindow('disp("clc") % clc')).toBe(false)
  })

  it('turns every browser reference example into one Command Window entry that runs', () => {
    const examples = reference.functions.filter(item => item.scope === 'browser' && item.example)
    expect(examples.length).toBeGreaterThan(60)
    for (const item of examples) expect(() => runMatlab(commandFromExample(item.example)), item.name).not.toThrow()
  })
})
