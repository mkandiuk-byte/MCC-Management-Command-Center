# Project Houston — Общий обзор проекта

## 1. Введение

**Project Houston** — проект по миграции и объединению четырёх существующих Django-сервисов (Dashboard, Finance, Events Manager, Function Manager) в единую микросервисную платформу на базе **FastAPI + PostgreSQL** с единой базой данных, новым API Gateway и централизованной системой аутентификации.

**Кодовое название:** Houston
**Дата начала планирования:** Март 2026
**Статус:** Фаза планирования

---

## 2. Бизнес-контекст

### 2.1 Текущая ситуация (AS-IS)

Платформа Makeberry состоит из 4 независимых Django-приложений, каждое из которых:
- Имеет собственную базу данных PostgreSQL
- Развёрнуто в отдельном Docker-стеке
- Использует собственные Celery-воркеры и Redis
- Взаимодействует с другими сервисами через HTTP API (point-to-point)
- Использует различные механизмы аутентификации (SSO, API-токены, Bearer-токены)

| Сервис | Назначение | Стек | БД | Порт |
|--------|-----------|------|----|------|
| **Dashboard** | Аналитика кликов/конверсий, P&L-отчёты, дашборды байеров | Django 5.1.3, Celery, Unfold | PostgreSQL (DigitalOcean) | 8085 |
| **Finance** | Управление финансами, расходы, зарплаты, Brocard-интеграция | Django 5.2.4, DRF, Celery | PostgreSQL 17 | 8087 |
| **Events Manager** | Маршрутизация событий, Facebook CAPI, правила потоков | Django 5.1.3, Celery | PostgreSQL | 8084 |
| **Function Manager** | Асинхронные задачи, интеграция с Keitaro, управление офферами | Django 5.1.8, Celery | PostgreSQL | 8000 |

### 2.2 Проблемы текущей архитектуры

1. **Фрагментированные данные** — данные размазаны по 4+ базам данных, нет единого источника правды
2. **Дублирование сущностей** — справочники (Buyers, Teams, Geos, Offers) дублируются между сервисами
3. **Сложная интеграция** — сервисы связаны через прямые HTTP-вызовы с токенами
4. **Множество баз** — каждый сервис поддерживает свою PostgreSQL, что усложняет бэкапы, мониторинг, миграции
5. **Разнородная аутентификация** — Django SSO, API-токены, Bearer-токены, пароли разделов
6. **Сложность деплоя** — 4 отдельных docker-compose стека, 4 набора Celery-воркеров
7. **Нет единого API** — клиенты должны знать адреса и токены каждого сервиса

### 2.3 Целевая ситуация (TO-BE)

Единая платформа, где:
- **Одна PostgreSQL база данных** — все данные в одном месте с единой схемой
- **Микросервисы на FastAPI** — лёгкие, быстрые, асинхронные сервисы, сгруппированные по доменам
- **API Gateway** — единая точка входа: `api.houston.com/dashboard`, `api.houston.com/finance`, и т.д.
- **Централизованная аутентификация** — Cloudflare Zero Trust + KeyCloak (OIDC, JWT, RBAC). Без кастомного Auth Service (SSO)
- **Dagster как оркестратор** — все фоновые/batch-операции (ETL, синхронизации, расчёты, отчёты) выполняются через Dagster. Синхронизация кликов из Keitaro и конверсий из Scaleo уже в процессе реализации в отдельном Dagster-сервисе на той же PostgreSQL
- **Celery только для real-time** — используется исключительно для обработки входящих событий в Events Service (мгновенный async dispatch)
- **Единый деплой** — один Docker Compose / Kubernetes, общий мониторинг

---

## 3. Цели проекта

### 3.1 Бизнес-цели
- Ускорить разработку новых фич за счёт единой кодовой базы и общей схемы данных
- Упростить онбординг новых разработчиков
- Снизить операционные расходы на инфраструктуру (меньше серверов, баз, Redis-инстансов)
- Обеспечить согласованность данных между всеми модулями

