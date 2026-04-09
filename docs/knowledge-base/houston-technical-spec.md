# Houston Technical Specification — Summary

> Extracted from 01_PROJECT_OVERVIEW.md, 02_TECHNICAL_ARCHITECTURE.md, 03_EPICS.md, 04_FEATURES.md, DATASET_CONFIG.md, ECOSYSTEM.md

---

## What Houston IS

Houston is the **migration of 4 Django services into a unified FastAPI + PostgreSQL platform** for the Makeberry media buying operation.

### Current State (4 Django Apps)
| Service | Port | DB | Purpose |
|---------|------|----|---------|
| Dashboard | 8085 | PostgreSQL (DO) | Click/conversion analytics, P&L reports, buyer dashboards |
| Finance | 8087 | PostgreSQL 17 | Costs, salaries, Brocard payments, counterparties |
| Events Manager | 8084 | PostgreSQL | Event routing, FB CAPI, flow rules |
| Function Manager | 8000 | PostgreSQL | Async tasks, Keitaro integration, offer monitoring |

### Target State (FastAPI Microservices)
| Service | Port | Schema | Orchestration |
|---------|------|--------|---------------|
| API Gateway | 8000 | N/A | JWT (KeyCloak JWKS), routing, rate limiting |
| Dashboard | 8002 | dashboard | API only (Dagster for background) |
| Finance | 8003 | finance | API only (Dagster for background) |
| Events | 8004 | events | API + Celery (real-time event dispatch only) |
| Functions | 8005 | functions | API only (Dagster for background) |
| Dagster | 3001 | dagster | ALL batch/scheduled ops |
| KeyCloak | 8080 | keycloak | Identity, OIDC, RBAC |

---

## Key Architecture Decisions

1. **Single PostgreSQL, isolated schemas** (shared, dashboard, finance, events, functions, dagster, keycloak)
2. **Dagster for ALL batch jobs** — Celery only for real-time event dispatch in Events Service
3. **KeyCloak + Cloudflare Zero Trust** — no custom auth service
4. **API-first** — no Django admin panels, all through REST API + API Gateway
5. **Keitaro click sync already running in Dagster** (every 15 min, ClickHouse → PostgreSQL)

---

## Shared Database Schema (Key Tables)

### shared.* (Common Dictionaries)
- `buyers` (id, name, buyer_external_id/Keitaro, brocard_id, team_id)
- `teams` (id, name, direction_id, head_id, lead_id)
- `directions` (id, name)
- `geos` (id, name/2-letter, full_name)
- `offers` (id, name, offer_external_id, payment_model CPA/SPEND)
- `funnels`, `funnel_categories`, `sources`, `devices`, `os_list`, `browsers`
- `counterparties`, `payment_sources`
- `user_profiles` (keycloak_id, email, team_id, buyer_id)

### dashboard.* (Analytics)
- `clicks` (PARTITIONED by month, 30+ fields, ~millions of rows)
- `conversions` (linked to clicks, from Scaleo)
- `buyer_tech_costs`, `cohort_rules`, `pnl_reports`
- `mv_buyer_dashboard` (materialized view)

### finance.* (Money)
- `daily_costs`, `tech_costs`, `global_tech_costs`
- `brocard_operations`, `counterparty_costs`, `counterparty_balances`
- `user_salaries`, `salary_operations` (1.3x coefficient)

### events.* (Routing)
- `campaigns` (alias, domain, method), `flows`, `rules`, `actions`, `action_mappings`
- `fb_tokens`, `fb_users`, `fb_logs`, `streams`, `applications`
- `request_logs`, `action_logs` (both PARTITIONED)

### functions.* (Tasks)
- `available_offers`, `offer_conversions`, `task_configs`, `task_logs`

---

## Dagster Assets (Data Pipeline)

### Already Running ✓
- `keitaro_clicks` (every 15 min) — ClickHouse → PostgreSQL
- `scaleo_conversions` (every 15 min)

### To Build
- `linked_conversions` → join clicks + conversions
- `rule_revenue` → apply CohortRules
- `tech_costs_sync` (hourly) → pull from Finance
- `materialized_views` (every 30 min)
- `brocard_operations` (hourly)
- `exchange_rates` (daily)
- `salary_operations_generation` (monthly)
- `events_log_cleanup` (daily)
- `offer_conversions_collection` (every 15 min)

