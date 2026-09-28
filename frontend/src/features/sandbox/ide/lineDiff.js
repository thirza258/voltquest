/**
 * Line diff (longest common subsequence) for small texts such as virtual workspace files.
 * Returns [{ type: ' ' | '+' | '-', text }]; a missing `before` means the file was added.
 */
export function lineDiff(before, after) {
  const a = before == null ? [] : before.split('\n'), b = after == null ? [] : after.split('\n')
  if (a.length * b.length > 250000) return [...a.map(text => ({ type: '-', text })), ...b.map(text => ({ type: '+', text }))]
  const table = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const rows = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { rows.push({ type: ' ', text: a[i] }); i++; j++ }
    else if (j < b.length && (i >= a.length || table[i][j + 1] >= table[i + 1][j])) rows.push({ type: '+', text: b[j++] })
    else rows.push({ type: '-', text: a[i++] })
  }
  return rows
}

/** Files added or changed between two virtual workspace snapshots, in name order. */
export function changedFiles(before, after) {
  return Object.keys(after ?? {}).filter(name => before?.[name] !== after[name]).sort().map(name => ({ name, status: before && Object.hasOwn(before, name) ? 'M' : 'A' }))
}