### 3.2 Технические цели
- Единая PostgreSQL-схема с нормализованными справочниками
- Асинхронные FastAPI-микросервисы с общей моделью данных (SQLAlchemy/Alembic)
- API Gateway с маршрутизацией, rate limiting, аутентификацией
- JWT-аутентификация с RBAC (Role-Based Access Control)
- Централизованное логирование и мониторинг
- CI/CD пайплайн для всех сервисов
- Покрытие тестами (>80% для критических путей)

---

## 4. Scope проекта

### 4.1 В scope

| Компонент | Описание |
|-----------|----------|
| **KeyCloak + Cloudflare ZT** | Аутентификация через Cloudflare Zero Trust + KeyCloak (OIDC/OAuth 2.0, RBAC). Нет кастомного Auth Service |
| **Dashboard Service** | Аналитика кликов/конверсий, дашборды, агрегации, словари. Только REST API |
| **Finance Service** | Финансовые операции, расходы, зарплаты, Brocard, контрагенты. Только REST API |
| **Events Service** | Маршрутизация событий, кампании, потоки, Facebook CAPI, правила. API + Celery для real-time dispatch |
| **Functions Service** | API проверки офферов, конфигурация задач. Только REST API |
| **API Gateway** | Кастомный FastAPI Gateway — маршрутизация, JWT-валидация (KeyCloak JWKS), rate limiting, CORS |
| **Dagster Orchestrator** | Единый оркестратор фоновых операций (ETL, sync, расчёты, отчёты). Синхронизация кликов/конверсий уже реализована |
| **Миграция данных** | Скрипты миграции данных из 4 старых БД в единую |
| **Инфраструктура** | Docker Compose, CI/CD, мониторинг, логирование |

### 4.2 Вне scope (первая фаза)
- Публичный API для внешних партнёров/других департаментов
- Полная замена Keitaro в разрезе управления трафиком. Только функция приема трафика.

---

## 5. Анализ текущих сервисов

### 5.1 Dashboard (Аналитика)

**Назначение:** Платформа аналитики affiliate-маркетинга, агрегирующая данные о кликах и конверсиях из Keitaro и Scaleo.

**Ключевые сущности:**
- Click (клики с Keitaro — ~30 полей с метаданными трафика)
- Conversion (конверсии из Scaleo, привязанные к кликам)
- BuyerTechCost (месячные технические расходы по покупателям)
- Справочники: Buyer, Team, Direction, Source, Funnel, Geo, Offer, Device, OS, Browser
- Модели дашбордов: BuyerDashboard, TeamDashboard, DirectionDashboard и т.д.
- CohortRule (правила расчёта выручки: ROI, Agency, Fixed)
- PnL-модели: PnlCategory, PnlAdditionalSum, PnlActualExpense, PnlSettings, PnlReports

**Фоновые задачи (14+), сейчас Celery → мигрируются в Dagster:**
- Синхронизация кликов из Keitaro (**уже в процессе реализации в Dagster**)
- Синхронизация конверсий из Scaleo (**уже в процессе реализации в Dagster**)
- Связывание конверсий с кликами → Dagster asset
- Расчёт rule_revenue по когортным правилам → Dagster asset
- Обновление техрасходов из Finance → Dagster asset
- Генерация P&L отчётов → Dagster job
- Обновление материализованных представлений → Dagster asset
- Очистка старых данных → Dagster scheduled job

**Интеграции:** Keitaro API, Scaleo API, Finance API, SSO, Sentry, BetterStack

---

### 5.2 Finance (Финансы)

**Назначение:** Финансовое управление для арбитражных команд — расходы, бюджеты, зарплаты.

**Ключевые сущности:**
- DailyCost (ежедневные рекламные расходы)
- TechCost (индивидуальные технические расходы)
- GlobalTechCost (корпоративные расходы с распределением)
- BrocardOperation (операции платёжной системы)
- CounterpartyCosts, BalanceCounterparties (контрагенты)
- UserGroup (иерархия команд: team → department → direction)
- UserSalary, MonthlySalaryOperation (зарплаты)
- Offer, OfferClicks, CloakClicks (аналитика)
- DailyTimezoneCost, CostSendQueue (таймзон-расходы)

