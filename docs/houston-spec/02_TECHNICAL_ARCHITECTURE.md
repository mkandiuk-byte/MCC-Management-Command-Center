# Project Houston — Техническая архитектура

## 1. Обзор архитектуры

### 1.1 Архитектурный стиль

**Modular Monolith с API Gateway** — микросервисы, которые:
- Разделены по бизнес-доменам (Dashboard, Finance, Events, Functions)
- Работают с единой PostgreSQL через изолированные схемы (schemas)
- Деплоятся как отдельные контейнеры
- Общаются через API Gateway (синхронно)
- Все фоновые/batch-операции оркестрируются через Dagster (не Celery)
- Celery используется для event-triggered async-операций (уведомления, обработка входящих событий, on-demand задачи из API)

### 1.2 Компоненты системы

```
┌─────────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТЫ                                      │
│            Web UI (React/Vue)  │  Mobile  │  External APIs           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ HTTPS (TLS 1.3)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                FASTAPI API GATEWAY (Custom Python Service)           │
│  ─ JWT Validation (KeyCloak JWKS)                                    │
│  ─ Path-based Routing (httpx reverse proxy)                          │
│  ─ Rate Limiting (slowapi / Redis)                                   │
│  ─ CORS middleware                                                   │
│  ─ Request tracing (X-Request-ID)                                    │
│  ─ X-User-* header injection                                        │
│  ─ :8000                                                            │
└──────┬──────┬──────┬──────┬──────────────────────────────────────────┘
       │      │      │      │
       ▼      ▼      ▼      ▼
┌─────────┐┌─────────┐┌─────────┐┌─────────┐
│Dashboard││ Finance ││ Events  ││Functions│
│ Service ││ Service ││ Service ││ Service │
│ :8002   ││ :8003   ││ :8004   ││ :8005   │
│         ││         ││         ││         │
│ FastAPI ││ FastAPI ││ FastAPI ││ FastAPI │
│ Uvicorn ││ Uvicorn ││ Uvicorn ││ Uvicorn │
└────┬────┘└────┬────┘└────┬────┘└────┬────┘
     │          │          │          │
     └──────────┴──────────┼──────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼              ▼
     ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐
     │ PostgreSQL │ │   Redis   │ │ Celery   │ │    Dagster      │
     │    17      │ │    7+     │ │ Workers  │ │  (Orchestrator) │
     │            │ │           │ │          │ │                 │
     │ Schemas:   │ │ ─ Cache   │ │ Event-   │ │ Scheduled/Batch:│
     │ ─ keycloak │ │ ─ Broker  │ │ triggered│ │ ─ Keitaro sync ✓│
     │ ─ shared   │ │ ─ Rates   │ │ async:   │ │ ─ Scaleo sync  ✓│
     │ ─ dashboard│ │           │ │ ─ Notifs │ │ ─ Rule revenue  │
     │ ─ finance  │ └───────────┘ │ ─ Events │ │ ─ P&L reports   │
     │ ─ events   │               │ ─ On-    │ │ ─ Brocard sync  │
     │ ─ functions│               │   demand │ │ ─ MView refresh │
     │ ─ dagster  │               │   tasks  │ │ ─ Cleanup       │
     └────────────┘               └──────────┘ │ ─ Salaries      │
                                               │ ─ Tech costs    │
                                               │ ─ ... all batch │
                                               └────────────────┘
```

---

## 2. API Gateway (FastAPI)

### 2.1 Выбор: Кастомный FastAPI Gateway

Кастомный API Gateway на FastAPI вместо Traefik/Kong/etc.:

| Преимущество | Описание |
|-------------|----------|
| **Единый стек** | Весь код на Python/FastAPI — одни и те же инструменты, CI/CD, мониторинг |
| **Гибкая логика** | JWT-валидация, парсинг KeyCloak claims, кастомные X-User-* headers — всё в Python-коде |
| **Контроль routing** | Полный контроль маршрутизации, трансформации запросов, fallback-стратегий |
| **Rate limiting** | slowapi (на базе Redis) — гибкая конфигурация per-route/per-user |
| **CORS** | FastAPI CORSMiddleware — встроенный и понятный |
| **Единый OpenAPI** | Можно агрегировать OpenAPI-спецификации всех сервисов в одном месте |
| **Тестируемость** | pytest + httpx — так же, как все остальные сервисы |

> **SSL termination** выполняется на уровне Cloudflare (перед Gateway). В production Gateway слушает HTTP, а Cloudflare обеспечивает HTTPS для клиентов.

### 2.2 Маршрутизация

```python
# services/gateway/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.middleware import JWTAuthMiddleware, RequestIDMiddleware
from app.proxy import proxy_request
from app.config import settings

app = FastAPI(title="Houston API Gateway", version="1.0.0")

# Middleware
app.add_middleware(RequestIDMiddleware)
app.add_middleware(JWTAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    max_age=3600,
)

limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)
app.state.limiter = limiter

# Route mapping
ROUTES = {
    "/api/dashboard": settings.DASHBOARD_SERVICE_URL,
    "/api/finance": settings.FINANCE_SERVICE_URL,
    "/api/events": settings.EVENTS_SERVICE_URL,
    "/api/functions": settings.FUNCTIONS_SERVICE_URL,
}

@app.api_route("/api/{service_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
@limiter.limit("100/minute")
async def gateway_proxy(request: Request, service_path: str):
    """Reverse proxy to downstream services with JWT validation and X-User-* headers."""
    return await proxy_request(request, service_path, ROUTES)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

```python
# services/gateway/app/middleware.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import httpx
from joserfc import jwt
from joserfc.jwk import KeySet

