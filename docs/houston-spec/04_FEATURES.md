# Project Houston — Список фич

## Формат оценки

- **S (Small):** 1-2 дня, 1 разработчик
- **M (Medium):** 3-5 дней, 1 разработчик
- **L (Large):** 1-2 недели, 1-2 разработчика
- **XL (Extra Large):** 2-3 недели, 2+ разработчика

---

## E1 — Инфраструктура и DevOps

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F1.1 | PostgreSQL setup с schemas | M | 3д | Создание PostgreSQL 16 с 6 схемами (shared, dashboard, finance, events, functions, dagster), роли с минимальными привилегиями |
| F1.2 | Redis setup | S | 1д | Redis 7 с отдельными DB для cache/broker/rate-limit |
| F1.3 | Docker Compose (dev) | M | 4д | Compose файл для всех сервисов + Gateway + PostgreSQL + Redis + KeyCloak + Dagster + monitoring |
| F1.4 | Docker Compose (prod) | M | 3д | Production-оптимизированный compose с volumes, restart policies, resource limits |
| F1.5 | Dockerfile template | S | 2д | Базовый Dockerfile для FastAPI-сервисов (multi-stage build, non-root user) |
| F1.6 | CI pipeline (lint + test) | M | 3д | GitHub Actions: ruff lint, mypy check, pytest для каждого сервиса |
| F1.7 | CD pipeline (build + deploy) | M | 4д | GitHub Actions: docker build, push to registry, SSH deploy |
| F1.8 | Makefile | S | 1д | Удобные команды: make up, make down, make test, make migrate, make logs |
| F1.9 | Init SQL scripts | S | 1д | Скрипты создания схем, ролей, расширений (uuid-ossp, pgcrypto) |
| F1.10 | Environment management | S | 2д | .env.example, Doppler integration guide, secrets documentation |

---

## E2 — Общая библиотека (shared)

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F2.1 | Python package setup | S | 1д | pyproject.toml, package structure, editable install |
| F2.2 | SQLAlchemy async engine | S | 2д | create_async_engine, session factory, connection pooling configuration |
| F2.3 | Shared models: Buyer | S | 1д | SQLAlchemy model + Pydantic schema для Buyer (name, external_id, team_id, is_active) |
| F2.4 | Shared models: Team, Direction | S | 1д | Модели Team (name, direction, head, lead) и Direction (name) |
| F2.5 | Shared models: Geo | S | 0.5д | Модель Geo (name, full_name) |
| F2.6 | Shared models: Offer, Funnel, Source | S | 1д | 3 справочника с FK между собой |
| F2.7 | Shared models: Device, OS, Browser | S | 0.5д | 3 простых справочника |
| F2.8 | Shared models: Counterparty, PaymentSource | S | 0.5д | Справочники для Finance |
| F2.9 | JWT utilities | M | 3д | Decode KeyCloak JWT, claims extraction, JWKS validation |
| F2.10 | CurrentUser dependency | S | 1д | FastAPI Depends для извлечения пользователя из X-User-* headers (set by API Gateway) |
| F2.11 | Permission checker | S | 1д | Decorator/dependency require_permission("dashboard:read") based on KeyCloak realm/client roles |
| F2.12 | BaseIntegrationClient | M | 3д | Async HTTP client (httpx) с retry (tenacity), timeout, logging, error handling |
| F2.13 | Structlog configuration | S | 2д | Structured logging setup, request_id propagation, JSON format |
| F2.14 | ASGI middleware | M | 3д | RequestIDMiddleware, LoggingMiddleware, ErrorHandlerMiddleware |
| F2.15 | BaseSettings config | S | 1д | Pydantic Settings: DATABASE_URL, REDIS_URL, SERVICE_NAME, LOG_LEVEL |
| F2.16 | Alembic setup | M | 3д | Multi-schema Alembic config, env.py, initial migrations |
| F2.17 | Pagination utilities | S | 1д | Reusable pagination params, response schema (items, total, page, size) |
| F2.18 | Exception handlers | S | 1д | Стандартные HTTP exception handlers, validation error formatting |
| F2.19 | Tests for shared lib | M | 3д | Unit-тесты: JWT, permissions, base client, middleware |

---

