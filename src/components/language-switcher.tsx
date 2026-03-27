"use client"

import { useLanguage, type Locale } from "@/lib/i18n"

const LOCALES: { value: Locale; label: string; title: string }[] = [
  { value: "ru", label: "RU", title: "Русский" },
  { value: "uk", label: "UA", title: "Українська" },
  { value: "en", label: "EN", title: "English" },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage()

  return (
    <div
      className="flex items-center rounded border border-border overflow-hidden shrink-0"
      title="Switch language"
    >
      {LOCALES.map(({ value, label, title }) => (
        <button
          key={value}
          onClick={() => setLocale(value)}
          title={title}
          className={`text-[10px] font-semibold px-1.5 py-1 transition-colors leading-none ${
            locale === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
