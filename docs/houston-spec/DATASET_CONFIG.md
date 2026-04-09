# Dataset Contract: Campaign & Funnel Performance

**Version:** 1.4.0
**Grain:** 1 row = 1 `campaign_id` × 1 `period` (default: weekly ISO-week)
**Primary key:** `campaign_id` + `period_start`
**Last updated:** 2026-03-09

---

## Data Sources

| Alias | System | Tables |
|-------|--------|--------|
| `ADMIN` | fs-admin PostgreSQL | `pwa_campaign`, `pwa_constructor`, `pwa_smart_link`, `pwa_smart_link_variants`, `pwa_campaign_geo`, `pwa_domain`, `pwa_flow_configuration` |
| `HLPR` | hlpr PostgreSQL | `keitaro_campaign`, `keitaro_funnel`, `keitaro_funnelstatistic`, `keitaro_stream`, `keitaro_stream_geos`, `keitaro_stream_landings`, `keitaro_stream_offers`, `keitaro_trafficsource`, `keitaro_funneltype` |
| `EVENTS` | fp-analytics-api PostgreSQL | `analytics_pwa_event` |
| `KEITARO` | mb_keitaro_events → `raw_keitaro_events` | cost (clicks) + revenue (conversions) |
| `FINANCE` | finance v1 → `keitaro_structure_dailycost` | actual ad spend per campaign per day (manual buyer input); `campaign_id` NOT NULL (verified v1.4) |

**Known event names** (`analytics_pwa_event.event_name`):

| Value | Meaning |
|-------|---------|
| `lp_view` | Impression на black page (реальный пользователь) |
| `wt_page_view` | White page impression (бот / фильтрованный трафик) |
| `pwa_view` | PWA страница открыта |
| `cta_btn_install` | Клик «Install» |
| `cta_btn_open` | Клик «Open Offer» — финальная конверсия в воронке |

**JOIN-цепочка для маппинга источников:**
```sql
-- EVENTS → ADMIN (через domain)
analytics_pwa_event.host = pwa_domain.name          -- ⚠️ строковый матч, нет FK
pwa_domain.id = pwa_campaign.domain_id

-- HLPR → ADMIN (через keitaro_id + domain)
keitaro_campaign.keitaro_id = raw_keitaro_events.campaign_id
raw_keitaro_events.domain = pwa_domain.name          -- ⚠️ строковый матч, нет FK
pwa_domain.id = pwa_campaign.domain_id

-- ⚠️ ВНИМАНИЕ: keitaro_campaign.domain_id → keitaro_domain (НЕ pwa_domain)
-- Это отдельная сущность. При расхождении доменов между системами JOIN молча теряет строки.

-- HLPR → HLPR (funnel stats)
keitaro_campaign.id = keitaro_funnel.campaign_id
keitaro_funnel.id = keitaro_funnelstatistic.funnel_id
keitaro_campaign.id = keitaro_stream.campaign_id
keitaro_stream.id = keitaro_stream_offers.stream_id
keitaro_stream.id = keitaro_stream_landings.stream_id
```

> **⚠️ Риск потери данных:** оба строковых матча (`host = pwa_domain.name`, `domain = pwa_domain.name`) не имеют FK-защиты. При переименовании домена события за старое имя перестают маппиться на кампанию без ошибки — строки просто выпадают. Добавить DQ-проверку: `COUNT(events без JOIN) / COUNT(all events)` — если > 1%, алерт.

---

## Schema

### Block 1 — Keys & Time

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `campaign_id` | `VARCHAR(10)` | NO | ADMIN | `pwa_campaign.identifier` |
| `period_start` | `DATE` | NO | computed | Начало ISO-недели (Monday) |
| `period_end` | `DATE` | NO | computed | Конец ISO-недели (Sunday) |
| `campaign_age_days` | `INT` | NO | ADMIN | `period_start - pwa_campaign.created` |
| `smart_link_id` | `VARCHAR(10)` | YES | ADMIN | `pwa_smart_link.identifier` если кампания в A/B сете |
| `is_active` | `BOOL` | NO | ADMIN | `pwa_campaign.is_active` |

---

### Block 2 — Campaign Config (static)

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `geo_tier` | `ENUM('T1','T2','T3','mixed')` | NO | ADMIN + ref | Tier по `pwa_geo.code` через `pwa_campaign_geo` |
| `geo_count` | `INT` | NO | ADMIN | `COUNT(*) FROM pwa_campaign_geo WHERE campaign_id=?` |
| `geo_list` | `VARCHAR[]` | NO | ADMIN | `ARRAY_AGG(pwa_geo.code)` через `pwa_campaign_geo` |
| `ios_blocked` | `BOOL` | NO | ADMIN | `pwa_campaign.ios_block_enabled` |
| `desktop_blocked` | `BOOL` | NO | ADMIN | `pwa_campaign.desktop_block_enabled` |
| `cloak_enabled` | `BOOL` | NO | ADMIN | `pwa_campaign.cloak_enabled` |
| `transfer_enabled` | `BOOL` | NO | ADMIN | `pwa_campaign.transfer_enabled` |
| `ab_test_enabled` | `BOOL` | NO | ADMIN | `pwa_smart_link.ab_test_enabled` (JOIN через `pwa_smart_link_variants.campaign_id`) |
| `ab_variant_count` | `INT` | NO | ADMIN | `COUNT(*) FROM pwa_smart_link_variants WHERE smart_link_id=?` |
| `ab_weight_entropy` | `FLOAT` | YES | computed | Shannon entropy `pwa_smart_link_variants.weight`; `NULL` если `ab_test_enabled=false` |
| `domain_zone` | `VARCHAR(20)` | NO | ADMIN | TLD из `pwa_domain.name` |
| `hlpr_campaign_type` | `VARCHAR(50)` | YES | HLPR | `keitaro_campaign.campaign_type` |
| `hlpr_funnel_type` | `VARCHAR(100)` | YES | HLPR | `keitaro_funneltype.name` через `keitaro_campaign.funnel_type_id` |
| `hlpr_funnel_status` | `VARCHAR(20)` | YES | HLPR | `keitaro_funnel.status` (active / integration / awaiting / pending / returned / banned / disabled) |
| `hlpr_traffic_source_type` | `VARCHAR(50)` | YES | HLPR | `keitaro_trafficsource.type` через `keitaro_campaign.traffic_source_id` |

