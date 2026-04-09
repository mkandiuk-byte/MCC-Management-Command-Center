"use client"
import { createContext, useContext, useState, useEffect, ReactNode } from "react"

type Lang = "uk" | "en"

const translations = {
  // Sidebar
  "nav.summary": { uk: "Головна", en: "Summary" },
  "nav.buying": { uk: "Медіабаїнг", en: "Media Buying" },
  "nav.engineering": { uk: "Продукт і Розробка", en: "Product & Eng" },
  "nav.processes": { uk: "Процеси", en: "Processes" },
  "nav.analytics": { uk: "Аналітика", en: "Analytics" },
  "nav.infrastructure": { uk: "Інфраструктура", en: "Infrastructure" },
  "nav.problems": { uk: "Проблеми", en: "Problems" },
  "nav.settings": { uk: "Налаштування", en: "Settings" },
  "nav.darkMode": { uk: "Темна тема", en: "Dark Mode" },
  "nav.lightMode": { uk: "Світла тема", en: "Light Mode" },
  "nav.collapse": { uk: "Згорнути", en: "Collapse" },

  // Executive Summary
  "summary.title": { uk: "Зведена панель", en: "Executive Summary" },
  "summary.subtitle": { uk: "Усі відділи · оперативна аналітика в реальному часі", en: "All departments · real-time operational intelligence" },
  "summary.issuesAttention": { uk: "проблем потребують уваги", en: "issues requiring attention" },
  "summary.positiveSignals": { uk: "позитивний сигнал", en: "positive signal" },
  "summary.totalSpend": { uk: "Витрати", en: "Total Spend" },
  "summary.revenue": { uk: "Дохід", en: "Revenue" },
  "summary.profit": { uk: "Прибуток", en: "Profit" },
  "summary.avgRoi": { uk: "Сер. ROI", en: "Avg ROI" },
  "summary.openProblems": { uk: "Відкриті проблеми", en: "Open Problems" },
  "summary.critical": { uk: "критичних", en: "critical" },
  "summary.activeProblems": { uk: "Активні проблеми", en: "Active Problems" },
  "summary.investigating": { uk: "Розслідується", en: "Investigating" },
  "summary.testing": { uk: "Тестування", en: "Testing" },

  // Media Buying
  "buying.title": { uk: "Медіабаїнг", en: "Media Buying" },
  "buying.subtitle": { uk: "Ефективність кампаній, аналітика байерів та гео-інсайти", en: "Campaign performance, buyer analytics & geo insights" },
  "buying.overview": { uk: "Огляд", en: "Overview" },
  "buying.buyers": { uk: "Байери", en: "Buyers" },
  "buying.geo": { uk: "Гео", en: "Geo" },
  "buying.offers": { uk: "Офери", en: "Offers" },
  "buying.operations": { uk: "Операції", en: "Operations" },
  "buying.stopSignals": { uk: "STOP сигнали", en: "STOP Signals" },
  "buying.activeCampaigns": { uk: "Активні кампанії", en: "Active Campaigns" },
  "buying.dailyTrend": { uk: "Щоденний тренд доходу та витрат", en: "Daily Revenue & Cost Trend" },
  "buying.topGeos": { uk: "Топ-5 Гео", en: "Top 5 Geos" },
  "buying.spend": { uk: "Витрати", en: "Spend" },
  "buying.buyer": { uk: "Байер", en: "Buyer" },
  "buying.campaigns": { uk: "Кампанії", en: "Campaigns" },
  "buying.signal": { uk: "Сигнал", en: "Signal" },
  "buying.country": { uk: "Країна", en: "Country" },
  "buying.offer": { uk: "Офер", en: "Offer" },
  "buying.conversions": { uk: "Конверсії", en: "Conversions" },
  "buying.cost": { uk: "Вартість", en: "Cost" },
  "buying.buyerGroups": { uk: "Групи байерів", en: "Buyer Groups" },
  "buying.totalCampaigns": { uk: "Всього кампаній", en: "Total Campaigns" },
  "buying.stopCampaigns": { uk: "STOP кампанії", en: "STOP Campaigns" },
  "buying.survivalRate": { uk: "Виживаність", en: "Survival Rate" },
  "buying.operationsTracking": { uk: "Відстеження операцій кампаній", en: "Campaign Operations Tracking" },
  "buying.topGeosByProfit": { uk: "Топ Гео за прибутком", en: "Top Geos by Profit" },
  "buying.clicks": { uk: "Кліки", en: "Clicks" },

  // Engineering
  "eng.title": { uk: "Продукт і Розробка", en: "Product & Engineering" },
  "eng.subtitle": { uk: "Здоров'я спринтів, навантаження команди, баги та прогрес епіків", en: "Sprint health, team workload, bug density, and epic progress" },
  "eng.sprint": { uk: "Спринт", en: "Sprint" },
  "eng.teams": { uk: "Команди", en: "Teams" },
  "eng.bugs": { uk: "Баги", en: "Bugs" },
  "eng.epics": { uk: "Епіки", en: "Epics" },
  "eng.velocity": { uk: "Швидкість", en: "Velocity" },
  "eng.bugDensity": { uk: "Щільність багів", en: "Bug Density" },
  "eng.blocked": { uk: "Заблоковано", en: "Blocked" },
  "eng.activeItems": { uk: "Активних задач", en: "Active Items" },
  "eng.sprintProgress": { uk: "Прогрес спринту", en: "Sprint progress" },
  "eng.velocityHistory": { uk: "Історія швидкості (останні 5 спринтів)", en: "Velocity History (Last 5 Sprints)" },
  "eng.teamWorkload": { uk: "Навантаження команди", en: "Team Workload" },
  "eng.items": { uk: "задач", en: "items" },
  "eng.bottleneck": { uk: "Вузьке місце", en: "Bottleneck" },
  "eng.bugsVsFeatures": { uk: "Баги vs Фічі", en: "Bugs vs Features" },
  "eng.bugCount90d": { uk: "Багів за 90 днів", en: "Bugs (90 days)" },
  "eng.epicProgress": { uk: "Прогрес епіків", en: "Epic Progress" },
  "eng.zombieEpics": { uk: "Зомбі-епіки", en: "Zombie Epics" },
  "eng.zombieDesc": { uk: "епіків в ASD створено, але ніколи не розбито на задачі", en: "epics in ASD created but never decomposed into tasks" },
  "eng.velocityTrend": { uk: "Тренд швидкості (останні 5 спринтів)", en: "Velocity Trend (last 5 sprints)" },
  "eng.bottleneckDetected": { uk: "Виявлено вузьке місце", en: "Bottleneck Detected" },

  // Processes
  "proc.title": { uk: "Процеси та KPI", en: "Processes & KPIs" },
  "proc.subtitle": { uk: "Операційні процеси по відділах, показники та вузькі місця", en: "Department operations, KPIs, and bottleneck detection" },
  "proc.mediaBuying": { uk: "Процеси медіабаїнгу", en: "Media Buying Processes" },
  "proc.engineering": { uk: "Процеси розробки", en: "Engineering Processes" },
  "proc.analyticsDept": { uk: "Процеси аналітики", en: "Analytics Processes" },
  "proc.pipeline": { uk: "Конвеєр", en: "Pipeline" },
  "proc.kpis": { uk: "KPI показники", en: "KPI Metrics" },

  // Analytics
  "analytics.title": { uk: "Аналітика", en: "Analytics" },
  "analytics.subtitle": { uk: "Самостійна аналітика: ефективність реклами, гео-бенчмарки", en: "Self-serve analytics: ad performance, geo benchmarks" },
  "analytics.adPerformance": { uk: "Ефективність реклами", en: "Ad Performance" },
  "analytics.geoBenchmarks": { uk: "Гео-бенчмарки", en: "Geo Benchmarks" },
  "analytics.convQuality": { uk: "Якість конверсій", en: "Conversion Quality" },
  "analytics.signalDist": { uk: "Розподіл сигналів", en: "Signal Distribution" },
  "analytics.minSpend": { uk: "Мін. витрати", en: "Min Spend" },
  "analytics.convQualityAnalysis": { uk: "Аналіз якості конверсій", en: "Conversion Quality Analysis" },
  "analytics.availableWhenConnected": { uk: "Доступно при підключенні", en: "Available When Connected" },

  // Problems
  "problems.title": { uk: "Проблеми", en: "Problems" },
  "problems.subtitle": { uk: "Відстежені гіпотези, експерименти та рішення", en: "Tracked hypotheses, experiments, and resolutions" },
  "problems.total": { uk: "всього", en: "total" },
  "problems.all": { uk: "Усі", en: "All" },
  "problems.cloaking": { uk: "Клоакінг", en: "Cloaking" },
  "problems.whitePages": { uk: "Вайт-пейджі", en: "White Pages" },
  "problems.accountHealth": { uk: "Здоров'я акаунтів", en: "Account Health" },
  "problems.ios": { uk: "iOS", en: "iOS" },
  "problems.eventStreaming": { uk: "Стрімінг подій", en: "Event Streaming" },
  "problems.funnelMigration": { uk: "Міграція воронок", en: "Funnel Migration" },
  "problems.description": { uk: "Опис", en: "Description" },
  "problems.hypothesis": { uk: "Гіпотеза", en: "Hypothesis" },
  "problems.metric": { uk: "Метрика", en: "Metric" },
  "problems.baseline": { uk: "Базове", en: "Baseline" },
  "problems.current": { uk: "Поточне", en: "Current" },
  "problems.status": { uk: "Статус", en: "Status" },
  "problems.updates": { uk: "Оновлення", en: "Updates" },
  "problems.logTestResult": { uk: "Зафіксувати результат", en: "Log Test Result" },
  "problems.type": { uk: "Тип", en: "Type" },
  "problems.outcome": { uk: "Результат", en: "Outcome" },
  "problems.content": { uk: "Зміст", en: "Content" },
  "problems.metricValue": { uk: "Значення метрики", en: "Metric Value" },
  "problems.submit": { uk: "Надіслати", en: "Submit" },
  "problems.noUpdates": { uk: "Оновлень ще немає.", en: "No updates yet." },
  "problems.noMatch": { uk: "Немає проблем за фільтрами.", en: "No problems match filters." },
  "problems.allSeverity": { uk: "Всі рівні", en: "All Severity" },

  // Common
  "common.roi": { uk: "ROI", en: "ROI" },
  "common.cpa": { uk: "CPA", en: "CPA" },
  "common.ftds": { uk: "FTD", en: "FTDs" },
  "common.revenue": { uk: "Дохід", en: "Revenue" },
  "common.profit": { uk: "Прибуток", en: "Profit" },
  "common.spend": { uk: "Витрати", en: "Spend" },
}

type TranslationKey = keyof typeof translations

const I18nContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}>({
  lang: "uk",
  setLang: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("uk")

  useEffect(() => {
    const saved = localStorage.getItem("mcc-lang") as Lang | null
    if (saved === "en" || saved === "uk") setLang(saved)
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem("mcc-lang", l)
  }

  const t = (key: TranslationKey): string => {
    return translations[key]?.[lang] ?? key
  }

  return (
    <I18nContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n()
  return (
    <div className="flex items-center gap-1 rounded-xl p-0.5 bg-[var(--muted)]">
      <button
        onClick={() => setLang("uk")}
        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-300 ${
          lang === "uk"
            ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        UA
      </button>
      <button
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all duration-300 ${
          lang === "en"
            ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        EN
      </button>
    </div>
  )
}
