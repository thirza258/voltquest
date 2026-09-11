/**
 * Plays `SimState.tones` through WebAudio — one square-wave oscillator per sounding pin.
 *
 * A buzzer driven by `tone()` is the only sound VoltQuest makes, so this stays deliberately tiny: no
 * sample loading, no mixer. The AudioContext is created lazily on the first tone (browsers refuse to
 * start one before a user gesture, and jsdom has none at all), and everything is torn down when the
 * hook unmounts or audio is switched off.
 */
import { useEffect, useRef } from 'react'

/** Gentle level: a square wave at unity would be painful through headphones. */
const GAIN = 0.06
const RAMP_S = 0.01

function getAudioContextCtor() {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

/**
 * @param {{ [pinName: string]: number }} tones `SimState.tones`
 * @param {boolean} enabled player's audio setting
 */
export function useToneAudio(tones, enabled = true) {
  const ctxRef = useRef(null)
  /** @type {{ current: Map<string, { osc: OscillatorNode, gain: GainNode, freq: number }> }} */
  const voicesRef = useRef(new Map())

  useEffect(() => {
    const voices = voicesRef.current

    const stopVoice = (pin) => {
      const voice = voices.get(pin)
      if (!voice) return
      voices.delete(pin)
      try {
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, ctxRef.current?.currentTime ?? 0)
        voice.gain.gain.linearRampToValueAtTime(0, (ctxRef.current?.currentTime ?? 0) + RAMP_S)
        voice.osc.stop((ctxRef.current?.currentTime ?? 0) + RAMP_S * 2)
        voice.osc.disconnect()
        voice.gain.disconnect()
      } catch {
        // A context torn down mid-flight throws; nothing to recover.
      }
    }

    const active = enabled && tones ? Object.entries(tones).filter(([, f]) => Number(f) > 0) : []

    if (!active.length) {
      for (const pin of [...voices.keys()]) stopVoice(pin)
      return undefined
    }

    if (!ctxRef.current) {
      const Ctor = getAudioContextCtor()
      if (!Ctor) return undefined
      try {
        ctxRef.current = new Ctor()
      } catch {
        return undefined
      }
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') void ctx.resume?.().catch?.(() => {})

    const wanted = new Set(active.map(([pin]) => pin))
    for (const pin of [...voices.keys()]) if (!wanted.has(pin)) stopVoice(pin)

    for (const [pin, rawFreq] of active) {
      const freq = Math.max(20, Math.min(20000, Number(rawFreq)))
      const existing = voices.get(pin)
      if (existing) {
        if (existing.freq !== freq) {
          try {
            existing.osc.frequency.setValueAtTime(freq, ctx.currentTime)
            existing.freq = freq
          } catch {
            // Ignore: a stopped oscillator cannot be retuned.
          }
        }
        continue
      }
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, ctx.currentTime)
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(GAIN, ctx.currentTime + RAMP_S)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        voices.set(pin, { osc, gain, freq })
      } catch {
        // WebAudio unavailable or blocked: stay silent rather than break the workspace.
      }
    }
    return undefined
  }, [tones, enabled])

  // Tear everything down on unmount, including the context itself.
  useEffect(() => {
    const voices = voicesRef.current
    return () => {
      for (const voice of voices.values()) {
        try {
          voice.osc.stop()
          voice.osc.disconnect()
          voice.gain.disconnect()
        } catch {
          // Already stopped.
        }
      }
      voices.clear()
      try {
        void ctxRef.current?.close?.()
      } catch {
        // Closing twice throws in some browsers.
      }
      ctxRef.current = null
    }
  }, [])
}

export default useToneAudio
