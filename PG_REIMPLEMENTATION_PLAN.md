# AAP Panel — PostgreSQL Re-Implementation Plan

**Goal:** Replace all Keitaro MCP API calls in `services/keitaro` and `services/graph` with
PostgreSQL queries against the Analytics DB. The result is a new microservice `services/analytics`
that exposes the same response contracts already defined in `@aap/types`.

---

## 1. Why PostgreSQL Instead of Keitaro MCP

| Dimension | Current (Keitaro MCP) | Target (PostgreSQL) |
|---|---|---|
| **Latency** | 4–6 parallel HTTP calls per request, ~2–5s | 1–2 SQL queries, ~50–300ms |
| **Rate limits** | Yes (Keitaro API throttles) | None |
| **Graph (graph-builder.ts)** | 6 API calls + N+1 per-campaign stream fetch (50 concurrent) | 2 SQL queries |
| **Data richness** | Limited to Keitaro report dimensions | Full sub_id_1..30, scaleo data, cost, tech_cost, funnel metadata |
| **Cost data** | Keitaro `cost` field only | `cost` + `tech_cost` + `marketing_cost` + Jamon/Scaleo joined |
| **Real-time lag** | Live | ~10 min (Dagster SYNC_LAG) — acceptable |
| **Offline resilience** | Breaks if Keitaro unreachable | Analytics DB always available |

---

## 2. Data Model Mapping

### Primary source: `agg_clicks`

One row per click. Pre-enriched Gold layer. Already filtered to `sub_id_9='offer'` clicks.

| Keitaro Report Field | `agg_clicks` Column | Notes |
|---|---|---|
| `campaign` (name) | JOIN `raw_keitaro_campaigns.name` | via `campaign_id` |
| `campaign.alias` | JOIN `raw_keitaro_campaigns.alias` | = cloak_id |
| `offer` (name) | `offer_name` OR JOIN `raw_keitaro_offers.name` | `offer_name` pre-resolved |
| `ad_campaign_id` | `ad_campaign_id` | text, nullable |
| `clicks` | `COUNT(*)` | 1 row = 1 click |
| `conversions` | `SUM(is_sale::int + is_lead::int)` | or separate leads/sales |
| `leads` | `SUM(is_lead::int)` | |
| `sales` | `SUM(is_sale::int)` | |
| `revenue` | `SUM(revenue)` | |
| `cost` | `SUM(cost)` | Keitaro cost |
| `tech_cost` | `SUM(tech_cost)` | Jamon/infra cost |
| `marketing_cost` | `SUM(marketing_cost)` | spend from ad networks |
| `profit` | `SUM(revenue - cost)` | |
| `roi` | `profit / cost * 100` | computed |
| `cr` | `conversions / clicks * 100` | computed |
| `cpa` | `cost / conversions` | computed |
| `country` | `country_code` | |
| `device_type` | `device_type` | |
| `os` | `os` | |
| `browser` | `browser` | |
| `buyer_id` | `buyer_id` | from dict_buyers |
| `funnel` | `funnel`, `funnel_id`, `funnel_category` | pre-resolved |
| `cloak_subid` | `cloak_subid` | = sub_id_17 |
| `cloak_campaign_id` | `cloak_campaign_id` | = sub_id_18 |
| `scaleo_offer_id` | `scaleo_offer_id` | Scaleo-side offer ID |

### Secondary source: `transform_events_cleaned`

Full Silver layer. Has `stream_id`. Used for graph routes only.

Key columns for graph: `campaign_id`, `stream_id`, `offer_id`, `ad_campaign_id`,
`revenue`, `cost`, `status`, `datetime`.

### Dimension tables

| Table | Use |
|---|---|
| `raw_keitaro_campaigns` | name, alias, state, type, group_id, traffic_source_id, cost_type |
| `raw_keitaro_offers` | name, country, payout_value, payout_type, payout_upsell |
| `raw_keitaro_streams` | name, schema, type, weight, state, campaign_id |
| `raw_keitaro_groups` | group name for campaign group display |
| `dict_buyers` | buyer name from buyer_id |