**`ab_weight_entropy` formula:**
```
H = -SUM(w_i * log2(w_i))  где w_i = pwa_smart_link_variants.weight / 100
```
0 = весь трафик на 1 вариант; max = равномерное распределение.

---

### Block 3 — PWA Template Attributes

> Таблица `pwa_constructor` (в коде — `PwaTemplate`). JOIN: `pwa_constructor.domain_id = pwa_campaign.domain_id`.
> **⚠️ Grain risk:** если у домена несколько конструкторов (draft + published), JOIN даёт дубли строк. Всегда добавлять `WHERE pwa_constructor.status = 'published'` и проверять `COUNT(constructor per domain) = 1`.

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `template_type` | `VARCHAR(50)` | YES | ADMIN | `pwa_template_type.name` через `pwa_constructor.template_type_id` |
| `template_theme_id` | `INT` | YES | ADMIN | `pwa_constructor.template_theme_id` |
| `template_status` | `VARCHAR(50)` | NO | ADMIN | `pwa_constructor.status` (draft / publishing / published / ...) |
| `constructor_is_active` | `BOOL` | NO | ADMIN | `pwa_constructor.is_active` |
| `constructor_is_archived` | `BOOL` | NO | ADMIN | `pwa_constructor.is_archived` |
| `displayed_rating` | `NUMERIC(2,1)` | NO | ADMIN | `pwa_constructor.rating` ∈ [1.0, 5.0] |
| `displayed_reviews` | `INT` | NO | ADMIN | `pwa_constructor.review_count` |
| `displayed_downloads` | `INT` | NO | ADMIN | `pwa_constructor.download_count` |
| `file_size_mb` | `NUMERIC(10,2)` | NO | ADMIN | `pwa_constructor.file_size` — отображаемый размер файла |
| `download_time_sec` | `INT` | NO | ADMIN | `pwa_constructor.download_time` — отображаемое время загрузки |
| `age_rating_id` | `INT` | NO | ADMIN | `pwa_constructor.age_rating_id` |
| `app_last_updated` | `DATE` | NO | ADMIN | `pwa_constructor.last_updated` — отображаемая дата обновления приложения |
| `has_pixel` | `BOOL` | NO | ADMIN | `pwa_constructor.pixel_id IS NOT NULL AND pixel_id != ''` |
| `comments_enabled` | `BOOL` | NO | ADMIN | `pwa_constructor.comments_enabled` |
| `comments_count` | `INT` | NO | ADMIN | `pwa_constructor.comments_count`; значимо только если `comments_enabled=true` |
| `contains_ads` | `BOOL` | NO | ADMIN | `pwa_constructor.contains_ads` — отображаемый флаг «содержит рекламу» |
| `editors_choice` | `BOOL` | NO | ADMIN | `pwa_constructor.editors_choice` — бейдж «выбор редакции» |
| `show_verify_badge` | `BOOL` | NO | ADMIN | `pwa_constructor.show_verify_badge` |
| `show_verify_app_badge` | `BOOL` | NO | ADMIN | `pwa_constructor.show_verify_app_badge` |
| `promo_video_enabled` | `BOOL` | NO | ADMIN | `pwa_constructor.promo_video_enabled` |
| `similar_games_enabled` | `BOOL` | NO | ADMIN | `pwa_constructor.similar_games_enabled` |
| `more_by_developer` | `BOOL` | NO | ADMIN | `pwa_constructor.more_by_developer` |
| `landing_header` | `BOOL` | NO | ADMIN | `pwa_constructor.landing_header` |
| `add_to_favorites` | `BOOL` | NO | ADMIN | `pwa_constructor.add_to_favorites` |
| `is_landing_transit` | `BOOL` | NO | ADMIN | `pwa_flow_configuration.is_landing_transit` через `pwa_constructor.id` |
| `install_flow_id` | `INT` | YES | ADMIN | `pwa_flow_configuration.install_flow_id` |

> **Верифицировано по схеме БД (v1.3):** поля `similar_games_enabled`, `promo_video_enabled`, `more_by_developer`, `landing_header`, `contains_ads`, `editors_choice`, `show_verify_badge`, `file_size` — прямые колонки таблицы `pwa_constructor`, **не JSONB**. Поле `config JSONB` существует, но его содержимое отдельно от перечисленных колонок.

---

### Block 4 — hlpr Stream & Funnel Stats

> Из HLPR PostgreSQL. Период агрегации: `keitaro_funnelstatistic.interval` фильтруется по нужному диапазону.
> **⚠️ Формат `interval`:** тип `VARCHAR(100)` — конкретный формат (ISO-week / date / month) не задокументирован. Требует `SELECT DISTINCT interval FROM keitaro_funnelstatistic LIMIT 20` для верификации до использования. Граница периодов может не совпадать с ISO-week границами Block 5–7.
> **⚠️ Агрегация по нескольким воронкам:** кампания может иметь несколько фуннелей (в т.ч. banned/disabled). SUM по всем фуннелям завышает метрики. Фильтровать: `WHERE keitaro_funnel.status = 'active'`.

**Lifecycle & Config воронки:**

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `funnel_count` | `INT` | YES | HLPR | `COUNT(*) FROM keitaro_funnel WHERE campaign_id=?` |
| `active_funnel_count` | `INT` | YES | HLPR | `COUNT(*) WHERE status='active'` |
| `funnel_age_days` | `INT` | YES | HLPR | `period_start - MIN(keitaro_funnel.created_at)` — возраст старейшей активной воронки |
| `funnel_buyers_count` | `INT` | YES | HLPR | `SUM(keitaro_funnel.buyers_count)` для активных воронок |
| `funnel_has_white_landing` | `BOOL` | YES | HLPR | `white_landing_id IS NOT NULL` для активной воронки |