class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Validate KeyCloak JWT and inject X-User-* headers for downstream services."""

    async def dispatch(self, request: Request, call_next):
        # Пропускаем health check и public endpoints
        if request.url.path in ("/health",) or request.method == "OPTIONS":
            return await call_next(request)

        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if not token:
            return JSONResponse(status_code=401, content={"detail": "Missing token"})

        try:
            # Validate JWT using KeyCloak JWKS
            claims = await self.validate_keycloak_jwt(token)
            # Inject X-User-* headers for downstream services
            request.state.user_id = claims.get("sub")
            request.state.user_email = claims.get("email")
            request.state.user_role = self._extract_realm_role(claims)
            request.state.team_id = claims.get("team_id")
            request.state.buyer_id = claims.get("buyer_id")
            request.state.permissions = self._extract_permissions(claims)
        except Exception:
            return JSONResponse(status_code=401, content={"detail": "Invalid token"})

        return await call_next(request)
```

```python
# services/gateway/app/proxy.py
import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse

async def proxy_request(request: Request, service_path: str, routes: dict):
    """Forward request to downstream service with X-User-* headers."""
    target_url = None
    for prefix, url in routes.items():
        if f"/api/{service_path}".startswith(prefix):
            target_url = f"{url}/api/{service_path}"
            break

    if not target_url:
        return JSONResponse(status_code=404, content={"detail": "Service not found"})

    # Build headers with user context
    headers = dict(request.headers)
    headers["X-User-ID"] = str(request.state.user_id)
    headers["X-User-Email"] = request.state.user_email or ""
    headers["X-User-Role"] = request.state.user_role or ""
    headers["X-Team-ID"] = str(request.state.team_id or "")
    headers["X-Buyer-ID"] = str(request.state.buyer_id or "")
    headers["X-Permissions"] = ",".join(request.state.permissions)

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=await request.body(),
            params=request.query_params,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=dict(response.headers),
    )
```

### 2.3 Аутентификация: Cloudflare Zero Trust + KeyCloak

#### Двухуровневая аутентификация

```
Клиент → Cloudflare Zero Trust (1-й уровень)
  → Проверка устройства, IP, geo, identity
  → Перенаправление на KeyCloak для логина (OIDC)
  → KeyCloak выдаёт JWT token
  → Запрос с JWT → FastAPI Gateway → JWTAuthMiddleware → KeyCloak JWKS validation
  → Gateway парсит claims, инжектит X-User-* headers
  → Запрос проксируется к целевому сервису
```

**Уровень 1 — Cloudflare Zero Trust:**
- Контроль доступа на сетевом уровне (IP, device posture, geo)
- Интеграция с KeyCloak как Identity Provider
- WAF, DDoS protection, bot management
- Access policies per application/path

**Уровень 2 — KeyCloak:**
- Identity Provider (OIDC/OAuth 2.0)
- Управление пользователями, ролями, группами
- JWT token issuance с custom claims
- Admin Console для управления realm
- RBAC через Realm Roles и Client Roles

Целевой сервис получает данные пользователя через заголовки:
```
X-User-ID: 42
X-User-Role: admin
X-Team-ID: 5
X-User-Email: user@example.com
X-User-Permissions: dashboard:read,finance:write
```

---

## 3. Аутентификация и авторизация (Cloudflare ZT + KeyCloak)

### 3.1 KeyCloak Configuration

- **Realm:** `houston`
- **Clients:** `houston-gateway` (confidential), `houston-web` (public SPA)
- **Realm Roles:** admin, manager, buyer, team_lead, finance_staff, viewer
- **Custom User Attributes:** team_id, buyer_id, brocard_id
- **Mappers:** Custom JWT claims для team_id, permissions

### 3.2 RBAC Model (KeyCloak Realm Roles)

```
Realm Role (KeyCloak)
├── admin          → полный доступ ко всем сервисам
├── manager        → доступ к Dashboard, Finance (read/write)
├── buyer          → доступ к Dashboard (свои данные), Finance (свои расходы)
├── team_lead      → доступ к данным своей команды
├── finance_staff  → доступ к Finance (full), Dashboard (read)
└── viewer         → только чтение

Client Roles (гранулярные права в KeyCloak)
├── dashboard: read, write, admin
├── finance: read, write, admin, salary
├── events: read, write, admin
└── functions: read, write, admin
```

### 3.3 JWT Token Structure (issued by KeyCloak)

```json
{
  "sub": "uuid-from-keycloak",
  "email": "user@example.com",
  "preferred_username": "john.doe",
  "realm_access": {
    "roles": ["buyer", "default-roles-houston"]
  },
  "resource_access": {
    "houston-gateway": {
      "roles": ["dashboard:read", "finance:read"]
    }
  },
  "team_id": 5,
  "buyer_id": 42,
  "iat": 1711900000,
  "exp": 1711903600
}
```

### 3.4 Cloudflare Zero Trust Policies

| Policy | Rule | Action |
|--------|------|--------|
| `houston-api` | Email domain = @company.com | Allow |
| `houston-api` | Country NOT IN [allowed_list] | Block |
| `houston-api` | Device posture = managed | Allow |
| `houston-dagster` | Group = DevOps, Admin | Allow |
| `houston-grafana` | Group = DevOps, Admin, Manager | Allow |

### 3.5 Нет отдельного Auth Service

> **Важно:** Вместо кастомного Auth Service используется KeyCloak. Управление пользователями, ролями, группами, сессиями — всё через KeyCloak Admin Console. FastAPI-сервисы **только валидируют JWT** и извлекают claims из заголовков.
```

---

## 4. Единая база данных PostgreSQL

### 4.1 Стратегия схем (Schemas)

Каждый микросервис работает со своей PostgreSQL-схемой + имеет доступ к `shared` схеме на чтение. Auth-данные управляются в KeyCloak (отдельная БД), не в Houston PostgreSQL.

```sql
-- Общие справочники (shared schema)
CREATE SCHEMA shared;

-- Схемы сервисов (без auth — auth в KeyCloak)
CREATE SCHEMA dashboard;
CREATE SCHEMA finance;
CREATE SCHEMA events;
CREATE SCHEMA functions;
CREATE SCHEMA dagster;      -- Dagster run storage, event log, schedules
```

### 4.2 Shared Schema — Общие справочники

Содержит нормализованные справочники, используемые несколькими сервисами:

```sql
-- shared.buyers — Единый справочник покупателей
CREATE TABLE shared.buyers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    buyer_external_id INTEGER UNIQUE,          -- ID из Keitaro
    brocard_id VARCHAR(100),
    team_id INTEGER REFERENCES shared.teams(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared.teams — Команды
CREATE TABLE shared.teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    direction_id INTEGER REFERENCES shared.directions(id),
    head_id INTEGER REFERENCES auth.users(id),
    lead_id INTEGER REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared.directions — Направления
CREATE TABLE shared.directions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared.geos — Географии
CREATE TABLE shared.geos (
    id SERIAL PRIMARY KEY,
    name VARCHAR(10) NOT NULL UNIQUE,    -- 2-letter code
    full_name VARCHAR(255)
);

-- shared.sources — Источники трафика
CREATE TABLE shared.sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- shared.offers — Офферы
CREATE TABLE shared.offers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    offer_external_id INTEGER UNIQUE,
    payment_model VARCHAR(20),          -- CPA, SPEND
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared.funnels — Воронки
CREATE TABLE shared.funnels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category_id INTEGER REFERENCES shared.funnel_categories(id)
);

-- shared.funnel_categories
CREATE TABLE shared.funnel_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- shared.devices, shared.os_list, shared.browsers
CREATE TABLE shared.devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE shared.os_list (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE shared.browsers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- shared.counterparties — Контрагенты
CREATE TABLE shared.counterparties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- shared.payment_sources — Источники оплаты
CREATE TABLE shared.payment_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);
-- shared.clicks — Клики
CREATE TABLE shared.clicks (
    id BIGSERIAL PRIMARY KEY,
    datetime TIMESTAMPTZ NOT NULL,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    source_id INTEGER REFERENCES shared.sources(id),
    geo_id INTEGER REFERENCES shared.geos(id),
    offer_id INTEGER REFERENCES shared.offers(id),
    funnel_id INTEGER REFERENCES shared.funnels(id),
    device_id INTEGER REFERENCES shared.devices(id),
    os_id INTEGER REFERENCES shared.os_list(id),
    browser_id INTEGER REFERENCES shared.browsers(id),
    .............
    -- Keitaro-specific fields
    keitaro_click_id VARCHAR(100) UNIQUE,
    campaign_id INTEGER,
    sub_id VARCHAR(100),
    sub2 VARCHAR(255),
    sub4 VARCHAR(255),
    keyword VARCHAR(500),
    ip VARCHAR(50),
    cost DECIMAL(12, 4) DEFAULT 0,
    tech_cost DECIMAL(12, 4) DEFAULT 0,
    revenue DECIMAL(12, 4) DEFAULT 0,
    rule_revenue DECIMAL(12, 4),
    ........
    is_sale BOOLEAN DEFAULT FALSE,
    sale_timestamp TIMESTAMPTZ,
    is_tail BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (datetime);

-- Партиционирование по месяцам для производительности
CREATE TABLE dashboard.clicks_2026_01 PARTITION OF dashboard.clicks
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE dashboard.clicks_2026_02 PARTITION OF dashboard.clicks
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... и т.д.

-- Индексы
CREATE INDEX idx_clicks_buyer_datetime ON dashboard.clicks (buyer_id, datetime);
CREATE INDEX idx_clicks_keitaro_id ON dashboard.clicks (keitaro_click_id);
CREATE INDEX idx_clicks_sub_id ON dashboard.clicks (sub_id);
CREATE INDEX idx_clicks_datetime ON dashboard.clicks (datetime);
```

### 4.3 User Profiles (shared schema)

> **Примечание:** Аутентификация и основные данные пользователей хранятся в **KeyCloak**. В Houston PostgreSQL хранится только бизнес-профиль пользователя (привязка к buyer, team, и прочие бизнес-атрибуты).

```sql
-- shared.user_profiles — Бизнес-профиль пользователя (дополнение к KeyCloak)
CREATE TABLE shared.user_profiles (
    id SERIAL PRIMARY KEY,
    keycloak_id UUID NOT NULL UNIQUE,          -- sub из KeyCloak JWT
    email VARCHAR(255) NOT NULL,
    username VARCHAR(150) NOT NULL,
    team_id INTEGER REFERENCES shared.teams(id),
    buyer_id INTEGER REFERENCES shared.buyers(id),
    telegram VARCHAR(100),
    slack VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Роли, разрешения, токены, сессии → ВСЕ в KeyCloak
-- В Houston PostgreSQL НЕТ auth-схемы. Пользователи, роли, permissions — в KeyCloak.
-- Бизнес-профили (team_id, buyer_id) — в shared.user_profiles (см. выше).
```

### 4.4 Dashboard Schema

```sql
-- dashboard.conversions — Конверсии
CREATE TABLE dashboard.conversions (
    id BIGSERIAL PRIMARY KEY,
    click_id BIGINT REFERENCES dashboard.clicks(id),
    conversion_type VARCHAR(50),               -- registration, deposit
    payout DECIMAL(12, 4) DEFAULT 0,
    revenue DECIMAL(12, 4) DEFAULT 0,
    scaleo_conversion_id VARCHAR(100) UNIQUE,
    status VARCHAR(50),
    datetime TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversions_click ON dashboard.conversions (click_id);
CREATE INDEX idx_conversions_datetime ON dashboard.conversions (datetime);

-- dashboard.buyer_tech_costs — Технические расходы по покупателям
CREATE TABLE dashboard.buyer_tech_costs (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    month DATE NOT NULL,                       -- first day of month
    category VARCHAR(100),
    cost_type VARCHAR(20),                     -- TECH, FULL
    amount DECIMAL(12, 2) DEFAULT 0,
    coefficient DECIMAL(5, 2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (buyer_id, month, category, cost_type)
);

-- dashboard.cohort_rules — Правила расчёта выручки
CREATE TABLE dashboard.cohort_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(30) NOT NULL,            -- guaranteed_roi, agency_model, fixed_revenue
    value DECIMAL(10, 4),
    date_from DATE,
    date_to DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dashboard.cohort_rule_filters — Фильтры для правил (M2M)
CREATE TABLE dashboard.cohort_rule_filters (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES dashboard.cohort_rules(id) ON DELETE CASCADE,
    filter_type VARCHAR(50),                   -- buyer, source, geo, funnel, offer, device
    filter_value_id INTEGER                    -- ID из соответствующего shared-справочника
);

-- dashboard.pnl_reports — P&L отчёты
CREATE TABLE dashboard.pnl_reports (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL UNIQUE,
    data JSONB NOT NULL,
    include_tails BOOLEAN DEFAULT FALSE,
    include_rules BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'draft',
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- dashboard.pnl_additional_sums — Доп. расходы P&L
CREATE TABLE dashboard.pnl_additional_sums (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    category VARCHAR(100),
    amount DECIMAL(12, 2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Материализованное представление для дашборда
CREATE MATERIALIZED VIEW dashboard.mv_buyer_dashboard AS
SELECT
    c.buyer_id,
    DATE_TRUNC('day', c.datetime) AS date,
    COUNT(*) AS clicks,
    COUNT(CASE WHEN conv.conversion_type = 'registration' THEN 1 END) AS registrations,
    COUNT(CASE WHEN conv.conversion_type = 'deposit' THEN 1 END) AS deposits,
    SUM(c.cost) AS total_cost,
    SUM(c.tech_cost) AS total_tech_cost,
    SUM(c.revenue) AS total_revenue,
    SUM(COALESCE(c.rule_revenue, c.revenue)) AS effective_revenue
FROM dashboard.clicks c
LEFT JOIN dashboard.conversions conv ON conv.click_id = c.id
GROUP BY c.buyer_id, DATE_TRUNC('day', c.datetime);

CREATE UNIQUE INDEX ON dashboard.mv_buyer_dashboard (buyer_id, date);
```

### 4.5 Finance Schema

```sql
-- finance.daily_costs — Ежедневные рекламные расходы
CREATE TABLE finance.daily_costs (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    campaign_id INTEGER,
    ad_campaign_id VARCHAR(255),
    counterparty_id INTEGER REFERENCES shared.counterparties(id),
    amount DECIMAL(12, 2) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_costs_date ON finance.daily_costs (date);
CREATE INDEX idx_daily_costs_buyer_date ON finance.daily_costs (buyer_id, date);

-- finance.tech_costs — Технические расходы
CREATE TABLE finance.tech_costs (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    date DATE NOT NULL,
    category_id INTEGER REFERENCES finance.tech_cost_categories(id),
    payment_source_id INTEGER REFERENCES shared.payment_sources(id),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    jira_task VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tech_costs_buyer_date ON finance.tech_costs (buyer_id, date);

-- finance.tech_cost_categories
CREATE TABLE finance.tech_cost_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- finance.global_tech_costs — Корпоративные расходы
CREATE TABLE finance.global_tech_costs (
    id SERIAL PRIMARY KEY,
    cost_type VARCHAR(30),                     -- team, counterparties
    category_id INTEGER REFERENCES finance.tech_cost_categories(id),
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    team_id INTEGER REFERENCES shared.teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- finance.brocard_operations — Операции Brocard
CREATE TABLE finance.brocard_operations (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    month DATE NOT NULL,
    operation_type VARCHAR(50),
    amount DECIMAL(12, 2),
    fee DECIMAL(12, 2) DEFAULT 0,
    is_tech_cost BOOLEAN DEFAULT FALSE,
    external_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- finance.counterparty_costs — Расходы контрагентов
CREATE TABLE finance.counterparty_costs (
    id SERIAL PRIMARY KEY,
    counterparty_id INTEGER REFERENCES shared.counterparties(id),
    buyer_id INTEGER REFERENCES shared.buyers(id),
    cost_type VARCHAR(30),                     -- ads, commission
    amount DECIMAL(12, 2),
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- finance.counterparty_balances — Баланс контрагентов
CREATE TABLE finance.counterparty_balances (
    id SERIAL PRIMARY KEY,
    counterparty_id INTEGER REFERENCES shared.counterparties(id),
    payment_source_id INTEGER REFERENCES shared.payment_sources(id),
    balance DECIMAL(14, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- finance.user_salaries — Зарплаты
CREATE TABLE finance.user_salaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id),
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- finance.salary_operations — Зарплатные операции
CREATE TABLE finance.salary_operations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth.users(id),
    month DATE NOT NULL,
    base_amount DECIMAL(12, 2),
    overhead_coefficient DECIMAL(5, 2) DEFAULT 1.3,
    total_amount DECIMAL(12, 2),
    status VARCHAR(30) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Events Schema

```sql
-- events.domains — Зарегистрированные домены
CREATE TABLE events.domains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- events.campaigns — Кампании
CREATE TABLE events.campaigns (
    id SERIAL PRIMARY KEY,
    alias VARCHAR(255) NOT NULL UNIQUE,
    domain_id INTEGER REFERENCES events.domains(id),
    method VARCHAR(10) DEFAULT 'ALL',          -- GET, POST, ALL
    required_params JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- events.actions — Действия
CREATE TABLE events.actions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    action_type VARCHAR(20) NOT NULL,          -- REQUEST, FB_EVENT, APPSFLYER
    url TEXT,
    method VARCHAR(10),
    headers JSONB DEFAULT '{}',
    body_template JSONB,
    content_type VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- events.action_mappings — Маппинг параметров
CREATE TABLE events.action_mappings (
    id SERIAL PRIMARY KEY,
    action_id INTEGER REFERENCES events.actions(id) ON DELETE CASCADE,
    source_param VARCHAR(255),
    target_param VARCHAR(255),
    default_value VARCHAR(500)
);

-- events.flows — Потоки обработки
CREATE TABLE events.flows (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES events.campaigns(id) ON DELETE CASCADE,
    action_id INTEGER REFERENCES events.actions(id),
    condition_type VARCHAR(5) DEFAULT 'AND',   -- AND, OR
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- events.rules — Правила фильтрации
CREATE TABLE events.rules (
    id SERIAL PRIMARY KEY,
    param VARCHAR(255) NOT NULL,
    operator VARCHAR(20) NOT NULL,             -- EMPTY, EQUALS, CONTAIN, etc.
    value VARCHAR(500)
);

-- events.flow_rules — Связь потоков и правил (M2M)
CREATE TABLE events.flow_rules (
    flow_id INTEGER REFERENCES events.flows(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES events.rules(id) ON DELETE CASCADE,
    PRIMARY KEY (flow_id, rule_id)
);

-- events.fb_tokens — Facebook токены
CREATE TABLE events.fb_tokens (
    id SERIAL PRIMARY KEY,
    pixel_id VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    buyer_id INTEGER REFERENCES shared.buyers(id),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- events.fb_users — Facebook пользователи
CREATE TABLE events.fb_users (
    id BIGSERIAL PRIMARY KEY,
    fbclid VARCHAR(255),
    fbp VARCHAR(255),
    ip VARCHAR(50),
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fb_users_fbclid ON events.fb_users (fbclid);

-- events.streams — Потоки FB-событий
CREATE TABLE events.streams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    fb_token_id INTEGER REFERENCES events.fb_tokens(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- events.applications — Клиентские приложения
CREATE TABLE events.applications (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    fb_event_status VARCHAR(20) DEFAULT 'No Active',
    appsflyer_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- events.request_logs — Логи входящих запросов
CREATE TABLE events.request_logs (
    id BIGSERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES events.campaigns(id),
    query_params JSONB,
    ip VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- events.action_logs — Логи выполненных действий
CREATE TABLE events.action_logs (
    id BIGSERIAL PRIMARY KEY,
    request_log_id BIGINT REFERENCES events.request_logs(id),
    action_id INTEGER REFERENCES events.actions(id),
    status VARCHAR(20),
    response_code INTEGER,
    response_body TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- events.fb_logs — Логи Facebook событий
CREATE TABLE events.fb_logs (
    id BIGSERIAL PRIMARY KEY,
    fb_user_id BIGINT REFERENCES events.fb_users(id),
    fb_token_id INTEGER REFERENCES events.fb_tokens(id),
    event_name VARCHAR(100),
    method VARCHAR(10),                        -- SSAPI, PIXEL
    success BOOLEAN,
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);
```

### 4.7 Functions Schema

```sql
-- functions.available_offers — Доступные офферы
CREATE TABLE functions.available_offers (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER REFERENCES shared.offers(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_full_disabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- functions.offer_conversions — Конверсии офферов
CREATE TABLE functions.offer_conversions (
    id BIGSERIAL PRIMARY KEY,
    offer_id INTEGER NOT NULL,
    sub_id VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(50),
    click_datetime TIMESTAMPTZ,
    postback_datetime TIMESTAMPTZ,
    sale_datetime TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offer_conv_offer ON functions.offer_conversions (offer_id);
CREATE INDEX idx_offer_conv_postback ON functions.offer_conversions (postback_datetime DESC);

-- functions.task_configs — Конфигурация задач (общая для всех сервисов)
CREATE TABLE functions.task_configs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    service VARCHAR(50) NOT NULL,              -- dashboard, finance, events, functions
    task_path VARCHAR(255) NOT NULL,           -- e.g., "dashboard.tasks.sync_clicks"
    frequency_minutes INTEGER DEFAULT 60,
    args JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- functions.task_logs — Логи выполнения задач
CREATE TABLE functions.task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_config_id INTEGER REFERENCES functions.task_configs(id),
    service VARCHAR(50),
    status VARCHAR(20),                        -- RUNNING, SUCCESS, ERROR, TIMEOUT
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration INTERVAL,
    log TEXT,
    error TEXT
) PARTITION BY RANGE (started_at);
```

---

## 5. Структура проекта (Monorepo)

```
houston/
├── docker-compose.yml              # Общий стек
├── docker-compose.prod.yml         # Продакшен
├── shared/                         # Общая библиотека
│   ├── pyproject.toml
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── database.py             # SQLAlchemy engine, session
│   │   ├── models/                 # Shared models (buyers, teams, geos...)
│   │   │   ├── __init__.py
│   │   │   ├── buyer.py
│   │   │   ├── team.py
│   │   │   ├── geo.py
│   │   │   ├── offer.py
│   │   │   └── ...
│   │   ├── schemas/                # Pydantic schemas (shared)
│   │   ├── auth.py                 # JWT utilities, CurrentUser dependency
│   │   ├── config.py               # Базовые настройки
│   │   ├── logging.py              # Structlog configuration
│   │   ├── middleware.py           # ASGI middleware
│   │   └── exceptions.py          # Общие исключения
│   └── tests/
│
├── alembic/                        # Миграции БД (общие)
│   ├── alembic.ini
│   ├── env.py
│   └── versions/
│
├── services/
│   ├── gateway/                     # API Gateway (FastAPI)
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── app/
│   │   │   ├── main.py              # FastAPI app, routing, reverse proxy
│   │   │   ├── config.py            # Service URLs, CORS origins, Redis
│   │   │   ├── middleware.py         # JWTAuthMiddleware, RequestIDMiddleware
│   │   │   ├── proxy.py             # Reverse proxy logic (httpx)
│   │   │   └── keycloak.py          # JWKS fetching, JWT validation
│   │   └── tests/
│   │
│   ├── dashboard/                  # Dashboard Service
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   ├── routers/
│   │   │   │   ├── clicks.py
│   │   │   │   ├── conversions.py
│   │   │   │   ├── dashboards.py
│   │   │   │   ├── rules.py
│   │   │   │   ├── pnl.py
│   │   │   │   └── dictionaries.py
│   │   │   ├── services/
│   │   │   │   ├── click_sync.py
│   │   │   │   ├── conversion_sync.py
│   │   │   │   ├── rule_engine.py
│   │   │   │   ├── pnl_generator.py
│   │   │   │   └── aggregation.py
│   │   │   ├── integrations/
│   │   │   │   ├── keitaro.py
│   │   │   │   └── scaleo.py
│   │   │   └── celery_tasks.py     # Celery: on-demand async (e.g., notifications)
│   │   └── tests/
│   │
│   ├── finance/                    # Finance Service
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   ├── routers/
│   │   │   │   ├── daily_costs.py
│   │   │   │   ├── tech_costs.py
│   │   │   │   ├── brocard.py
│   │   │   │   ├── salaries.py
│   │   │   │   ├── counterparties.py
│   │   │   │   └── reports.py
│   │   │   ├── services/
│   │   │   ├── integrations/
│   │   │   │   ├── brocard.py
│   │   │   │   └── exchange_rates.py
│   │   │   └── celery_tasks.py     # Celery: on-demand async (e.g., balance update notifs)
│   │   └── tests/
│   │
│   ├── events/                     # Events Service
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   ├── routers/
│   │   │   │   ├── campaigns.py
│   │   │   │   ├── flows.py
│   │   │   │   ├── actions.py
│   │   │   │   ├── fb_events.py
│   │   │   │   └── event_handler.py
│   │   │   ├── services/
│   │   │   │   ├── event_router.py
│   │   │   │   ├── fb_service.py
│   │   │   │   └── action_executor.py
│   │   │   └── celery_tasks.py     # Celery: real-time event dispatch (FB, HTTP actions)
│   │   └── tests/
│   │
│   └── functions/                  # Functions Service
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── app/
│       │   ├── main.py
│       │   ├── models/
│       │   ├── schemas/
│       │   ├── routers/
│       │   │   ├── offers.py
│       │   │   └── tasks.py
│       │   ├── services/
│       │   ├── integrations/
│       │   │   └── keitaro.py
│       │   └── celery_tasks.py     # Celery: on-demand async
│       └── tests/
│
├── dagster/                        # Dagster Orchestrator (все scheduled/batch операции)
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── dagster_houston/
│   │   ├── __init__.py
│   │   ├── definitions.py         # Dagster Definitions (entry point)
│   │   ├── resources.py           # DB connections, HTTP clients
│   │   ├── assets/
│   │   │   ├── dashboard/         # keitaro_clicks ✓, scaleo_convs ✓, rules, pnl, mviews, cleanup
│   │   │   ├── finance/           # brocard_sync, cost_calc, salaries, exchange_rates
│   │   │   ├── events/            # log_cleanup, fb_event_import
│   │   │   └── functions/         # keitaro_ops, offer_conversions, stale_cleanup
│   │   ├── schedules.py           # Cron-based schedules
│   │   ├── sensors.py             # Event-driven sensors
│   │   └── jobs.py                # Composite jobs
│   ├── dagster.yaml               # Instance config (PostgreSQL storage)
│   └── workspace.yaml
│
├── monitoring/
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   └── loki/
│       └── loki-config.yml
│
├── scripts/
│   ├── migrate_data.py             # Миграция данных из старых БД
│   ├── seed_data.py                # Начальные данные
│   └── backup.sh                   # Бэкапы
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Тесты + линтинг
│       └── deploy.yml              # Деплой
│
├── .env.example
├── Makefile
└── README.md
```

---

## 6. Docker Compose (Development)

```yaml
version: "3.9"

services:
  # === API GATEWAY ===
  gateway:
    build: ./services/gateway
    environment:
      REDIS_URL: redis://redis:6379/5
      KEYCLOAK_JWKS_URL: http://keycloak:8080/realms/houston/protocol/openid-connect/certs
      DASHBOARD_SERVICE_URL: http://dashboard:8002
      FINANCE_SERVICE_URL: http://finance:8003
      EVENTS_SERVICE_URL: http://events:8004
      FUNCTIONS_SERVICE_URL: http://functions:8005
      CORS_ORIGINS: '["http://localhost:3000","https://app.houston.com"]'
    ports:
      - "80:8000"
    depends_on:
      - keycloak
      - redis

  # === DATABASE ===
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: houston
      POSTGRES_USER: houston
      POSTGRES_PASSWORD: houston_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init_schemas.sql:/docker-entrypoint-initdb.d/01-schemas.sql

  # === CACHE & BROKER ===
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # === KEYCLOAK (Identity Provider) ===
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev --import-realm
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/houston
      KC_DB_SCHEMA: keycloak
      KC_DB_USERNAME: houston
      KC_DB_PASSWORD: houston_dev
    ports:
      - "8080:8080"    # KeyCloak Admin Console
    volumes:
      - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm.json
    depends_on:
      - postgres

  # === SERVICES ===
  dashboard:
    build: ./services/dashboard
    environment:
      DATABASE_URL: postgresql+asyncpg://houston:houston_dev@postgres:5432/houston
      REDIS_URL: redis://redis:6379/1
    depends_on:
      - postgres
      - redis

  finance:
    build: ./services/finance
    environment:
      DATABASE_URL: postgresql+asyncpg://houston:houston_dev@postgres:5432/houston
      REDIS_URL: redis://redis:6379/2
    depends_on:
      - postgres
      - redis

  events:
    build: ./services/events
    environment:
      DATABASE_URL: postgresql+asyncpg://houston:houston_dev@postgres:5432/houston
      REDIS_URL: redis://redis:6379/3
    depends_on:
      - postgres
      - redis

  functions:
    build: ./services/functions
    environment:
      DATABASE_URL: postgresql+asyncpg://houston:houston_dev@postgres:5432/houston
      REDIS_URL: redis://redis:6379/4
    depends_on:
      - postgres
      - redis

  # === DAGSTER (scheduled/batch orchestrator) ===
  dagster-webserver:
    build: ./dagster
    command: dagster-webserver -h 0.0.0.0 -p 3001
    environment:
      DAGSTER_POSTGRES_URL: postgresql://houston:houston_dev@postgres:5432/houston
      HOUSTON_DATABASE_URL: postgresql://houston:houston_dev@postgres:5432/houston
    ports:
      - "3001:3001"    # Dagster UI
    depends_on:
      - postgres

  dagster-daemon:
    build: ./dagster
    command: dagster-daemon run
    environment:
      DAGSTER_POSTGRES_URL: postgresql://houston:houston_dev@postgres:5432/houston
      HOUSTON_DATABASE_URL: postgresql://houston:houston_dev@postgres:5432/houston
    depends_on:
      - postgres

  # === CELERY (event-triggered async only) ===
  celery-worker:
    build: ./services/events
    command: celery -A app.celery_app worker -l info -Q events,notifications
    environment:
      DATABASE_URL: postgresql+asyncpg://houston:houston_dev@postgres:5432/houston
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis

  # === MONITORING ===
  prometheus:
    image: prom/prometheus:v2.50.0
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:10.3.0
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards

volumes:
  postgres_data:
  redis_data:
  grafana_data:
```

---

## 7. Общая библиотека (shared)

### 7.1 Database Connection

```python
# shared/shared/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class SharedBase(DeclarativeBase):
    __table_args__ = {"schema": "shared"}

def create_engine(database_url: str):
    return create_async_engine(
        database_url,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        echo=False,
    )

def create_session_factory(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### 7.2 JWT Auth Dependency

```python
# shared/shared/auth.py
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

class CurrentUser(BaseModel):
    id: int
    email: str
    role: str
    team_id: int | None = None
    permissions: list[str] = []

async def get_current_user(request: Request) -> CurrentUser:
    """Extract user from X-User-* headers set by API Gateway."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return CurrentUser(
        id=int(user_id),
        email=request.headers.get("X-User-Email", ""),
        role=request.headers.get("X-User-Role", ""),
        team_id=int(request.headers.get("X-Team-ID", 0)) or None,
        permissions=request.headers.get("X-Permissions", "").split(","),
    )

