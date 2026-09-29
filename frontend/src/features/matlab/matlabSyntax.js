import reference from '@content/matlab-functions.json'
import { parse } from '../../engine/matlab/parser.js'

/**
 * Editor-side view of the browser MATLAB subset. Lexing follows the rules in
 * engine/matlab/parser.js, so colours never promise syntax the interpreter rejects.
 */
export const KEYWORDS = new Set(['for', 'while', 'if', 'elseif', 'else', 'end', 'break', 'continue', 'clear', 'clc'])
/** MATLAB keywords that desktop MATLAB colours but the browser parser does not implement. */
export const UNSUPPORTED_KEYWORDS = new Set(['function', 'switch', 'case', 'otherwise', 'try', 'catch', 'return', 'global', 'persistent', 'parfor', 'spmd', 'classdef', 'properties', 'methods', 'events', 'enumeration'])
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/
const BROWSER = new Set(reference.functions.filter(item => item.scope === 'browser').map(item => item.name))
const DESKTOP_ONLY = new Set(reference.functions.filter(item => item.scope === 'desktop' && IDENTIFIER.test(item.name) && !BROWSER.has(item.name)).map(item => item.name))
const PAIRS = ['.*', './', '.^', '.\\', ".'", '<=', '>=', '==', '~=', '&&', '||']
const SINGLE = "+-*/\\^<>&|~=:,;()[]@'"
const PLAIN = new Set(['id', 'op', 'space', 'newline'])

/** Valid MATLAB script name for a preset: matlab-start → matlab_start.m. */
export const scriptFileName = lesson => `${lesson.replace(/[^A-Za-z0-9]+/g, '_')}.m`
export const scriptName = lesson => scriptFileName(lesson).slice(0, -2)
export const desktopFileName = lesson => `${scriptName(lesson)}_desktop.m`
/** Preset folder shown in the Current Folder tree, e.g. 01_start. */
export const folderName = course => `${String(course.order).padStart(2, '0')}_${course.id.replace(/^matlab-/, '').replace(/[^A-Za-z0-9]+/g, '_')}`

/**
 * Fine-grained tokens with 1-based lines. Types: comment, section, string, string-open
 * (unterminated), number, keyword, unsupported, invalid, id, op, space and newline.
 */
export function lexMatlab(source) {
  const tokens = []
  let i = 0, line = 1, previous = null, gap = true, lineStart = true
  const push = (text, type) => tokens.push({ text, type, line })
  const lineEnd = from => { const end = source.indexOf('\n', from); return end < 0 ? source.length : end }
  while (i < source.length) {
    const c = source[i]
    if (c === '\n') { push(c, 'newline'); i++; line++; previous = { type: 'sep' }; gap = true; lineStart = true; continue }
    if (c === ' ' || c === '\t' || c === '\r') { push(c, 'space'); i++; gap = true; continue }
    if (c === '%' || source.startsWith('...', i)) {
      const end = lineEnd(i), text = source.slice(i, end)
      push(text, c === '%' && lineStart && text.startsWith('%%') ? 'section' : 'comment')
      i = end; gap = true; lineStart = false; continue
    }
    lineStart = false
    const transpose = c === "'" && !gap && previous && (['number', 'id'].includes(previous.type) || [')', ']', "'", ".'"].includes(previous.value))
    if (c === '"' || (c === "'" && !transpose)) {
      let j = i + 1, closed = false
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === c) { if (source[j + 1] === c) { j += 2; continue } closed = true; j++; break }
        j++
      }
      push(source.slice(i, j), closed ? 'string' : 'string-open')
      i = j; previous = { type: 'string' }; gap = false; continue
    }
    const number = source.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/)
    if (number) {
      // In 2.*x the dot belongs to the operator, not the numeric literal (as in the parser).
      let raw = number[0]
      if (raw.endsWith('.') && /[*/^\\']/.test(source[i + raw.length] ?? ' ')) raw = raw.slice(0, -1)
      push(raw, 'number'); i += raw.length; previous = { type: 'number' }; gap = false; continue
    }
    const name = source.slice(i).match(/^[A-Za-z][A-Za-z0-9_]*/)
    if (name) {
      const word = name[0]
      push(word, KEYWORDS.has(word) ? 'keyword' : UNSUPPORTED_KEYWORDS.has(word) ? 'unsupported' : 'id')
      i += word.length; previous = { type: 'id', value: word }; gap = false; continue
    }
    const pair = source.slice(i, i + 2)
    if (PAIRS.includes(pair)) { push(pair, 'op'); i += 2; previous = { type: 'op', value: pair }; gap = false; continue }
    if (SINGLE.includes(c)) { push(c, 'op'); i++; previous = { type: c === ';' ? 'sep' : 'op', value: c }; gap = false; continue }
    push(c, 'invalid'); i++; previous = null; gap = false
  }
  return tokens
}

/** Highlight runs for CodeEditor; joining every run's text reproduces the source exactly. */
export function tokenizeMatlab(source) {
  const runs = []
  for (const token of lexMatlab(source)) {
    const type = PLAIN.has(token.type) ? '' : token.type
    const last = runs.at(-1)
    if (last && last.type === type) last.text += token.text
    else runs.push({ text: token.text, type })
  }
  return runs
}

/**
 * The editor's code check: the actual browser parser plus warnings for keywords and
 * desktop-only functions that the parser or runtime would reject. It never executes code.
 */
export function analyzeMatlab(source) {
  const issues = []
  try { parse(source) } catch (error) {
    const match = /^Line (\d+): /.exec(error.message)
    issues.push({ severity: 'error', line: match ? Number(match[1]) : null, message: match ? error.message.slice(match[0].length) : error.message })
  }
  const tokens = lexMatlab(source), assigned = new Set(), seen = new Set()
  tokens.forEach((token, index) => {
    if (token.type !== 'id') return
    const next = tokens.slice(index + 1).find(item => item.type !== 'space')
    if (next?.text === '=') assigned.add(token.text)
  })
  tokens.forEach((token, index) => {
    if (seen.has(token.text)) return
    if (token.type === 'unsupported') {
      seen.add(token.text)
      issues.push({ severity: 'warning', line: token.line, message: `${token.text} is desktop MATLAB syntax; the browser subset does not implement it.` })
    } else if (token.type === 'id' && DESKTOP_ONLY.has(token.text) && !assigned.has(token.text) && tokens.slice(index + 1).find(item => item.type !== 'space')?.text === '(') {
      seen.add(token.text)
      issues.push({ severity: 'warning', line: token.line, message: `${token.text} needs desktop MATLAB; the browser subset reports it as unsupported when it runs.` })
    }
  })
  return issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
}

/** True when a command contains the clc statement outside strings and comments. */
export const clearsCommandWindow = command => lexMatlab(command).some(token => token.type === 'keyword' && token.text === 'clc')
