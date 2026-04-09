# Buying Problems — Complete Metrics Specification

## PART 1: What We CANNOT Calculate (Blocked)

### Blocked Metrics — Require External Access

| # | Metric | Needed For | Blocked By | Who Unblocks | Priority |
|---|--------|-----------|------------|-------------|----------|
| B1 | **Bot detection rate** (true positive %) | Problems #1, #2, #10 | hox.tech dashboard has no API — data only visible in their web UI | Serhii Oliinyk: ask hox.tech support if they have an API or export | HIGH |
| B2 | **False positive rate** (legit users blocked by cloaking) | Problems #1, #2, #10 | Same — hox.tech internal metric, not exposed | Same | HIGH |
| B3 | **In-app browser detection accuracy** | Problem #2 | Keitaro doesn't tag in-app vs system browser natively. Need custom sub_id parameter or JS detection on landing | Andrii Laptiev: add in-app detection JS to landings, pass result to Keitaro as sub_id | MEDIUM |
| B4 | **SSAPI event volume per account** | Problem #4 | Events Manager service DB not accessible to MCC | Oleksii Kosenko: provide read-only DB access or API endpoint | HIGH |
| B5 | **SSAPI source IP distribution** | Problem #4 | Same — Events Manager logs not exposed | Same | HIGH |
| B6 | **Event delivery latency (p50/p95) after proxy** | Problem #4 | Doesn't exist yet — needs implementation + monitoring | Serhii Poprovka: add latency logging when proxy is built | MEDIUM |
| B7 | **Cloudflare account ↔ domain mapping** | Problem #8 | Cloudflare API token not available to MCC | Andrii Laptiev: provide CF API token OR export domain-to-account mapping | MEDIUM |
| B8 | **Cloudflare NS server distribution** | Problem #8 | Same | Same | MEDIUM |
| B9 | **Push subscription rate on iOS** | Problem #9 | fp-analytics-api (port unknown) not connected | Oleksii Kosenko: provide access or expose endpoint | LOW |
| B10 | **hox.tech ML confidence scores per visitor** | Problems #1, #2 | hox.tech doesn't export per-visitor scores via API | May never be available — use aggregate stats from their dashboard manually | LOW |
| B11 | **Facebook WebRTC connection endpoints** | Problem #3 | Requires manual browser inspection — not automatable at scale | Serhii Oliinyk: document once, then it's known | LOW (one-time) |
| B12 | **Counteragent/partner payment terms (Spend model)** | Problem #6 supplement | Finance system / Gorchuk meeting data not accessible | Mykola: get from Gorchuk meeting | MEDIUM |

### Workarounds for Blocked Metrics