**Фоновые задачи (сейчас Celery → мигрируются в Dagster):**
- Синхронизация Brocard-операций (ежечасно) → Dagster scheduled asset
- Обновление кликов по офферам → Dagster asset
- Расчёт техрасходов → Dagster asset
- Генерация зарплатных операций → Dagster monthly job

**Интеграции:** Keitaro API, Brocard API, OpenExchangeRates, TON Blockchain, Dashboard API, Sentry, BetterStack

---

### 5.3 Events Manager (Маршрутизация событий)

**Назначение:** Роутинг и обработка маркетинговых событий с поддержкой Facebook CAPI.

**Ключевые сущности:**
- Campaign (входная точка для событий, привязана к домену)
- Flow (шаги выполнения с правилами)
- Stream (батч-обработка FB событий)
- Rule (условия фильтрации: EMPTY, EQUALS, CONTAIN и т.д.)
- Action (типы: REQUEST, FB_EVENT, APPSFLYER)
- ActionMapping (трансформация параметров)
- FbToken, FbUser, FbLog (Facebook-интеграция)
- ApplicationList (клиентские приложения)
- LogRequest, LogAction (логи запросов и действий)

**API:**
- `POST /1.0/events/<alias>` — обработка входящих событий
- `POST /1.0/user/save` — сохранение FB-пользователей
- `POST /1.0/application/save` — регистрация приложений

**Интеграции:** Facebook Graph API v16.0, Facebook Pixel API, AppsFlyerAPI, BetterStack

---

### 5.4 Function Manager (Задачи и офферы)

**Назначение:** Управление асинхронными задачами и мониторинг доступности офферов.

**Ключевые сущности:**
- CeleryTasks, CeleryTasksLog (конфигурация и логи задач)
- AvailableOffers (мастер-данные офферов)
- AvailableOffersSubid (конверсии по sub_id)

**API:**
- `POST /api/not-available-offers` — проверка доступности офферов

**Фоновые задачи (сейчас Celery → мигрируются в Dagster):**
- Исправление типов кампаний в Keitaro → Dagster asset
- Обновление click sub_id → Dagster asset
- Сбор конверсий по офферам → Dagster scheduled asset
- Очистка зависших задач → Dagster sensor/scheduled job

**Интеграции:** Keitaro API, BetterStack

---

## 6. Целевая архитектура (высокий уровень)

```
                    ┌──────────────────────┐
                    │      Клиенты         │
                    │  (Web UI, Mobile,    │
                    │   External APIs)     │
                    └──────────┬───────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │    API Gateway        │
                    │   (FastAPI Gateway)          │
                    │  ─ JWT Validation     │
                    │  ─ Rate Limiting      │
                    │  ─ CORS              │
                    │  ─ Request Routing    │
                    └──┬───┬───┬───┬───┬───┘
                       │   │   │   │   │
          ┌────────────┘   │   │   └────────────┐
          ▼                ▼   │                ▼
    ┌──────────┐  ┌──────────┐│  ┌───────────┐
    │Dashboard │  │ Finance  ││  │ Functions │
    │ Service  │  │ Service  ││  │  Service  │
    │/dashboard│  │/finance/*││  │/functions*│
    └────┬─────┘  └────┬─────┘│  └─────┬─────┘
         │              │      │        │
         │              │      ▼        │
         │              │ ┌──────────┐  │
         │              │ │  Events  │  │
         │              │ │  Service │  │
         │              │ │ /events/*│  │
         │              │ └────┬─────┘  │
         │              │      │        │
         └──────────────┴──────┼────────┘
                                │
                    ┌───────────▼───────────┐
                    │   PostgreSQL (единая) │
                    │   ─ keycloak schema   │
                    │   ─ shared schema     │
                    │   ─ dashboard schema  │
                    │   ─ finance schema    │
                    │   ─ events schema     │
                    │   ─ functions schema  │
                    │   ─ dagster schema    │
                    └───────────▲───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
    ┌─────────▼─────────┐  ┌───▼────┐  ┌─────────▼─────────┐
    │      Dagster       │  │ Redis  │  │  Celery Worker    │
    │  (Orchestrator)    │  │  7+    │  │  (Events only)    │
    │                    │  │        │  │                    │
    │ ─ Dagster Daemon   │  │─ Cache │  │ Real-time async   │
    │ ─ Dagster Webserver│  │─ Rate  │  │ event processing  │
    │                    │  │  limit │  │ (FB CAPI, HTTP    │
    │ Assets:            │  │─ Broker│  │  actions)          │
    │ ─ Keitaro clicks ✓│  │  (for  │  └───────────────────┘
    │ ─ Scaleo convs   ✓│  │  Celery│
    │ ─ Rule revenue     │  │  only) │
    │ ─ P&L reports      │  └────────┘
    │ ─ Brocard sync     │
    │ ─ Tech costs       │
    │ ─ Salaries         │
    │ ─ Keitaro ops      │
    │ ─ MView refresh    │
    │ ─ Data cleanup     │
    │ ─ ... все batch ops│
    └────────────────────┘
```

