# Project Houston — Эпики

## Обзор эпиков

| # | Эпик | Приоритет | Оценка | Команда | Зависимости |
|---|------|-----------|--------|---------|-------------|
| E1 | Инфраструктура и DevOps | Критический | 3-4 недели | DevOps + Backend | — |
| E2 | Общая библиотека (shared) | Критический | 2-3 недели | Backend (senior) | E1 |
| E3 | KeyCloak + Cloudflare ZT setup | Критический | 2-3 недели | DevOps + Backend | E1 |
| E4 | API Gateway (FastAPI) | Критический | 1-2 недели | Backend | E1, E3 |
| E5 | Dagster Orchestrator | Критический | 3-4 недели | Backend (senior) | E1, E2 |
| E6 | Dashboard Service (API only) | Высокий | 4-6 недель | 2 Backend | E2, E3, E4 |
| E7 | Finance Service (API only) | Высокий | 4-5 недель | 1-2 Backend | E2, E3, E4 |
| E8 | Events Service (API + Celery) | Средний | 4-6 недель | 1-2 Backend | E2, E3, E4 |
| E9 | Functions Service (API only) | Средний | 2-3 недели | 1 Backend | E2, E3, E4 |
| E10 | Миграция данных | Высокий | 3-4 недели | 1 Backend + DBA | E3, E6, E7, E8, E9 |
| E11 | Мониторинг и логирование | Средний | 2-3 недели | DevOps | E1, E4 |
| E12 | Тестирование и стабилизация | Критический | 3-5 недель | QA + Backend | E6-E9 |
| E13 | Деплой и переключение | Критический | 2-3 недели | DevOps + Backend | E10, E12 |

> **Ключевые изменения vs. первоначальный план:**
> - **Нет Auth Service** — аутентификация через Cloudflare Zero Trust + KeyCloak
> - **Нет Admin Panel** — FastAPI-сервисы = только API, клиенты через API Gateway
> - **Dagster** вместо Celery для всех scheduled/batch-операций (sync кликов/конверсий уже реализован)
> - **Celery** остаётся только для event-triggered async операций (notifications, event dispatch)

**Общая оценка:** 33-48 недель работы (с учётом параллельности: 24-32 недели календарных)

---

## E1 — Инфраструктура и DevOps

### Описание
Подготовка инфраструктуры для всей платформы: PostgreSQL, Redis, Docker Compose, CI/CD пайплайн, реестр образов, среды разработки.

### Цели
- Развёрнутая PostgreSQL 16+ с изолированными схемами
- Redis 7+ для кэширования и брокера задач
- Docker Compose для локальной разработки
- Docker Compose для продакшена
- CI/CD пайплайн (GitHub Actions)
- Настройка DNS и SSL

### Подзадачи
1. Проектирование и создание PostgreSQL-схем (shared, dashboard, finance, events, functions, dagster, keycloak)
2. Создание PostgreSQL-ролей с минимальными привилегиями
3. Настройка Redis (кэш + Celery broker)
4. Docker Compose для dev-окружения (все сервисы + KeyCloak + Dagster + инфраструктура)
5. Docker Compose для prod-окружения
6. Dockerfile-шаблон для FastAPI-сервисов
7. CI/CD: lint + test + build + deploy pipeline
8. Настройка Docker registry (DockerHub / GitHub Container Registry)
9. Настройка Makefile с удобными командами
10. Init-скрипты для БД (создание схем, ролей, расширений)

### Оценка
- **Длительность:** 3-4 недели
- **Ресурсы:** 1 DevOps-инженер + 1 Backend-разработчик
- **Человеко-недели:** 6-8

### Критерии приёмки
- `docker compose up` поднимает все сервисы с нуля
- PostgreSQL содержит все схемы и роли
- CI пайплайн проходит на пустом проекте
- Продакшен Docker Compose готов к деплою

---

## E2 — Общая библиотека (shared)

### Описание
Разработка Python-пакета с общим кодом: модели SQLAlchemy для shared-схемы, Pydantic-схемы, утилиты для JWT, логирования, конфигурации, middleware, базовые клиенты интеграций.