| Blocked Metric | Workaround | Accuracy |
|---------------|------------|----------|
| B1-B2 (bot rates) | Manual: screenshot hox.tech dashboard daily, enter into MCC daily metrics form | ~90% (manual lag) |
| B3 (in-app detection) | Proxy: use Keitaro `browser` field — in-app browsers report as "Facebook" or "Instagram" user agent | ~70% (not all in-app detected) |
| B4-B5 (SSAPI volume) | Proxy: count Facebook pixel events from Keitaro conversion data as approximation | ~60% (doesn't show server-side specifically) |
| B7-B8 (CF domains) | Available in Airtable `appvJqFmRGWvenYwS` Domains Control — has CF account column | ~80% (may not be 100% current) |
| B12 (partner payments) | Available in Airtable `appWzGwXmRyVh6Z8k` B2B Main Data — has cost structures | ~70% |

---

## PART 2: All Calculable Metrics — Formulas & Test Matrices

### Problem 1: AI Crawlers Bypass Cloaking

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Account Survival Rate (72h)** | `accounts_alive_after_72h / accounts_launched × 100` | Manual daily input (MCC metrics form) | Input: accounts_launched (daily), accounts_banned (daily). Group by: test group (A/B/C). Period: 10 days. Min sample: 30 launches per group. |
| **Ad Approval Rate** | `ads_approved / ads_submitted × 100` | Manual daily input OR MetaMind (FS-691 fix) | Input: ads_submitted, ads_approved, ads_rejected. Group by: cloaking service. Daily. |
| **Spend Achieved per Account** | `SUM(cost) / COUNT(active_accounts)` | Keitaro report API `cost` + manual account count | Keitaro: `grouping: ["campaign"], metrics: ["cost"]`. Manual: active account count per group. |
| **CPM by Test Group** | `(cost / impressions) × 1000` | Keitaro report API (if impressions tracked) OR manual from FB Ads Manager | May need manual entry from FB dashboard. |
| **Cost per Active Account-Day** | `total_spend / SUM(account_alive_days)` | Keitaro spend + manual account tracking | Compute: for each account, days_alive = ban_date - launch_date. Sum across group. |
| **Campaigns Launched per Day** | `COUNT(campaigns WHERE created_at = today)` | Keitaro campaigns API | `GET /campaigns?limit=500`, filter by `created_at` date range, count. |
| **Test vs Control Delta** | `(test_survival - control_survival) / control_survival × 100` | Computed from Account Survival Rate | Compare Group B and C vs Group A. Statistical threshold: p < 0.05 with N ≥ 30. |

**UI Placement**: Problem #1 card on `/problems` page → expanded detail shows:
- Top row: 3 ScoreBoxes (Survival Rate Group A / B / C)
- Chart: daily survival rate by group (line chart, 10 days)
- Table: per-day breakdown (launched, survived, banned per group)
- Delta indicator: "Group B shows +34% vs control"

**Design Rationale**: This is the #1 crisis metric. It deserves the most visual real estate on the Problems page. The A/B/C comparison must be immediately visible without clicking — if someone opens Problems, this card should scream whether the fix is working.

---

### Problem 2: In-App Browser Limitations

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Traffic Split (in-app vs system)** | `clicks_inapp / total_clicks × 100` | Keitaro report grouped by `browser` (filter "Facebook"/"Instagram" user agents) | `grouping: ["browser"], metrics: ["clicks"]`. Classify: in-app = browser contains "FB"/"Instagram"/"TikTok". |
| **Conversion Rate by Browser Type** | `conversions / clicks × 100` per browser category | Keitaro report grouped by browser | Same query, add `conversions` metric. Compare in-app vs system. |
| **Bounce Rate by Funnel** | `single_page_visits / total_visits × 100` | fp-analytics-api (if accessible) OR Keitaro unique vs total clicks ratio | Keitaro: `unique_clicks / clicks` per funnel. |
| **Funnel A vs B Comparison** | `conversion_A / clicks_A` vs `conversion_B / clicks_B` | Keitaro split test (two streams on same campaign) | Set up Keitaro stream split 50/50. Measure over 5 days. |

**UI Placement**: Problem #2 card on `/problems` page → expanded shows:
- Donut chart: traffic split (in-app / system / other)
- Table: conversion rate by browser type
- A/B comparison bar chart (JS on vs JS off)

**Design Rationale**: Put next to Problem #1 — they're related (cloaking effectiveness depends on browser type). The browser split donut immediately tells you what % of your traffic is affected.

---

### Problem 3: WebRTC Leaks

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Leak Frequency** | `leaks_detected / page_refreshes` | Manual test by Serhii Oliinyk (one-time) | 10 profiles × 20 refreshes = 200 tests. Log each leak. |
| **Account Ban Rate (WebRTC disabled vs enabled)** | `bans_disabled_group / accounts_disabled_group` vs same for enabled | Manual tracking over 2 weeks | 5 profiles WebRTC OFF vs historical baseline. Track ban events. |
| **Functional Impact Score** | Binary checklist: FB login ✓, images ✓, video ✓, Messenger ✓ | Manual QA test | Checklist in Problems tracker update log. |

**UI Placement**: Problem #3 card → expanded shows:
- ScoreBox: Leak rate (e.g., "1 per 4 refreshes")
- Checklist: functional impact (green checkmarks)
- Before/after: ban rate comparison (baseline vs disabled metric)

**Design Rationale**: This is a quick win (low effort, medium impact). The card should be compact — the key question is binary: "did disabling WebRTC break anything?" Yes/No with evidence.

---

### Problem 4: Single IP for SSAPI Events

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Accounts per IP (before)** | `COUNT(DISTINCT account_id) WHERE server_ip = X` | ❌ Events Manager logs (BLOCKED) | Workaround: estimate from total active accounts / 1 (all share same IP). |
| **Proxy Pool Utilization** | `COUNT(DISTINCT proxy_ip_used) / total_proxies × 100` | New logging after proxy implementation | Add to proxy backend: log `account_id, proxy_ip, timestamp`. |
| **Event Delivery Success Rate** | `events_delivered_ok / events_sent × 100` | New logging after proxy implementation | Log every SSAPI request: status code, response time. |
| **Latency Impact** | `p50(response_time_with_proxy) - p50(response_time_without_proxy)` | New logging | A/B: 50% through proxy, 50% direct. Compare latency distributions. |
| **Account Ban Correlation with IP** | `ban_rate_single_ip vs ban_rate_diversified_ip` | Manual tracking + new proxy logs | 2-week comparison after proxy rollout. |

**UI Placement**: Problem #4 card → expanded shows:
- ScoreBox: "Accounts per IP" (currently: ALL → target: ≤5)
- Progress bar: proxy rollout (10% → 50% → 100%)
- ScoreBox: Event delivery rate (target: >99%)

**Design Rationale**: This is a staged rollout metric. The progress bar (10% → 50% → 100%) is the primary visual — it shows WHERE in the rollout we are. The delivery rate is the safety check — if it drops, we stop.

---

### Problem 5: Stale White Pages

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Total Active White Pages** | `COUNT(landing_pages WHERE state = "active")` | Keitaro landing pages API | `GET /landing_pages` — already confirmed 1,290+ accessible. |
| **White Page Reuse Rate** | `landing_pages_used_in_multiple_campaigns / total_active × 100` | Keitaro: for each landing page, check stream assignments | For each landing in Keitaro, count campaigns using it. If count > 1, it's reused. |
| **Unique White Pages per Campaign** | `COUNT(DISTINCT landing_id) / COUNT(campaigns)` | Keitaro streams API | Fetch streams per campaign, extract landing_id. Group by campaign. |
| **White Page Generation Rate** | `new_landing_pages_created_this_week` | Keitaro landing pages API filtered by `created_at` | Count landings created in last 7 days. |
| **Page Weight** | `file_size_bytes` per landing page | Automated: fetch each landing URL, measure response size | Script: `curl -sI {landing_url}` → Content-Length header. |
| **Ad Approval Rate (fresh vs stale)** | `approval_fresh / submitted_fresh` vs `approval_stale / submitted_stale` | Manual A/B tracking | Group A: reused white pages. Group B: fresh. Compare ad approval. |
| **Account Survival (fresh vs stale)** | Same as Problem #1 but segmented by white page freshness | Manual A/B + Keitaro | Tag campaigns with fresh vs stale white pages in the test. |

**UI Placement**:
- Problem #5 card on `/problems` → shows reuse rate, generation rate
- ALSO on Media Buying `/buying` Offers tab → "White Page Health" mini-section:
  - ScoreBox: Active WPs (1,290), Reuse Rate (X%), New This Week (Y)
  - Alert if reuse rate > 50%

**Design Rationale**: White page health is both a problem to solve AND an operational metric. Showing it on the Buying page (not just Problems) means it becomes part of daily consciousness — buyers see it every time they check offers.

---

### Problem 6: No Centralized Analytics Pipeline

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Pipeline Coverage** | `data_sources_connected / total_needed × 100` | MCC configuration | Currently: 4/7 (Keitaro ✓, Jira ✓, Airtable ✓, Problems ✓, MetaMind ✗, Events Manager ✗, HiBob ✗) |
| **Data Freshness per Source** | `NOW() - last_sync_timestamp` per source | API response timestamps | Each API route returns `updatedAt`. Track in PageHeader "Updated Xm ago". |
| **Variables Testable** | Count of dimensions we can isolate in A/B tests | Configuration | Currently: cloaking service, white page, domain, geo, offer, buyer. NOT testable: proxy type (Problem #4 not built yet). |
| **Test Cycle Duration** | `test_end_date - test_start_date` | MCC Problems tracker timestamps | For each problem card: time from first test_result update to resolution. |
| **Decision Quality** | `problems_resolved_with_positive_outcome / total_resolved × 100` | MCC Problems tracker | Count resolved problems where final test outcome = positive. |

**UI Placement**: This IS the MCC panel itself. Show pipeline health as a meta-metric on the Processes page:
- "Data Pipeline Status" section showing each source with green/red dot and freshness
- On homepage: "Analytics" dept card already shows "Self-Serve: ~60%"

**Design Rationale**: Self-referential metric — the dashboard tracking its own health. Put it where ops leadership looks (Processes page) so they know what data to trust and what's stale.

---

### Problem 7: Buyer Coordination & Discipline

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Protocol Compliance Rate** | `buyers_following_protocol / total_test_buyers × 100` | Manual: verify via Keitaro logs (did buyer use assigned link/WP/domain?) | Check each buyer's campaign: does cloaking link match assigned? Does domain match assigned? |
| **Campaign Launch Volume** | `COUNT(campaigns) per buyer per day` | Keitaro campaigns API filtered by campaign name (buyer prefix in sub_id) | Group by sub_id_1 (buyer) and date. |
| **Ban Reporting Latency** | `ban_report_time - ban_event_time` (in hours) | Manual: Problems tracker update timestamps | Track when ban occurred (from daily check) vs when buyer reported it. |
| **Test Sample Size** | `COUNT(campaigns) per test group` | Keitaro + manual grouping | Count campaigns launched per A/B/C group. Minimum: 30 per group. |
| **Qualitative Observations** | Free text: "account warned but not banned", "ad rejected at review" | Problems tracker update log (type: "note") | Collected from buyers daily, logged as notes on Problem #7 card. |

**UI Placement**: Problem #7 card → expanded shows:
- ScoreBox: Compliance Rate (X%)
- Table: buyer × protocol match (green ✓ / red ✗ per buyer per day)
- ScoreBox: Avg reporting latency (hours)

**Design Rationale**: Buyer compliance is a PEOPLE metric, not a system metric. The table showing per-buyer compliance creates accountability — if a buyer's row is all red, everyone can see it. This is intentional pressure.

---

### Problem 8: PWA Migration

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **PWA Domains Ready** | `COUNT(domains WHERE state = "active")` | Keitaro domains API | Already returning 2,861. Filter for PWA-specific domains. |
| **Domains per CF Account** | `COUNT(domains) GROUP BY cloudflare_account` | Airtable `appvJqFmRGWvenYwS` Domains Control → CloudFlare table | `GET /appvJqFmRGWvenYwS/CloudFlare` → count domains per account. Target: ≤3 per account. |
| **Buyers on Own Funnels (%)** | `campaigns_on_own_PWA / total_campaigns × 100` | Keitaro: campaigns with 🟠 prefix (own PWA) vs campaigns with external names | Parse campaign name: "SKAKAPP"/"BETTER LINKS" = external, "FUNNEL SPACE"/"PWA DIRECT" = own. |
| **Conversion Rate Own vs External** | `conversion_own / clicks_own` vs `conversion_ext / clicks_ext` | Keitaro report grouped by traffic source type | Group by `traffic_source_id` (own sources vs external). Compare CR. |
| **Ban Rate Own vs External** | Manual tracking during pilot | Manual A/B | 5 buyers migrated, compare 2-week ban history. |
| **Integration Response Time** | `PWA_delivered_date - PWA_requested_date` (hours) | Jira FS project cycle time | Already tracked in live Jira integration. FS median: 9 days (needs improvement). |

**UI Placement**:
- Problem #8 card on `/problems` → migration progress
- ALSO on Media Buying `/buying` Operations tab → "Funnel Distribution" section:
  - Donut: own PWA vs external (from campaign type parsing)
  - ScoreBox: migration % (target: 80%)

**Design Rationale**: Migration is a strategic initiative with a clear end state (100% on own funnels). The donut chart on the Buying page makes the current split impossible to ignore. The Problems card tracks the path to get there.

---

### Problem 9: iOS Conversion Gap

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **iOS vs Android CR** | `conversions_ios / clicks_ios` vs `conversions_android / clicks_android` | Keitaro report with device grouping | `grouping: ["device_type"], metrics: ["clicks","conversions"]`. Segment iOS vs Android. |
| **iOS Revenue Share** | `revenue_ios / total_revenue × 100` | Keitaro report with device grouping | Same query, add `revenue`. |
| **Time to Interactive (iOS)** | Lighthouse mobile score | Automated: run Lighthouse CLI against PWA URLs | Script: `lighthouse {url} --output json --only-categories=performance`. |
| **Install Prompt Success Rate** | `successful_installs / install_prompts_shown × 100` | fp-analytics-api (if accessible) OR manual QA count | ❌ Blocked — need fp-analytics-api. Workaround: manual count on 50 test sessions. |
| **Competitor Benchmark Gap** | `our_ios_CR / betterlinks_ios_CR × 100` | Manual: install competitor PWA, record CR from their public stats or estimate | One-time competitive research. Document in Problems tracker. |
| **Gap After Fix** | `fixed_ios_CR / baseline_ios_CR × 100` | Keitaro: A/B with fixed vs old PWA | Keitaro stream split on same offer. Measure over 5 days. |

**UI Placement**: Problem #9 card → expanded shows:
- Two ScoreBoxes side by side: iOS CR vs Android CR (visual gap obvious)
- Bar chart: our iOS vs competitor iOS (benchmark)
- After fix deployed: before/after line chart

Also add to Media Buying `/buying` Overview tab:
- Small "Device Split" widget showing iOS vs Android CR inline

**Design Rationale**: The iOS gap is invisible unless you explicitly compare platforms. Putting iOS vs Android side-by-side on the Buying Overview makes it a permanent awareness item — every time someone checks buying performance, they see the gap.

---

### Problem 10: fb_click_id Filter Gaps

| Metric | Formula | Data Source | Test Matrix |
|--------|---------|-------------|-------------|
| **Android Bot Penetration (with filter)** | Manual: count bot visits that reach offer page on Android after fb_click_id restored | Keitaro: if bots are tagged or if conversion anomalies appear | Monitor Android CR stability for 24h after filter restore. If CR stays stable → no legit traffic lost. |
| **iOS Traffic Volume Change** | `clicks_ios_after_ML / clicks_ios_before_ML × 100` | Keitaro report grouped by device, compare periods | Before: 7-day avg iOS clicks. After ML filter: 7-day avg. Drop > 5% = too aggressive. |
| **iOS Conversion Stability** | `CR_ios_after / CR_ios_before` | Keitaro report grouped by device | Same comparison. CR should stay ≥ 95% of baseline. |

**UI Placement**: Problem #10 card → expanded shows:
- ScoreBox: Android filter status (Active ✓ / Inactive ✗)
- ScoreBox: iOS ML filter status (Active ✓ / Inactive ✗)
- Before/after: iOS traffic volume and CR comparison

**Design Rationale**: Binary status (on/off) for each platform filter, plus the safety metrics (did we lose traffic?). Simple and decisive.

---

## PART 3: UI Placement Summary — Design Critique

### Where Each Problem's Metrics Live

```
Homepage (/)
├── KPI Ribbon: Spend, Revenue, Profit, ROI, Open Problems
├── Dept Card: Media Buying → shows STOP signals, ROI
├── Dept Card: Engineering → sprint, velocity, bugs, blocked
├── Dept Card: Infrastructure → tasks, services, overdue
├── Dept Card: Analytics → self-serve, freshness
├── Active Problems: top 5 with severity dots
└── Insights: auto-generated warnings about STOP buyers, critical problems

Media Buying (/buying)
├── Overview tab
│   ├── KPI row + daily trend chart + top geos
│   ├── NEW: "Device Split" widget (iOS vs Android CR) ← Problem #9
│   └── NEW: "Funnel Distribution" donut (own vs external) ← Problem #8
├── Buyers tab (sortable table with signals)
├── Geo tab (card grid with ROI)
├── Offers tab
│   ├── Keitaro offers table
│   ├── Airtable offer pipeline (active/archive/pending)
│   └── NEW: "White Page Health" (active WPs, reuse rate, new/week) ← Problem #5
└── Operations tab
    ├── Campaign lifecycle (test/active/scaled/killed)
    ├── NEW: "Test Protocol" section (compliance %, sample size) ← Problem #7
    └── NEW: "Migration Progress" bar (% on own funnels) ← Problem #8

Engineering (/engineering)
├── Sprint tab (velocity, progress, history chart)
├── Teams tab (workload bars, bottleneck alerts)
├── Bugs tab (density, count, bugs vs features chart)
└── Epics tab (progress bars, zombie alert)

Processes (/processes)
├── Insights card (auto-generated from all data)
├── Media Buying processes (pipeline + KPIs)
├── Engineering processes (pipeline + KPIs + SLA compliance)
├── Analytics processes (pipeline + KPIs)
├── Infrastructure (Airtable tasks + services)
├── People & Organization (328 people, department bars)
└── NEW: "Data Pipeline Status" (source health + freshness) ← Problem #6

Problems (/problems)
├── Summary strip: total, by status, success rate, with metrics
├── Filter chips: category + severity
├── Problem cards (expand for detail):
│   ├── #1 Cloaking: A/B/C survival rates, daily chart
│   ├── #2 In-App: traffic split donut, funnel comparison
│   ├── #3 WebRTC: leak rate, functional checklist, ban comparison
│   ├── #4 SSAPI: IP count, rollout progress bar, delivery rate
│   ├── #5 White Pages: reuse rate, generation rate, approval comparison
│   ├── #6 Analytics: pipeline coverage, freshness per source
│   ├── #7 Coordination: compliance table, reporting latency
│   ├── #8 Migration: domain readiness, migration %, ban comparison
│   ├── #9 iOS Gap: iOS vs Android CR, competitor benchmark
│   └── #10 fb_click_id: platform filter status, traffic volume safety
└── Each card: hypothesis, test log, before/after metrics
```

### Senior Product Designer Critique

**What works:**
1. **Problems page is the testing command center** — every hypothesis has metrics, every test has before/after. This is operationally correct.
2. **Buying page shows operational reality** — ROI, signals, lifecycle. Adding device split and migration progress embeds strategic metrics into daily workflow.
3. **Cross-pollination is right** — Problem #5 (White Pages) shows on BOTH Problems page AND Buying/Offers. Problem #8 (Migration) shows on BOTH Problems AND Buying/Operations. This means the metrics are visible in context.

**What needs improvement:**
1. **Problem cards are too dense when expanded** — 10 problems × full detail = overwhelming. Add a "Focus Mode" that shows only one problem at a time with full-screen detail.
2. **No timeline view across all tests** — the calendar from the test plan (Day 1-10) isn't reflected in the UI. Add a Gantt-style timeline on the Problems page showing all 10 tests on a shared calendar.
3. **A/B group management is manual** — there's no UI to define groups, assign buyers, or set parameters. For now it's manual (spreadsheet/chat), but v2 should have an "Experiment Builder" component.
4. **Alert thresholds not configurable** — the ≥30% improvement threshold, the <5% traffic loss threshold, the 30-campaign minimum sample — these are hardcoded in the plan but not in the UI. Add a Settings section where these thresholds can be adjusted.
5. **No "test completed" workflow** — when a test reaches Day 10 and the decision point, there's no UI flow for "declare winner → scale up → close problem." The status just changes from "testing" to "resolved." Need a "Decision" status between testing and resolved with the winner recorded.
