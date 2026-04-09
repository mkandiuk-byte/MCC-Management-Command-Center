# Action Plan — Post Ivan/Serhii Call (2026-04-09)

## Data Sources Confirmed

| Source | Status | What It Provides |
|--------|--------|-----------------|
| **Keitaro** (`keitaro.make-admin.com`) | ✅ Connected | Campaigns, offers, geos, revenue, cost, ROI, sub_id fields |
| **Jira** (`upstars.atlassian.net`) | ✅ Connected | Sprints, issues, velocity, bugs, epics, team workload |
| **Confluence** | ✅ Connected | Houston spec, team docs, process docs |
| **Airtable Roadmap** (`appyDgbuyTYErM1NN`) | ✅ Connected | Infrastructure team tasks (Operations, Automation, Accounts) — 27 tasks |
| **Airtable Payment Control** (`appVSVooX0MbBoQ3g`) | ✅ Connected | Service subscriptions, costs, renewal dates — 15 services |
| **Scaleo** | ❌ Not needed | Serhii confirmed: same data as Keitaro, no extra value |
| **F3 (Creative hosting)** | ❌ Future | Creative pipeline tracking — later phase |
| **Airtable main base** (`appLF7Y6WvJpwZkJ5`) | ⚠️ Token needs access | Not yet accessible — needs PAT scope update |

---

## Enriched Action Points

### AP-1: Keitaro Sub_ID Field Integration
**From call**: Serhii Oliinyk provided exact field mappings
**What to do**:
- Add `sub_id_2` (creative ID) to Keitaro report queries
- Add `sub_id_13` (funnel ID from Keitaro) to queries
- Add `sub_id_16` (funnel name) to queries
- These go into the `/api/mcc/keitaro/buyers` and `/api/mcc/keitaro/roi` routes
- Display: creative count per buyer, funnel breakdown per campaign

**Implementation**: Modify the Keitaro report body in both API routes to include these columns. Add funnel name as a grouping option on the Buying page.

---

### AP-2: Campaign Lifecycle Detection (Test → Scale → Kill)
**From call**: Mykola proposed heuristic, Serhii warned about margin of error
**Rules**:
- **Test**: Campaign lifespan < 3 days AND total spend < $500
- **Scaled**: Campaign lifespan > 7 days AND spend increasing week-over-week
- **Killed**: Campaign state changed to inactive/paused
- **Optimized**: Campaign running > 14 days with positive ROI

**Implementation**: New API route `/api/mcc/keitaro/campaign-lifecycle` that:
1. Fetches all campaigns with their `created_at` and current state
2. Fetches 30-day spend per campaign from report API
3. Classifies each into: test / active / scaled / killed / optimized
4. Returns counts + lists per category

**Display**: New "Operations" tab content on Media Buying page with:
- 5 score boxes: Tests (count), Active, Scaled, Killed, Success Rate
- Campaign lifecycle funnel visualization (tests → survived → scaled)
- List of recently killed campaigns with reason (STOP signal, manual, ban)

---

### AP-3: Infrastructure Department from Airtable
**From call**: Mykola wants Infrastructure as a department
**Data available**: Airtable Roadmap base has 27 tasks across Operations, Automation, Accounts directions
**Team members found**:
- Serhii Oliinyk (Operations — monitoring, funnel audit, documentation)
- Andrii Lemak (Automation — PNL integration, task manager MVP, caps control)
- Ihor Mateiko (Accounts — BitWarden, onboarding, payment control)

**Implementation**:
1. New API route `/api/mcc/airtable/infra` that pulls from Airtable Roadmap
2. On the Executive Summary: add 4th department card "Infrastructure"
3. Infrastructure department page or section on Processes page with:
   - Task breakdown by direction (Operations/Automation/Accounts)
   - Status distribution (Planned/In Progress/Backlog/Done)
   - Service subscriptions from Payment Control base (15 services, costs, renewal alerts)

---

### AP-4: Payment Control Integration
**Data**: 15 service subscriptions with costs, renewal dates, responsible persons
**Alerts needed**: DOLPHIN subscription is -205 days overdue! BLUE ANGEL HOST is -211 days overdue!
**Display**: On Infrastructure section — table of services with:
- Service name, cost, billing cycle, days until renewal
- Red alert for overdue renewals
- Total monthly infrastructure cost

---

### AP-5: Buying Operations — Detailed Metrics
**From call**: Mykola wants per-buyer AND per-team unit metrics
**What's new vs current**:
- Current: we show GEO | SOURCE grouping (e.g., "GB | FB")
- Needed: campaign count per group, test vs production split, kill rate
- Needed: creative usage rate (requested vs launched — from sub_id_2)
- Needed: funnel performance (from sub_id_13/16)

**Implementation**: Enhance the existing `/api/mcc/keitaro/buyers` route to include:
- `campaigns_total`, `campaigns_test`, `campaigns_scaled`, `campaigns_killed`
- `creative_count` (distinct sub_id_2 values)
- `funnel_count` (distinct sub_id_13 values)

---

### AP-6: Creative Pipeline Tracking (Future)
**From call**: Ivan mentioned F3 creative hosting as data source
**Vadim Kazhanov** assigned as junior PO to own this process
**Scope**: How many creatives requested → how many used → performance per creative
**Status**: Future phase — needs F3 API access and Vadim's process research first

---

### AP-7: Deploy for Team Access
**From call**: "I want to host it, throw it on any domain"
**People who need access**: Ivan Demydko, Serhii Oliinyk, Omelchenko, Kosenko, Pravdyvyi, Kuts, Laptiev, Krutko, Hrachov
**Implementation**: Push to GitHub, deploy via Vercel or similar. Share URL with team.

---

## Development Plan — Execute Now

### Phase A: API Enhancements (30 min)

**A1**: Update `/api/mcc/keitaro/buyers` route — add sub_id_2, sub_id_13, sub_id_16 to report query. Add campaign lifecycle classification.

**A2**: Create `/api/mcc/keitaro/campaign-lifecycle` route — fetches campaign list, classifies by lifecycle stage, returns counts.

**A3**: Create `/api/mcc/airtable/infra` route — pulls Infrastructure tasks from Airtable Roadmap base + Payment Control services.

### Phase B: Frontend Updates (45 min)

**B1**: Media Buying Operations tab — replace placeholder with real campaign lifecycle data (tests/active/scaled/killed counts, funnel chart, recent kills list).

**B2**: Executive Summary — add 4th Infrastructure department card with Airtable task status + overdue payment alerts.

**B3**: Processes page — add Infrastructure section with Airtable task pipeline + service cost table.

### Phase C: Deploy (15 min)

**C1**: Push to GitHub repo
**C2**: Share access URL with team