### Цели
- Shared SQLAlchemy-модели (buyers, teams, geos, offers, sources, funnels, devices и т.д.)
- Pydantic-схемы для общих сущностей
- Утилиты JWT (создание, валидация, dependency для FastAPI)
- Базовый HTTP-клиент для интеграций (retry, timeout, logging)
- Structlog-конфигурация
- ASGI-middleware (request_id, logging, error handling)
- Конфигурация через Pydantic Settings
- Alembic setup для миграций

### Подзадачи
1. Инициализация Python-пакета (pyproject.toml, структура)
2. SQLAlchemy Base и SharedBase с async engine
3. Модели shared-справочников (10+ таблиц)
4. Pydantic-схемы для shared-моделей
5. JWT-утилиты (encode, decode, FastAPI dependency)
6. CurrentUser dependency для всех сервисов
7. Permission checker (require_permission decorator)
8. BaseIntegrationClient с retry (tenacity)
9. Structlog configuration
10. ASGI-middleware (RequestIDMiddleware, LoggingMiddleware)
11. BaseSettings конфигурация (DATABASE_URL, REDIS_URL и т.д.)
12. Alembic env.py с multi-schema поддержкой
13. Начальные миграции для shared-схемы
14. Unit-тесты для всех утилит

### Оценка
- **Длительность:** 2-3 недели
- **Ресурсы:** 1 Senior Backend-разработчик
- **Человеко-недели:** 2-3

### Критерии приёмки
- Пакет устанавливается через `pip install -e ./shared`
- Все shared-модели создаются через Alembic
- JWT-утилиты покрыты тестами
- Документация по использованию

---

## E3 — KeyCloak + Cloudflare Zero Trust Setup

### Описание
Настройка двухуровневой аутентификации: Cloudflare Zero Trust (сетевой уровень) + KeyCloak (Identity Provider, OIDC, RBAC). Нет кастомного Auth Service — все управление пользователями, ролями, группами через KeyCloak Admin Console.

### Цели
- KeyCloak realm `houston` с настроенными clients, roles, mappers
- Cloudflare Zero Trust Application с интеграцией KeyCloak как IdP
- JWT-валидация в API Gateway через KeyCloak JWKS
- RBAC: Realm Roles + Client Roles для гранулярных прав
- shared.user_profiles для бизнес-атрибутов (team_id, buyer_id)
- Миграция пользователей из текущего SSO в KeyCloak

### Подзадачи
1. Развёртывание KeyCloak (Docker, PostgreSQL storage в keycloak schema)
2. Создание realm `houston`, настройка темы и логина
3. Создание client `houston-gateway` (confidential) для API Gateway JWT-валидации
4. Создание client `houston-web` (public) для SPA-клиентов
5. Настройка Realm Roles: admin, manager, buyer, team_lead, finance_staff, viewer
6. Настройка Client Roles для гранулярных permissions (dashboard:read, finance:write и т.д.)
7. Custom User Attributes (team_id, buyer_id, brocard_id) + Protocol Mappers → JWT claims
8. Настройка Cloudflare Zero Trust Application
9. Интеграция KeyCloak как Identity Provider в Cloudflare ZT
10. Настройка Access Policies (email domain, geo, device posture)
11. API Gateway JWTAuthMiddleware → KeyCloak JWKS validation
12. shared.user_profiles таблица + Alembic migration
13. Скрипт миграции пользователей из текущего SSO → KeyCloak
14. Тестирование auth flow end-to-end
15. Документация по управлению пользователями в KeyCloak

### Оценка
- **Длительность:** 2-3 недели
- **Ресурсы:** 1 DevOps + 1 Backend-разработчик
- **Человеко-недели:** 3-5

### Критерии приёмки
- Пользователи логинятся через Cloudflare ZT → KeyCloak
- JWT содержит roles, team_id, buyer_id, permissions
- ForwardAuth корректно валидирует JWT и устанавливает X-User-* headers
- RBAC блокирует доступ при отсутствии нужной роли
- Все пользователи мигрированы из старого SSO
- KeyCloak Admin Console доступен для управления

---

## E4 — API Gateway (FastAPI)

