import { describe, expect, it } from 'vitest'
import { COMPANIONS, createProject } from '../../agents/project.js'
import { DEFAULT_SKILL } from '../../../engine/agents/model.js'
import { caretPosition, lineOffset, outdentLine, transformLines, uncommentLine, commentLine, indentLine } from './textEdits.js'
import { tokenizeC, tokenizeJavascript, tokenizeJson, tokenizeMarkdown, tokenizePython } from './tokenizers.js'
import { exampleCode } from '../../hpc/examples.js'
import { LABS } from '../../../engine/hpc/model.js'
import { changedFiles, lineDiff } from './lineDiff.js'

const joined = runs => runs.map(run => run.text).join('')
const typed = runs => runs.filter(run => run.type).map(run => [run.type, run.text.trim()])

describe('IDE tokenizers', () => {
  it('reproduce real sandbox sources exactly', () => {
    const source = createProject('agents-mcp').source
    expect(joined(tokenizeJson(source))).toBe(source)
    expect(joined(tokenizeJavascript(COMPANIONS.javascript))).toBe(COMPANIONS.javascript)
    expect(joined(tokenizePython(COMPANIONS.python))).toBe(COMPANIONS.python)
    expect(joined(tokenizeMarkdown(DEFAULT_SKILL))).toBe(DEFAULT_SKILL)
    expect(joined(tokenizeJson('{ "unfinished": "str'))).toBe('{ "unfinished": "str')
    for (const lab of Object.keys(LABS)) for (const language of ['c', 'cpp']) expect(joined(tokenizeC(exampleCode(lab, language)))).toBe(exampleCode(lab, language))
  })
  it('colour C/C++ directives, include targets, OpenMP pragmas and numeric suffixes', () => {
    expect(typed(tokenizeC('#include <stdio.h>\n#pragma omp parallel for reduction(+:s)\nfloat x = 1.5f; // sum\nreturn "ok";'))).toEqual([['keyword', '#include'], ['string', '<stdio.h>'], ['keyword', '#pragma'], ['literal', 'omp parallel for reduction(+:s)'], ['literal', 'float'], ['number', '1.5f'], ['comment', '// sum'], ['keyword', 'return'], ['string', '"ok"']])
    expect(typed(tokenizeC('std::vector<double> v; if (a < b) {}'))).toEqual([['literal', 'std'], ['literal', 'double'], ['keyword', 'if']])
  })
  it('colour keys, literals, keywords, comments and headings', () => {
    expect(typed(tokenizeJson('{"a": 1, "b": [true, null, "x"]}'))).toEqual([['punct', '{'], ['key', '"a"'], ['punct', ':'], ['number', '1'], ['punct', ','], ['key', '"b"'], ['punct', ':'], ['punct', '['], ['literal', 'true'], ['punct', ','], ['literal', 'null'], ['punct', ','], ['string', '"x"'], ['punct', ']}']])
    expect(typed(tokenizeJavascript('const a = 1 // note\nreturn "x"'))).toEqual([['keyword', 'const'], ['number', '1'], ['comment', '// note'], ['keyword', 'return'], ['string', '"x"']])
    expect(typed(tokenizePython('def f(x):\n    return None # done'))).toEqual([['keyword', 'def'], ['keyword', 'return'], ['literal', 'None'], ['comment', '# done']])
    expect(typed(tokenizeMarkdown('---\nname: issue\n---\n# Title\n- item `code`'))).toEqual([['punct', '---'], ['key', 'name'], ['punct', '---'], ['heading', '# Title'], ['literal', '-'], ['string', '`code`']])
  })
})

describe('IDE line diff', () => {
  it('reports added, removed and unchanged lines and changed files', () => {
    expect(lineDiff('a\nb\nc', 'a\nc\nd')).toEqual([{ type: ' ', text: 'a' }, { type: '-', text: 'b' }, { type: ' ', text: 'c' }, { type: '+', text: 'd' }])
    expect(lineDiff(undefined, 'new')).toEqual([{ type: '+', text: 'new' }])
    expect(changedFiles({ 'a.md': 'x', 'b.md': 'y' }, { 'a.md': 'x', 'b.md': 'z', 'c.md': 'w' })).toEqual([{ name: 'b.md', status: 'M' }, { name: 'c.md', status: 'A' }])
  })
})

describe('IDE line edits', () => {
  it('transform only the selected lines and report caret positions', () => {
    const text = 'a = 1;\nb = 2;\nc = 3;'
    expect(transformLines(text, 8, 9, commentLine('%')).text).toBe('a = 1;\n% b = 2;\nc = 3;')
    expect(transformLines(text, 0, 7, commentLine('%')).text).toBe('% a = 1;\nb = 2;\nc = 3;')
    expect(uncommentLine('%')('  % x')).toBe('  x')
    expect(indentLine(4)('x')).toBe('    x')
    expect(outdentLine(4)('      x')).toBe('  x')
    expect(caretPosition(text, 9)).toEqual({ line: 2, column: 3 })
    expect(lineOffset(text, 3)).toBe(14)
    expect(lineOffset(text, 9)).toBe(text.length)
  })
})