def require_permission(permission: str):
    async def checker(user: CurrentUser = Depends(get_current_user)):
        if permission not in user.permissions and user.role != "admin":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker
```

---

## 8. Dagster — Orchestrator для фоновых операций

### 8.1 Принцип разделения Dagster vs Celery

| Критерий | Dagster | Celery |
|----------|---------|--------|
| **Когда** | По расписанию, batch, ETL, data pipelines | По событию, on-demand, real-time async |
| **Примеры** | Sync кликов, расчёт revenue, P&L, Brocard sync, cleanup | Event dispatch (FB CAPI), notifications, API-triggered async ops |
| **Scheduling** | Cron schedules, sensors, asset dependencies | Не имеет расписания — вызывается из кода |
| **UI** | Dagster Webserver (визуализация DAG, логи, статусы) | Flower (опционально) |
| **Storage** | PostgreSQL (dagster schema) для run history | Redis (broker only) |
| **Retries** | Встроенные retry policies, backfill | Celery retry |
| **Lineage** | Asset dependencies, data lineage graph | Нет |

### 8.2 Dagster Assets (полный список)

#### Dashboard Assets (перенос из Celery-задач Dashboard)

| Asset | Schedule | Описание | Статус |
|-------|----------|----------|--------|
| `keitaro_clicks` | Every 15 min | Синхронизация кликов из Keitaro Admin API | **✓ Реализован** |
| `scaleo_conversions` | Every 15 min | Синхронизация конверсий из Scaleo API | **✓ Реализован** |
| `linked_conversions` | After clicks + conversions | Связывание конверсий с кликами по offer_click/sub_id | Новый |
| `rule_revenue` | After linked_conversions | Расчёт rule_revenue по когортным правилам | Новый |
| `sale_timestamps` | After linked_conversions | Пометка is_sale, расчёт is_tail | Новый |
| `tech_costs_sync` | Every 1 hour | Получение техрасходов из Finance | Новый |
| `dictionaries_populated` | After keitaro_clicks | Авто-создание справочников из новых кликов | Новый |
| `noset_distributed` | After dictionaries_populated | Распределение кликов без buyer_id | Новый |
| `materialized_views` | Every 30 min | Обновление MV (buyer, team, geo, source и т.д.) | Новый |
| `costs_to_keitaro` | Every 1 hour | Отправка расходов обратно в Keitaro Tracking API | Новый |

#### Dashboard Jobs (составные операции)

| Job | Schedule | Описание |
|-----|----------|----------|
| `pnl_report_generation` | Monthly (1st day) | Генерация P&L отчёта: clicks + costs + rules + additional sums |
| `dashboard_data_cleanup` | Daily at 03:00 | Удаление старых кликов/логов по retention policy |

#### Finance Assets

| Asset | Schedule | Описание |
|-------|----------|----------|
| `brocard_operations` | Every 1 hour | Синхронизация операций из Brocard API |
| `offer_clicks_update` | Every 1 hour | Обновление кликов по офферам |
| `tech_cost_calculation` | Daily at 01:00 | Расчёт и распределение техрасходов |
| `exchange_rates` | Daily at 00:00 | Обновление курсов валют |

#### Finance Jobs

| Job | Schedule | Описание |
|-----|----------|----------|
| `salary_operations_generation` | Monthly (1st day) | Генерация ежемесячных зарплатных операций |

#### Events Assets

| Asset | Schedule | Описание |
|-------|----------|----------|
| `events_log_cleanup` | Daily at 04:00 | Удаление старых request/action/fb логов |
| `fb_app_event_import` | Every 6 hours | Импорт FB app events по конфигурации |

#### Functions Assets

| Asset | Schedule | Описание |
|-------|----------|----------|
| `keitaro_campaign_type_fix` | Every 30 min | Исправление типов кампаний в Keitaro |
| `keitaro_click_subid_update` | Every 30 min | Обновление click sub_id |
| `offer_conversions_collection` | Every 15 min | Сбор конверсий офферов из Keitaro |
| `stale_tasks_cleanup` | Every 1 hour | Очистка зависших задач |

### 8.3 Dagster Sensors

| Sensor | Описание |
|--------|----------|
| `new_clicks_sensor` | Запускает `linked_conversions` при появлении новых кликов |
| `new_conversions_sensor` | Запускает `linked_conversions` при появлении новых конверсий |
| `pnl_manual_trigger` | Слушает API-запросы на ручную генерацию P&L |

### 8.4 Dagster Instance Configuration

```yaml
# dagster.yaml
storage:
  postgres:
    postgres_url:
      env: DAGSTER_POSTGRES_URL
    postgres_schema: dagster

