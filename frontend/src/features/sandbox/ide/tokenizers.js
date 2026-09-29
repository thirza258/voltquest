/**
 * Small display-only tokenizers for sandbox IDE editors. Each returns [{ text, type }] runs whose
 * texts join back to the exact source; they colour text and never decide validity or execute it.
 */
function scanner(rules) {
  return source => {
    const runs = []
    let i = 0
    const push = (text, type = '') => {
      const last = runs.at(-1)
      if (last && last.type === type) last.text += text
      else runs.push({ text, type })
    }
    outer: while (i < source.length) {
      for (const [pattern, type] of rules) {
        pattern.lastIndex = i
        const match = pattern.exec(source)
        if (match && match.index === i && match[0].length) {
          push(match[0], typeof type === 'function' ? type(match[0], source, i + match[0].length) : type)
          i += match[0].length
          continue outer
        }
      }
      push(source[i]); i++
    }
    return runs
  }
}

const JS_KEYWORDS = new Set(['async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'of', 'return', 'static', 'switch', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'yield'])
const JS_LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this', 'NaN', 'Infinity'])
const PY_KEYWORDS = new Set(['and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'])
const PY_LITERALS = new Set(['True', 'False', 'None', 'self'])

/** JSON: object keys, strings, numbers and true/false/null. */
export const tokenizeJson = scanner([
  [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, 'key'],
  [/"(?:[^"\\\n]|\\.)*"?/y, 'string'],
  [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, 'number'],
  [/\b(?:true|false|null)\b/y, 'literal'],
  [/[{}[\],:]/y, 'punct'],
  [/\s+/y, ''],
])

/** JavaScript/Node companion source. */
export const tokenizeJavascript = scanner([
  [/\/\/[^\n]*/y, 'comment'],
  [/\/\*[\s\S]*?(?:\*\/|$)/y, 'comment'],
  [/`(?:[^`\\]|\\[\s\S])*`?/y, 'string'],
  [/'(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?/y, 'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?\b/y, 'number'],
  [/[A-Za-z_$][\w$]*/y, word => JS_KEYWORDS.has(word) ? 'keyword' : JS_LITERALS.has(word) ? 'literal' : ''],
  [/\s+/y, ''],
])

/** Python companion source. */
export const tokenizePython = scanner([
  [/#[^\n]*/y, 'comment'],
  [/(?:[rbfu]{0,2})(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$))/iy, 'string'],
  [/(?:[rbfu]{0,2})(?:'(?:[^'\\\n]|\\.)*'?|"(?:[^"\\\n]|\\.)*"?)/iy, 'string'],
  [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?j?\b/y, 'number'],
  [/@[A-Za-z_][\w.]*/y, 'literal'],
  [/[A-Za-z_]\w*/y, word => PY_KEYWORDS.has(word) ? 'keyword' : PY_LITERALS.has(word) ? 'literal' : ''],
  [/\s+/y, ''],
])

/** Markdown (SKILL.md, notes): frontmatter fences and keys, headings, list markers and code. */
export const tokenizeMarkdown = scanner([
  [/^---[ \t]*$/my, 'punct'],
  [/^#{1,6}[^\n]*/my, 'heading'],
  [/^[A-Za-z][\w-]*(?=:)/my, 'key'],
  [/^[ \t]*(?:[-*+]|\d+\.)(?=\s)/my, 'literal'],
  [/`[^`\n]*`/y, 'string'],
  [/[^\n`#-]+|\n/y, ''],
])

const C_KEYWORDS = new Set(['alignas', 'alignof', 'auto', 'break', 'case', 'catch', 'class', 'const', 'constexpr', 'continue', 'decltype', 'default', 'delete', 'do', 'else', 'enum', 'explicit', 'extern', 'for', 'goto', 'if', 'inline', 'namespace', 'new', 'noexcept', 'operator', 'private', 'protected', 'public', 'register', 'restrict', 'return', 'sizeof', 'static', 'static_assert', 'struct', 'switch', 'template', 'throw', 'try', 'typedef', 'typename', 'union', 'using', 'virtual', 'volatile', 'while'])
const C_TYPES = new Set(['bool', 'char', 'double', 'float', 'int', 'long', 'short', 'signed', 'unsigned', 'void', 'size_t', 'ptrdiff_t', 'int32_t', 'int64_t', 'uint8_t', 'uint32_t', 'uint64_t', 'std', 'true', 'false', 'nullptr', 'NULL'])

/** C17/C++17 native source: comments, preprocessor directives and include targets, strings and numbers. */
export const tokenizeC = scanner([
  [/\/\/[^\n]*/y, 'comment'],
  [/\/\*[\s\S]*?(?:\*\/|$)/y, 'comment'],
  [/^[ \t]*#[ \t]*[A-Za-z_]+/my, 'keyword'],
  [/(?<=#[ \t]*include[ \t]*)<[^>\n]*>/y, 'string'],
  [/(?<=^[ \t]*#[ \t]*pragma)[^\n]*/my, 'literal'],
  [/"(?:[^"\\\n]|\\.)*"?/y, 'string'],
  [/'(?:[^'\\\n]|\\.)*'?/y, 'string'],
  [/\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)[uUlLfF]*\b/y, 'number'],
  [/[A-Za-z_]\w*/y, word => C_KEYWORDS.has(word) ? 'keyword' : C_TYPES.has(word) ? 'literal' : ''],
  [/\s+/y, ''],
])

export const TOKENIZERS = { c: tokenizeC, json: tokenizeJson, javascript: tokenizeJavascript, python: tokenizePython, markdown: tokenizeMarkdown }