## E3 — KeyCloak + Cloudflare Zero Trust

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F3.1 | KeyCloak deployment | M | 3д | Docker-контейнер KeyCloak с PostgreSQL storage, health check, env configuration |
| F3.2 | Realm `houston` creation | S | 1д | Создание realm houston с базовыми настройками (token lifetimes, brute-force protection) |
| F3.3 | Client `houston-gateway` (confidential) | S | 2д | Confidential client для API Gateway JWT-валидации: client_credentials grant, audience mapping |
| F3.4 | Client `houston-web` (public) | S | 1д | Public client для SPA: authorization_code + PKCE, redirect URIs, CORS |
| F3.5 | Realm Roles setup | S | 1д | Создание realm roles: admin, manager, buyer, team_lead, finance_staff, viewer |
| F3.6 | Client Roles for granular permissions | M | 3д | Client-level roles для детальных разрешений (dashboard:read, finance:write, events:admin и т.д.) |
| F3.7 | Custom User Attributes + Protocol Mappers | M | 3д | team_id, direction_id, buyer_id атрибуты + mappers в JWT claims |
| F3.8 | Cloudflare Zero Trust Application | S | 2д | Создание Application в Cloudflare Access для домена houston |
| F3.9 | KeyCloak as IdP in Cloudflare ZT | S | 2д | Настройка KeyCloak как Identity Provider в Cloudflare Zero Trust |
| F3.10 | Access Policies | S | 2д | Политики доступа: email domain, geo restrictions, device posture checks |
| F3.11 | API Gateway JWTAuthMiddleware → KeyCloak | M | 3д | Настройка JWTAuthMiddleware в FastAPI Gateway для валидации JWT через KeyCloak JWKS |
| F3.12 | shared.user_profiles table + migration | S | 1д | Таблица user_profiles в shared schema (keycloak_sub, team_id, preferences), Alembic migration |
| F3.13 | User migration script (old SSO → KeyCloak) | S | 2д | Скрипт миграции пользователей из старого SSO в KeyCloak (realm import JSON) |
| F3.14 | E2E auth flow testing | S | 1д | Тесты: login → token → ForwardAuth → resource access → refresh → logout |
| F3.15 | Documentation | S | 1д | Документация: KeyCloak admin guide, Cloudflare ZT setup, role matrix, troubleshooting |

---

## E4 — API Gateway (FastAPI)

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F4.1 | FastAPI Gateway boilerplate | S | 1д | main.py, config.py, Dockerfile, health check endpoint |
| F4.2 | Path-based routing + reverse proxy | M | 3д | httpx reverse proxy: /api/dashboard → dashboard:8002, /api/finance → finance:8003 и т.д. |
| F4.3 | JWTAuthMiddleware | M | 3д | KeyCloak JWKS validation, claims parsing, X-User-* header injection |
| F4.4 | Rate limiting middleware | S | 2д | slowapi + Redis: 100 req/min per IP (configurable per route) |
| F4.5 | CORS middleware | S | 1д | FastAPI CORSMiddleware: allowed origins, methods, headers |
| F4.6 | RequestIDMiddleware | S | 1д | Генерация/проброс X-Request-ID |
| F4.7 | Health check routes | S | 0.5д | /health → 200 OK (public, no auth) |
| F4.8 | Error handling | S | 1д | Стандартизированные ответы при ошибках downstream-сервисов, таймаутах |
| F4.9 | Prometheus /metrics | S | 0.5д | prometheus-fastapi-instrumentator для мониторинга gateway |
| F4.10 | Gateway tests | S | 2д | Unit-тесты middleware, integration-тесты proxy logic |

---

## E5 — Dagster Orchestrator