run_launcher:
  module: dagster.core.launcher
  class: DefaultRunLauncher

schedule_storage:
  module: dagster_postgres.schedule_storage
  class: PostgresScheduleStorage
  config:
    postgres_url:
      env: DAGSTER_POSTGRES_URL

run_coordinator:
  module: dagster.core.run_coordinator
  class: QueuedRunCoordinator
  config:
    max_concurrent_runs: 10

retention:
  schedule:
    purge_after_days:
      skipped: 7
      failure: 30
      success: 30
```

### 8.5 Celery (event-triggered only)

Celery остаётся для операций, которые должны выполняться **немедленно по триггеру**, а не по расписанию:

| Queue | Сервис | Задачи |
|-------|--------|--------|
| `events` | Events Service | `process_event_actions` — dispatch HTTP/FB/AppsFlyer действий после получения входящего события |
| `notifications` | Все сервисы | `send_notification` — отправка уведомлений (email, Slack, Telegram) |
| `on_demand` | Все сервисы | Любые on-demand async операции, триггеренные из API (ручной пересчёт, принудительный sync) |

```python
# Пример: Events Service — Celery для real-time event dispatch
@celery_app.task(bind=True, max_retries=3)
def process_event_actions(self, request_log_id: int, flows: list[dict]):
    """Выполняет действия по потокам после получения входящего события."""
    for flow in flows:
        execute_action(flow["action_id"], flow["params"])