> **Принцип:** Dagster — единый оркестратор для всех фоновых операций (ETL, синхронизации, расчёты, отчёты, очистка). Celery используется **только** в Events Service для real-time обработки входящих событий (dispatch действий после получения HTTP-запроса).

---

## 7. Стек технологий

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| **API Gateway** | **FastAPI-based gateway** | Маршрутизация, middleware, SSL termination |
| **Микросервисы** | **FastAPI** (Python 3.12+) | Асинхронность, автогенерация OpenAPI, Pydantic-валидация |
| **ORM** | **SQLAlchemy 2.0** + **Alembic** | Async ORM, миграции, поддержка schema isolation |
| **База данных** | **PostgreSQL 17** | Схемы для изоляции, JSONB, индексы, надёжность |
| **Кэширование** | **Redis 7** | Кэш, rate limiting, брокер для Celery (Events only) |
| **Оркестрация задач** | **Dagster** | Все фоновые/batch-операции: ETL, синхронизации, расчёты, отчёты, очистка. Sync кликов/конверсий уже реализован |
| **Real-time async** | **Celery 5** | Только для Events Service: мгновенная обработка входящих событий (FB CAPI dispatch, HTTP actions) |
| **Аутентификация** | **KeyCloak** (OIDC/OAuth 2.0) + **Cloudflare Zero Trust** | KeyCloak как IdP, RBAC через Realm/Client Roles, сетевой уровень через Cloudflare ZT |
| **Валидация** | **Pydantic v2** | Быстрая валидация, сериализация |
| **Миграции** | **Alembic** | Версионирование схемы БД |
| **Контейнеризация** | **Docker** + **Docker Compose** | Единый стек для всех сервисов |
| **CI/CD** | **GitHub Actions** | Автотесты, линтинг, деплой |
| **Мониторинг** | **Prometheus** + **Grafana** | Метрики, алерты |
| **Логирование** | **Sentry** | Структурированные логи |
| **Документация API** | **Swagger/ReDoc** (встроенные в FastAPI) | Автоматическая OpenAPI-документация |
| **Тестирование** | **pytest** + **httpx** + **testcontainers** | Unit/integration/e2e тесты |

---

## 8. Принципы проектирования

1. **Единая база, раздельные схемы** — каждый микросервис работает со своей PostgreSQL-схемой, но может читать shared-справочники
2. **API-first** — все взаимодействия через REST API, документированные в OpenAPI
3. **Stateless-сервисы** — состояние хранится в PostgreSQL/Redis, сервисы можно масштабировать горизонтально
4. **Dagster-first для background ops** — все периодические/batch-операции оркестрируются через Dagster (assets, jobs, schedules, sensors). Celery только для real-time event dispatch в Events Service
5. **DRY-справочники** — Buyers, Teams, Geos, Offers и т.д. определены один раз в shared-схеме
6. **Backward compatibility** — на период миграции старые сервисы продолжают работать параллельно
7. **Observability** — каждый запрос трассируется (request_id), метрики собираются в Prometheus