**Stream Config:**

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `stream_count` | `INT` | YES | HLPR | `COUNT(*) FROM keitaro_stream WHERE campaign_id=?` |
| `active_stream_count` | `INT` | YES | HLPR | `COUNT(*) WHERE enabled=true` |
| `stream_flow_type` | `VARCHAR(50)` | YES | HLPR | `keitaro_stream.flow_type` — берётся у первого активного стрима; если стримов несколько, см. `stream_count` |
| `stream_geos_count` | `INT` | YES | HLPR | `COUNT(*) FROM keitaro_stream_geos` для активных стримов |
| `stream_has_offers` | `BOOL` | YES | HLPR | `EXISTS(SELECT 1 FROM keitaro_stream_offers WHERE stream_id IN (active streams))` |
| `stream_has_landings` | `BOOL` | YES | HLPR | `EXISTS(SELECT 1 FROM keitaro_stream_landings WHERE stream_id IN (active streams))` |

**Funnel Statistics (только активные воронки, только активный период):**

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `funnel_clicks` | `INT` | YES | HLPR | `SUM(keitaro_funnelstatistic.clicks)` за период, только `status='active'` воронки |
| `funnel_unique_clicks` | `INT` | YES | HLPR | `SUM(keitaro_funnelstatistic.campaign_unique_clicks)` за период |
| `funnel_conversions` | `INT` | YES | HLPR | `SUM(keitaro_funnelstatistic.conversions)` за период |
| `funnel_sales` | `INT` | YES | HLPR | `SUM(keitaro_funnelstatistic.sales)` за период |
| `funnel_cr` | `FLOAT` | YES | computed | `funnel_conversions / NULLIF(funnel_unique_clicks, 0)` — **не использовать как фичу в Task 3/4 (leakage)** |

---

### Block 5 — Traffic Metrics

> Агрегация из `analytics_pwa_event` за период. JOIN: `analytics_pwa_event.host = pwa_domain.name → pwa_campaign.domain_id`.

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `lp_views` | `INT` | NO | EVENTS | `COUNT(*) WHERE event_name='lp_view'` |
| `wt_page_views` | `INT` | NO | EVENTS | `COUNT(*) WHERE event_name='wt_page_view'` |
| `pwa_views` | `INT` | NO | EVENTS | `COUNT(*) WHERE event_name='pwa_view'` |
| `unique_users` | `INT` | NO | EVENTS | `COUNT(DISTINCT upid)` |
| `unique_sessions` | `INT` | NO | EVENTS | `COUNT(DISTINCT sid)` |
| `white_ratio` | `FLOAT` | NO | computed | `wt_page_views / (lp_views + wt_page_views)` |
| `mobile_share` | `FLOAT` | NO | EVENTS | `COUNT(*) FILTER (WHERE dvc='mobile') / COUNT(*)` |
| `desktop_share` | `FLOAT` | NO | EVENTS | `COUNT(*) FILTER (WHERE dvc='desktop') / COUNT(*)` |
| `top_geo` | `VARCHAR(2)` | YES | EVENTS | ISO-код страны #1 по `lp_view` из `locale`; приоритет: `locale` > `utm->>'country'` |
| `geo_hhi` | `FLOAT` | NO | computed | HHI гео-концентрации: `SUM((share_i)^2)` |
| `organic_share` | `FLOAT` | NO | EVENTS | Доля сессий без `sub1` и без `referrer` — **ненадёжна**: платный трафик без UTM выглядит органикой |
| `top_utm_source` | `VARCHAR(100)` | YES | EVENTS | Топ `utm->>'utm_source'` по объёму |
| `source_diversity` | `INT` | NO | EVENTS | `COUNT(DISTINCT utm->>'utm_source')` |
| `avg_session_depth` | `FLOAT` | NO | EVENTS | `COUNT(*) / COUNT(DISTINCT sid)` |
| `bounce_rate` | `FLOAT` | NO | computed | `sessions_with_1_event / unique_sessions` |
| `top_os` | `VARCHAR(50)` | YES | KEITARO | OS #1 по объёму кликов (`raw_keitaro_events.os`) |
| `cellular_share` | `FLOAT` | YES | KEITARO | `COUNT(*) FILTER (WHERE connection_type='cellular') / total_clicks` |
| `proxy_clicks_share` | `FLOAT` | YES | KEITARO | `SUM(is_using_proxy) / NULLIF(total_clicks, 0)` — доля прокси-трафика |
| `events_join_loss_rate` | `FLOAT` | NO | computed | `COUNT(events без JOIN на campaign) / COUNT(all events для домена)` — DQ-метрика строковых JOIN |

---

### Block 6 — Conversion Funnel Metrics

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `cta_installs` | `INT` | NO | EVENTS | `COUNT(*) WHERE event_name='cta_btn_install'` |
| `cta_opens` | `INT` | NO | EVENTS | `COUNT(*) WHERE event_name='cta_btn_open'` |
| `ctr_install` | `FLOAT` | NO | computed | `cta_installs / NULLIF(lp_views, 0)` |
| `ctr_open` | `FLOAT` | NO | computed | `cta_opens / NULLIF(lp_views, 0)` — CR основной конверсии |
| `install_to_open_rate` | `FLOAT` | YES | computed | `cta_opens / NULLIF(cta_installs, 0)` |

---

### Block 7 — Revenue & Profit (ML targets)