# Пример: On-demand trigger из API
@router.post("/api/dashboard/pnl-reports/generate")
async def trigger_pnl_generation(month: date, user: CurrentUser = Depends(get_current_user)):
    # Вместо Celery — триггерим Dagster job
    dagster_client.submit_job_execution("pnl_report_generation", run_config={...})
```

---

## 9. Внешние интеграции

### 9.1 Карта интеграций

| Интеграция | Потребитель (Dagster/Service) | Метод | Описание |
|------------|-------------------------------|-------|----------|
| **Keitaro Admin API** | Dagster (dashboard, functions assets) | HTTP REST | Получение кликов, конверсий, обновление параметров |
| **Keitaro Tracking API** | Dagster (dashboard assets) | HTTP REST | Отправка стоимостей обратно в Keitaro |
| **Scaleo API** | Dagster (dashboard assets) | HTTP REST | Получение конверсий аффилиатов |
| **Facebook Graph API v16** | Events Service (Celery) | HTTP REST | Серверные события (CAPI/SSAPI) |
| **Facebook Pixel API** | Events Service (Celery) | HTTP GET | Fallback для пиксельных событий |
| **AppsFlyerAPI** | Events Service (Celery) | HTTP REST | Мобильные конверсии |
| **Brocard API** | Dagster (finance assets) | HTTP REST | Синхронизация платёжных операций |
| **OpenExchangeRates** | Dagster (finance assets) | HTTP REST | Курсы валют |
| **Cloudflare Zero Trust** | API Gateway (FastAPI) | OIDC/JWT | Первый уровень аутентификации |
| **KeyCloak** | API Gateway (FastAPI) / All services | OIDC/JWT | Identity Provider, RBAC, token issuance |
| **BetterStack/Logtail** | Все | HTTP | Централизованное логирование |
| **Sentry** | Все | SDK | Трекинг ошибок |

### 8.2 Integration Client Pattern

Каждый внешний клиент реализуется как отдельный класс с retry-стратегией:

```python
# shared/shared/integrations/base.py
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class BaseIntegrationClient:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self.client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def _request(self, method: str, path: str, **kwargs):
        response = await self.client.request(method, path, **kwargs)
        response.raise_for_status()
        return response.json()