> Все фоновые периодические задачи (бывшие Celery tasks из Dashboard, Finance, Events, Functions) вынесены в единый Dagster-проект. См. также E5 в EPICS.md.

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F5.1 | Dagster project structure | M | 3д | Расширение dagster_houston: assets по доменам (dashboard, finance, events, functions) |
| F5.2 | DB connection resource | S | 1д | Dagster resource для PostgreSQL async connection |
| F5.3 | KeitaroClient resource | M | 3д | Dagster resource: async клиент Keitaro Admin API + Tracking API |
| F5.4 | ScaleoClient resource | S | 2д | Dagster resource: async клиент Scaleo API |
| F5.5 | BrocardClient resource | S | 2д | Dagster resource: async клиент Brocard API |
| F5.6 | ExchangeRateClient resource | S | 1д | Dagster resource: OpenExchangeRates |
| F5.7 | Asset: linked_conversions | M | 3д | Связывание конверсий с кликами по offer_click/sub_id |
| F5.8 | Asset: rule_revenue | L | 5д | Применение CohortRules к кликам, расчёт rule_revenue |
| F5.9 | Asset: sale_timestamps | S | 2д | Пометка кликов как is_sale, расчёт is_tail |
| F5.10 | Asset: tech_costs_sync | M | 3д | Получение техрасходов из Finance, обновление BuyerTechCost |
| F5.11 | Asset: dictionaries_populated | M | 3д | Авто-создание записей справочников из новых кликов |
| F5.12 | Asset: noset_distributed | M | 3д | Распределение кликов без buyer_id |
| F5.13 | Asset: materialized_views | S | 2д | Обновление всех materialized views |
| F5.14 | Asset: costs_to_keitaro | M | 3д | Отправка агрегированных расходов в Keitaro Tracking API |
| F5.15 | Job: pnl_report_generation | L | 5д | Агрегация данных → JSON P&L-отчёт (monthly) |
| F5.16 | Job: dashboard_data_cleanup | S | 2д | Удаление старых кликов/логов по retention policy |
| F5.17 | Asset: brocard_operations | M | 4д | Синхронизация операций из Brocard API (hourly) |
| F5.18 | Asset: offer_clicks_update | S | 2д | Обновление кликов по офферам |
| F5.19 | Asset: tech_cost_calculation | M | 3д | Расчёт и распределение техрасходов |
| F5.20 | Asset: exchange_rates | S | 1д | Обновление курсов валют |
| F5.21 | Job: salary_generation | M | 3д | Ежемесячная генерация зарплатных операций |
| F5.22 | Asset: events_log_cleanup | S | 2д | Удаление старых request/action/fb логов |
| F5.23 | Asset: fb_app_event_import | S | 2д | Импорт FB app events (every 6h) |
| F5.24 | Asset: keitaro_campaign_fix | M | 3д | Исправление типов кампаний в Keitaro |
| F5.25 | Asset: keitaro_click_subid | S | 2д | Обновление click sub_id через Keitaro API |
| F5.26 | Asset: offer_conversions | M | 3д | Сбор конверсий из Keitaro с batch processing |
| F5.27 | Asset: stale_tasks_cleanup | S | 1д | Очистка зависших задач |
| F5.28 | Schedules configuration | M | 3д | Cron-based schedules для всех assets |
| F5.29 | Sensors | M | 3д | new_clicks_sensor, new_conversions_sensor, pnl_manual_trigger |
| F5.30 | Dagster instance config | S | 1д | PostgreSQL storage в dagster schema |
| F5.31 | Dagster Docker setup | S | 2д | dagster-webserver + dagster-daemon в Docker Compose |
| F5.32 | Dagster tests | M | 4д | Unit-тесты для assets, jobs, sensors |
| F5.33 | Prometheus metrics | S | 1д | Dagster → Prometheus metrics export |

---

## E6 — Dashboard Service (API only)

> Все фоновые задачи (бывшие Celery tasks) перенесены в E5 Dagster Orchestrator.

### Модели и миграции

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F6.1 | FastAPI boilerplate | S | 1д | main.py, config, health, Dockerfile |
| F6.2 | Click model | M | 3д | SQLAlchemy model с 30+ полями, партиционирование по месяцам, индексы |
| F6.3 | Conversion model | S | 2д | Модель конверсии с FK на Click |
| F6.4 | BuyerTechCost model | S | 1д | Месячные техрасходы с coefficient |
| F6.5 | CohortRule models | S | 2д | CohortRule + CohortRuleFilter с M2M на справочники |
| F6.6 | PnL models | S | 2д | PnlReport, PnlAdditionalSum, PnlActualExpense |
| F6.7 | Dashboard materialized views | M | 3д | MV для BuyerDashboard, TeamDashboard, GeoDashboard и т.д. |
| F6.8 | Alembic migrations | S | 2д | Все миграции для dashboard schema |