> **⚠️ Revenue lookback bias:** конверсии последних 2+ дней периода ещё не `approved` на момент T+2. Для недель с `revenue_coverage_pct < 0.85` revenue систематически занижен. Исключать из обучения до достижения порога.

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `revenue_total` | `DECIMAL(12,2)` | YES | KEITARO | `SUM(revenue) WHERE event_type='conversion' AND status='approved' AND is_bot=0` |
| `pending_revenue` | `DECIMAL(12,2)` | YES | KEITARO | `SUM(revenue) WHERE event_type='conversion' AND status='pending' AND is_bot=0` |
| `rejected_revenue` | `DECIMAL(12,2)` | YES | KEITARO | `SUM(revenue) WHERE event_type='conversion' AND status='rejected' AND is_bot=0` |
| `revenue_coverage_pct` | `FLOAT` | YES | computed | `revenue_total / NULLIF(revenue_total + pending_revenue, 0)` — % закрытости периода |
| `rebills_total` | `INT` | YES | KEITARO | `SUM(rebills) WHERE event_type='conversion' AND status='approved' AND is_bot=0` — повторные биллинги |
| `cost_total` | `DECIMAL(12,2)` | YES | KEITARO | `SUM(cost) WHERE event_type='click' AND is_bot=0 AND is_unique_campaign=1` |
| `profit` | `DECIMAL(12,2)` | YES | computed | `revenue_total - cost_total` — **primary target** |
| `profit_log` | `FLOAT` | YES | computed | `SIGN(profit) * log1p(ABS(profit))` — log-scale target для регрессии (правый хвост) |
| `roi` | `FLOAT` | YES | computed | `profit / NULLIF(cost_total, 0)` |
| `revenue_per_user` | `DECIMAL(8,4)` | YES | computed | `revenue_total / NULLIF(unique_users, 0)` |

---

## ML Task Mapping

### Task 1 — Campaign Clustering

```
Features:  Block 2 + Block 5 + Block 6 + Block 7
Target:    unsupervised (cluster_id)
Algorithm: K-Means / DBSCAN / GMM
Filter:    lp_views >= 100
Exclude:   is_active=false, campaign_age_days < 7
```

### Task 2 — Funnel Set Clustering

```
Features:  Block 3 + Block 4 (статические атрибуты)
Target:    unsupervised (funnel_cluster_id)
Algorithm: Hierarchical Clustering + Silhouette для выбора K
```

### Task 3 — Funnel Parameter → Profit Impact

```
Features:  Block 3 + Block 2 (контекст)
           Block 4 — ТОЛЬКО лаговые значения (prev_period), НЕ текущего периода
           ⚠️ funnel_cr, funnel_conversions, funnel_clicks — LEAKAGE, исключить
Target:    profit_log (регрессия) / roi > 0 (classification)
Algorithm: LightGBM + SHAP values
Filter:    cost_total > 0 AND lp_views >= 200 AND revenue_coverage_pct >= 0.85
Interpret: SHAP summary plot → топ атрибуты LP → прибыль
```

### Task 4 — Funnel Setup Prediction (Profit Maximization)

```
Features:  Block 2 (geo_tier, hlpr_campaign_type, hlpr_traffic_source_type, ...)
           предсказать Block 3 + Block 4 конфиг
Target:    profit_log (regression) или roi > threshold (classification)
Algorithm: LightGBM Regressor + Optuna гиперопт конфига
Filter:    revenue_coverage_pct >= 0.85 AND cost_total > 0
Use case:  Для заданного гео + типа трафика → рекомендовать LP конфиг
⚠️ Selection bias: операторы уже оптимизируют конфиг руками → модель учит
   текущие предпочтения, а не оптимум. Учитывать при интерпретации SHAP.
```

---

## Data Quality Rules

| Rule | Check | Severity |
|------|-------|----------|
| No duplicate grain | `(campaign_id, period_start)` — UNIQUE | CRITICAL |
| Active campaign | `pwa_campaign.is_active = true` | CRITICAL |
| Positive impressions | `lp_views >= 0` | CRITICAL |
| Age campaign | `campaign_age_days >= 0` | CRITICAL |
| Constructor uniqueness | `COUNT(pwa_constructor WHERE domain_id=X AND status='published') = 1` — иначе дубли строк | CRITICAL |
| Rate bounds | Все `*_rate`, `*_share`, `*_ratio` ∈ [0, 1] | ERROR |
| Profit consistency | `profit = revenue_total - cost_total` ± 0.01 | ERROR |
| Rating bounds | `displayed_rating` ∈ [1.0, 5.0] | ERROR |
| Revenue coverage | `revenue_coverage_pct >= 0.85` для train set; строки ниже порога — exclude | ERROR |
| Events join loss | `events_join_loss_rate < 0.01` — иначе строки теряются при строковом матче | ERROR |
| Minimum volume | `lp_views >= 100` для clustering, `>= 200` для Task 3/4 | WARNING |
| White ratio anomaly | `white_ratio > 0.7` → флаг `is_cloaking_issue = true` | WARNING |
| Missing cost | `cost_total IS NULL` → исключить из Task 3/4 | WARNING |
| Revenue lag check | `pending_revenue > revenue_total * 0.5` → данные неполные | WARNING |
| Funnel count check | `active_funnel_count = 0` при наличии `funnel_clicks > 0` → аномалия маппинга | WARNING |
| Proxy traffic | `proxy_clicks_share > 0.3` → трафик подозрителен | WARNING |
| Finance spend delta | `ABS(finance_cost_delta) > 0.5` → расхождение расходов > 50% (Finance vs Keitaro) | WARNING |
| Finance data absent | `finance_entries = 0 AND cost_total > 0` → баер не ввёл расходы за период | INFO |
| Finance status | `finance_status_ok_pct < 0.8` → >20% записей с неизвестным status → возможны некорректные суммы | WARNING |

---

## Computed Columns Reference

