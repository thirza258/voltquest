/** Tokeniser rules that the rest of the interpreter depends on (CONTRACTS §6). */
import { describe, it, expect } from 'vitest'
import { LexError, tokenize } from './lexer.js'

/** Tokens without the trailing EOF, as `type:value` pairs. */
const kinds = (src, intBits = 16) => tokenize(src, { intBits }).slice(0, -1).map((t) => `${t.type}:${t.value}`)
/** First token of `x = <literal>;`. */
const literal = (text, intBits = 16) => tokenize(`x = ${text};`, { intBits })[2]

describe('lexer', () => {
  it('splits identifiers, operators and punctuation', () => {
    expect(kinds('a += b << 2;')).toEqual(['ident:a', 'punct:+=', 'ident:b', 'punct:<<', 'number:2', 'punct:;'])
  })

  it('is greedy about multi-character operators', () => {
    expect(kinds('a >>= b')).toEqual(['ident:a', 'punct:>>=', 'ident:b'])
    expect(kinds('a >> = b')).toEqual(['ident:a', 'punct:>>', 'punct:=', 'ident:b'])
  })

  it('types decimal literals as int, then long', () => {
    expect(literal('1000')).toMatchObject({ value: 1000, ctype: 'int' })
    expect(literal('40000')).toMatchObject({ value: 40000, ctype: 'long' })
    expect(literal('40000', 32)).toMatchObject({ value: 40000, ctype: 'int' })
  })

  it('types hex/binary/octal literals with the int → unsigned int → long ladder', () => {
    expect(literal('0xFFFF')).toMatchObject({ value: 65535, ctype: 'unsigned int' })
    expect(literal('0xFFFF', 32)).toMatchObject({ value: 65535, ctype: 'int' })
    expect(literal('0b1011')).toMatchObject({ value: 11, ctype: 'int' })
    expect(literal('017')).toMatchObject({ value: 15, ctype: 'int' })
  })

  it('honours U/L/F suffixes', () => {
    expect(literal('1UL')).toMatchObject({ ctype: 'unsigned long' })
    expect(literal('5L')).toMatchObject({ ctype: 'long' })
    expect(literal('2.5f')).toMatchObject({ value: 2.5, ctype: 'float' })
    expect(literal('2.5')).toMatchObject({ value: 2.5, ctype: 'double' })
    expect(literal('1e3')).toMatchObject({ value: 1000, ctype: 'double' })
  })

  it('decodes string and character escapes', () => {
    expect(literal('"a\\tb\\n"')).toMatchObject({ type: 'string', value: 'a\tb\n' })
    expect(literal("'\\n'")).toMatchObject({ value: 10, ctype: 'char' })
    expect(literal("'\\x41'")).toMatchObject({ value: 65, ctype: 'char' })
    expect(literal("'A'")).toMatchObject({ value: 65, ctype: 'char' })
  })

  it('concatenates adjacent string literals', () => {
    expect(literal('"ab" "cd"')).toMatchObject({ value: 'abcd' })
  })

  it('reads raw string literals verbatim, including newlines and quotes', () => {
    const t = literal('R"J({"k": "v"}\n)J"')
    expect(t.value).toBe('{"k": "v"}\n')
    expect(t.ctype).toBe('String')
  })

  it('keeps line and column of every token', () => {
    const tokens = tokenize('int a;\n  float b;')
    expect(tokens[0]).toMatchObject({ line: 1, col: 1 })
    expect(tokens[3]).toMatchObject({ value: 'float', line: 2, col: 3 })
  })

  it('reports stray characters and unterminated literals with a position', () => {
    expect(() => tokenize('int a = @;')).toThrow(LexError)
    try {
      tokenize('int a = @;')
    } catch (err) {
      expect(err).toMatchObject({ line: 1, col: 9 })
    }
    expect(() => tokenize('String s = "oops;')).toThrow(/missing terminating/)
    expect(() => tokenize('String s = R"x(oops;')).toThrow(/unterminated raw string/)
  })
})
