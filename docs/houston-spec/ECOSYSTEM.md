# Upstars Ecosystem — Полная архитектурная документация

> **Дата:** 2026-03-04
> **Версия:** 1.0
> **Аудитория:** Операторы экосистемы, технические лиды, senior-разработчики

---

## Содержание

1. [Обзор экосистемы](#1-обзор-экосистемы)
2. [Карта сервисов по слоям](#2-карта-сервисов-по-слоям)
3. [Главный датафлоу: путь трафика от клика до конверсии](#3-главный-датафлоу-путь-трафика-от-клика-до-конверсии)
4. [Датафлоу: Клоакинг](#4-датафлоу-клоакинг)
5. [Датафлоу: Воронки и лендинги](#5-датафлоу-воронки-и-лендинги)
6. [Датафлоу: Атрибуция и трекинг конверсий](#6-датафлоу-атрибуция-и-трекинг-конверсий)
7. [Датафлоу: Retention и push-уведомления](#7-датафлоу-retention-и-push-уведомления)
8. [Датафлоу: Управление трафик-сорсами (Meta Ads)](#8-датафлоу-управление-трафик-сорсами-meta-ads)
9. [Схема межсервисного взаимодействия](#9-схема-межсервисного-взаимодействия)
10. [Control Plane: управление конфигурациями](#10-control-plane-управление-конфигурациями)
11. [Инфраструктурный слой](#11-инфраструктурный-слой)
12. [Аналитическая платформа и BI](#12-аналитическая-платформа-и-би)
13. [Инструкция оператора экосистемы](#13-инструкция-оператора-экосистемы)

---

## 1. Обзор экосистемы

Экосистема Upstars — это affiliate/performance-marketing платформа для медиабайеров, работающих преимущественно с трафиком из Meta (Facebook) Ads в вертикалях iGaming, PWA, App Store.

**Ключевые функции системы:**
- Закупка и автоматизация трафика из Meta Ads
- Клоакинг: показ разного контента для реальных пользователей и модераторов рекламных платформ
- Управление воронками: лендинги, PWA, офферволлы, App Store страницы
- Умная маршрутизация: A/B тесты, геотаргетинг, распределение по офферам
- Атрибуция конверсий: мультитач, постбэки, синхронизация между трекером и аналитикой
- Retention: push-уведомления для возврата пользователей
- Аналитика: ClickHouse + PostgreSQL + BI + LLM-анализ воронок

**Центральный элемент экосистемы — Keitaro 11** (не в репозиториях).
Keitaro — основной трекер кликов и менеджер потоков. Все кастомные сервисы либо расширяют Keitaro, либо интегрируются с ним через API, постбэки или прямое подключение к его БД (ClickHouse).

**Три организации GitHub:**

| Org | Назначение |
|-----|-----------|
| `f3nixacc-f3nixacc` | Core backend: SSO, трекинг, аналитика, finance, IaC |
| `funnel-prod` | Воронки: CF Workers, лендинги, PWA, офферволлы, клоак |
| `MB-Retention` | Retention microservices: push, click/conv sync |

---

## 2. Карта сервисов по слоям

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRAFFIC SOURCES LAYER                           │
│  Meta Ads Manager ←→ meta-mind-extension-legacy [текущий]               │
│  (Facebook кабинеты)    x-ray-extension-v2 [отдельный инструмент]      │
│                   ···→ meta-mind-extension [в разработке, замена legacy] │
│                              ↕ fb_data_acceptor                         │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ рекламные клики
┌──────────────────────────────────▼──────────────────────────────────────┐
│                         KEITARO 11 (TRACKER)                            │
│  Центральный трекер: клики, потоки, постбэки, ClickHouse-хранилище     │
│  Управление: inf-ops-keitaro-automation-scripts                         │
│  Backup: inf-ops-keitaro-emergency-restore-tools                        │
└────────┬──────────────────────────────────────┬────────────────────────┘
         │ поток: real users                     │ поток: bots/mods
┌────────▼────────────────┐          ┌───────────▼────────────────────────┐
│     CLOAKING LAYER      │          │         WHITE PAGES                │
│  fs-cloak-proxy-worker  │          │  fs-white-pages (CF Worker)        │
│  keitaro-smart-         │          │  (безопасный "белый" контент)      │
│    redirector (PHP)     │          └────────────────────────────────────┘
│  fs-offerwall-proxy-    │
│    cloak-worker         │
└────────┬────────────────┘
         │ реальный пользователь
┌────────▼────────────────────────────────────────────────────────────────┐
│                         ROUTING LAYER                                   │
│  fp-smart-link-worker (CF Worker, A/B, geo, device)                    │
│  upbase / JustLink (Django, user tracking + redirect rules)             │
└────────┬────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────────────┐
│                         LANDING / FUNNEL LAYER                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │ fs-template-    │  │ fs-template-     │  │ fs-casino-wheel-lp  │   │
│  │ apple-app-store │  │ google-play-mkt  │  │ (Next.js колесо)    │   │
│  └─────────────────┘  └──────────────────┘  └─────────────────────┘   │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │ fs-template-    │  │ pwa_new          │  │ landing (Django     │   │
│  │ offerwall       │  │ (PWA frontend)   │  │ multi-tenant)       │   │
│  └────────┬────────┘  └──────────────────┘  └─────────────────────┘   │
│           │ запрос офферов                                              │
│  ┌────────▼────────────────────────────────────────────────────────┐   │
│  │ fs-offerwall-lp-api (Node.js/Express + PostgreSQL, геотаргетинг)│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  offerwall-alpha (Django GameHub — gaming-вертикаль)                   │
└────────┬────────────────────────────────────────────────────────────────┘
         │ клик / конверсия
┌────────▼────────────────────────────────────────────────────────────────┐
│                     OFFER / AFFILIATE NETWORK                           │
│         Партнёрские офферы (казино, App Store, iGaming и др.)           │
│         Постбэк конверсии → Keitaro 11 ← → conv_attribution            │
└────────┬────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────────────┐
│                      ANALYTICS & ATTRIBUTION LAYER                      │
│  Keitaro 11 → ClickHouse ←→ dagster ETL → PostgreSQL                   │
│  landing-tracker (FastAPI → Kafka → ClickHouse)                        │
│  fp-analytics-tracker (браузер) → fp-analytics-api → PostgreSQL        │
│  user-identification-service (FastAPI, ClickHouse, Kafka, Redis)       │
│  conv_attribution (PHP, multi-touch, постбэки)                         │
│  dashboard (Django, аналитика и репортинг)                             │
└────────┬────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────────────┐
│                         RETENTION LAYER                                 │
│  MB_retention_push (FastAPI, Web Push notifications)                   │
│  mb_retention_click_sync / mb_retention_conversions_sync               │
│  mb_keitaro_events (Keitaro event handling)                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTROL PLANE                                   │
│  SSO (Django OAuth2/JWT, permission gateway)                           │
│  fs-admin (Django+Nuxt, конфигурации офферволл/PWA)                   │
│  function-manager (офферы, медиабайерские функции)                     │
│  hlpr (кампании, ключи)                                                │
│  finance [текущий] / finance_v2 [в разработке, замена finance]         │
│  events-manager (события, аналитика)                                   │
└────────┬────────────────────────────────────────────────────────────────┘
         │ sync
┌────────▼────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE EDGE                                    │
│  fs-d1-sync-worker → D1 (SQL) + KV (key-value)                        │
│  fp-cloudflare-infra (Terraform+Terragrunt, GitOps DNS/Workers)        │
│  fs-ai-content-worker (AI iGaming reviews, Llama 3.1)                 │
└────────┬────────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE                                    │
│  iac-platform (Terraform+Ansible, DigitalOcean+Cloudflare, SOPS+age)  │
│  fs-infra (Kubernetes manifests)                                       │
│  fn-ev-staging-gateway (nginx-proxy, Docker auto-discovery)            │
│  doppler_reloader (config hot-reload on Doppler change)                │
│  ssh_operator / django-command-executor (remote ops)                   │
│  pwa_switcher (Cloudflare DNS, PWA management)                        │
│  inf-ops-* scripts (Keitaro automation, SkakApp, backup)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2.1. Каталог сервисов

### Трафик-сорсы

> **Версионность расширений для сбора данных Meta Ads:**
> `fb-ads-extension` → (мигрировал Feb 2026) → `meta-mind-extension-legacy` ← текущий
> `meta-mind-extension` — новая архитектура, в разработке
> `x-ray-extension-v2` — отдельный инструмент, не является версией meta-mind

| Сервис | Статус | Назначение |
|--------|--------|-----------|
| **meta-mind-extension-legacy** | ✅ текущий | Chrome-расширение для сбора статистики кампаний из Meta Ads Manager; поглотило кодовую базу fb-ads-extension (Feb 2026). |
| **fb-ads-extension** | ⚠️ устарел (мигрирован) | Оригинальное расширение (f3nixacc-f3nixacc org), откуда вырос meta-mind-extension-legacy; код перенесён, репо заморожено. |
| **meta-mind-extension** | 🚧 в разработке | Полный rewrite расширения с новой архитектурой; пока только initial commit, не используется. |
| **x-ray-extension-v2** | ✅ отдельный инструмент | Chrome-расширение "FB X-Ray" для анализа Facebook-рекламы с remote-update архитектурой (бизнес-логика обновляется с GitHub без переустановки). |
| **meta-mind-automation-poc** | 🧪 PoC | PoC-автоматизация запуска браузерных профилей Dolphin Anty и сбора данных без участия оператора. |
| **fb_data_acceptor** | ✅ текущий | Django-сервис для приёма, нормализации и сохранения данных кампаний, поступающих от Chrome-расширений. |

### Клоакинг
| Сервис | Назначение |
|--------|-----------|
| **fs-cloak-proxy-worker** | Cloudflare Worker на глобальном edge: определяет реальный пользователь или бот и проксирует на соответствующий контент. |
| **keitaro-smart-redirector** | PHP-редиректор с SQLite-кэшем: выбирает оффер или white page в зависимости от источника, гео и режима. |
| **fs-offerwall-proxy-cloak-worker** | Cloudflare Worker: клоакинг специально для офферволл-воронок — отделяет ботов от реальных посетителей. |
| **fs-white-pages** | Cloudflare Worker: показывает безопасный нейтральный контент модераторам и ботам для прохождения модерации. |

### Маршрутизация
| Сервис | Назначение |
|--------|-----------|
| **fp-smart-link-worker** | Cloudflare Worker: распределяет трафик между вариантами воронок по весам, гео и типу устройства (A/B). |
| **upbase / JustLink** | Django-сервис: идентифицирует пользователей по IP/JID/device и перенаправляет их по правилам на нужный оффер. |

### Лендинги и воронки
| Сервис | Назначение |
|--------|-----------|
| **fs-template-apple-app-store** | Next.js лендинг, имитирующий страницу приложения в App Store для конверсии в установку. |
| **fs-template-google-play-market** | Nuxt лендинг, имитирующий страницу приложения в Google Play для Android-трафика. |
| **fs-casino-wheel-lp** | Next.js лендинг с анимированным колесом фортуны — механика вовлечения перед редиректом на казино. |
| **fs-template-offerwall** | Next.js лендинг со списком офферов, которые пользователь может выбрать сам. |
| **pwa_new** | FastAPI-бэкенд + PWA frontend: обеспечивает установку прогрессивного веб-приложения и подписку на push. |
| **landing** | Django multi-tenant лендинг с поддержкой 13 языков, A/B тестами и GPT-4o переводами. |
| **offerwall-alpha** | Django-приложение GameHub для gaming-вертикали: листинг игр и офферов. |
| **fs-offerwall-lp-api** | Node.js/Express API: отдаёт список активных офферов с учётом страны и приоритетов для офферволл-лендингов. |
| **fs-ai-content-worker** | Cloudflare Worker: генерирует iGaming review-контент через Llama 3.1 для white page и SEO-страниц. |
| **fs-lp-builder** | Node.js/Express сервис: собирает и деплоит лендинги (Next.js/Nuxt) по команде из fs-admin. |
| **fs-manifest-builder** | Node.js/Express сервис: генерирует PWA manifest.json, обрабатывает иконки и загружает артефакты в S3/R2. |

### Аналитика и атрибуция
| Сервис | Назначение |
|--------|-----------|
| **fp-analytics-tracker** | JS-библиотека, встраиваемая в лендинги: буферизует события пользователя и отправляет их в fp-analytics-api. |
| **fp-analytics-api** | Node.js/Express API: принимает браузерные события от fp-analytics-tracker и сохраняет в PostgreSQL. |
| **landing-tracker** | FastAPI-сервис: принимает события с лендингов, дедуплицирует через Redis и передаёт в Kafka → ClickHouse. |
| **user-identification-service** | FastAPI-сервис: матчит пользователей кросс-сессионно, потребляет Kafka, хранит ID в ClickHouse и Redis. |
| **conv_attribution** | PHP-сервис: принимает постбэки конверсий и рассчитывает мультиатрибуцию (first/last/linear/time-decay). |
| **dagster ETL** | Python ETL-пайплайны: каждую минуту перекачивают данные из ClickHouse Keitaro в PostgreSQL для BI. |
| **dashboard** | Django-дэшборд: визуализирует кампании, офферы, конверсии и ROAS на основе данных из PostgreSQL. |
| **events-manager** | Django-сервис: централизованный приём и хранение аналитических событий от других сервисов экосистемы. |

### Retention
| Сервис | Назначение |
|--------|-----------|
| **MB_retention_push** | FastAPI-сервис: хранит VAPID-подписки пользователей и рассылает Web Push уведомления по расписанию или триггеру. |
| **mb_retention_click_sync** | Сервис синхронизации данных кликов из Keitaro в retention-базу для формирования сегментов аудитории. |
| **mb_retention_conversions_sync** | Сервис синхронизации конверсий: обновляет статусы пользователей (FTD, re-deposit) для retention-логики. |
| **mb_keitaro_events** | Сервис приёма событий из Keitaro для запуска retention-триггеров в зависимости от действий пользователя. |

### Control Plane

> **Версионность finance:** `finance` — текущий production. `finance_v2` — новая версия в разработке, в production не запущена.

| Сервис | Статус | Назначение |
|--------|--------|-----------|
| **SSO** | ✅ текущий | Django OAuth2/JWT: централизованная аутентификация всех сотрудников и управление правами доступа между сервисами. |
| **fs-admin** | ✅ текущий | Django+Nuxt UI: панель управления конфигурациями офферволлов, PWA-лендингов, кампаний и клоак-правил. |
| **function-manager** | ✅ текущий | Django-сервис: управление медиабайерскими функциями, офферами и CSV/Excel импортом данных. |
| **hlpr** | ✅ текущий | Django REST + Nuxt UI: управление кампаниями Keitaro, ключами и связанными файлами в S3. |
| **finance** | ✅ текущий (v1) | Django-сервис финансового учёта команды медиабайеров с интеграцией TON Blockchain для криптовыплат. |
| **finance_v2** | 🚧 в разработке | Переработанная версия finance с расширенным API и балансами; в production не запущена. |
| **mb_permex** | ✅ текущий | Django-библиотека (permission_client + permission_gateway): синхронизирует группы и права доступа между SSO и сервисами. |

### Edge (Cloudflare)
| Сервис | Назначение |
|--------|-----------|
| **fs-d1-sync-worker** | Cloudflare Worker: получает webhook из fs-admin и синхронизирует конфигурации в CF D1 (SQL) и KV. |
| **fp-cloudflare-infra** | Terraform+Terragrunt GitOps: управляет DNS-зонами, Workers-маршрутами и CF-инфраструктурой через git. |

### Инфраструктура
| Сервис | Назначение |
|--------|-----------|
| **iac-platform** | Terraform+Ansible: весь серверный слой на DigitalOcean и Cloudflare с шифрованием секретов через SOPS+age. |
| **fs-infra** | Kubernetes-манифесты для деплоя Django-сервисов с ingress и service-конфигурациями. |
| **fn-ev-staging-gateway** | nginx-proxy: автоматически обнаруживает Docker-контейнеры по VIRTUAL_HOST и создаёт routing для staging. |
| **doppler_reloader** | FastAPI-сервис: слушает webhook Doppler и перезапускает нужный Docker-контейнер при изменении секрета. |
| **ssh_operator / django-command-executor** | Django-сервис: выполняет произвольные команды на удалённых серверах через SSH с live-выводом в браузер. |
| **pwa_switcher** | Django-сервис: управляет DNS-записями Cloudflare для PWA-доменов и отправляет уведомления в Slack. |
| **jira-bot-2** | Telegram-бот на aiogram: создаёт и обновляет задачи в Jira по командам операторов прямо из чата. |
| **inf-ops-keitaro-automation-scripts** | Python-скрипты для автоматизации операций Keitaro API: токены, плейсхолдеры, конверсии. |
| **inf-ops-skakapp-service-scripts** | Python-скрипты для bulk-обновления PWA-именований через SkakApp API. |
| **inf-ops-keitaro-emergency-restore-tools** | Bash/Python инструменты для восстановления Keitaro из ежедневных бэкапов в DigitalOcean Spaces. |

---

## 3. Главный датафлоу: путь трафика от клика до конверсии

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    ПОЛНЫЙ ПУТЬ ТРАФИКА                                   │
└──────────────────────────────────────────────────────────────────────────┘

[1] СОЗДАНИЕ РЕКЛАМЫ
    Meta Ads Manager (браузер оператора)
         ↓
    meta-mind-extension-legacy (Chrome MV3) [текущий]
    ··· meta-mind-extension [в разработке — придёт на смену]
         ↓  Facebook Graph API v22
    Данные кампаний → fb_data_acceptor (Django) → PostgreSQL
         ↓
    function-manager — управление офферами, медиабайерские функции
    hlpr — управление кампаниями и ключами (Keitaro streams)

[2] КЛИК ПОЛЬЗОВАТЕЛЯ
    Рекламное объявление (Facebook/Instagram Feed)
         ↓  URL с параметрами трекинга
    Keitaro 11 — приём клика
         ├── Фиксация в ClickHouse: sub_id_1..N, источник, гео, устройство
         ├── Счётчики кликов, лимиты, расписания
         └── Определение потока (stream) для маршрутизации

[3] КЛОАКИНГ (Keitaro → Cloak Worker)
    Keitaro stream → Landing URL
         ↓
    ┌─────────────────────────────────────────┐
    │  fs-cloak-proxy-worker (CF Worker)      │
    │  ИЛИ keitaro-smart-redirector (PHP)     │
    │  ИЛИ fs-offerwall-proxy-cloak-worker    │
    │                                         │
    │  Bot Detection:                         │
    │  - User-Agent analysis                  │
    │  - IP reputation check                  │
    │  - Поведенческие паттерны               │
    │  - CF D1: проверка активности кампании  │
    └────────────┬────────────────────────────┘
                 │
        ┌────────▼────────┐     ┌─────────────────────┐
        │  Real User      │     │  Bot / Moderator     │
        │  (реальный)     │     │  (модератор/бот)     │
        └────────┬────────┘     │  → fs-white-pages    │
                 │              │  (безопасный контент) │
                 │              └─────────────────────┘

[4] МАРШРУТИЗАЦИЯ
    Real User
         ↓
    fp-smart-link-worker (CF Worker, global edge)
         ├── Читает конфигурацию из CF KV
         ├── A/B тест: распределение по вариантам (%)
         ├── Геотаргетинг: страна → нужный лендинг
         └── Device: iOS/Android → нужный шаблон
         ↓
    upbase / JustLink (Django)
         ├── Идентификация пользователя: IP, JID, device, OS
         ├── Redis кэш UserData (TTL)
         ├── Логика редиректа по правилам (functions.py)
         └── events-manager API → аналитика
         ↓
    Выбранный лендинг / воронка

[5] ЛЕНДИНГ / ВОРОНКА
    Вариант A: App Store / Google Play воронка
         → fs-template-apple-app-store (Next.js 16)
           ИЛИ fs-template-google-play-market (Nuxt 4)
         → Кнопка "Установить" → App Store / Google Play
         → Установка приложения
         → postback: app_install → Keitaro

    Вариант B: iGaming / Casino воронка
         → fs-casino-wheel-lp (Next.js 16, колесо фортуны)
         → "Выиграли!" → CTA кнопка
         → fp-analytics-tracker: событие spin/win
         → Redirect → партнёрский оффер казино

    Вариант C: Offerwall воронка
         → fs-template-offerwall (Next.js 16, CF OpenNextjs)
         → GET fs-offerwall-lp-api /offers?country=UA&lang=uk
         → Список офферов (геотаргетинг, приоритет)
         → Пользователь выбирает оффер
         → Redirect → партнёрская ссылка

    Вариант D: PWA воронка
         → pwa_new (FastAPI + PWA frontend)
         → pwa_switcher управляет DNS (Cloudflare)
         → fs-manifest-builder генерирует PWA manifest
         → Установка PWA → push subscription
         → MB_retention_push: Web Push уведомления

    Вариант E: Multi-tenant лендинг
         → landing (Django, 13 языков, A/B тест, GPT-4o переводы)

[6] КОНВЕРСИЯ
    Пользователь совершает целевое действие на оффере
         ↓
    Партнёрская сеть → postback → Keitaro 11
    Keitaro → обновление статистики в ClickHouse
         ↓
    conv_attribution (PHP)
         ├── Получает постбэк /postback/?cid={clickid}&status=sale
         ├── Мультиатрибуция: first-click, last-click, linear
         └── PostgreSQL/MySQL → отчёты атрибуции

[7] СИНХРОНИЗАЦИЯ ДАННЫХ
    Keitaro ClickHouse → dagster ETL (каждую минуту)
         ├── Stream 1: keitaro_events → raw_keitaro_events → cleaned
         ├── Stream 2: справочники (кампании, офферы, домены, потоки)
         └── Stream 3: Jamon API → PostgreSQL (каждые 5 мин)
         ↓
    dashboard (Django) — аналитика и репортинг
    finance [текущий] — финансовый учёт команды
    ··· finance_v2 [в разработке — придёт на смену finance]
```

---

## 4. Датафлоу: Клоакинг

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CLOAK SYSTEM DATAFLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

ВАРИАНТ 1: Cloudflare-based cloaking (funnel-prod воронки)
─────────────────────────────────────────────────────────

Keitaro stream → URL на CF Worker домен
     ↓
fs-cloak-proxy-worker (CF Worker, ~0ms latency, global edge)
     │
     ├── [1] Проверка кампании: CF D1 (SQL)
     │         "SELECT active FROM campaigns WHERE id=?"
     │         Если кампания не активна → 404 / redirect
     │
     ├── [2] Bot detection:
     │         - User-Agent: проверка браузерных подписей
     │         - Заголовки: отсутствие типичных browser-headers
     │         - IP: чёрные списки, диапазоны Facebook/Apple/Google
     │         - CF Bot Score (встроенный CF механизм)
     │
     ├── [3] БОТО / МОДЕРАТОР → proxy → fs-white-pages
     │         Показывает: блог, новости, безобидный контент
     │         Цель: прохождение модерации Facebook Ads
     │
     └── [4] РЕАЛЬНЫЙ ПОЛЬЗОВАТЕЛЬ → proxy → настоящий лендинг
               Прозрачный reverse proxy (URL не меняется)

Конфигурация обновляется через:
     fs-admin → fs-d1-sync-worker → CF D1 (campaigns table)

─────────────────────────────────────────────────────────
ВАРИАНТ 2: PHP Smart Redirector (Keitaro потоки)
─────────────────────────────────────────────────────────

HTTP запрос (sub_id_1, sub_id_3, geo, device...)
     ↓
keitaro-smart-redirector/Validator.php
     │
     ├── [1] SQLite кэш — cache hit → UrlBuilder → redirect (быстро)
     │
     └── [2] Cache miss → параллельные async запросы (Guzzle):
               │
               ├── OfferManagerService
               │     GET /offers → pipe-separated список офферов
               │
               ├── FinanceApiService
               │     данные байерской команды, лимиты
               │
               └── В зависимости от режима:
                     ├── CLOAK режим → FunnelManagerService
                     │       белая страница vs настоящий оффер
                     ├── APP режим → JustLinkService (iOS)
                     │       атрибуция iOS-установок
                     └── DEFAULT → DefaultManagerService
                           fallback логика

               ↓ выбор оффера по логике
               SQLite: сохранение результата (кэш)
               LoggerService → Grafana Loki (JSON Lines)
               ↓
               UrlBuilder.php → redirect URL
               HTTP 302 → конечный оффер

─────────────────────────────────────────────────────────
ВАРИАНТ 3: Offerwall cloaking
─────────────────────────────────────────────────────────

Трафик → fs-offerwall-proxy-cloak-worker (CF Worker)
     ├── Бот → fs-white-pages
     └── Реальный → fs-template-offerwall (офферволл лендинг)
```

---

## 5. Датафлоу: Воронки и лендинги

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     FUNNEL MANAGEMENT DATAFLOW                           │
└──────────────────────────────────────────────────────────────────────────┘

СОЗДАНИЕ И ДЕПЛОЙ ВОРОНКИ
──────────────────────────

Маркетолог в fs-admin (Django + Nuxt.js UI)
     │
     ├── Создаёт конфигурацию оффервол/лендинга
     │     → PostgreSQL (fs-admin DB)
     │     → Webhook → fs-d1-sync-worker
     │           ↓
     │     Cloudflare D1 (SQL): campaigns, offers, rules
     │     Cloudflare KV: routing configs, A/B settings
     │           ↓
     │     fp-smart-link-worker читает KV → роутинг
     │     fs-cloak-proxy-worker читает D1 → клоак
     │
     ├── Запускает сборку LP
     │     → fs-lp-builder (Node.js/Express)
     │           ↓
     │     npm run build (Nuxt/Next.js LP)
     │     Deploy → CF Workers / DO / S3
     │
     ├── Генерирует PWA manifest
     │     → fs-manifest-builder (Node.js/Express)
     │           ↓
     │     Обработка иконок (Sharp)
     │     Генерация manifest.json
     │     Upload → S3/R2
     │
     └── Управляет DNS для PWA
           → pwa_switcher (Django + Cloudflare API)
                 ↓
           Cloudflare DNS: добавление/изменение записей
           Slack-уведомление об изменении

LANDING PAGE RUNTIME
─────────────────────

Пользователь открывает лендинг
     ↓
Лендинг загружается (Next.js SSR / Nuxt SSR / PWA)
     │
     ├── fp-analytics-tracker подключён (JS lib)
     │     → navigator.sendBeacon → fp-analytics-api → PostgreSQL
     │
     ├── Если offerwall: GET fs-offerwall-lp-api/offers?country=XX
     │     │  MaxMind GeoIP / CF-IPCountry определяет страну
     │     └── PostgreSQL: активные офферы для страны
     │           Сортировка: приоритет / CPL-ставка
     │
     ├── Если fs-casino-wheel-lp:
     │     → Анимация колеса (React)
     │     → ВСЕГДА "выигрыш" (WINNING_SEGMENT из ENV)
     │     → CTA кнопка → redirect на казино с affiliate URL
     │
     └── Клик CTA → партнёрский оффер
           + fp-analytics-tracker: событие 'click'/'conversion'

AI CONTENT (для SEO/white-page контента)
──────────────────────────────────────────

fs-ai-content-worker (CF Worker)
     → Запрос к Llama 3.1 (Cloudflare AI)
     → Генерация iGaming review контента (multi-language)
     → Встраивается в white page или SEO-контент воронки
```

---

## 6. Датафлоу: Атрибуция и трекинг конверсий

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  ATTRIBUTION & CONVERSION DATAFLOW                       │
└──────────────────────────────────────────────────────────────────────────┘

СЛОЙ 1: Трекинг кликов (Keitaro 11)
──────────────────────────────────────

Рекламное объявление
     ↓  https://keitaro.domain.com/click?campaign_id=X&sub_id_1=Y
Keitaro 11
     ├── Запись клика в ClickHouse
     │     Таблица: keitaro_events (108 колонок)
     │     Поля: datetime, sub_id_1..N, geo, device, OS, browser,
     │           IP, campaign_id, offer_id, landing_id, stream_id,
     │           is_bot, event_type, sign
     └── Redirect → лендинг / клоак-воркер

СЛОЙ 2: Трекинг пользователей (upbase / JustLink)
───────────────────────────────────────────────────

Запрос с параметрами (JID, IP, device)
     ↓
upbase (Django/JustLink)
     ├── Идентификация: создание/обновление UserData
     ├── RequestLog → PostgreSQL
     ├── Statistic → агрегация
     ├── Redis: кэш с TTL
     └── Celery: async сохранение
           ↓
     events-manager API → аналитическое хранилище

СЛОЙ 3: Браузерный трекинг лендингов
───────────────────────────────────────

Пользователь на лендинге (браузер)
     ↓
fp-analytics-tracker (JS, TypeScript + Webpack)
     ├── Буферизация событий (batch)
     ├── Типы: page_view, click, install, conversion, session_*
     └── navigator.sendBeacon → fp-analytics-api
           ↓
     fp-analytics-api (Node.js/Express)
           ↓
     PostgreSQL (events table)

landing-tracker (альтернатива для высоконагруженных LP):
     POST /track → FastAPI
           ├── Redis: дедупликация
           └── Kafka producer → topic: landing-events
                 ↓
           Kafka consumer
                 ↓
           ClickHouse (INSERT INTO events)

СЛОЙ 4: User identification
─────────────────────────────

user-identification-service (FastAPI)
     ├── Получает события из Kafka
     ├── Валидация и нормализация user ID
     ├── Кэш в Redis
     └── Запись в ClickHouse
           ↓
     Используется для кросс-сессионного матчинга

СЛОЙ 5: Постбэки конверсий
────────────────────────────

Партнёрская сеть регистрирует конверсию
     ↓  HTTP postback
     ↓  URL: https://keitaro.domain.com/postback?status=sale&clickid={cid}
Keitaro 11
     ├── Обновление статуса клика в ClickHouse
     └── Forwarding postback → conv_attribution

conv_attribution (PHP)
     ├── POST /postback/?cid={clickid}&status=sale
     ├── Controllers: валидация и парсинг
     ├── Services: расчёт атрибуции
     │     Модели: first-click, last-click, linear, time-decay
     └── PostgreSQL/MySQL → отчёты атрибуции
           ↓
     Admin-панель /admin/ — визуализация атрибуции

СЛОЙ 6: ETL и синхронизация (dagster)
───────────────────────────────────────

Keitaro ClickHouse (источник правды)
     ↓  каждую минуту (TSV bypass, ~31K rows/sec)
dagster ETL:
     Stream 1 (Events):
          CH keitaro_events → PG raw_keitaro_events
               ↓ transform job
          PG transform_events_cleaned
          (фильтры: is_bot=0, event_type=click, sign=1,
           дедупликация по (sub_id, datetime))

     Stream 2 (Dictionaries):
          CH [campaigns, offers, streams, domains, landings,
              groups, affiliate_networks, traffic_sources]
          → PG reference tables (full-replace, fingerprint skip)

     Stream 3 (Jamon API):
          Jamon HTTP API → cursor incremental
          → PG jamon-таблицы (каждые 5 мин)

     ↓
PostgreSQL (BI-источник)
     ↓
dashboard (Django) — аналитика команды
```

---

## 7. Датафлоу: Retention и push-уведомления

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        RETENTION DATAFLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

ПОДПИСКА НА PUSH
─────────────────

PWA лендинг (браузер)
     ↓  Пользователь разрешает уведомления
     ↓  POST /users/subscribe (VAPID subscription object)
MB_retention_push (FastAPI)
     ├── users/ — сохранение subscription
     ├── segments/ — сегментация пользователей
     └── PostgreSQL (users, segments, products)

СИНХРОНИЗАЦИЯ ДАННЫХ ДЛЯ RETENTION
─────────────────────────────────────

mb_retention_click_sync
     ↓  Синхронизация данных кликов из Keitaro
     ↓  (идентификация пользователей для retention-сегментов)
PostgreSQL (uni_casion_postgress)

mb_retention_conversions_sync
     ↓  Синхронизация конверсий
     ↓  Обновление статусов пользователей (FTD, повторный депозит)
PostgreSQL

mb_keitaro_events
     ↓  Приём событий из Keitaro
     ↓  (для retention-триггеров)

ОТПРАВКА PUSH-УВЕДОМЛЕНИЙ
──────────────────────────

Триггер: расписание / конверсионное событие
     ↓
MB_retention_push:
     push_planner/ — планирование рассылки
          ↓  по расписанию или триггеру
     workers/ — фоновые задачи (Redis очередь)
          ↓
     push/ — формирование и отправка
          ↓  Web Push API (VAPID auth)
     Браузер пользователя ← Push Notification
          ├── Показ уведомления
          └── Клик → возврат на оффер
               ↓
     logs_app/ → PostgreSQL (лог доставки, CTR)
```

---

## 8. Датафлоу: Управление трафик-сорсами (Meta Ads)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    META ADS MANAGEMENT DATAFLOW                          │
└──────────────────────────────────────────────────────────────────────────┘

МЕДИАБАЙЕР В DOLPHIN ANTY
───────────────────────────

Dolphin Anty (антидетект-браузер)
     ↓  загружено Chrome Extension
meta-mind-extension-legacy (TypeScript MV3) [текущий сборщик данных кампаний]
··· meta-mind-extension [в разработке — придёт на смену legacy]
x-ray-extension-v2 [отдельный инструмент — анализ FB-рекламы, используется параллельно]
     │
     ├── Content script активируется на Meta Ads Manager
     ├── Кнопка "Загрузить данные" в popup
     ├── Вызов Facebook Graph API v22:
     │     GET /me/adaccounts?fields=...
     │     GET /{ad_account}/campaigns?fields=...
     │     GET /{campaign}/adsets?fields=insights...
     │     GET /{adset}/ads?fields=creative,insights...
     │
     └── Данные: impressions, clicks, spend, CPM, CTR,
               CPC, conversions, ROAS, reach
          ↓
     Background script → POST fb_data_acceptor/api/
          ↓
     fb_data_acceptor (Django, SSO auth)
          ├── Celery async обработка
          ├── S3 — хранение сырых данных
          └── PostgreSQL — нормализованные данные
               ↓
     dashboard (Django) — отображение метрик

АВТОМАТИЗАЦИЯ (PoC)
─────────────────────

meta-mind-automation-poc (TypeScript, Manifest V3)
     ↓  node automation.js --profile-id=123
Dolphin Anty API (localhost:3001/v1.0)
     ├── Запуск браузерного профиля
     └── Открытие Meta Ads Manager
          ↓
Chrome Extension (автоматически)
     → Извлечение данных кампаний
     → Синхронизация в хранилище

УПРАВЛЕНИЕ КАМПАНИЯМИ
──────────────────────

Медиабайер
     ↓
hlpr (Django REST + Nuxt.js)
     ├── Управление кампаниями (Campaign management)
     ├── Управление ключами (Key management)
     ├── S3 — хранение файлов
     └── PostgreSQL
          ↓
function-manager (Django)
     ├── Функции медиабайерской команды
     ├── Управление офферами
     ├── mb_permex — права доступа
     ├── SSO — аутентификация
     └── Импорт/экспорт CSV/Excel → PostgreSQL

inf-ops-keitaro-automation-scripts (Python)
     → Keitaro API:
          - Управление токенами
          - Управление плейсхолдерами
          - Управление конверсиями

inf-ops-skakapp-service-scripts (Python)
     → SkakApp API:
          - Bulk обновление URL PWA-именований
```

---

## 9. Схема межсервисного взаимодействия

```
┌──────────────────────────────────────────────────────────────────────────┐
│                SERVICE-TO-SERVICE COMMUNICATION MAP                      │
└──────────────────────────────────────────────────────────────────────────┘

АУТЕНТИФИКАЦИЯ (SSO Hub)
──────────────────────────

SSO (Django OAuth2/JWT)
  ←→ function-manager    [OAuth2 redirect]
  ←→ dashboard           [OAuth2 redirect]
  ←→ finance             [OAuth2 redirect] [текущий]
··←→ finance_v2          [OAuth2 redirect] [в разработке]
  ←→ events-manager      [OAuth2 redirect]
  ←→ landing             [OAuth2 redirect]
  ←→ hlpr                [OAuth2 redirect]
  ←→ fb_data_acceptor    [JWT verify]
  └─ permission_gateway  [межсервисная валидация прав]
        ↑ mb_permex (Django lib — основа permission gateway)

КОНФИГУРАЦИИ (Admin → Edge)
─────────────────────────────

fs-admin (Django)
  → fs-d1-sync-worker (CF Worker)     [webhook / periodic]
       → Cloudflare D1                [SQL INSERT/UPDATE]
       → Cloudflare KV                [key-value PUT]
            ← fp-smart-link-worker    [KV GET routing config]
            ← fs-cloak-proxy-worker   [D1 SELECT campaign]

fs-admin
  → fs-lp-builder (Node.js)           [HTTP trigger build]
  → fs-manifest-builder (Node.js)     [HTTP trigger manifest]

АНАЛИТИКА (Event Bus)
───────────────────────

upbase / JustLink (Django)
  → events-manager                    [HTTP API POST /events]

landing-tracker (FastAPI)
  → Kafka                             [produce: landing-events]
  → ClickHouse                        [INSERT via consumer]

user-identification-service (FastAPI)
  ← Kafka                             [consume events]
  → ClickHouse                        [INSERT user records]
  → Redis                             [cache user IDs]

dagster ETL
  ← ClickHouse (keitaro_events)       [SELECT TSV bulk]
  → PostgreSQL                        [COPY FROM STDIN]
  ← Jamon HTTP API                    [GET cursor-based]
  → PostgreSQL                        [INSERT]

RETENTION (Data Sync)
──────────────────────

mb_retention_click_sync
  ← Keitaro / PostgreSQL              [click data]
  → uni_casion_postgress              [normalized clicks]

mb_retention_conversions_sync
  ← Keitaro / postback                [conversion events]
  → PostgreSQL                        [user conversion status]

MB_retention_push
  ← uni_casion_postgress              [user segments]
  → Web Push API (browsers)           [VAPID push]

ИНФРАСТРУКТУРА (Ops Plane)
────────────────────────────

doppler_reloader (FastAPI)
  ← Doppler webhook                   [config change event]
  → Docker daemon                     [container restart]

pwa_switcher (Django)
  → Cloudflare API                    [DNS record CRUD]
  → Slack API                         [change notifications]

jira-bot-2 (Telegram bot / aiogram)
  ← Telegram API                      [команды оператора]
  → Jira API                          [создание/обновление задач]
  ← Doppler                           [secrets]

ssh_operator / django-command-executor
  → paramiko SSH                      [remote server commands]
  ← HTMX UI                           [live output streaming]

ФИНАНСЫ
────────

finance (Django) [текущий — используется в production]
  ← SSO                               [OAuth2]
  → PostgreSQL                        [финансовые записи]
  → TON Blockchain API                [выплаты]
  ← Keitaro                           [структуры кампаний]

finance_v2 (Django) [в разработке — придёт на смену finance]
  ← SSO                               [OAuth2]
  → PostgreSQL                        [финансовые записи]
  → S3                                [Excel import/export]
  → Redis / Celery                    [async задачи]
```

---

## 10. Control Plane: управление конфигурациями

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION MANAGEMENT                            │
└──────────────────────────────────────────────────────────────────────────┘

ИСТОЧНИКИ КОНФИГУРАЦИИ
────────────────────────

[Doppler] → секреты и env-переменные для всех сервисов
     ↓  webhook при изменении
doppler_reloader → Docker container restart
     (hot-reload без downtime)

[fs-admin] → конфигурации офферволл, PWA, кампаний
     ↓  sync
fs-d1-sync-worker (CF Worker, Inversify DI)
     ├── CF D1: таблицы campaigns, offers, geo_rules
     └── CF KV: routing configs, A/B weights

[fp-cloudflare-infra] → GitOps IaC
     Terraform + Terragrunt → CF DNS zones, Workers routes,
     domains, KV namespaces, D1 databases
     (git push → план → apply)

[iac-platform] → вся инфраструктура
     Terraform → DigitalOcean (Droplets, K8s, Spaces, Firewall)
     Ansible → конфигурация серверов
     SOPS + age → шифрование секретов в git
     Cloudflare → DNS, Workers, SSL

[fs-infra] → Kubernetes
     Kubernetes manifests для Django admin + microservices
     (django-admin deployment, services, ingress)

ROUTING TABLE (актуальность конфигов)
───────────────────────────────────────

Изменение в fs-admin UI
     ↓ ~секунды
fs-d1-sync-worker → CF D1/KV обновлены
     ↓ мгновенно (CF edge cache)
fp-smart-link-worker видит новый routing
fs-cloak-proxy-worker видит изменения кампании

Изменение Doppler секрета
     ↓ webhook ~секунды
doppler_reloader → Docker restart целевого контейнера
     ↓ ~10-30 секунд
Сервис перезапущен с новым конфигом
```

---

## 11. Инфраструктурный слой

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE TOPOLOGY                            │
└──────────────────────────────────────────────────────────────────────────┘

CLOUDFLARE EDGE (глобальный, latency ~10ms)
────────────────────────────────────────────

CF Workers:
  ├── fp-smart-link-worker    → умный роутинг (A/B, geo)
  ├── fs-cloak-proxy-worker   → клоакинг
  ├── fs-offerwall-proxy-cloak-worker → офферволл клоак
  ├── fs-d1-sync-worker       → конфиг синхронизация
  ├── fs-ai-content-worker    → AI контент (Llama 3.1)
  └── fs-white-pages          → fallback white page

CF Storage:
  ├── D1 (SQL): campaigns, cloak rules
  └── KV: routing configs, A/B weights

DIGITALOCEAN (основные сервера)
────────────────────────────────

Kubernetes Cluster (fs-infra):
  ├── fs-admin (Django + Nuxt)
  └── Supporting microservices

VPS / Droplets:
  ├── Keitaro 11 (tracker + ClickHouse)
  ├── PostgreSQL (основная БД)
  ├── Redis (кэш + Celery broker)
  ├── Kafka + Zookeeper (event streaming)
  ├── Django микросервисы (SSO, function-manager, dashboard,
  │   events-manager, landing, finance_v2, hlpr, upbase,
  │   fb_data_acceptor, ssh_operator)
  └── PHP сервисы (keitaro-smart-redirector, conv_attribution)

STAGING ОКРУЖЕНИЕ
──────────────────

fn-ev-staging-gateway (nginx-proxy)
  → Docker socket → автообнаружение контейнеров
  → VIRTUAL_HOST env → автоматический routing
  → Cloudflare SSL (wildcard cert)

МОНИТОРИНГ
────────────

upbase → Prometheus /metrics/
Keitaro-smart-redirector → Grafana Loki (JSON Lines)
Dagster UI → pipeline мониторинг
CI/CD → GitHub Actions (MB-Retention → DO Container Registry)
```

---

## 12. Аналитическая платформа и BI

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      ANALYTICS PLATFORM                                  │
└──────────────────────────────────────────────────────────────────────────┘

ИСТОЧНИКИ ДАННЫХ
─────────────────

Keitaro 11 ClickHouse
  → keitaro_events (108 колонок, месячные партиции)
     sub_id_1..N, geo, device, campaign_id, offer_id,
     landing_id, stream_id, is_bot, event_type, sign

landing-tracker ClickHouse
  → LP события: visit, click, scroll, conversion

user-identification-service ClickHouse
  → нормализованные user IDs

fp-analytics-api PostgreSQL
  → PWA события

АНАЛИТИКА
──────────

dagster ETL (Python 3.11, Dagster)
  → PostgreSQL: cleaned events, справочники, Jamon данные
  → Основа для BI-запросов и аналитических отчётов

dashboard (Django)
  ← PostgreSQL (через dagster)
  → Визуализация: кампании, офферы, конверсии, ROAS
  → Доступ через SSO

conv_attribution (PHP)
  → Multi-touch attribution reports
  ← Постбэки от партнёрских сетей + Keitaro

finance (Django) [текущий]
  → Финансовые отчёты команды медиабайеров
  → TON Blockchain выплаты

finance_v2 (Django) [в разработке — придёт на смену finance]
  → Переработанный финансовый учёт
  → Импорт/экспорт Excel
  → S3 storage
```

---

## 13. Инструкция оператора экосистемы

### 13.1. Быстрый старт: запуск новой рекламной кампании

```
ЧЕКЛИСТ ЗАПУСКА КАМПАНИИ
──────────────────────────

ШАГ 1: Создание трафик-сорса в Meta Ads
  □ Зайти в Meta Ads Manager через Dolphin Anty
    (антидетект профиль с нужным аккаунтом)
  □ Создать кампанию / адсет / объявление
  □ Установить tracking URL с параметрами Keitaro:
    https://keitaro.domain.com/click?campaign_id={keitaro_id}&sub_id_1={ad_id}

ШАГ 2: Настройка потока в Keitaro 11
  □ Создать кампанию в Keitaro → назначить трафик-сорс (Facebook)
  □ Создать поток (stream):
       - Если нужен клоак: добавить Filter (Bot Checker) →
           бот → белая страница (fs-white-pages URL)
           реальный → лендинг URL
       - Если нет клоака: прямой redirect → лендинг
  □ Настроить sub_id макросы для передачи ad_id, adset_id
  □ Настроить постбэк URL оффера:
    https://keitaro.domain.com/postback?clickid={clickid}&status=sale

ШАГ 3: Настройка клоакинга (при необходимости)
  Вариант A — CF-based (рекомендуется для funnel-prod):
  □ Зайти в fs-admin → создать Campaign запись
       name, domain, active=true, white_page_url, real_lp_url
  □ fs-d1-sync-worker автоматически синхронизирует в CF D1
  □ Настроить wrangler.toml routes для домена клоака
  □ fs-cloak-proxy-worker будет обслуживать трафик

  Вариант B — PHP Smart Redirector:
  □ Настроить .env: OFFER_MANAGER_URL, FINANCE_API_URL, etc.
  □ Выбрать режим: CLOAK или APP (iOS атрибуция)
  □ Keitaro stream → URL smart-redirector на PHP сервере

ШАГ 4: Создание/выбор лендинга
  □ В fs-admin → создать LP конфигурацию
  □ Выбрать шаблон:
       - Apple App Store LP → fs-template-apple-app-store
       - Google Play LP → fs-template-google-play-market
       - Casino Wheel LP → fs-casino-wheel-lp
       - Offerwall LP → fs-template-offerwall
       - PWA → pwa_new + fs-manifest-builder
  □ Запустить fs-lp-builder → сборка и деплой LP
  □ Для PWA: pwa_switcher → настроить DNS запись в Cloudflare
  □ Убедиться что fp-analytics-tracker подключён (для трекинга)

ШАГ 5: Настройка маршрутизации
  □ В fs-admin → создать Smart Link конфигурацию:
       variants: [{ url, weight, geo, device }]
  □ fs-d1-sync-worker → CF KV обновлён
  □ fp-smart-link-worker → A/B распределение активно
  □ Проверить: curl -H "CF-IPCountry: UA" https://smart-link.domain.com/

ШАГ 6: Запуск и мониторинг
  □ Включить рекламное объявление в Meta Ads Manager
  □ Проверить первые клики в Keitaro 11 (Real-time):
       Keitaro → Statistics → Last clicks
  □ Проверить клоак (тест от имени бота):
       curl -H "User-Agent: facebookexternalhit" https://cloak-domain.com/
       → должен вернуть white page
  □ Проверить реальный переход:
       Открыть ссылку в браузере → должен попасть на лендинг
  □ Мониторинг аналитики:
       dashboard → кампании → метрики
```

### 13.2. Управление данными Meta Ads

```
СБОР ДАННЫХ ИЗ META ADS
──────────────────────────

1. Установка расширения в Dolphin Anty:
   chrome://extensions/ → Load unpacked → dist/
   Расширения: meta-mind-extension ИЛИ fb-ads-extension

2. Извлечение данных:
   □ Открыть Meta Ads Manager в Dolphin Anty
   □ Кликнуть popup расширения → "Загрузить данные"
   □ Расширение вызывает Facebook Graph API
   □ Данные отправляются в fb_data_acceptor

3. Просмотр данных:
   □ dashboard → Meta Ads раздел
   □ Или: fb_data_acceptor /admin/ → AdData

4. Автоматизация (PoC):
   node automation.js --profile-id=<dolphin_profile_id>
   Требует: DOLPHIN_API_URL, DOLPHIN_TOKEN в .env
```

### 13.3. Управление конфигурациями через fs-admin

```
FS-ADMIN: ОСНОВНЫЕ ОПЕРАЦИИ
─────────────────────────────

URL: https://admin.your-domain.com/admin/

ОФФЕРВОЛЛ:
  □ Campaigns → Add → заполнить name, country_codes, reward,
    cta_url, active, priority
  □ Сохранить → автоматическая синхронизация в CF D1
  □ Проверить: GET /offers?country=UA&limit=5 на fs-offerwall-lp-api

PWA ЛЕНДИНГИ:
  □ PWA Config → Add → заполнить app_name, icon, theme_color,
    target_url, geo_rules
  □ Generate Manifest → fs-manifest-builder генерирует manifest.json
  □ Deploy LP → fs-lp-builder строит и деплоит
  □ DNS → pwa_switcher создаёт DNS запись в Cloudflare

КЛОАК КАМПАНИИ:
  □ Cloak Campaigns → Add → domain, white_page_url, real_lp_url, active
  □ Sync → fs-d1-sync-worker обновляет CF D1
  □ Проверить активность: GET /health на Worker
```

### 13.4. Мониторинг и диагностика

```
МОНИТОРИНГ СИСТЕМЫ
───────────────────

KEITARO (основной трекер):
  □ Keitaro UI → Statistics → Real-time clicks
  □ Keitaro UI → Reports → Conversions, EPC, CR
  □ ClickHouse: SELECT count() FROM keitaro_events WHERE datetime > now()-3600
  □ Backup статус: проверить Telegram от inf-ops-keitaro-emergency-restore-tools

CLOUDFLARE WORKERS:
  □ CF Dashboard → Workers → Analytics (invocations, errors, latency)
  □ Wrangler tail → live логи: npx wrangler tail fs-cloak-proxy-worker
  □ D1 проверка: npx wrangler d1 execute CAMPAIGNS_DB --command="SELECT count(*) FROM campaigns WHERE active=1"

DAGSTER ETL:
  □ Dagster UI (localhost:3000) → Jobs → последний run
  □ Если job завис: dagster job execute -j raw_sync_events_job
  □ PG advisory locks: SELECT * FROM pg_locks WHERE NOT granted;

ANALYTICS:
  □ upbase metrics: curl http://upbase:8000/metrics/ | grep http_requests
  □ landing-tracker: ClickHouse → SELECT count() FROM events WHERE toDate(ts)=today()
  □ fp-analytics-api: PostgreSQL → SELECT count(*) FROM events WHERE created_at > now()-interval '1 hour'

RETENTION:
  □ MB_retention_push: logs_app → PostgreSQL → последние доставки
  □ Push delivery rate: logs/ → WHERE status='delivered' / total

СЕРВИСЫ:
  □ SSO: curl https://sso.domain.com/health/
  □ function-manager: Django /admin/ → доступность
  □ Все Django сервисы: Celery workers running?
      celery -A core inspect active
```

### 13.5. Экстренные процедуры

```
КЕЙС 1: Keitaro недоступен
───────────────────────────
1. Проверить сервер: ssh keitaro-server
2. Проверить процессы: systemctl status keitaro
3. Если потеря данных: inf-ops-keitaro-emergency-restore-tools
   bash restore.sh --date=2026-03-03
   (восстанавливает из DO Spaces backup)
4. Telegram уведомление будет отправлено автоматически

КЕЙС 2: CF Worker выдаёт ошибки
─────────────────────────────────
1. npx wrangler tail <worker-name> → смотреть логи
2. Проверить D1: npx wrangler d1 execute CAMPAIGNS_DB --command="SELECT 1"
3. Откатить версию: CF Dashboard → Workers → Deployments → Rollback
4. Экстренно: изменить route в CF Dashboard → выключить Worker

КЕЙС 3: Клоак показывает LP вместо white page
────────────────────────────────────────────────
1. Проверить D1: campaign active=true
2. Проверить bot detection headers:
   curl -v -H "User-Agent: facebookexternalhit/1.1" https://cloak-domain.com/
3. Если нужно добавить IP в чёрный список — обновить D1 блоклист:
   npx wrangler d1 execute CAMPAIGNS_DB --command="INSERT INTO ip_blocklist VALUES('1.2.3.4')"
4. Обновить Worker: npx wrangler deploy

КЕЙС 4: Meta аккаунт заблокирован / объявление отклонено
──────────────────────────────────────────────────────────
1. Немедленно остановить трафик в Keitaro (деактивировать поток)
2. Проверить white page через новый аккаунт Facebook
3. При необходимости обновить fs-white-pages контент
4. Переключить кампанию на другой аккаунт через Dolphin Anty
5. Создать Jira задачу через jira-bot-2 (Telegram бот)

КЕЙС 5: dagster ETL не синхронизирует данные
──────────────────────────────────────────────
1. Dagster UI → Job → Failure → смотреть логи
2. Проверить ClickHouse доступность:
   clickhouse-client --query "SELECT 1"
3. Проверить PostgreSQL:
   psql $DATABASE_URL -c "SELECT 1"
4. Сбросить PG advisory locks при deadlock:
   SELECT pg_advisory_unlock_all();
5. Перезапустить job вручную:
   dagster job execute -j raw_sync_events_job

КЕЙС 6: Push уведомления не доставляются
──────────────────────────────────────────
1. Проверить VAPID ключи: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY в .env
2. MB_retention_push logs_app → статусы ошибок
3. Проверить Redis очередь: redis-cli LLEN push_queue
4. Перезапустить workers:
   docker-compose restart workers
5. Проверить актуальность подписок (expired subscriptions)
```

### 13.6. Управление инфраструктурой

```
IAC ОПЕРАЦИИ
──────────────

DigitalOcean (iac-platform):
  # Просмотр плана изменений
  cd terraform/digitalocean
  terraform plan

  # Применить изменения
  terraform apply

  # Ansible: применить конфигурацию
  ansible-playbook -i inventory playbooks/configure-server.yml

  # SOPS: расшифровать секрет
  sops -d secrets/production.yaml

Cloudflare (fp-cloudflare-infra):
  # GitOps: изменить DNS/Worker в YAML → git push → pipeline
  # Или вручную:
  cd cloudflare/staging
  terragrunt plan
  terragrunt apply

DNS / PWA управление:
  # pwa_switcher (Django admin):
  # /admin/ → DNS Records → Add Record
  # ИЛИ через API:
  POST /api/dns/ { "subdomain": "casino-ua", "ip": "1.2.3.4" }

ДОБАВЛЕНИЕ НОВОГО СЕРВИСА
──────────────────────────

1. Создать репозиторий → clone в ~/Desktop/Upstars/soft/
2. Использовать starter-pack-script для scaffold:
   bash scaffold.sh --name=new-service --type=django
   (создаёт Docker, Celery, PostgreSQL структуру)
3. Настроить секреты в Doppler → new-service project
4. doppler_reloader подхватит изменения автоматически
5. fn-ev-staging-gateway: добавить VIRTUAL_HOST env в docker-compose
6. SSO: зарегистрировать новый клиент в sso/admin/
7. mb_permex: настроить права доступа
8. Деплой: GitHub Actions или ручной docker-compose up -d
```

### 13.7. Роли и доступы

```
РОЛИ В СИСТЕМЕ
───────────────

МЕДИАБАЙЕР:
  Доступ: Meta Ads Manager (Dolphin Anty), meta-mind-extension,
           fb-ads-extension, dashboard (чтение)
  Задачи: создание и управление рекламными кампаниями,
           отслеживание метрик, масштабирование

ТЕХНИЧЕСКИЙ ОПЕРАТОР:
  Доступ: Keitaro admin, fs-admin, function-manager, hlpr,
           Cloudflare Dashboard, Dagster UI
  Задачи: настройка потоков, клоак, лендингов, маршрутизации

DEVOPS / ИНФРАСТРУКТУРА:
  Доступ: iac-platform, fp-cloudflare-infra, Doppler,
           ssh_operator, django-command-executor, DigitalOcean
  Задачи: инфраструктура, деплой, мониторинг, backup

АНАЛИТИК:
  Доступ: dashboard, dagster UI, ClickHouse (read), conv_attribution,
           dashboard
  Задачи: анализ воронок, атрибуция, отчётность по ROAS

ФИНАНСЫ:
  Доступ: finance_v2, finance (SSO auth)
  Задачи: финансовый учёт, выплаты команде

УПРАВЛЕНИЕ ДОСТУПАМИ:
  Все роли → через SSO (sso.domain.com)
  Права → mb_permex + permission_gateway
  Создание пользователей: SSO admin → Users → Add user → assign roles
```

### 13.8. Ключевые метрики и SLA-ориентиры

```
ПРОИЗВОДИТЕЛЬНОСТЬ СИСТЕМЫ
────────────────────────────

CF Workers (клоак, роутинг):
  Latency: < 20ms (global edge)
  Availability: 99.99% (Cloudflare SLA)
  Throughput: неограниченно (auto-scale)

Keitaro 11:
  Click processing: < 50ms
  ClickHouse write: ~31K rows/sec (dagster benchmark)
  Backup frequency: ежедневно (DO Spaces)

dagster ETL:
  Events sync: каждую минуту
  Dict sync: каждую минуту
  Jamon sync: каждые 5 минут
  Latency data lag: < 2 минуты

upbase / JustLink:
  Redis cache hit rate: > 90%
  Redirect latency: < 100ms (cache hit), < 500ms (miss)

MB_retention_push:
  Push delivery rate: > 85% (зависит от браузера/устройства)
  Campaign latency: < 30 сек от триггера до отправки

КЛЮЧЕВЫЕ KPI ВОРОНКИ:
  CTR (клик/показ): мониторить в dashboard
  CR (клик/конверсия): мониторить в Keitaro + conv_attribution
  ROAS: finance_v2 + dashboard
  EPC (earning per click): Keitaro Statistics
```

---

## Глоссарий терминов

| Термин | Определение |
|--------|-------------|
| **Keitaro 11** | Основной трекер кликов. Центральный элемент всей системы |
| **Клоак** | Показ разного контента для реальных пользователей и модераторов рекламных платформ |
| **White Page** | Безопасная страница для модераторов/ботов (fs-white-pages) |
| **Black Page / Real LP** | Настоящий лендинг для реальных пользователей |
| **Stream** | Поток трафика в Keitaro с правилами маршрутизации |
| **Sub ID** | Параметры трекинга (sub_id_1..N) — передаются по всей цепочке |
| **Постбэк** | Серверный HTTP-запрос о конверсии от партнёрской сети → Keitaro |
| **Smart Link** | URL с A/B логикой маршрутизации (fp-smart-link-worker) |
| **Оффервол** | Страница со списком офферов для монетизации трафика |
| **PWA** | Progressive Web App — устанавливаемое веб-приложение |
| **Dolphin Anty** | Антидетект-браузер для работы с несколькими FB-аккаунтами |
| **ROAS** | Return on Ad Spend — возврат на рекламные расходы |
| **EPC** | Earning Per Click — доход на клик |
| **FTD** | First-Time Deposit — первый депозит (iGaming конверсия) |
| **JID** | JustLink User ID — уникальный идентификатор пользователя в upbase |
| **CF Worker** | Cloudflare Worker — serverless функция на глобальном edge |
| **D1** | Cloudflare D1 — edge SQL база данных |
| **KV** | Cloudflare KV — edge key-value хранилище |
| **VAPID** | Voluntary Application Server Identification — стандарт Web Push auth |