### Описание
Разработка кастомного API Gateway на FastAPI: маршрутизация, JWT-валидация (KeyCloak JWKS), rate limiting, CORS. SSL termination на уровне Cloudflare.

### Цели
- Маршрутизация: /api/dashboard → Dashboard, /api/finance → Finance, и т.д.
- ForwardAuth через KeyCloak userinfo endpoint
- Rate limiting (100 req/min per IP)
- CORS middleware
- SSL/TLS (Let's Encrypt для прода, self-signed для dev)
- Prometheus метрики для мониторинга

### Подзадачи
1. FastAPI Gateway boilerplate (main.py, config, Dockerfile)
2. Path-based routing + reverse proxy (httpx)
3. JWTAuthMiddleware (KeyCloak JWKS validation, X-User-* injection)
4. Rate limiting middleware
5. CORS middleware
6. SSL configuration (Let's Encrypt ACME)
7. Health check probes для каждого сервиса
8. Prometheus /metrics endpoint
9. Интеграционные тесты маршрутизации
10. Документация по добавлению новых сервисов

### Оценка
- **Длительность:** 1-2 недели
- **Ресурсы:** 1 DevOps-инженер
- **Человеко-недели:** 1-2

### Критерии приёмки
- Все сервисы доступны через единый домен
- Неаутентифицированные запросы блокируются (кроме health check endpoints)
- Rate limiting работает
- CORS корректно настроен
- SSL работает в проде

---

## E5 — Dagster Orchestrator

### Описание
Расширение существующего Dagster-сервиса (уже реализован sync кликов из Keitaro и конверсий из Scaleo) всеми остальными фоновыми/batch-операциями из 4 сервисов. Все scheduled/ETL задачи, которые сейчас в Celery, переносятся в Dagster assets/jobs/schedules.

### Цели
- Перенос всех Celery periodic tasks в Dagster assets с зависимостями
- Настройка schedules и sensors
- Единая точка мониторинга всех фоновых операций (Dagster Webserver UI)
- PostgreSQL storage для run history
- Интеграционные клиенты (Keitaro, Scaleo, Brocard, OpenExchangeRates) как Dagster resources

### Подзадачи
1. Расширение Dagster проекта: структура assets по доменам (dashboard, finance, events, functions)
2. Dagster resources: DB connection, KeitaroClient, ScaleoClient, BrocardClient, ExchangeRateClient
3. **Dashboard assets:** linked_conversions, rule_revenue, sale_timestamps, tech_costs_sync, dictionaries_populated, noset_distributed, materialized_views, costs_to_keitaro
4. **Dashboard jobs:** pnl_report_generation (monthly), dashboard_data_cleanup (daily)
5. **Finance assets:** brocard_operations, offer_clicks_update, tech_cost_calculation, exchange_rates
6. **Finance jobs:** salary_operations_generation (monthly)
7. **Events assets:** events_log_cleanup (daily), fb_app_event_import (every 6h)
8. **Functions assets:** keitaro_campaign_type_fix, keitaro_click_subid_update, offer_conversions_collection, stale_tasks_cleanup
9. Schedules для всех assets (cron-based)
10. Sensors: new_clicks_sensor, new_conversions_sensor, pnl_manual_trigger
11. Dagster instance config (PostgreSQL storage в dagster schema)
12. Docker: dagster-webserver + dagster-daemon
13. Unit-тесты для assets
14. Мониторинг: Dagster → Prometheus metrics

### Оценка
- **Длительность:** 3-4 недели
- **Ресурсы:** 1-2 Backend-разработчика (senior, знание Dagster)
- **Человеко-недели:** 5-7

### Критерии приёмки
- Все бывшие Celery periodic tasks работают как Dagster assets/jobs
- Keitaro clicks sync и Scaleo conversions sync продолжают работать (уже реализованы)
- Dagster UI показывает lineage graph всех assets
- Schedules работают по расписанию
- Sensors реагируют на события
- Dagster run history хранится в PostgreSQL

---

## E6 — Dashboard Service (API only)

### Описание
Миграция Dashboard с Django на FastAPI. **Только REST API** — без фоновых задач (все перенесены в Dagster). Без admin panel — клиенты подключаются через API Gateway.

### Цели
- REST API для кликов, конверсий, дашбордов, справочников
- Rule Engine для расчёта выручки (вызывается из Dagster)
- P&L-генератор (вызывается из Dagster)
- Материализованные представления для агрегаций

### Подзадачи
1. FastAPI-приложение (boilerplate, dependency injection)
2. SQLAlchemy-модели dashboard-схемы (clicks, conversions, tech_costs, rules, pnl и т.д.)
3. Alembic-миграции для dashboard-схемы
4. Pydantic-схемы для всех endpoints
5. **Router: Clicks** — API для получения и фильтрации кликов
6. **Router: Conversions** — API для конверсий
7. **Router: Dashboards** — Агрегированные дашборды (buyer, team, direction, geo, source, funnel, offer, device, os, browser)
8. **Router: Dictionaries** — CRUD для справочников (через shared-модели)
9. **Router: Rules** — CRUD для когортных правил
10. **Router: P&L** — Генерация и получение P&L-отчётов
11. **Router: Costs** — API для техрасходов
12. **Service: ClickSyncService** — синхронизация кликов из Keitaro
13. **Service: ConversionSyncService** — синхронизация конверсий из Scaleo
14. **Service: CostSyncService** — синхронизация техрасходов
15. **Service: RuleRevenueService** — расчёт rule_revenue
16. **Service: PnlGeneratorService** — генерация P&L-отчётов
17. **Service: AggregationService** — обновление материализованных представлений (вызывается из Dagster)
18. **Service: DictionaryService** — авто-заполнение справочников + распределение NOSET (вызывается из Dagster)
19. Партиционирование таблицы clicks по месяцам
20. Создание индексов и оптимизация запросов
21. Unit-тесты бизнес-логики
22. Integration-тесты API endpoints

> **Примечание:** Интеграционные клиенты (KeitaroClient, ScaleoClient) и все scheduled tasks — в Dagster (E5). Dashboard Service = только API endpoints + бизнес-логика, вызываемая как из API, так и из Dagster assets.

### Оценка
- **Длительность:** 4-6 недель
- **Ресурсы:** 2 Backend-разработчика
- **Человеко-недели:** 8-12

### Критерии приёмки
- Все API endpoints работают и документированы (OpenAPI)
- Бизнес-логика (rule engine, P&L, aggregations) вызывается как из API, так и из Dagster
- Дашборды показывают те же данные, что и в текущей системе
- Тесты покрывают >80% бизнес-логики

---

## E7 — Finance Service (API only)

### Описание
Миграция Finance с Django/DRF на FastAPI. **Только REST API** — без фоновых задач (Brocard sync, cost calc, salaries — в Dagster). Без admin panel.

### Цели
- REST API для всех финансовых операций
- Бизнес-логика для Brocard, зарплат, контрагентов (вызывается из API и Dagster)
- Управление контрагентами и балансами
- Изоляция по командам

### Подзадачи
1. FastAPI-приложение (boilerplate)
2. SQLAlchemy-модели finance-схемы
3. Alembic-миграции
4. Pydantic-схемы
5. **Router: DailyCosts** — CRUD для ежедневных расходов
6. **Router: TechCosts** — CRUD для техрасходов (индивидуальные + глобальные)
7. **Router: Brocard** — операции Brocard, синхронизация
8. **Router: Salaries** — управление зарплатами, генерация операций
9. **Router: Counterparties** — CRUD контрагентов, балансы
10. **Router: Reports** — финансовые отчёты, маркетинговые операции
11. **Service: BrocardSyncService** — синхронизация с Brocard API
12. **Service: CurrencyService** — конвертация валют (OpenExchangeRates)
13. **Service: SalaryService** — расчёт зарплат с коэффициентами
14. **Service: CostDistributionService** — распределение глобальных расходов
15. Изоляция данных по командам (team-based access)
16. Unit-тесты
17. Integration-тесты

> **Примечание:** Интеграционные клиенты (BrocardClient, ExchangeRateClient) и scheduled tasks — в Dagster (E5).

### Оценка
- **Длительность:** 4-5 недель
- **Ресурсы:** 1-2 Backend-разработчика
- **Человеко-недели:** 6-8

### Критерии приёмки
- Все финансовые операции доступны через API
- Brocard-синхронизация работает
- Зарплаты рассчитываются корректно
- Изоляция по командам обеспечена
- Суммы совпадают с текущей системой

---

## E8 — Events Service (API + Celery)

### Описание
Миграция Events Manager на FastAPI. **Единственный сервис с Celery** — для real-time async dispatch действий (FB CAPI, HTTP requests) после получения входящих событий. Scheduled tasks (log cleanup, FB import) — в Dagster.

### Цели
- Event handler endpoint (приём и обработка событий)
- Celery для async dispatch действий (FB, HTTP, AppsFlyer)
- Campaign/Flow/Action management API
- Rule Engine для фильтрации потоков
- Логирование запросов и действий

### Подзадачи
1. FastAPI-приложение (boilerplate)
2. SQLAlchemy-модели events-схемы
3. Alembic-миграции
4. Pydantic-схемы
5. **Router: EventHandler** — `POST /api/events/handle/{alias}` — основной обработчик
6. **Router: Campaigns** — CRUD кампаний
7. **Router: Flows** — CRUD потоков с правилами
8. **Router: Actions** — CRUD действий и маппингов
9. **Router: FbTokens** — управление FB-токенами и пикселями
10. **Router: Applications** — регистрация приложений
11. **Router: FbUsers** — сохранение FB-пользователей
12. **Service: EventRouterService** — маршрутизация событий через потоки
13. **Service: RuleEvaluator** — проверка правил (EMPTY, EQUALS, CONTAIN и т.д.)
14. **Service: ActionExecutor** — выполнение действий (HTTP, FB, AppsFlyer)
15. **Service: FbEventService** — отправка FB SSAPI/Pixel событий
16. **Integration: FacebookClient** — Graph API v16.0 + Pixel API
17. **Integration: AppsFlyerClient** — AppsFlyer API
18. Celery tasks: `process_event_actions` (real-time dispatch), notifications
19. Партиционирование таблиц логов
20. Unit-тесты
21. Integration-тесты

> **Примечание:** Scheduled tasks (log cleanup, FB event import) — в Dagster (E5).

### Оценка
- **Длительность:** 4-6 недель
- **Ресурсы:** 1-2 Backend-разработчика
- **Человеко-недели:** 6-10

### Критерии приёмки
- Обработчик событий принимает и маршрутизирует запросы
- FB CAPI/SSAPI работает с fallback на Pixel
- Правила корректно фильтруют потоки
- Действия выполняются асинхронно
- Логи запросов и действий записываются

---

## E9 — Functions Service (API only)

### Описание
Миграция Function Manager на FastAPI. **Только REST API** — все Keitaro batch-операции в Dagster. Без admin panel.

### Цели
- API проверки доступности офферов
- Управление конфигурацией задач (для Dagster)

### Подзадачи
1. FastAPI-приложение (boilerplate)
2. SQLAlchemy-модели functions-схемы
3. Alembic-миграции
4. Pydantic-схемы
5. **Router: Offers** — проверка доступности офферов, CRUD
6. **Router: Tasks** — управление конфигурацией задач, просмотр логов
7. **Service: OfferService** — бизнес-логика офферов
8. **Integration: KeitaroClient** — запросы к Keitaro (отчёты, обновление параметров, постбэки) — используется из Dagster
9. Batch-processing с настраиваемыми размерами и паузами (логика вызывается из Dagster assets)
11. Unit-тесты
12. Integration-тесты

### Оценка
- **Длительность:** 2-3 недели
- **Ресурсы:** 1 Backend-разработчик
- **Человеко-недели:** 2-3

### Критерии приёмки
- API офферов работает с правильной логикой is_change
- KeitaroClient работает и используется из Dagster assets
- Batch-processing Keitaro-данных стабилен
- Дубликаты задач предотвращаются

---

## E10 — Миграция данных

### Описание
Перенос всех данных из 4 существующих PostgreSQL-баз в единую базу Houston с маппингом, дедупликацией и валидацией.

### Цели
- Скрипты миграции для каждой таблицы
- Дедупликация справочников
- Маппинг ID (старые → новые)
- Валидация целостности
- Инкрементальная миграция для больших таблиц

### Подзадачи
1. Анализ и документирование маппинга полей (старые → новые)
2. Скрипт миграции shared-справочников (с дедупликацией)
3. Генерация ID-маппинга (old_id → new_id) для всех сущностей
4. Миграция пользователей из текущего SSO → KeyCloak (параллельно с E3)
5. Скрипт миграции dashboard-данных (clicks, conversions, rules, pnl)
6. Скрипт миграции finance-данных (costs, brocard, salaries, counterparties)
7. Скрипт миграции events-данных (campaigns, flows, actions, fb_tokens, logs)
8. Скрипт миграции functions-данных (offers, task_configs)
9. Инкрементальная миграция больших таблиц (clicks — миллионы записей)
10. Валидационные скрипты (counts, sums, FK integrity)
11. Dry-run на staging
12. Документация процедуры rollback

### Оценка
- **Длительность:** 3-4 недели
- **Ресурсы:** 1 Backend-разработчик + 1 DBA (part-time)
- **Человеко-недели:** 4-6

### Критерии приёмки
- Все данные перенесены без потерь
- Количества записей совпадают
- Финансовые суммы совпадают
- FK-ссылки корректны
- P&L-отчёты дают те же цифры
- Процедура rollback протестирована

---

## E11 — Мониторинг и логирование

### Описание
Настройка полной observability-стека: метрики (Prometheus + Grafana), логи (Loki или BetterStack), трейсинг, алерты.

### Цели
- Сбор метрик со всех сервисов
- Визуализация в Grafana
- Централизованные логи
- Алерты при критических событиях
- Health-check мониторинг

### Подзадачи
1. Prometheus endpoint в каждом FastAPI-сервисе (/metrics)
2. Prometheus конфигурация (scrape targets)
3. Grafana дашборды: HTTP metrics, DB queries, Dagster runs, Celery tasks (Events)
4. Grafana дашборд: бизнес-метрики (клики, конверсии, расходы)
5. Structlog → stdout → Loki (или BetterStack)
6. Grafana + Loki для просмотра логов
7. Алерты: высокий error rate, долгие запросы, упавшие сервисы, failed Dagster runs
8. Health check dashboard (all services + Dagster + KeyCloak status)
9. Dagster Webserver UI для мониторинга background jobs
10. Документация по добавлению метрик и алертов

### Оценка
- **Длительность:** 2-3 недели
- **Ресурсы:** 1 DevOps-инженер
- **Человеко-недели:** 2-3

### Критерии приёмки
- Все сервисы видны в Prometheus
- Grafana показывает HTTP, DB, Dagster, Celery (Events) метрики
- Логи доступны через Grafana/Loki
- Алерты срабатывают при тестовых сбоях

---

## E12 — Тестирование и стабилизация

### Описание
Комплексное тестирование всей платформы: unit, integration, e2e, нагрузочное, тестирование миграции.

### Цели
- Unit-тесты для всей бизнес-логики (>80% coverage)
- Integration-тесты для всех API endpoints
- E2E-тесты критических сценариев
- Нагрузочное тестирование
- Тестирование миграции данных
- Тестирование failover-сценариев

### Подзадачи
1. Настройка тестовой инфраструктуры (testcontainers, fixtures)
2. Unit-тесты: KeyCloak auth flow (JWT validation, RBAC)
3. Unit-тесты: Dashboard Service (бизнес-логика, rule engine, pnl)
4. Unit-тесты: Finance Service
5. Unit-тесты: Events Service (event router, rule evaluator)
6. Unit-тесты: Functions Service
7. Integration-тесты: все API endpoints через httpx
8. E2E-тесты: полный flow (KeyCloak login → Cloudflare ZT → API Gateway → dashboard → данные)
9. E2E-тесты: event processing (кампания → поток → действие → лог)
10. Нагрузочное тестирование (Locust/k6): API Gateway, Dashboard API
11. Тестирование миграции данных (dry-run + валидация)
12. Тестирование failover (падение одного сервиса, reconnect к БД)
13. Исправление найденных багов
14. Performance-оптимизация по результатам нагрузочного тестирования

### Оценка
- **Длительность:** 3-5 недель
- **Ресурсы:** 1 QA-инженер + 1-2 Backend-разработчика
- **Человеко-недели:** 6-10

### Критерии приёмки
- Unit-тест coverage >80% для критических модулей
- Все API endpoints покрыты integration-тестами
- E2E-тесты проходят стабильно
- Нагрузочное тестирование: p95 < 500ms при 100 RPS
- Failover-тесты пройдены

---

## E13 — Деплой и переключение

### Описание
Финальный деплой новой платформы, параллельный запуск, переключение клиентов, отключение старых сервисов.

### Цели
- Деплой на продакшен-сервер(ы)
- Параллельный запуск (shadow mode) — новая система работает рядом со старой
- Валидация данных в реальном времени
- Переключение DNS / nginx upstream
- Отключение старых сервисов
- Post-migration мониторинг

### Подзадачи
1. Подготовка продакшен-сервера (или облачных ресурсов)
2. Деплой Docker Compose prod-стека
3. Запуск финальной миграции данных
4. Параллельный запуск: новые сервисы работают, старые продолжают обслуживать клиентов
5. Shadow mode: копирование трафика на новые сервисы, сравнение ответов
6. Валидация: проверка что новые сервисы дают правильные результаты
7. Переключение: обновление DNS / nginx конфигурации
8. Мониторинг первых 48 часов
9. Hotfix-план: быстрые исправления при обнаружении проблем
10. Отключение старых сервисов (через 1-2 недели после стабилизации)
11. Удаление старых баз данных (через 1 месяц после подтверждения)
12. Post-mortem и документация lessons learned

### Оценка
- **Длительность:** 2-3 недели
- **Ресурсы:** 1 DevOps + 1-2 Backend-разработчика
- **Человеко-недели:** 4-6

### Критерии приёмки
- Новая платформа обслуживает 100% трафика
- Нет потери данных
- Время отклика не хуже старой системы
- Мониторинг показывает стабильную работу 48+ часов
- Старые сервисы безопасно отключены

---

## Сводная таблица

| Эпик | Длительность | Человеко-недели | Параллельность |
|------|-------------|-----------------|----------------|
| E1 Инфраструктура | 3-4 нед | 6-8 | Старт |
| E2 Shared lib | 2-3 нед | 2-3 | После E1 (частично параллельно) |
| E3 KeyCloak + CF ZT | 2-3 нед | 3-5 | После E1 |
| E4 API Gateway (FastAPI) | 1-2 нед | 1-2 | После E1, E3 |
| E5 Dagster Orchestrator | 3-4 нед | 5-7 | После E1, E2 |
| E6 Dashboard (API only) | 4-6 нед | 8-12 | После E2, E3, E4 |
| E7 Finance (API only) | 4-5 нед | 6-8 | Параллельно с E6 |
| E8 Events (API + Celery) | 4-6 нед | 6-10 | Параллельно с E6, E7 |
| E9 Functions (API only) | 2-3 нед | 2-3 | Параллельно с E8 |
| E10 Миграция данных | 3-4 нед | 4-6 | После E3, E6-E9 |
| E11 Мониторинг | 2-3 нед | 2-3 | Параллельно с E6-E9 |
| E12 Тестирование | 3-5 нед | 6-10 | После E6-E9 |
| E13 Деплой | 2-3 нед | 4-6 | После E10, E12 |
| **ИТОГО** | **33-48 нед** | **56-83** | **Календарных: 24-32 нед** |

### Визуализация таймлайна (при команде из 5 человек)

```
Неделя:  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28
E1:      ████████████
E2:         ██████████
E3:            █████████
E4:                  █████
E5:            ████████████████
E6:                     ████████████████████
E7:                     ██████████████████
E8:                        ████████████████████
E9:                              █████████
E11:                        ██████████
E10:                                          ████████████
E12:                                          ██████████████████
E13:                                                            ██████████
```