```sql
-- ab_weight_entropy
weights = [w/100 for w in pwa_smart_link_variants.weight if w > 0]
entropy  = -SUM(w * log2(w) for w in weights)
-- 0 = весь трафик на 1 вариант; max = равномерное распределение

-- white_ratio
white_ratio = wt_page_views / NULLIF(lp_views + wt_page_views, 0)

-- geo_hhi
-- shares = COUNT(lp_view) per locale / total lp_views
hhi = SUM(share_i ^ 2)  -- 1.0 = весь трафик из одной страны

-- bounce_rate
bounce_rate = sessions_with_1_event / NULLIF(unique_sessions, 0)

-- funnel_cr  ⚠️ использовать ТОЛЬКО как lag-фичу, не как фичу текущего периода в Task 3/4
funnel_cr = funnel_conversions / NULLIF(funnel_unique_clicks, 0)

-- profit / roi
profit = revenue_total - cost_total
roi    = profit / NULLIF(cost_total, 0)

-- profit_log (для ML-регрессии, правый хвост)
profit_log = SIGN(profit) * log(1 + ABS(profit))

-- revenue_coverage_pct
revenue_coverage_pct = revenue_total / NULLIF(revenue_total + pending_revenue, 0)

-- revenue_per_user
revenue_per_user = revenue_total / NULLIF(unique_users, 0)

-- funnel_age_days
funnel_age_days = period_start - MIN(keitaro_funnel.created_at AT TIME ZONE 'UTC')::DATE
-- берётся минимум по активным воронкам кампании

-- events_join_loss_rate (DQ-метрика)
events_join_loss_rate = COUNT(*) FILTER (WHERE campaign_id IS NULL)
                      / NULLIF(COUNT(*), 0)
-- считается до JOIN, после LEFT JOIN на pwa_domain

-- finance_cost_delta (DQ-метрика расхождения источников расходов)
finance_cost_delta = (finance_spend - cost_total) / NULLIF(ABS(cost_total), 0)
-- > 0.5 → финансовые расходы на 50%+ выше Keitaro (возможна ошибка ввода или смешение кампаний)
-- < -0.5 → в Keitaro больше расходов чем в Finance (неполный ввод баера)
-- NULL если finance_entries = 0 (данных Finance нет)
```

---

### Block 8 — Finance Spend (условно, требует верификации JOIN)

> **Источник:** Finance v1 → `keitaro_structure_dailycost`
> **JOIN:** `DailyCost.campaign_id` → `keitaro_campaign.keitaro_id` (текстовый матч, ручной ввод)
> **Качество:** Средняя надёжность — ручной ввод баером, возможны опечатки.
> **Верифицировано v1.4:** `campaign_id` — NOT NULL в схеме (схема не допускает пропусков).
> **⚠️ Нет индекса по `(campaign_id, date)`** — агрегация за период будет full scan. Добавить индекс перед пайплайном.

| Field | Type | Nullable | Source | SQL Reference |
|-------|------|----------|--------|---------------|
| `finance_spend` | `DECIMAL(12,2)` | YES | FINANCE | `SUM(dc.sum) FROM keitaro_structure_dailycost dc WHERE dc.campaign_id=? AND dc.date BETWEEN period_start AND period_end` |
| `finance_entries` | `INT` | YES | FINANCE | `COUNT(*) FROM keitaro_structure_dailycost WHERE campaign_id=? AND date IN period` |
| `finance_cost_delta` | `FLOAT` | YES | computed | `(finance_spend - cost_total) / NULLIF(ABS(cost_total), 0)` — расхождение ручного учёта vs Keitaro |
| `ad_campaign_ids` | `VARCHAR[]` | YES | FINANCE | `ARRAY_AGG(DISTINCT ad_campaign_id) FROM keitaro_structure_dailycost WHERE campaign_id=?` |
| `finance_geos` | `VARCHAR[]` | YES | FINANCE | Гео через M2M `keitaro_structure_dailycost_geos` → `keitaro_structure_geo.code` |
| `buyer_count` | `INT` | YES | FINANCE | `COUNT(DISTINCT buyer_id) FROM keitaro_structure_dailycost WHERE campaign_id=? AND date IN period` |
| `finance_status_ok_pct` | `FLOAT` | YES | computed | Доля записей с `status IS NULL OR status = 'ok'` — фильтрация невалидных строк |

**⚠️ Ограничения:**
- `finance_spend` — **фактические расходы**, не бюджетный лимит (лимитов в системе нет)
- `DailyCost.campaign_id` — ручной ввод, NULL допустим → требует DQ-проверки
- JOIN `DailyCost` → `keitaro_campaign` через текст, не FK → возможны потери при опечатках
- Перед использованием верифицировать: `SELECT COUNT(*) FILTER (WHERE campaign_id IS NULL) / COUNT(*) FROM dailycost`

**JOIN для Block 8:**
```sql
-- Finance v1
-- ⚠️ Нет индекса по (campaign_id, date) — создать перед пайплайном:
-- CREATE INDEX IF NOT EXISTS idx_dailycost_campaign_date
--   ON keitaro_structure_dailycost (campaign_id, date);

SELECT
    dc.campaign_id,
    SUM(dc.sum)              AS finance_spend,
    COUNT(*)                 AS finance_entries,
    ARRAY_AGG(DISTINCT dc.ad_campaign_id) FILTER (WHERE dc.ad_campaign_id IS NOT NULL AND dc.ad_campaign_id != '') AS ad_campaign_ids,
    COUNT(DISTINCT dc.buyer_id) AS buyer_count,
    COUNT(*) FILTER (WHERE dc.status IS NULL OR dc.status = 'ok')::float / NULLIF(COUNT(*), 0) AS finance_status_ok_pct,
    ARRAY_AGG(DISTINCT g.code)  AS finance_geos
FROM keitaro_structure_dailycost dc
LEFT JOIN keitaro_structure_dailycost_geos dcg ON dcg.dailycost_id = dc.id
LEFT JOIN keitaro_structure_geo g ON g.id = dcg.geo_id
WHERE dc.campaign_id = :keitaro_campaign_id
  AND dc.date BETWEEN :period_start AND :period_end
GROUP BY dc.campaign_id

-- Computed
finance_cost_delta = (finance_spend - cost_total) / NULLIF(ABS(cost_total), 0)
```

---

## Update Frequency & Latency