---

## 3. New Service: `services/analytics`

**Port:** `3802`
**Stack:** TypeScript + Fastify (identical to `services/keitaro`)
**Package name:** `@aap/analytics`

### Directory structure

```
services/analytics/
  src/
    index.ts                    # Fastify entry, port 3802
    lib/
      db.ts                     # PG pool (postgres-js or pg)
      helpers.ts                # detectCampaignType, detectNetwork, parseOfferMeta
                                # (copy from keitaro/lib/keitaro.ts, remove curl deps)
    routes/
      campaigns.ts              # GET /api/analytics/campaigns
      offers.ts                 # GET /api/analytics/offers
      chain.ts                  # GET /api/analytics/chain
      report.ts                 # GET /api/analytics/report
      graph.ts                  # GET /api/analytics/graph
      graph-campaign.ts         # GET /api/analytics/graph/campaign/:id
  package.json
  tsconfig.json
```

### Response contracts

Routes **must** return the same types from `@aap/types`:
- `campaigns.ts` → `CampaignsResponse`
- `offers.ts` → `OffersResponse`
- `chain.ts` → same shape as current `chain.ts` (nodes + edges + adOfferLinks + adCampLinks + stats)
- `graph.ts` → `GraphResponse`
- `graph-campaign.ts` → `GraphResponse`
- `report.ts` → `{ rows: Record<string, unknown>[]; period: {...} }`

---

## 4. Route Implementation Guide

### 4.1 `GET /api/analytics/campaigns`

**Replaces:** `services/keitaro/src/routes/campaigns.ts` (4 API calls)
**Cache TTL:** 5 min

**Query 1 — Main campaign stats** (from `agg_clicks`):

```sql
SELECT
  c.id                          AS campaign_id,
  c.name,
  c.alias,                      -- cloak_id
  c.state,
  c.group_id,
  c.type                        AS campaign_type_raw,
  c.traffic_source_id,
  c.cost_type,
  c.cost_value,
  c.domain_id,
  COUNT(*)                      AS clicks,
  SUM(a.is_lead::int)           AS leads,
  SUM(a.is_sale::int)           AS sales,
  SUM(a.is_lead::int + a.is_sale::int)  AS conversions,
  COALESCE(SUM(a.revenue), 0)   AS revenue,
  COALESCE(SUM(a.cost), 0)      AS cost,
  COALESCE(SUM(a.marketing_cost), 0) AS marketing_cost,
  COALESCE(SUM(a.tech_cost), 0) AS tech_cost,
  COALESCE(SUM(a.revenue - a.cost), 0) AS profit
FROM agg_clicks a
JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id
WHERE a.datetime >= $1 AND a.datetime < $2
GROUP BY c.id, c.name, c.alias, c.state, c.group_id,
         c.type, c.traffic_source_id, c.cost_type, c.cost_value, c.domain_id
ORDER BY clicks DESC
```

**Query 2 — Offer breakdown per campaign** (same WHERE, GROUP BY campaign + offer):

```sql
SELECT
  a.campaign_id,
  COALESCE(o.name, a.offer_name, 'Unknown') AS offer_name,
  COUNT(*)                      AS clicks,
  SUM(a.is_sale::int + a.is_lead::int) AS conversions,
  COALESCE(SUM(a.revenue), 0)   AS revenue,
  COALESCE(SUM(a.cost), 0)      AS cost,
  COALESCE(SUM(a.revenue - a.cost), 0) AS profit
FROM agg_clicks a
LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
WHERE a.datetime >= $1 AND a.datetime < $2
GROUP BY a.campaign_id, COALESCE(o.name, a.offer_name, 'Unknown')
ORDER BY clicks DESC
```

