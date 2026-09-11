// Loads shared content from ../../content (bundled at build time via the @content alias).
const worldFiles = import.meta.glob('@content/worlds.json', { eager: true })
const questFiles = import.meta.glob('@content/quests/*.json', { eager: true })
const catalogFiles = import.meta.glob('@content/catalog.json', { eager: true })
const cosmeticsFiles = import.meta.glob('@content/cosmetics.json', { eager: true })
const tutorialFiles = import.meta.glob('@content/tutorials.json', { eager: true })

const first = (files) => { const v = Object.values(files)[0]; return v ? (v.default ?? v) : null }

export const WORLDS = (first(worldFiles)?.worlds ?? []).slice().sort((a, b) => a.order - b.order)
export const LEVELS = Object.fromEntries(Object.values(questFiles).map((m) => { const lvl = m.default ?? m; return [lvl.id, lvl] }))
export const LEVEL_ORDER = WORLDS.flatMap((w) => w.levelIds ?? []).filter((id) => LEVELS[id])
export const CATALOG = first(catalogFiles) ?? {}
export const COSMETICS = first(cosmeticsFiles) ?? { skins: [], wirePalettes: [] }
export const TUTORIALS = first(tutorialFiles)?.tutorials ?? []

export function getLevel(id) { return LEVELS[id] ?? null }
export function getWorld(id) { return WORLDS.find((w) => w.id === id) ?? null }
export function nextLevelId(id) { const i = LEVEL_ORDER.indexOf(id); return i >= 0 && i < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[i + 1] : null }
export function prevLevelId(id) { const i = LEVEL_ORDER.indexOf(id); return i > 0 ? LEVEL_ORDER[i - 1] : null }
