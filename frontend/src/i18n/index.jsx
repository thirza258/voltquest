import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { readJson, writeJson } from '../lib/storage.js'
import indonesian from './id.json'

export const LOCALES = ['id', 'en']
export function translate(locale, message, values = {}) {
  if (typeof message !== 'string') return message
  const key = message.trim()
  const translated = locale === 'id' && Object.hasOwn(indonesian, key) ? indonesian[key] : undefined
  const text = translated == null ? message : message.slice(0, message.length - message.trimStart().length) + translated + message.slice(message.trimEnd().length)
  return text.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match)
}

const english = (message, values) => translate('en', message, values)
const LocaleContext = createContext({ locale: 'en', t: english, setLocale: () => {} })

export function LocaleProvider({ children }) {
  const [locale, updateLocale] = useState(() => {
    const saved = readJson('vq.locale')
    return LOCALES.includes(saved) ? saved : 'en'
  })
  const setLocale = useCallback(value => {
    if (!LOCALES.includes(value)) return
    writeJson('vq.locale', value)
    updateLocale(value)
  }, [])
  const t = useCallback((message, values) => translate(locale, message, values), [locale])
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useI18n() { return useContext(LocaleContext) }

export function LanguageSelect() {
  const { locale, setLocale } = useI18n()
  return <select aria-label="Language / Bahasa" value={locale} onChange={event => setLocale(event.target.value)} className="h-8 max-w-24 rounded-md border border-line-strong bg-white px-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500">
    <option value="id" lang="id">Indonesia</option><option value="en" lang="en">English</option>
  </select>
}