| Block | Frequency | Expected Lag | Note |
|-------|-----------|--------------|------|
| Block 1–3 (static config) | On campaign change | < 1 min (event-driven) | ⚠️ Snapshot не хранится — config всегда текущий |
| Block 4 (hlpr stream/funnel) | Daily batch | T+1 day | ⚠️ Формат `interval` требует верификации |
| Block 5 (traffic) | Daily batch | T+1 day | |
| Block 6 (conversions funnel) | Daily batch | T+1 day | |
| Block 7 (revenue/cost) | Daily batch | T+2 days (Keitaro lag) | Использовать `revenue_coverage_pct` для контроля полноты |
| Block 8 (finance spend) | Manual entry (daily) | T+0 to T+7 | Задержка зависит от баера; `finance_entries=0` → данных нет |

---

## Service Integration Requirements

Требования к изменениям в сервисах для устойчивой сборки датасета. Сгруппированы по сервису и приоритету.

---

### FIX-1 · fs-admin: добавить `keitaro_campaign_id` в `pwa_campaign`

**Сервис:** fs-admin
**Приоритет:** КРИТИЧНЫЙ
**Проблема:** Нет прямой связи между `pwa_campaign` (ADMIN) и `keitaro_campaign` (HLPR). Текущий JOIN идёт через цепочку `pwa_campaign.domain_id → pwa_domain.name ← keitaro_campaign` — три шага через строковый матч без FK.
**Последствие:** При расхождении доменов между системами JOIN молча теряет строки Block 4. Невозможно надёжно гарантировать, что HLPR-метрики относятся к правильной кампании.

**Требуемые изменения:**

```sql
-- fs-admin: добавить колонку
ALTER TABLE pwa_campaign ADD COLUMN keitaro_campaign_id VARCHAR(50);
CREATE INDEX idx_pwa_campaign_keitaro_id ON pwa_campaign(keitaro_campaign_id);

-- Заполнить через существующий строковый матч (один раз):
UPDATE pwa_campaign pc
SET keitaro_campaign_id = kc.keitaro_id
FROM pwa_domain pd
JOIN km_helper.keitaro_campaign kc ON kc.domain_id = ...  -- через общее доменное имя
WHERE pc.domain_id = pd.id;
```

**Итог:** JOIN `pwa_campaign.keitaro_campaign_id = keitaro_campaign.keitaro_id` — прямой, без промежуточных таблиц, без строкового матча на домене.

---

### FIX-2 · fp-analytics-api: добавить `campaign_id` в `analytics_pwa_event`

**Сервис:** fp-analytics-api
**Приоритет:** КРИТИЧНЫЙ
**Проблема:** События в `analytics_pwa_event` привязаны к кампании только через `host = pwa_domain.name` — строковый матч без FK. При переименовании домена события за старое имя необратимо теряются при JOIN.
**Последствие:** `events_join_loss_rate > 0` не поддаётся ретроспективному восстановлению. Block 5 и Block 6 теряют исторические данные без алерта.

**Требуемые изменения:**

```sql
-- fp-analytics-api: добавить колонку
ALTER TABLE analytics_pwa_event ADD COLUMN campaign_id VARCHAR(10);
CREATE INDEX idx_pwa_event_campaign_id ON analytics_pwa_event(campaign_id, created_at);

-- При записи события: резолвить campaign_id в момент приёма запроса
-- через lookup: host → pwa_domain.name → pwa_campaign.identifier
-- и писать campaign_id сразу в строку события
```

**Дополнительно:** ретроспективный бэкфил через `UPDATE ... SET campaign_id = ... FROM pwa_domain WHERE host = pwa_domain.name`. Не восстановит строки с уже переименованными доменами, но закроет проблему на будущее.

**Итог:** JOIN `analytics_pwa_event.campaign_id = pwa_campaign.identifier` — прямой, независимый от доменного имени.

---

### FIX-3 · fs-admin: добавить `pwa_constructor_history` (snapshot-таблица)

**Сервис:** fs-admin
**Приоритет:** ВЫСОКИЙ
**Проблема:** `pwa_constructor` хранит только текущий конфиг шаблона. При изменении лендинга (рейтинг, значки, trust-элементы) история не сохраняется. Для периодов в прошлом блок 3 отражает текущий, а не фактический конфиг.
**Последствие:** Temporal leakage в ML: фичи Block 3 и target Block 7 относятся к разным состояниям воронки. Модель учится на некорректных парах (feature, label).

**Требуемые изменения:**

```sql
-- Вариант A: Отдельная history-таблица
CREATE TABLE pwa_constructor_history (
    id              BIGSERIAL PRIMARY KEY,
    constructor_id  INT NOT NULL REFERENCES pwa_constructor(id),
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,          -- NULL = текущая версия
    snapshot        JSONB NOT NULL,       -- полный снимок полей конструктора
    changed_by      INT REFERENCES auth_user(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_constructor_history_lookup
    ON pwa_constructor_history(constructor_id, effective_from, effective_to);

-- Вариант B (минимальный): добавить updated_at-версионирование
ALTER TABLE pwa_constructor ADD COLUMN version_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- + триггер: при UPDATE — копировать старую строку в history
```

**Правило использования в датасете:** для периода `[period_start, period_end]` брать версию конструктора с `effective_from <= period_start` и (`effective_to > period_start` OR `effective_to IS NULL`).

---

### FIX-4 · fs-admin: добавить `deactivated_at` в `pwa_campaign`

**Сервис:** fs-admin
**Приоритет:** ВЫСОКИЙ
**Проблема:** `pwa_campaign` имеет только `created` и `modified`, поля `end_date` или `deactivated_at` нет. Длительность жизни кампании нельзя вычислить точно — только эвристика через `modified + is_active=false`.
**Последствие:** `campaign_age_days` и признак "кампания завершена" неточны. Нельзя строить признаки "дней до деактивации" или "доля жизни кампании в периоде".

**Требуемые изменения:**

