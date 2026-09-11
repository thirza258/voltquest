const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
let counter = 0
/** Short unique id with a prefix: newId('c') → 'c_4f3a9k'. Deterministic-enough for tests (uses a counter + random). */
export function newId(prefix = 'id') {
  counter = (counter + 1) % 1296
  let s = ''
  for (let i = 0; i < 4; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  s += ALPHABET[Math.floor(counter / 36)] + ALPHABET[counter % 36]
  return `${prefix}_${s}`
}