Run both queries in parallel (`Promise.all`). Group offer rows by `campaign_id` in JS.

**Post-processing in TypeScript** (identical logic to current `campaigns.ts`):
- `detectCampaignType(c.name)` — emoji-based type detection
- `classifyCampaign()` — success/failed/decision/no_data based on cost≥150, clicks≥100
- `buildRecommendation()` — payback months, ROI comment
- `subid9` field: since `agg_clicks` is pre-filtered to offer traffic, return `{ offer: 100 }` or omit.
  Add a note in the API response: `_note: "subid9 unavailable from PG (pre-filtered to offer clicks)"`

**Enrichments available in PG but NOT in Keitaro API:**
- `marketing_cost` (ad network spend from Jamon)
- `tech_cost` (infrastructure cost)
- `buyer_id` → can JOIN `dict_buyers` to get buyer name/team
- `funnel_category` breakdown

---

### 4.2 `GET /api/analytics/offers`

**Replaces:** `services/keitaro/src/routes/offers.ts` (offers list + campaigns + N+1 stream fetches)
**Cache TTL:** 5 min

**Query 1 — Offer stats** (from `agg_clicks`):

```sql
SELECT
  COALESCE(o.id::text, a.offer_id::text)      AS offer_id,
  COALESCE(o.name, a.offer_name, 'Unknown')   AS offer_name,
  o.payout_value,
  o.payout_type,
  o.payout_upsell,
  o.country,
  COUNT(*)                                     AS clicks,
  SUM(a.is_lead::int)                          AS leads,
  SUM(a.is_sale::int)                          AS sales,
  SUM(a.is_lead::int + a.is_sale::int)         AS conversions,
  COALESCE(SUM(a.revenue), 0)                  AS revenue,
  COALESCE(SUM(a.cost), 0)                     AS cost,
  COALESCE(SUM(a.revenue - a.cost), 0)         AS profit
FROM agg_clicks a
LEFT JOIN raw_keitaro_offers o ON o.id = a.offer_id
WHERE a.datetime >= $1 AND a.datetime < $2
GROUP BY COALESCE(o.id::text, a.offer_id::text),
         COALESCE(o.name, a.offer_name, 'Unknown'),
         o.payout_value, o.payout_type, o.payout_upsell, o.country
ORDER BY clicks DESC
LIMIT 500
```

**Query 2 — Funnels (stream → offer routing)** (from `transform_events_cleaned`):

Replaces the N+1 per-campaign `/campaigns/:id/streams` fetches entirely.

```sql
SELECT
  e.offer_id,
  e.stream_id,
  e.campaign_id,
  s.name          AS stream_name,
  s.schema,
  s.type          AS stream_type,
  s.weight,
  s.state         AS stream_status,
  c.name          AS campaign_name,
  COUNT(*)        AS clicks,
  SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END) AS conversions,
  COALESCE(SUM(e.revenue), 0) AS revenue,
  COALESCE(SUM(e.cost), 0)    AS cost
FROM transform_events_cleaned e
LEFT JOIN raw_keitaro_streams s ON s.id = e.stream_id
LEFT JOIN raw_keitaro_campaigns c ON c.id = e.campaign_id
WHERE e.datetime >= $1 AND e.datetime < $2
  AND e.offer_id IS NOT NULL
  AND e.stream_id IS NOT NULL
GROUP BY e.offer_id, e.stream_id, e.campaign_id,
         s.name, s.schema, s.type, s.weight, s.state, c.name
ORDER BY clicks DESC
LIMIT 5000
```

Group funnel rows by `offer_id` in JS, then attach to each offer's `funnels[]` array.

**Post-processing:** `parseOfferMeta(name)` and `OfferSignals` calculation identical to current `offers.ts`.

---

### 4.3 `GET /api/analytics/chain`

**Replaces:** `services/keitaro/src/routes/chain.ts` (6 parallel API calls)
**Cache TTL:** 5 min