### API Endpoints

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F6.9 | GET /clicks | M | 4д | Список кликов с фильтрами (buyer, date range, geo, source, offer, funnel), пагинация |
| F6.10 | GET /conversions | M | 3д | Список конверсий с фильтрами, привязка к кликам |
| F6.11 | GET /dashboards/buyer | M | 4д | Агрегированный дашборд покупателей: клики, регистрации, депозиты, расходы, ROI, CPD, CPR |
| F6.12 | GET /dashboards/team | M | 3д | Агрегация по командам |
| F6.13 | GET /dashboards/direction | S | 2д | Агрегация по направлениям |
| F6.14 | GET /dashboards/geo | S | 2д | Агрегация по гео |
| F6.15 | GET /dashboards/source | S | 2д | Агрегация по источникам |
| F6.16 | GET /dashboards/funnel | S | 2д | Агрегация по воронкам |
| F6.17 | GET /dashboards/offer | S | 2д | Агрегация по офферам |
| F6.18 | GET /dashboards/device | S | 1д | Агрегация по устройствам |
| F6.19 | GET /dashboards/os | S | 1д | Агрегация по ОС |
| F6.20 | GET /dashboards/browser | S | 1д | Агрегация по браузерам |
| F6.21 | Dashboard filters | M | 3д | Общие фильтры: date_from, date_to, buyer_id, team_id, geo, source, funnel, offer |
| F6.22 | Dashboard column config | S | 2д | API для сохранения/загрузки пользовательских настроек видимости колонок |
| F6.23 | GET /dictionaries/* | M | 3д | CRUD для всех справочников через shared-модели |
| F6.24 | CohortRule CRUD | M | 4д | GET/POST/PUT/DELETE для правил с фильтрами |
| F6.25 | GET /pnl-reports | M | 3д | Получение P&L отчётов с фильтрами по месяцу |
| F6.26 | POST /pnl-reports/generate | S | 2д | Запуск генерации P&L отчёта (trigger Dagster job) |
| F6.27 | POST /pnl-additional-sums | S | 2д | CRUD для доп. расходов (зарплаты, бонусы) |
| F6.28 | GET /costs | M | 3д | Агрегированные расходы покупателей с KPI |

### Shared resources (used by Dagster)

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F6.29 | KeitaroClient | M | 4д | Async клиент Keitaro Admin API + Tracking API (shared resource, used by Dagster) |
| F6.30 | ScaleoClient | M | 3д | Async клиент Scaleo API (shared resource, used by Dagster) |
| F6.31 | Dashboard tests | L | 5д | Unit-тесты бизнес-логики + integration-тесты API |

---

## E7 — Finance Service (API only)

> Все фоновые задачи (бывшие Celery tasks) перенесены в E5 Dagster Orchestrator.

### Модели и миграции

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F7.1 | FastAPI boilerplate | S | 1д | main.py, config, health, Dockerfile |
| F7.2 | DailyCost model | S | 2д | Ежедневные расходы с buyer, campaign, counterparty |
| F7.3 | TechCost model | S | 2д | Техрасходы (индивидуальные) + TechCostCategory |
| F7.4 | GlobalTechCost model | S | 2д | Корпоративные расходы с распределением по командам |
| F7.5 | BrocardOperation model | S | 1д | Операции Brocard (тип, сумма, комиссия) |
| F7.6 | CounterpartyCost + Balance models | S | 2д | Расходы контрагентов + балансы |
| F7.7 | Salary models | M | 3д | UserSalary + SalaryOperation (monthly, с коэффициентом) |
| F7.8 | Alembic migrations | S | 2д | Все миграции для finance schema |

### API Endpoints

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F7.9 | DailyCost CRUD | M | 4д | GET/POST/PUT/DELETE для ежедневных расходов, фильтры по дате/покупателю/контрагенту |
| F7.10 | TechCost CRUD | M | 3д | GET/POST/DELETE для индивидуальных техрасходов |
| F7.11 | GlobalTechCost CRUD | M | 3д | CRUD для корпоративных расходов с автораспределением |
| F7.12 | BrocardOperation API | M | 3д | GET для операций + POST для ручного триггера синхронизации (trigger Dagster job) |
| F7.13 | Salary management API | M | 4д | CRUD зарплат, генерация ежемесячных операций, расчёт с коэффициентом 1.3x |
| F7.14 | Counterparty CRUD | M | 3д | CRUD контрагентов + управление балансами |
| F7.15 | Monthly tech cost summary | S | 2д | GET — агрегированные техрасходы за месяц (для Dashboard) |
| F7.16 | Actual expenses API | S | 2д | GET — фактические расходы за период |
| F7.17 | Marketing operations report | M | 3д | GET — маркетинговые операции (расходы + ROI) |
| F7.18 | Buyers & Employees API | S | 2д | GET — списки покупателей и сотрудников (для dropdown) |
| F7.19 | Team-based data isolation | M | 4д | Фильтрация данных на уровне запросов по team_id пользователя |

### Shared resources (used by Dagster)

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F7.20 | BrocardClient | M | 3д | Async клиент Brocard API (shared resource, used by Dagster) |
| F7.21 | ExchangeRateClient | S | 2д | Клиент OpenExchangeRates (shared resource, used by Dagster) |

### Бизнес-логика

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F7.22 | Cost distribution service | M | 4д | Распределение GlobalTechCost по членам команды (equal/weighted) |
| F7.23 | Currency conversion service | S | 2д | Конвертация сумм в USD с кэшированием курсов |
| F7.24 | Balance auto-update | S | 2д | Автоматическое обновление балансов контрагентов при создании TechCost |
| F7.25 | Finance tests | L | 5д | Unit + integration тесты |

---

## E8 — Events Service (API + Celery)

> Events Service сохраняет Celery для real-time dispatch (event routing, action execution). Периодические задачи (log cleanup, FB import) перенесены в E5 Dagster Orchestrator.

### Модели и миграции

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F8.1 | FastAPI boilerplate | S | 1д | main.py, config, health, Dockerfile |
| F8.2 | Campaign + Domain models | S | 2д | Кампании с alias, методом, required params |
| F8.3 | Flow + Rule models | M | 3д | Потоки с правилами (M2M), condition type (AND/OR) |
| F8.4 | Action + ActionMapping models | S | 2д | Действия (REQUEST, FB_EVENT, APPSFLYER) с маппингами |
| F8.5 | FB models (Token, User, Log) | M | 3д | FbToken, FbUser, FbLog, FbStream |
| F8.6 | Log models (Request, Action) | S | 2д | RequestLog, ActionLog с партиционированием |
| F8.7 | Application model | S | 1д | Клиентские приложения (FB status, AppsFlyer key) |
| F8.8 | Alembic migrations | S | 2д | Все миграции для events schema |

### API Endpoints

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F8.9 | Event handler endpoint | L | 7д | POST /api/events/handle/{alias} — основной обработчик: валидация → routing → execution → logging |
| F8.10 | Campaign CRUD | M | 3д | GET/POST/PUT/DELETE для кампаний с inline flows |
| F8.11 | Flow CRUD | M | 3д | CRUD потоков с правилами и привязкой к действиям |
| F8.12 | Action CRUD | M | 3д | CRUD действий с маппингами параметров |
| F8.13 | Rule CRUD | S | 2д | CRUD правил (param, operator, value) |
| F8.14 | FB Token management | M | 3д | CRUD FB-токенов, pixel_id, expiry tracking |
| F8.15 | FB User save | S | 2д | POST для сохранения FB-пользователей (fbclid, fbp) |
| F8.16 | Application management | S | 2д | CRUD приложений, FB Event status |
| F8.17 | Request/Action logs API | M | 3д | GET — логи запросов и действий с фильтрами и пагинацией |
| F8.18 | FB logs API | S | 2д | GET — логи FB событий с фильтрами |

### Бизнес-логика (real-time Celery)

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F8.19 | EventRouterService | L | 5д | Маршрутизация событий: campaign lookup → flow matching → action dispatch |
| F8.20 | RuleEvaluator | M | 3д | Проверка правил: EMPTY, NO EMPTY, EQUALS, NO EQUALS, CONTAIN, NO CONTAIN |
| F8.21 | ActionExecutor (HTTP) | M | 3д | Выполнение HTTP-действий с dynamic URL/header/body, macro substitution |
| F8.22 | FbEventService (SSAPI) | M | 4д | Отправка FB Conversions API events через Graph API v16 |
| F8.23 | FbEventService (Pixel fallback) | S | 2д | Fallback на Facebook Pixel при неудаче SSAPI |
| F8.24 | FacebookClient | M | 3д | Async клиент Facebook Graph API v16 |
| F8.25 | AppsFlyerClient | S | 2д | Async клиент AppsFlyer API |
| F8.26 | Events tests | L | 5д | Unit + integration тесты (event routing, rule evaluation, FB sending) |

---

## E9 — Functions Service (API only)

> Все фоновые задачи (бывшие Celery tasks) перенесены в E5 Dagster Orchestrator.

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F9.1 | FastAPI boilerplate | S | 1д | main.py, config, health, Dockerfile |
| F9.2 | AvailableOffer models | S | 1д | Модели офферов и конверсий (sub_id tracking) |
| F9.3 | TaskConfig + TaskLog models | S | 1д | Конфигурация задач и логи выполнения |
| F9.4 | Alembic migrations | S | 1д | Миграции для functions schema |
| F9.5 | Offer availability API | M | 3д | POST /api/functions/offers/check — проверка доступности (is_change logic) |
| F9.6 | Offer CRUD | S | 2д | CRUD для AvailableOffers |
| F9.7 | Task config CRUD | S | 2д | CRUD для конфигурации задач + просмотр логов |
| F9.8 | KeitaroClient (functions) | M | 3д | Клиент для: report/build, update click params, postbacks (shared resource, used by Dagster) |
| F9.9 | Batch processing engine | M | 3д | Batch size=500, pause=0.5s, request_delay=0.1s, configurable |
| F9.10 | Duplicate task prevention | S | 2д | Проверка на дубликаты (5min idempotency window) |
| F9.11 | Functions tests | M | 3д | Unit + integration тесты |

---

## E10 — Миграция данных

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F10.1 | Field mapping document | M | 3д | Детальный маппинг каждого поля из старых моделей в новые |
| F10.2 | Shared dictionaries migration | M | 4д | Слияние Buyers, Teams, Geos, Offers, Sources, Funnels из 4 БД с дедупликацией |
| F10.3 | ID mapping table | S | 2д | Таблица old_id → new_id для всех мигрированных сущностей |
| F10.4 | Auth data migration → KeyCloak | M | 3д | Миграция пользователей, ролей, команд из SSO в KeyCloak (realm import JSON) |
| F10.5 | Dashboard data migration | L | 7д | Clicks (потенциально миллионы), Conversions, TechCosts, Rules, PnL — инкрементальная миграция |
| F10.6 | Finance data migration | M | 5д | DailyCosts, TechCosts, Brocard, Salaries, Counterparties |
| F10.7 | Events data migration | M | 4д | Campaigns, Flows, Actions, FbTokens, Logs (partitioned) |
| F10.8 | Functions data migration | S | 2д | Offers, TaskConfigs |
| F10.9 | Validation scripts | M | 4д | Сравнение counts, sums, FK integrity, P&L verification |
| F10.10 | Dry-run on staging | M | 3д | Полный прогон миграции на staging-окружении |
| F10.11 | Rollback procedure | S | 2д | Документация и скрипты для отката |

---

## E11 — Мониторинг и логирование

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F11.1 | Prometheus /metrics endpoint | S | 2д | prometheus-fastapi-instrumentator для каждого сервиса |
| F11.2 | Prometheus configuration | S | 1д | Scrape targets для всех сервисов + Dagster |
| F11.3 | Grafana: HTTP metrics dashboard | M | 3д | Request rate, latency (p50/p95/p99), error rate, status codes |
| F11.4 | Grafana: DB metrics dashboard | S | 2д | Query duration, connection pool, slow queries |
| F11.5 | Grafana: Dagster dashboard | M | 3д | Asset materialization count, duration, success/error rate, sensor ticks |
| F11.6 | Grafana: Business metrics | M | 3д | Клики/час, конверсии/день, расходы, обработка событий |
| F11.7 | Loki setup + Grafana | M | 3д | Centralized log collection, search, filtering |
| F11.8 | Alerting rules | M | 3д | Alerts: error rate > 5%, p95 > 2s, service down, Dagster run failure |
| F11.9 | Health check dashboard | S | 2д | Overview: все сервисы + БД + Redis + Dagster status |
| F11.10 | Dagster webserver UI | S | 2д | Dagster built-in UI для мониторинга assets, jobs, runs |

---

## E12 — Тестирование и стабилизация

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F12.1 | Test infrastructure setup | M | 3д | testcontainers (PostgreSQL, Redis), fixtures, factories |
| F12.2 | KeyCloak auth flow tests | M | 3д | KeyCloak login/logout, token validation, ForwardAuth, role-based access checks |
| F12.3 | Dashboard integration tests | L | 5д | API endpoints (mocked integrations) |
| F12.4 | Finance integration tests | M | 4д | API endpoints, cost calculations |
| F12.5 | Events integration tests | L | 5д | Event handler flow, FB sending, action execution |
| F12.6 | Functions integration tests | S | 2д | Offer API, task config |
| F12.7 | Dagster asset tests | M | 4д | Unit-тесты для Dagster assets, jobs, sensors, schedules |
| F12.8 | E2E tests: auth flow | M | 3д | KeyCloak login → Cloudflare ZT → access resource → refresh → access again |
| F12.9 | E2E tests: data flow | M | 4д | Dagster sync → conversion link → dashboard aggregation → P&L |
| F12.10 | E2E tests: event processing | M | 3д | Request → campaign match → flow → action → log |
| F12.11 | Load testing (k6/Locust) | M | 4д | API Gateway, Dashboard API, Events handler под нагрузкой |
| F12.12 | Migration validation | M | 3д | Проверка данных после миграции: counts, sums, reports |
| F12.13 | Failover testing | S | 2д | Падение сервиса, reconnect к БД/Redis, graceful degradation |
| F12.14 | Bug fixes | L | 5д | Исправление найденных при тестировании проблем |
| F12.15 | Performance optimization | M | 3д | Оптимизация по результатам нагрузочного тестирования |

---

## E13 — Деплой и переключение

| ID | Фича | Размер | Оценка | Описание |
|----|-------|--------|--------|----------|
| F13.1 | Production server setup | M | 3д | Подготовка сервера(ов), Docker, firewall, SSL |
| F13.2 | Production deploy | M | 3д | Деплой Docker Compose prod, проверка работоспособности |
| F13.3 | Final data migration | M | 4д | Последняя синхронизация данных из старых БД |
| F13.4 | Shadow mode | M | 4д | Параллельный запуск, копирование трафика, сравнение ответов |
| F13.5 | DNS/Nginx switchover | S | 1д | Переключение traffic на новую платформу |
| F13.6 | Post-switch monitoring | S | 2д | 48-часовой мониторинг, оперативные hotfixes |
| F13.7 | Old services decommission | S | 2д | Отключение старых сервисов после стабилизации |
| F13.8 | Documentation & lessons learned | S | 2д | Post-mortem, обновление документации |

---

## Сводная статистика

| Категория | Кол-во фич | S | M | L | XL |
|-----------|-----------|---|---|---|---|
| E1 Инфраструктура | 10 | 5 | 5 | 0 | 0 |
| E2 Shared lib | 19 | 14 | 5 | 0 | 0 |
| E3 KeyCloak + CF ZT | 15 | 11 | 4 | 0 | 0 |
| E4 API Gateway | 10 | 10 | 0 | 0 | 0 |
| E5 Dagster Orchestrator | 33 | 16 | 15 | 2 | 0 |
| E6 Dashboard (API only) | 31 | 17 | 13 | 1 | 0 |
| E7 Finance (API only) | 25 | 13 | 11 | 1 | 0 |
| E8 Events (API + Celery) | 26 | 12 | 11 | 3 | 0 |
| E9 Functions (API only) | 11 | 7 | 4 | 0 | 0 |
| E10 Миграция данных | 11 | 3 | 7 | 1 | 0 |
| E11 Мониторинг | 10 | 5 | 5 | 0 | 0 |
| E12 Тестирование | 15 | 2 | 10 | 3 | 0 |
| E13 Деплой | 8 | 4 | 4 | 0 | 0 |
| **ИТОГО** | **224** | **119** | **94** | **11** | **0** |

### Общая оценка в человеко-днях
- **S фичи:** ~119 × 1.5д = ~179 чел.-дней
- **M фичи:** ~94 × 4д = ~376 чел.-дней
- **L фичи:** ~11 × 7.5д = ~83 чел.-дней
- **XL фичи:** 0
- **ИТОГО:** ~638 чел.-дней ≈ **128 чел.-недель ≈ 29 чел.-месяцев**

> При команде из 5 разработчиков: ~29 / 5 = **~6 месяцев** (с учётом параллельности и буфера)
