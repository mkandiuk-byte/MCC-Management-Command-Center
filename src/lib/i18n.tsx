"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { en, type TranslationKey } from "./locales/en"
import { ru } from "./locales/ru"
import { uk } from "./locales/uk"

export type Locale = "en" | "ru" | "uk"

const LOCALES: Record<Locale, Record<TranslationKey, string>> = { en, ru, uk }
const STORAGE_KEY = "aap-locale"
const DEFAULT_LOCALE: Locale = "ru"

interface LanguageContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => en[key],
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
      if (saved && LOCALES[saved]) setLocaleState(saved)
    } catch {}
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
  }, [])

  const t = useCallback(
    (key: TranslationKey): string => LOCALES[locale][key] ?? en[key] ?? key,
    [locale],
  )

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export type { TranslationKey }