```sql
ALTER TABLE pwa_campaign ADD COLUMN deactivated_at TIMESTAMPTZ;
CREATE INDEX idx_pwa_campaign_deactivated ON pwa_campaign(deactivated_at)
    WHERE deactivated_at IS NOT NULL;

-- Триггер: при SET is_active = false → проставить deactivated_at = NOW()
-- если deactivated_at IS NULL (чтобы не перезаписывать повторные деактивации)
CREATE OR REPLACE FUNCTION trg_set_deactivated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_active = false AND OLD.is_active = true AND NEW.deactivated_at IS NULL THEN
        NEW.deactivated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER pwa_campaign_deactivated_at
    BEFORE UPDATE ON pwa_campaign
    FOR EACH ROW EXECUTE FUNCTION trg_set_deactivated_at();
```

**Итог:** `campaign_lifetime_days = deactivated_at::date - created::date` — точный признак жизненного цикла.

---

### FIX-5 · finance: добавить индекс и FK-валидацию в `keitaro_structure_dailycost`

**Сервис:** finance (v1)
**Приоритет:** ВЫСОКИЙ
**Проблема (а):** Нет индекса по `(campaign_id, date)` — агрегация за период делает full scan таблицы.
**Проблема (б):** `campaign_id` — ручной ввод без FK на `keitaro_campaign.keitaro_id`. Опечатки при вводе создают "висячие" записи, которые выпадают из JOIN без ошибки.

**Требуемые изменения:**

```sql
-- (а) Индекс для пайплайна
CREATE INDEX CONCURRENTLY idx_dailycost_campaign_date
    ON keitaro_structure_dailycost (campaign_id, date DESC);

-- (б) Валидация при вводе: добавить проверку через API/форму
-- Перед сохранением DailyCost — запрос к HLPR API:
-- GET /api/campaigns/{campaign_id}/exists → если 404 → показать ошибку баеру

-- (б) Опционально: soft FK через constraint (если HLPR доступна из finance БД)
-- ALTER TABLE keitaro_structure_dailycost
--     ADD CONSTRAINT fk_dailycost_keitaro_campaign
--     FOREIGN KEY (campaign_id) REFERENCES km_helper.keitaro_campaign(keitaro_id);
-- Если cross-DB FK невозможен — реализовать validation на уровне приложения
```

**Итог:** агрегация Block 8 ускоряется в 10–100x, процент "висячих" записей снижается до нуля при новых вводах.

---

### FIX-6 · km-helper: стандартизировать формат `keitaro_funnelstatistic.interval`

**Сервис:** km-helper (HLPR)
**Приоритет:** ВЫСОКИЙ
**Проблема:** Поле `interval VARCHAR(100)` — формат не документирован. Если это не ISO-week (`2025-W10`), а произвольный диапазон дат, агрегация Block 4 за период может включать данные из соседних недель или пропускать граничные дни.
**Последствие:** Смещение метрик Block 4 относительно Block 5–7, которые агрегируются строго по `created_at BETWEEN period_start AND period_end`.

**Требуемые изменения:**

```sql
-- 1. Верификация (немедленно, без изменений кода):
SELECT DISTINCT interval, COUNT(*) FROM keitaro_funnelstatistic GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- 2. Если формат не ISO-week — добавить нормализованные поля:
ALTER TABLE keitaro_funnelstatistic
    ADD COLUMN period_start DATE,
    ADD COLUMN period_end   DATE;

-- 3. Заполнить через парсер interval-строки + обновить логику записи
-- UPDATE keitaro_funnelstatistic SET
--     period_start = parse_interval_start(interval),
--     period_end   = parse_interval_end(interval);

-- 4. Создать индекс:
CREATE INDEX idx_funnelstat_funnel_period
    ON keitaro_funnelstatistic(funnel_id, period_start, period_end);
```

**Итог:** агрегация `WHERE period_start = :week_start` вместо строкового матча по `interval`.

---

### FIX-7 · km-helper: синхронизировать `keitaro_domain` ↔ `pwa_domain`

**Сервис:** km-helper (HLPR)
**Приоритет:** СРЕДНИЙ
**Проблема:** `keitaro_campaign.domain_id` указывает на `keitaro_domain` (собственная таблица HLPR), а не на `pwa_domain` (ADMIN). JOIN идёт через имя домена: `keitaro_domain.name = pwa_domain.name`. Если домены расходятся — строки кампании теряются без ошибки.

**Требуемые изменения:**

```sql
-- 1. Регулярная сверка (DQ-мониторинг, запустить сейчас):
SELECT kd.name AS keitaro_domain, pd.name AS pwa_domain, pd.id
FROM km_helper.keitaro_domain kd
LEFT JOIN pwa_domain pd ON kd.name = pd.name
WHERE pd.id IS NULL;  -- домены в HLPR без пары в ADMIN → потенциальная потеря данных

-- 2. Добавить `pwa_domain_id` в keitaro_campaign как явную ссылку:
ALTER TABLE km_helper.keitaro_campaign ADD COLUMN pwa_domain_id INT;
-- Заполнить через текущий матч по имени:
UPDATE km_helper.keitaro_campaign kc
SET pwa_domain_id = pd.id
FROM km_helper.keitaro_domain kd
JOIN pwa_domain pd ON kd.name = pd.name
WHERE kc.domain_id = kd.id;

-- 3. При создании/переименовании домена — синхронизировать через event/webhook
```

**Итог:** JOIN `keitaro_campaign.pwa_domain_id = pwa_campaign.domain_id` — прямой FK без риска расхождения имён.

---

### FIX-8 · finance: ввести валидацию `status` и документировать значения

**Сервис:** finance (v1)
**Приоритет:** СРЕДНИЙ
**Проблема:** Поле `keitaro_structure_dailycost.status VARCHAR(255)` nullable — возможные значения не задокументированы. Неизвестно, нужно ли фильтровать строки с ненулевым статусом. Если `status='deleted'` используется как soft-delete, включение таких строк завышает `finance_spend`.

**Требуемые изменения:**