**Single query** — 3-level graph from `agg_clicks`:

```sql
SELECT
  a.ad_campaign_id,
  a.campaign_id,
  a.offer_id,
  c.name          AS campaign_name,
  c.alias,        -- cloak_id
  c.state,
  c.type          AS campaign_type_raw,
  COALESCE(o.name, a.offer_name, 'Unknown') AS offer_name,
  COUNT(*)        AS clicks,
  SUM(a.is_sale::int + a.is_lead::int) AS conversions,
  COALESCE(SUM(a.revenue), 0) AS revenue,
  COALESCE(SUM(a.cost), 0)    AS cost
FROM agg_clicks a
LEFT JOIN raw_keitaro_campaigns c ON c.id = a.campaign_id
LEFT JOIN raw_keitaro_offers    o ON o.id = a.offer_id
WHERE a.datetime >= $1 AND a.datetime < $2
  AND a.ad_campaign_id IS NOT NULL
  AND a.ad_campaign_id != ''
GROUP BY
  a.ad_campaign_id, a.campaign_id, a.offer_id,
  c.name, c.alias, c.state, c.type,
  COALESCE(o.name, a.offer_name, 'Unknown')
ORDER BY clicks DESC
LIMIT 5000
```

**TypeScript post-processing** (mirrors current `chain.ts` node/edge builder):

1. Iterate rows → build `adNodes`, `campNodes`, `offerNodes` maps
2. `detectNetwork(adId)` → same heuristic (Meta/Google/TikTok by digit count)
3. Build `adToCamp` and `campToOffer` edge accumulators
4. Derive `adOfferLinks` and `adCampLinks` from the same rows (no second query needed — the 3-column GROUP BY already provides this)
5. Build React Flow `nodes` and `edges` with proportional `strokeWidth`
6. Compute 3-column layout (adPos, campPos, offerPos sorted by clicks)
7. Return same `{ nodes, edges, adOfferLinks, adCampLinks, stats, period }` shape

**Why this replaces 6 API calls:**
The 3-way GROUP BY `(ad_campaign_id, campaign_id, offer_id)` encodes all 6 reports' information in one pass:
- `adCampReport` → GROUP BY (ad_campaign_id, campaign_id)
- `campOfferReport` → GROUP BY (campaign_id, offer_id)
- `adOfferReport` → GROUP BY (ad_campaign_id, offer_id)
- `adCampOfferReport` → the 3-way itself
- `campaignsRaw` / `offersRaw` → covered by JOINs

---

### 4.4 `GET /api/analytics/report`

**Replaces:** `services/keitaro/src/routes/analytics.ts` (Keitaro /report/build proxy)
**Cache TTL:** 5 min

Dynamic SQL generator. Whitelist-only (same security model as current `VALID_DIMENSIONS`/`VALID_MEASURES`).

**Supported dimensions** (map query param → SQL expression):

```typescript
const DIM_MAP: Record<string, { expr: string; join?: string }> = {
  day:            { expr: "DATE_TRUNC('day', a.datetime)" },
  week:           { expr: "DATE_TRUNC('week', a.datetime)" },
  month:          { expr: "DATE_TRUNC('month', a.datetime)" },
  campaign:       { expr: 'c.name', join: 'raw_keitaro_campaigns c ON c.id = a.campaign_id' },
  offer:          { expr: "COALESCE(o.name, a.offer_name)", join: 'raw_keitaro_offers o ON o.id = a.offer_id' },
  country:        { expr: 'a.country_code' },
  device_type:    { expr: 'a.device_type' },
  os:             { expr: 'a.os' },
  browser:        { expr: 'a.browser' },
  ad_campaign_id: { expr: 'a.ad_campaign_id' },
  buyer:          { expr: 'a.buyer_id' },
  funnel:         { expr: 'a.funnel' },
  funnel_category:{ expr: 'a.funnel_category' },
  cloak_campaign: { expr: 'a.cloak_campaign_id' },
  language:       { expr: 'a.language' },
}

const MEASURE_MAP: Record<string, string> = {
  clicks:       'COUNT(*)',
  conversions:  'SUM(a.is_sale::int + a.is_lead::int)',
  leads:        'SUM(a.is_lead::int)',
  sales:        'SUM(a.is_sale::int)',
  revenue:      'COALESCE(SUM(a.revenue), 0)',
  cost:         'COALESCE(SUM(a.cost), 0)',
  tech_cost:    'COALESCE(SUM(a.tech_cost), 0)',
  marketing_cost: 'COALESCE(SUM(a.marketing_cost), 0)',
  profit:       'COALESCE(SUM(a.revenue - a.cost), 0)',
  // computed post-query:
  roi:          null,  // profit / cost * 100
  cr:           null,  // conversions / clicks * 100
  cpa:          null,  // cost / conversions
  epc:          null,  // revenue / clicks
}
```