```

---

## 9. Мониторинг и Observability

### 9.1 Стек мониторинга

```
FastAPI Services → Prometheus metrics endpoint (/metrics)
       │
       ▼
   Prometheus (scraping каждые 15s)
       │
       ▼
   Grafana (визуализация + алерты)

FastAPI Services → structlog → stdout
       │
       ▼
   Loki (или BetterStack) → Grafana (логи)
```

### 9.2 Ключевые метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `http_requests_total` | Counter | Общее количество HTTP-запросов |
| `http_request_duration_seconds` | Histogram | Время обработки запросов |
| `http_requests_in_progress` | Gauge | Текущие запросы в обработке |
| `db_query_duration_seconds` | Histogram | Время выполнения SQL-запросов |
| `dagster_run_status` | Gauge | Статус Dagster runs (success/failure/running) |
| `dagster_asset_materialization_total` | Counter | Количество материализаций assets |
| `celery_tasks_total` | Counter | Количество Celery-задач (event-triggered) |
| `celery_task_duration_seconds` | Histogram | Длительность Celery-задач |
| `integration_requests_total` | Counter | Запросы к внешним API |
| `integration_errors_total` | Counter | Ошибки внешних API |
| `cache_hits_total` / `cache_misses_total` | Counter | Попадания/промахи кэша |

### 9.3 Health Checks

Каждый сервис предоставляет:
- `GET /health` — liveness probe (200 OK если процесс жив)
- `GET /health/ready` — readiness probe (200 OK если БД и Redis доступны)

---

## 10. CI/CD Pipeline

### 10.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: uv run ruff check .
      - run: uv run ruff format --check .
      - run: uv run mypy .

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: houston_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    strategy:
      matrix:
        service: [dashboard, finance, events, functions, dagster]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
      - run: cd services/${{ matrix.service }} && uv run pytest -v --cov

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [dashboard, finance, events, functions, dagster]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: ./services/${{ matrix.service }}
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: registry/houston-${{ matrix.service }}:latest
```