```sql
-- 1. Аудит существующих значений (немедленно):
SELECT status, COUNT(*) FROM keitaro_structure_dailycost GROUP BY 1;

-- 2. Задокументировать и зафиксировать допустимые значения:
ALTER TABLE keitaro_structure_dailycost
    ADD CONSTRAINT chk_dailycost_status
    CHECK (status IN ('active', 'deleted', 'cancelled', NULL));
    -- набор значений уточнить по результатам аудита

-- 3. Добавить `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` как явный soft-delete флаг
--    вместо или дополнительно к status, чтобы логика фильтрации была однозначной

-- 4. Пайплайн: до получения документации — фильтровать WHERE status IS NULL OR status = 'active'
```

---

### Сводная таблица требований

| ID | Сервис | Изменение | Приоритет | ML-impact |
|----|--------|-----------|-----------|-----------|
| FIX-1 | fs-admin | `pwa_campaign.keitaro_campaign_id` — прямой FK на HLPR | КРИТИЧНЫЙ | Надёжный JOIN Block 4 |
| FIX-2 | fp-analytics-api | `analytics_pwa_event.campaign_id` — прямой FK | КРИТИЧНЫЙ | Надёжный JOIN Block 5/6, устранение `events_join_loss_rate` |
| FIX-3 | fs-admin | `pwa_constructor_history` — snapshot конфигов | ВЫСОКИЙ | Устранение temporal leakage в Block 3 |
| FIX-4 | fs-admin | `pwa_campaign.deactivated_at` — триггер | ВЫСОКИЙ | Признак `campaign_lifetime_days` |
| FIX-5 | finance | Индекс `(campaign_id, date)` + валидация FK | ВЫСОКИЙ | Производительность Block 8 + качество JOIN |
| FIX-6 | km-helper | `keitaro_funnelstatistic.period_start/end` DATE | ВЫСОКИЙ | Корректная агрегация Block 4 по неделям |
| FIX-7 | km-helper | `keitaro_campaign.pwa_domain_id` — прямой FK | СРЕДНИЙ | Устранение риска расхождения доменов |
| FIX-8 | finance | Документирование и constraint на `status` | СРЕДНИЙ | Корректный расчёт `finance_spend` |

**Зависимости внедрения:**
- FIX-1 должен идти вместе с FIX-7 (оба устанавливают прямые ссылки через домен)
- FIX-3 требует FIX-4 для полного покрытия temporal-контекста кампании
- FIX-2 можно внедрять независимо, но требует бэкфила

---

## Known Gaps & TODO

| Gap | Impact | Status | Resolution |
|-----|--------|--------|------------|
| `analytics_pwa_event.host → pwa_campaign` — нет прямого FK | JOIN теряет события при переименовании домена без ошибки | Открыт | Добавить `campaign_id` в `analytics_pwa_event`; добавить DQ-метрику `events_join_loss_rate` |
| `keitaro_campaign.keitaro_id → pwa_campaign` — нет прямого FK | HLPR блоки требуют 3-step JOIN через строки | Открыт | Добавить прямой маппинг `hlpr_campaign_id` в `pwa_campaign` |
| `keitaro_campaign.domain_id` → `keitaro_domain` (не `pwa_domain`) | При расхождении доменов между системами JOIN молча ломается | Открыт | Верифицировать совпадение `keitaro_domain.name = pwa_domain.name` для всех активных кампаний |
| `keitaro_funnelstatistic.interval` — формат VARCHAR(100) не документирован | Агрегация Block 4 может быть некорректной (граница недели) | Открыт | `SELECT DISTINCT interval FROM keitaro_funnelstatistic LIMIT 20` |
| Static config без исторического snapshot | Temporal leakage в ML: config текущий, target — прошлый период | Открыт | Добавить `effective_from/to` для ключевых полей или хранить snapshot в отдельной таблице |
| Нет `deactivated_at` / `end_date` у кампании | Длительность кампании нельзя вычислить точно | Открыт | Добавить `pwa_campaign.deactivated_at` или восстанавливать через `modified + is_active=false` |
| Нет бюджетов на уровне кампании | Только `cost_total` (факт расходов) — лимитов нет | Structural | В текущей архитектуре бюджет не хранится; `cost_total` — единственный источник |
| `pwa_constructor.config JSONB` — содержимое не задокументировано | Могут быть дополнительные атрибуты шаблона | Открыт | Проверить схему `config` в БД; все основные поля Block 3 — прямые колонки (верифицировано v1.3) |
| A/B тест: данные агрегированы по всем вариантам | Нельзя оценить вклад отдельного варианта | Открыт | Рассмотреть grain `smart_link_variant_id × period` для A/B анализа |
| `DailyCost.campaign_id` — ручной ввод, без FK | Опечатки → потеря строк без ошибки; NOT NULL гарантирует заполненность, но не корректность | Открыт | Верифицировать: `SELECT COUNT(*) FROM keitaro_structure_dailycost dc LEFT JOIN km_helper.keitaro_campaign kc ON kc.keitaro_id=dc.campaign_id WHERE kc.id IS NULL` |
| `keitaro_structure_dailycost` — нет индекса по `(campaign_id, date)` | Агрегация за период будет full scan; критично при больших данных | Открыт | `CREATE INDEX idx_dailycost_campaign_date ON keitaro_structure_dailycost(campaign_id, date)` перед пайплайном |
| `DailyCost.status` — поле nullable, значения не документированы | Возможно содержит статус 'deleted'/'cancelled' — тогда нужна фильтрация | Открыт | `SELECT DISTINCT status, COUNT(*) FROM keitaro_structure_dailycost GROUP BY 1` |
| `fb_collector_fbpushrecord.json` JSONB — структура неизвестна | Единственный шанс найти keitaro_campaign_id в dataflow системе | Открыт | `SELECT json FROM fb_collector_fbpushrecord LIMIT 5` в dataflow БД |
| `data_processor_facebookadstat` — нет campaign_id, только `campaign_name` text | JOIN с keitaro через campaign_name ненадёжен; через ad_campaign_id — длинная 4-шаговая цепочка | Структурный | Block 9 (Meta Stats) требует верификации join пути перед использованием |