Build query dynamically, collect required JOINs, compute derived measures in JS after fetch.

---

### 4.5 `GET /api/analytics/graph`

**Replaces:** `services/graph/src/lib/graph-builder.ts` (6 API calls + N+1 stream fetches)
**Cache TTL:** 10 min

**Query 1 — Campaign × Stream × Offer stats** (from `transform_events_cleaned`):

```sql
SELECT
  e.campaign_id,
  e.stream_id,
  e.offer_id,
  COUNT(*)        AS clicks,
  SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END) AS conversions,
  COALESCE(SUM(e.revenue), 0) AS revenue,
  COALESCE(SUM(e.cost), 0)    AS cost
FROM transform_events_cleaned e
WHERE e.datetime >= $1 AND e.datetime < $2
  AND e.campaign_id IS NOT NULL
  AND e.stream_id   IS NOT NULL
  AND e.offer_id    IS NOT NULL
GROUP BY e.campaign_id, e.stream_id, e.offer_id
ORDER BY clicks DESC
LIMIT 10000
```

**Query 2 — Metadata** (collect unique IDs from Query 1, fetch in parallel):

```sql
-- campaigns
SELECT id, name, alias, state, type FROM raw_keitaro_campaigns
WHERE id = ANY($1::bigint[])

-- streams
SELECT id, name, schema, type, weight, state, campaign_id FROM raw_keitaro_streams
WHERE id = ANY($1::bigint[])

-- offers
SELECT id, name, country, payout_value, payout_type, payout_upsell FROM raw_keitaro_offers
WHERE id = ANY($1::bigint[])
```

**TypeScript post-processing:** Identical node/edge builder as current `graph-builder.ts`.
- Campaign nodes: aggregate over all (stream, offer) pairs
- Stream nodes: aggregate over all (offer) pairs
- Offer nodes: aggregate globally
- Edges: campaign→stream, stream→offer
- Apply Dagre layout via existing `applyDagreLayout()`

---

### 4.6 `GET /api/analytics/graph/campaign/:id`

**Replaces:** `services/graph/src/lib/campaign-graph-builder.ts`
**Cache TTL:** 10 min (per campaign)

```sql
SELECT
  e.stream_id,
  e.offer_id,
  COUNT(*)        AS clicks,
  SUM(CASE WHEN e.status = 'approved' THEN 1 ELSE 0 END) AS conversions,
  COALESCE(SUM(e.revenue), 0) AS revenue,
  COALESCE(SUM(e.cost), 0)    AS cost
FROM transform_events_cleaned e
WHERE e.datetime >= $1 AND e.datetime < $2
  AND e.campaign_id = $3
  AND e.stream_id   IS NOT NULL
  AND e.offer_id    IS NOT NULL
GROUP BY e.stream_id, e.offer_id
ORDER BY clicks DESC
LIMIT 2000
```