---

## Ecosystem (40+ Services)

### Traffic Flow
```
Meta Ads → meta-mind-extension (Chrome) → Keitaro 11 (click) →
fs-cloak-proxy-worker (CF Worker, bot detection) →
fp-smart-link-worker (A/B, geo) →
upbase/JustLink (user identification) →
Landing/PWA (fs-template-*, pwa_new) →
fp-analytics-tracker (browser events) →
fp-analytics-api → PostgreSQL →
dagster ETL (ClickHouse → PostgreSQL) →
dashboard (BI)
```

### Key External Systems
| System | Purpose | Data |
|--------|---------|------|
| **Keitaro 11** | Central tracker | Clicks, redirects, postbacks, ClickHouse events |
| **Meta Ads** | Ad campaigns | via meta-mind-extension (Chrome) |
| **Scaleo** | Affiliate network | Conversions, payouts |
| **Brocard** | Payments | Card operations, balances |
| **Cloudflare** | Edge compute | Workers (cloaking, routing), D1 (SQL), KV |
| **Facebook Graph API** | CAPI/SSAPI | Event dispatch, pixel tracking |

---

## Dataset Config (ML Pipeline)

**Grain**: 1 row = 1 campaign_id × 1 ISO-week

### 8 Data Blocks
1. Keys & Time (campaign_id, period)
2. Campaign Config (geo, cloak, A/B, domain)
3. PWA Template (constructor, display elements, flow)
4. Funnel & Stream Stats (from Keitaro Helper)
5. Traffic Metrics (page views, sessions, device split, geo concentration)
6. Conversion Funnel (CTA installs, opens, rates)
7. Revenue & Profit (revenue, cost, profit, ROI — **ML targets**)
8. Finance Spend (manual daily costs, buyer input)

### Critical Data Fixes Needed
- FIX-1: No FK `pwa_campaign → keitaro_campaign` (3-step string JOIN)
- FIX-2: No FK `analytics_pwa_event → campaign_id` (domain name match)
- FIX-5: Missing index on Finance `daily_costs` (full table scan)

---

## Epics & Timeline

| Epic | Duration | Team | Status |
|------|----------|------|--------|
| E1 Infra & DevOps | 3-4 weeks | DevOps + Backend | Planning |
| E2 Shared Library | 2-3 weeks | Senior Backend | Planning |
| E3 KeyCloak + CF ZT | 2-3 weeks | DevOps + Backend | Planning |
| E4 API Gateway | 1-2 weeks | Backend | Planning |
| E5 Dagster Orchestrator | 3-4 weeks | Senior Backend | Partially done (click/conv sync) |
| E6 Dashboard Service | 4-6 weeks | 2 Backend | Planning |
| E7 Finance Service | 4-5 weeks | 1-2 Backend | Planning |
| E8 Events Service | 4-6 weeks | 1-2 Backend | Planning |
| E9 Functions Service | 2-3 weeks | 1 Backend | Planning |
| E10 Data Migration | 3-4 weeks | Backend + DBA | Planning |
| E11 Monitoring | 2-3 weeks | DevOps | Planning |
| E12 Testing | 3-5 weeks | QA + Backend | Planning |
| E13 Deploy & Switch | 2-3 weeks | DevOps + Backend | Planning |

**Total**: 224 features, 33-48 work-weeks, 24-32 calendar weeks with 5-person team.

---

## How MCC Panel Connects to Houston

### Our panel (MCC) reads FROM Houston:
1. **Dashboard schema** → campaign performance, click/conversion metrics, P&L
2. **Finance schema** → spend, costs, budget tracking
3. **shared schema** → buyers, teams, offers, geos (dictionaries)
4. **Dagster** → pipeline status, last sync times

### Our panel ADDS on top:
1. **Buying Problems Tracker** → not in Houston
2. **Alert system with escalation** → not in Houston
3. **Management Overview** → aggregates Houston data for CEO/VP view
4. **Process tracking** → hypothesis lifecycle (not in Houston)

### Integration Strategy
- **Phase 0**: MCC works standalone (manual input + Keitaro direct)
- **Phase 1**: MCC connects to Houston PostgreSQL (read-only) when available
- **Phase 2+**: MCC uses Houston API Gateway once it's deployed
- **Long term**: MCC becomes the frontend layer for Houston operational data