---

## 9. Этапность миграции

### Фаза 1 — Фундамент (8-10 недель)
- Проектирование единой схемы БД
- KeyCloak + Cloudflare Zero Trust (настройка realm, roles, Cloudflare ZT Application)
- API Gateway (FastAPI — маршрутизация, JWT-валидация через KeyCloak JWKS)
- Shared-библиотека (модели, утилиты, клиенты)
- Dagster-проект: расширение существующего сервиса (уже есть sync кликов/конверсий), добавление новых assets
- CI/CD пайплайн
- Инфраструктура (Docker Compose, мониторинг)

### Фаза 2 — Миграция Dashboard (5-7 недель)
- Dashboard Service на FastAPI (API only, без фоновых задач, без admin panel)
- Миграция моделей кликов/конверсий
- Dagster assets: link conversions, rule revenue, tech costs, MView refresh, P&L, cleanup
- Миграция справочников
- Миграция данных из старой БД

### Фаза 3 — Миграция Finance (5-7 недель)
- Finance Service на FastAPI (API only)
- Миграция финансовых моделей
- Dagster assets: Brocard sync, cost calculation, salary generation
- Миграция данных

### Фаза 4 — Миграция Events & Functions (5-7 недель)
- Events Service на FastAPI + Celery (real-time event dispatch only)
- Functions Service на FastAPI (API only)
- Dagster assets: Keitaro ops, offer conversions, log cleanup, FB event import
- Миграция FB CAPI интеграции
- Миграция данных

### Фаза 5 — Интеграция и стабилизация (4-6 недель)
- Интеграционное тестирование
- Нагрузочное тестирование
- Параллельный запуск (shadow mode)
- Миграция клиентов на новые API
- Отключение старых сервисов

---

## 10. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|-----------|---------|-----------|
| Потеря данных при миграции | Средняя | Высокое | Скрипты миграции с валидацией, dry-run, откат |
| Несовместимость схем между сервисами | Средняя | Среднее | Тщательное проектирование shared-схемы до начала разработки |
| Downtime при переключении | Низкая | Высокое | Blue-green deployment, параллельный запуск |
| Рост сложности единой БД | Средняя | Среднее | PostgreSQL-схемы для изоляции, чёткие ownership-правила |
| Недооценка объёма работ | Высокая | Среднее | Итеративный подход, MVP для каждого сервиса |
| Потеря бизнес-логики при переписывании | Средняя | Высокое | Детальное документирование перед началом, тесты как спецификация |

---

## 11. Команда и ресурсы

### Рекомендуемый состав
- **Tech Lead / Архитектор** — 1 чел. (full-time)
- **Backend-разработчики (FastAPI)** — 2-3 чел. (full-time)
- **DevOps-инженер** — 1 чел. (part-time → full-time на фазе 5)
- **QA-инженер** — 2 чел. (full-time)
- **Product Owner** — 1 чел. ( для приоритизации и приёмки)

### Общая оценка
- **Длительность:** 29-39 недель (7-10 месяцев)
- **Команда:** 4-6 человек
- **Человеко-месяцы:** ~30-45 чел.-мес.

---

## 12. Критерии успеха

1. Все 4 сервиса полностью мигрированы на FastAPI и работают с единой PostgreSQL
2. API Gateway обрабатывает 100% клиентских запросов
3. Время отклика API не хуже текущего (p95 < 500ms)
4. Нулевая потеря данных при миграции
5. CI/CD пайплайн деплоит все сервисы за < 10 минут
6. Мониторинг покрывает все сервисы (uptime, latency, errors)
7. Документация API автоматически генерируется и актуальна