Then fetch stream metadata and offer metadata by collected IDs (2 parallel queries).
Build bipartite graph: stream nodes (top) → offer nodes (bottom), apply Dagre TB layout.

---

## 5. DB Connection (`src/lib/db.ts`)

Use `postgres` (postgres-js) — simpler TypeScript integration than `pg`:

```typescript
import postgres from 'postgres'

const ANALYTICS_DB_URL = process.env.ANALYTICS_DB_URL

if (!ANALYTICS_DB_URL) throw new Error('ANALYTICS_DB_URL not set')

export const sql = postgres(ANALYTICS_DB_URL, {
  max: 10,          // connection pool size
  idle_timeout: 30, // seconds
  connect_timeout: 10,
})
```

All routes import `sql` and use tagged template literals:
```typescript
const rows = await sql`
  SELECT campaign_id, COUNT(*) AS clicks
  FROM agg_clicks
  WHERE datetime >= ${dateFrom} AND datetime < ${dateTo}
  GROUP BY campaign_id
`
```

---

## 6. `src/index.ts` (port 3802)

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { campaignsRoutes }    from './routes/campaigns.js'
import { offersRoutes }       from './routes/offers.js'
import { chainRoutes }        from './routes/chain.js'
import { reportRoutes }       from './routes/report.js'
import { graphRoutes }        from './routes/graph.js'
import { graphCampaignRoutes} from './routes/graph-campaign.js'

const PORT = parseInt(process.env.PORT ?? '3802', 10)

const app = Fastify({ logger: { level: 'info' } })
await app.register(cors, { origin: process.env.PANEL_ORIGIN ?? 'http://localhost:3777' })

await app.register(campaignsRoutes,    { prefix: '/api/analytics/campaigns' })
await app.register(offersRoutes,       { prefix: '/api/analytics/offers' })
await app.register(chainRoutes,        { prefix: '/api/analytics/chain' })
await app.register(reportRoutes,       { prefix: '/api/analytics/report' })
await app.register(graphRoutes,        { prefix: '/api/analytics/graph' })
await app.register(graphCampaignRoutes,{ prefix: '/api/analytics/graph/campaign' })

app.get('/health', async () => ({ ok: true, service: 'analytics', ts: Date.now() }))
await app.listen({ port: PORT, host: '127.0.0.1' })
```

---

## 7. Environment Variables

Add to `.env` / `ecosystem.config.cjs`:

```
ANALYTICS_DB_URL=postgres://user:pass@host:5432/analytics_db
```

The same DB URL already used by Dagster. Check `dagster/.env` for the value.

---

## 8. Frontend Integration — Rollout Strategy

Run both services in parallel. Switch frontend to PG endpoints one page at a time.

**Phase 1: Chain graph** (highest value — 6→1 API calls)
- Add feature flag: `NEXT_PUBLIC_USE_PG_CHAIN=true`
- Frontend: if flag → fetch `/api/analytics/chain` else `/api/keitaro/analytics/chain`
- Validate same node/edge count, same click totals

**Phase 2: Campaigns page**
- Switch `/api/keitaro/campaigns` → `/api/analytics/campaigns`
- Add new columns: `tech_cost`, `marketing_cost`, `buyer_id`

**Phase 3: Offers page**
- Switch `/api/keitaro/offers` → `/api/analytics/offers`
- Major improvement: funnels now come from SQL, not N+1 API calls

**Phase 4: Graph pages**
- Switch both graph endpoints

**Phase 5: Deprecate `services/keitaro` and `services/graph`**
- Keep as fallback for 30 days, then remove

---

## 9. Performance Considerations

### Indexes on `agg_clicks`

Existing indexes cover datetime queries well:
- `idx_agg_clicks_datetime` (btree on datetime) — range scans
- `uq_agg_clicks_sub_datetime` (unique on sub_id, datetime) — dedup guard

**Additional indexes recommended** (create once, non-blocking):

```sql
-- For chain route (ad_campaign_id GROUP BY)
CREATE INDEX CONCURRENTLY idx_agg_clicks_ad_campaign_id
  ON agg_clicks (ad_campaign_id, datetime)
  WHERE ad_campaign_id IS NOT NULL;

