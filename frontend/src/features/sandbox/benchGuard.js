import { useEffect } from 'react'

let current = null

/**
 * Registers unsaved work on the mounted bench (explicit-save benches: notebooks, experiments,
 * settings), so the sandbox rail can ask before navigating away and discarding it. The circuit and
 * drone workspaces autosave drafts instead and do not register.
 */
export function useUnsavedBenchWork(unsaved, what) {
  useEffect(() => {
    if (!unsaved) return undefined
    const entry = { what }
    current = entry
    return () => { if (current === entry) current = null }
  }, [unsaved, what])
}

/** The unsaved work registered by the mounted bench, or null. */
export const unsavedBenchWork = () => current