### 10.2 Deploy Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  workflow_run:
    workflows: ["CI"]
    branches: [main]
    types: [completed]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: deploy
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/houston
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
            docker compose -f docker-compose.prod.yml exec -T auth alembic upgrade head
```

---

## 11. Стратегия миграции данных

### 11.1 Этапы миграции

1. **Анализ** — маппинг полей из старых моделей в новую схему
2. **Скрипт миграции** — Python-скрипт, читающий из старых БД и записывающий в новую
3. **Dry-run** — запуск на копии данных с валидацией
4. **Инкрементальная миграция** — для таблиц с большим объёмом (clicks, conversions)
5. **Финальный переезд** — последний синк + переключение DNS

### 11.2 Маппинг справочников

Справочники из всех 4 сервисов объединяются с дедупликацией:

```
Dashboard.BuyerList + Finance.UserGroup(buyers) → shared.buyers
Dashboard.TeamList + Finance.UserGroup(teams)   → shared.teams
Dashboard.GeoList + Finance.Geo                 → shared.geos
Dashboard.OfferList + Finance.Offer             → shared.offers
Dashboard.SourceList                            → shared.sources
Dashboard.FunnelList                            → shared.funnels
Dashboard.DeviceList                            → shared.devices
Finance.Counterparty                            → shared.counterparties
Finance.PaymentSource                           → shared.payment_sources
```

### 11.3 Валидация

После миграции проверяем:
- Количество записей в старых БД = количество в новой
- Суммы (cost, revenue, payout) совпадают
- Ссылочная целостность (FK) не нарушена
- P&L-отчёты дают те же цифры на новой схеме

---

## 12. Безопасность

### 12.1 Уровни защиты

| Уровень | Механизм |
|---------|----------|
| **Сеть** | Cloudflare Zero Trust (WAF, DDoS, device posture, geo-blocking) |
| **Транспорт** | TLS 1.3 (Cloudflare → Gateway), HTTP внутри Docker network |
| **Аутентификация** | KeyCloak (OIDC/OAuth 2.0, JWT tokens) |
| **Авторизация** | RBAC через KeyCloak Realm Roles + Client Roles |
| **API Rate Limiting** | Gateway slowapi/Redis (100 req/min) + Cloudflare rate rules |
| **Секреты** | Environment variables / Doppler |
| **БД** | Schema isolation, minimal privileges per service |
| **Логирование** | Аудит в KeyCloak (login events), request tracing в сервисах |

### 12.2 Принцип минимальных привилегий

Каждый микросервис получает PostgreSQL-роль с доступом только к своей схеме:

```sql
-- Роль для Dashboard Service
CREATE ROLE houston_dashboard LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA dashboard TO houston_dashboard;
GRANT ALL ON ALL TABLES IN SCHEMA dashboard TO houston_dashboard;
GRANT USAGE ON SCHEMA shared TO houston_dashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA shared TO houston_dashboard;
-- Dashboard не может писать в finance, events, functions, auth schemas
```