-- For campaign-grouped queries
CREATE INDEX CONCURRENTLY idx_agg_clicks_campaign_datetime
  ON agg_clicks (campaign_id, datetime);

-- For offer-grouped queries
CREATE INDEX CONCURRENTLY idx_agg_clicks_offer_datetime
  ON agg_clicks (offer_id, datetime);
```

### Indexes on `transform_events_cleaned`

Existing: `idx_transform_events_cleaned_datetime` + unique on (sub_id, datetime)

**Additional:**
```sql
-- For graph route (campaign × stream × offer)
CREATE INDEX CONCURRENTLY idx_transform_events_campaign_stream
  ON transform_events_cleaned (campaign_id, stream_id, datetime)
  WHERE campaign_id IS NOT NULL AND stream_id IS NOT NULL;
```

### Query latency estimates (on current DB size)

| Route | Query | Expected latency |
|---|---|---|
| `/campaigns` | agg_clicks GROUP BY campaign_id, 30d | ~50ms |
| `/offers` | agg_clicks GROUP BY offer_id, 30d | ~60ms |
| `/chain` | agg_clicks GROUP BY 3 keys, 30d | ~100ms |
| `/graph` | transform_events 3-way GROUP BY, 30d | ~200ms |
| `/graph/campaign/:id` | transform_events WHERE campaign_id=X | ~30ms |

All responses cached 5–10 min → p99 from cache is <5ms.

---

## 10. Known Gaps vs. Current Keitaro MCP

| Feature | Current Keitaro MCP | PostgreSQL | Workaround |
|---|---|---|---|
| `sub_id_9` distribution per campaign | ✅ from Keitaro report | ❌ agg_clicks pre-filtered | Return `{offer: 100}` or query raw_keitaro_events separately |
| Campaign cost model auto-detection | From `cost_type` field | ✅ `raw_keitaro_campaigns.cost_type` | No gap |
| Stream `filter_or` / filter conditions | From `/campaigns/:id/streams` | Not in transform_events_cleaned | Fetch from `raw_keitaro_streams` metadata |
| Landing page IDs per stream | From stream detail | `raw_keitaro_streams.action_payload` JSON | Parse JSON from raw_keitaro_streams if needed |
| Real-time data (< 10 min) | ✅ live | ❌ ~10 min lag | Add "data lag" notice in UI |

---

## 11. Implementation Sequence

1. **Create service scaffold** — `services/analytics/`, copy `package.json` + `tsconfig.json` from `services/keitaro`, add `postgres` dependency
2. **`src/lib/db.ts`** — PG pool setup
3. **`src/lib/helpers.ts`** — copy `detectCampaignType`, `detectNetwork`, `parseOfferMeta`, `formatDate` from keitaro service (no curl dependency)
4. **`routes/chain.ts`** — start here (highest value, single SQL query)
5. **`routes/campaigns.ts`** — 2 parallel queries
6. **`routes/offers.ts`** — 2 parallel queries (one uses transform_events_cleaned)
7. **`routes/report.ts`** — dynamic SQL generator
8. **`routes/graph.ts`** — 2 queries + Dagre layout (reuse existing layout.ts via shared package)
9. **`routes/graph-campaign.ts`** — simplest graph route
10. **`src/index.ts`** — wire everything
11. **Add to `ecosystem.config.cjs`** — PM2 entry
12. **Add to `pnpm-workspace.yaml`** — monorepo member

---

## 12. `package.json` for `services/analytics`

```json
{
  "name": "@aap/analytics",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@aap/types": "workspace:*",
    "@fastify/cors": "^9.0.1",
    "fastify": "^4.28.1",
    "postgres": "^3.4.4"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```
