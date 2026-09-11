/** Preprocessor behaviour (CONTRACTS §6): comments, #include, #define and conditional compilation. */
import { describe, it, expect } from 'vitest'
import { preprocess, stripComments } from './preprocessor.js'

/** Source lines of the preprocessed text, trimmed — handy for asserting what survived. */
const lines = (src, opts) => preprocess(src, opts).text.split('\n').map((l) => l.trim())

describe('stripComments', () => {
  it('blanks comments but keeps every line', () => {
    const src = 'int a; // tail\n/* block\n   spanning */ int b;'
    const out = stripComments(src).text
    expect(out.split('\n')).toHaveLength(3)
    expect(out).toHaveLength(src.length)
    expect(out.split('\n')[0].trimEnd()).toBe('int a;')
    expect(out.split('\n')[2].trim()).toBe('int b;')
  })

  it('does not treat // inside a string literal as a comment', () => {
    const out = stripComments('String u = "http://x"; // real').text
    expect(out).toContain('"http://x"')
    expect(out.trimEnd()).toBe('String u = "http://x";')
  })

  it('leaves raw string literals alone', () => {
    const out = stripComments('String j = R"(a // b /* c */)";').text
    expect(out).toBe('String j = R"(a // b /* c */)";')
  })

  it('reports an unterminated block comment', () => {
    expect(stripComments('int a;\n/* oops').errors[0]).toMatchObject({ line: 2, col: 1 })
  })

  it('treats a digit separator as a separator, not a character literal', () => {
    const out = stripComments("long n = 1'000'000; // x").text
    expect(out.trimEnd()).toBe("long n = 1'000'000;")
  })
})

describe('preprocess', () => {
  it('records includes in source order and de-duplicates', () => {
    const r = preprocess('#include <Servo.h>\n#include "local.h"\n#include <Servo.h>\n')
    expect(r.includes).toEqual(['Servo.h', 'local.h'])
  })

  it('substitutes object-like macros and reports them', () => {
    const r = preprocess('#define LED 13\nint pin = LED;')
    expect(r.macros).toEqual({ LED: '13' })
    expect(r.text.split('\n')[1]).toBe('int pin = 13;')
  })

  it('never substitutes inside string or character literals', () => {
    const r = preprocess('#define LED 13\nString s = "LED";\nchar c = \'L\';')
    expect(r.text).toContain('"LED"')
  })

  it('terminates on a self-referential macro', () => {
    const r = preprocess('#define A A + 1\nint x = A;')
    expect(r.text.split('\n')[1]).toBe('int x = A + 1;')
  })

  it('keeps line numbers stable across directives and excluded branches', () => {
    const src = '#define DEBUG\n#ifdef DEBUG\nint a = 1;\n#else\nint a = 2;\n#endif\nint b = 3;'
    expect(lines(src)).toEqual(['', '', 'int a = 1;', '', '', '', 'int b = 3;'])
  })

  it('handles #ifndef, #undef and nested conditionals inside dead regions', () => {
    const src = [
      '#ifndef NOPE',
      '#ifdef MISSING',
      'int dead = 1;',
      '#endif',
      'int live = 1;',
      '#endif',
      '#define X 1',
      '#undef X',
      '#ifdef X',
      'int gone = 1;',
      '#endif',
    ].join('\n')
    const out = lines(src)
    expect(out.filter(Boolean)).toEqual(['int live = 1;'])
  })

  it('evaluates #if defined(), #elif and #else', () => {
    const src = '#define BOARD 2\n#if defined(NOPE)\nint v = 0;\n#elif BOARD == 2\nint v = 2;\n#else\nint v = 3;\n#endif'
    expect(lines(src).filter(Boolean)).toEqual(['int v = 2;'])
  })

  it('joins backslash-continued directives without losing lines', () => {
    const src = '#define WIDE 1 + \\\n  2\nint x = WIDE;'
    const out = preprocess(src).text.split('\n')
    expect(out).toHaveLength(3)
    expect(out[2].replace(/\s+/g, ' ')).toBe('int x = 1 + 2;')
  })

  it('accepts pre-seeded defines', () => {
    const r = preprocess('#ifdef __AVR__\nint avr = 1;\n#endif', { defines: { __AVR__: '1' } })
    expect(r.text).toContain('int avr = 1;')
  })

  it('warns about function-like macros and leaves the identifier untouched', () => {
    const r = preprocess('#define MIN(a,b) ((a)<(b)?(a):(b))\nint x = MIN(1,2);')
    expect(r.macros).toEqual({})
    expect(r.errors[0]).toMatchObject({ severity: 'warning', line: 1 })
    expect(r.text.split('\n')[1]).toBe('int x = MIN(1,2);')
  })

  it('treats a parenthesised object-like body normally', () => {
    const r = preprocess('#define PIN (13)\nint p = PIN;')
    expect(r.macros).toEqual({ PIN: '(13)' })
    expect(r.text.split('\n')[1]).toBe('int p = (13);')
  })

  it('warns instead of silently flipping a branch it cannot evaluate', () => {
    const r = preprocess('#if __has_include(<Wire.h>)\nint a = 1;\n#else\nint a = 2;\n#endif')
    expect(r.errors[0]).toMatchObject({ severity: 'warning', line: 1 })
    expect(r.errors[0].message).toMatch(/cannot evaluate/)
    expect(r.text).toContain('int a = 2;')
  })

  it('reports an unterminated #if', () => {
    expect(preprocess('#ifdef X\nint a;').errors[0].message).toBe('unterminated #if')
  })
})
