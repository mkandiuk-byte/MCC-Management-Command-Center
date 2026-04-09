# Frontend Development Plan v3 — MCC Panel

> Written after: 4 meeting transcripts analyzed, Jira deep-mined (1000+ issues, sprint velocity, bug density, workload), Keitaro fully connected (8,463 campaigns, $3.4M/30d), 20+ backend API routes cataloged, Vibrant Wellness design system studied, Houston spec read.

---

## Who Uses This

**All top management** — you (Head of Product), Alexander (VP Production), Oleksii (Head of Engineering). You all share the Product & Engineering department. Vladov (PM) reports to you. Kuts and Krutko are Product Owners under you.

The panel must answer in **under 5 seconds** any question a leader asks in a meeting:
- "How much did we spend this month?"
- "Which buyer is losing money?"
- "What's blocking the sprint?"
- "How many bugs did we ship?"
- "Is the cloaking fix working?"

---

## The Three Departments

### 1. Media Buying
**What it owns**: All paid traffic — Facebook, Google, TikTok, ASO, GDN, third-party PWA sources.
**Data source**: Keitaro API (campaigns, offers, geos, revenue, cost, ROI). Buyer IDs from Keitaro sub_id for now, mapped properly later via Houston.
**Key metrics**: Spend, Revenue, Profit, ROI, CPA, Ban rate, Rejection rate, Active campaigns, STOP/WATCH signals.
**Problems from calls**: Account bans, primitive cloaking, stale white pages, WebRTC leaks, iOS conversion, event streaming IP, funnel migration.

### 2. Product & Engineering
**What it owns**: All software development — ASD team (Arbitrage Platform), FS team (Funnel Space), infrastructure, automations.
**Data source**: Jira API (sprints, issues, velocity, bugs, epics), GitHub (PRs, commits).
**Key metrics**: Sprint velocity (done/total), Bug density (bugs/total), Cycle time, Blocked items, Epic progress, Code review queue.
**Problems from calls**: 6-month rewrites, inadequate specs, 50% unplanned work, no process accountability, zombie epics.

**What Jira tells us right now**:
- ASD: 44% of work is bugs. Oleh Litvin has 10 items + 4 stuck in review for 11 months. Finance 2.0 is 63% done but the single dev is overloaded.
- FS: 53% of work is bugs — majority is firefighting. Meta Mind has data quality issues (4 active bugs).
- QA bottleneck: Tymofii Konopatov is solo QA for ASD with 10-item queue.
- 8 zombie epics in ASD — created but never decomposed.
- Sprint velocity dropped from 92% to 61% in last ASD sprint.

**Scrum/PM layer** (from Vladov calls): Process framework with stages (Screening → Discovery → Prioritization → Spec → Dev → Delivery → Adoption → Impact). SLA targets: Discovery = 1 week. Every hypothesis must answer cost + impact.

### 3. Analytics
**What it owns**: Currently underperforming ("useless" — your words). You'll conduct analytics yourself.
**Data source**: The analytics service (port 3806) already computes ad-performance, traffic quality, revenue deltas. Keitaro data. Houston DB when available.
**Key metrics**: Self-serve analytics — you need the tools to ask questions and get answers without waiting for anyone.
**What this means for the panel**: Analytics isn't a "department page" — it's a **tool section** where you can pull reports, see conversion quality, compare offers, check revenue reconciliation.

---

## Design System — Vibrant Wellness Adaptation

**Not identical, but the same DNA:**

| Token | Value | Notes |
|-------|-------|-------|
| Background | `#F8F8F8` | Off-white, not pure white |
| Surface (cards) | `#FFFFFF` | White cards on off-white bg |
| Text primary | `#222222` | Near-black |
| Text secondary | `#A7A7A7` | Gray |
| Accent | `#FA5D29` | Orange — CTAs, active states, critical alerts ONLY |
| Success | `#52C67E` | Green |
| Warning | `#FFF083` | Yellow (bg), `#D97706` (text) |
| Error | `#FA5D29` | Same orange as accent (intentional — demands attention) |
| Info | `#49B3FC` | Blue |
| Border | `#EDEDED` | Light gray, 0.5px-1px |
| Border radius | `8px` | Standard, `4px` small, `16px` large |
| Font | `Inter Tight` | Variable weight 300-800 |
| Spacing | `8, 12, 16, 20, 24, 32, 40, 52, 64` | Scale based on 4px grid |
| Shadow | `0 0 6px rgba(0,0,0,0.08)` | Very subtle, only on elevated elements |
| Transitions | `all 0.3s ease` | Standard |
| Max width | `1816px` | With `20px` gutter |

**Typography scale** (clamp-based, fluid):
- Page title: `clamp(26px, 3vw, 42px)` weight 700
- Section header: `clamp(18px, 2vw, 22px)` weight 600
- Card title: `16px` weight 600
- Body: `14px` weight 400
- Caption/label: `11px` weight 600 uppercase tracking `0.05em`
- Numbers (KPIs): `clamp(28px, 4vw, 42px)` weight 800

---

## Page Structure (5 pages total)

### Page 1: Executive Summary (`/`)
**What it shows**: One screen, all departments at a glance. First thing you see.

**Layout** (top to bottom):
1. **Header bar** — "MCC" logo, date range selector (7d/14d/30d/90d), refresh button
2. **KPI ribbon** — 5 score boxes in a row:
   - Total Spend (from Keitaro)
   - Total Revenue (from Keitaro)
   - Profit (computed, green/red)
   - Avg ROI (computed, green/red)
   - Active Problems (from problems tracker, count + critical count)
3. **Three department cards** — equal-width, each with:
   - Department name + status dot (green/yellow/red)
   - 3-4 key metrics as small score boxes
   - Top problem or alert (1-line summary)
   - "View Details →" link
4. **Active Alerts feed** — last 5 alerts sorted by severity
5. **Sprint Status strip** — current sprint name, days remaining, completion % bar, velocity trend sparkline

**Data sources**: `/api/mcc/keitaro/roi` (totals), `/api/mcc/problems` (count), `/api/jira/stats` (sprint), `/api/mcc/keitaro/buyers` (buyer data)

---

### Page 2: Media Buying (`/buying`)
**What it shows**: Campaign performance, buyer efficiency, geo ROI, problems.

**Layout**:
1. **Department header** — "Media Buying" + status + period selector
2. **KPI row** — Spend, Revenue, Profit, ROI, Active Campaigns, STOP Campaigns (score boxes)
3. **Tabs**: Overview | Buyers | Geo | Offers | Problems

**Tab: Overview**
- Daily trend chart (Area chart, spend + revenue lines, profit area)
- Top 5 geos (cards with colored left border by ROI)
- Top 5 offers (mini table)
- Signal distribution (pie: OK/WATCH/STOP/NEW counts)

**Tab: Buyers**
- Sortable table: Buyer ID, Spend, Revenue, Profit, ROI, CPA, Campaigns, STOP count, Signal badge
- Click row → expand with campaign list for that buyer
- Color: green profit, red loss, orange STOP badge

**Tab: Geo**
- Grid of geo cards (3 columns): country name, large ROI %, spend, profit, CPA
- Left border: green (ROI > 0), yellow (ROI -20 to 0), red (ROI < -20)
- Sorted by profit descending

**Tab: Offers**
- Table: Offer name, Revenue, Cost, Profit, ROI, Conversions, CR
- Top 10 by revenue, bottom 5 by profit (two sections)
- Conversion quality indicators (from traffic-quality API)

**Tab: Problems**
- Filtered view of Problems Tracker — only buying-related categories
- Same kanban/list as the dedicated Problems page

**Data sources**: `/api/mcc/keitaro/buyers`, `/api/mcc/keitaro/roi`, `/api/mcc/problems?category=cloaking,white_pages,account_health,ios,event_streaming,funnel_migration`

---

### Page 3: Product & Engineering (`/engineering`)
**What it shows**: Development health, sprint analytics, team workload, bugs, epics.

**Layout**:
1. **Department header** — "Product & Engineering" + status
2. **KPI row** — Sprint Completion %, Bug Density %, Avg Cycle Time, Blocked Items, Epics In Progress, Open PRs
3. **Tabs**: Sprint | Teams | Bugs | Epics | Process

**Tab: Sprint**
- Current sprint card: name, goal, dates, progress bar (done/total issues)
- Velocity chart (last 5 sprints — bar chart with completion % line overlay)
- Planned vs Unplanned ratio (donut)
- Carry-over count with trend

**Tab: Teams**
- Two team cards (ASD + FS):
  - Team name, sprint name, member count
  - Per-member workload bars (in-progress item count, color by load: green ≤3, yellow 4-6, red 7+)
  - Bottleneck highlight: who has most items, who has items stuck longest
- **Key insight from Jira**: Oleh Litvin (10 items, 4 stuck 11 months), Tymofii (10 QA items — solo bottleneck)

**Tab: Bugs**
- Bug density chart: bugs vs features per sprint (stacked bar)
- Bug-to-feature ratio: ASD 44%, FS 53% (prominently displayed as score boxes)
- Recent bugs list with severity, assignee, age
- Trend: is bug density going up or down?

**Tab: Epics**
- Active epics with progress bars (done/total children)
- Status: color-coded by progress (green >75%, yellow 25-75%, red <25%)
- Zombie epic callout: "8 epics created but never decomposed" — red alert card
- From Jira: Finance 2.0 (63%), Keitaro Manager (90%), ID Check (86%), Meta Mind (37%), Landing Manager (0%)

**Tab: Process**
- Vladov's framework stages as a horizontal pipeline
- Count per stage (items currently in Screening, Discovery, Spec, Dev, etc.)
- SLA indicators: green if within target, red if overdue
- Simple table, not React Flow — shows bottlenecks clearly

**Data sources**: `/api/jira/stats`, `/api/jira/boards/1022` (ASD), `/api/jira/boards/956` (FS), Jira API direct calls for velocity/bugs

---

### Page 4: Analytics Workbench (`/analytics`)
**What it shows**: Self-serve analytics tools. YOU are the analytics team now.

**Layout**:
1. **Header** — "Analytics" + date range
2. **Quick Stats row** — Total clicks, conversions, revenue, CR, avg CPA (from Keitaro)
3. **Tabs**: Ad Performance | Conversion Quality | Geo Benchmarks | Report Builder

**Tab: Ad Performance**
- The existing analytics service endpoint (`/api/analytics/ad-performance`) already computes everything
- Table: campaign, buyer, spend, revenue, profit, ROI, signal (STOP/WATCH/OK/NEW)
- Filter by buyer, min spend, group by campaign or offer
- Signal distribution chart

**Tab: Conversion Quality**
- From existing `/api/analytics/traffic-quality/offers`: approval rate, rejection rate, avg days to approve
- Revenue delta: Keitaro vs Scaleo reconciliation
- Highlight discrepancies > 20%

**Tab: Geo Benchmarks**
- From existing `/api/keitaro/geo-benchmarks`: CPA range per geo (min/avg/max)
- Historical context: what's normal CPA for GB? For CA?

**Tab: Report Builder**
- Simple form: select metrics, grouping, date range, filters
- Calls Keitaro report API
- Results in table format, exportable

**Data sources**: `/api/analytics/*`, `/api/keitaro/geo-benchmarks`, `/api/mcc/keitaro/roi`

---

### Page 5: Problems & Initiatives (`/problems`)
**What it shows**: All operational problems, their status, test results, metrics.

**Layout**:
1. **Header** — "Problems & Initiatives" + filters
2. **Summary strip** — Total, Investigating, Testing, Measuring, Resolved (count badges)
3. **View toggle**: List | Kanban
4. **Filter bar** — category chips, severity dropdown, owner dropdown

**List view** (default):
- Sortable table: Title, Category, Severity, Owner, Status, Metric (baseline → current), Last Update, Age
- Click row → expands inline with hypothesis, test log, metric chart
- Severity dot: red (critical), orange (high), blue (medium), gray (low)

**Kanban view**:
- 4 columns: Investigating | Testing | Measuring | Resolved
- Cards: title, severity dot, category badge, owner, time since last update

**Problem detail** (click to expand or navigate):
- Hypothesis card (highlighted, left border accent)
- Metric tracking: baseline → current → target with progress bar
- Timeline of updates (test results, notes, status changes)
- Action buttons: Log Test Result, Change Status, Add Note

**Data sources**: `/api/mcc/problems`, `/api/mcc/problems/[id]`, `/api/mcc/problems/[id]/updates`

---

## Navigation

**Left sidebar** (persistent, collapsible):
- Logo: "MCC"
- Summary (/) — Home icon
- Media Buying (/buying) — TrendingUp icon
- Product & Engineering (/engineering) — Code icon
- Processes & KPIs (/processes) — GitBranch icon
- Analytics (/analytics) — BarChart icon
- Problems (/problems) — AlertTriangle icon
- Divider
- Settings — Gear icon

**Active state**: Left border accent (#FA5D29), bold text, slight bg highlight (#F8F8F8 on white sidebar)

**Sidebar style**: White background, 240px width, 0.5px right border #EDEDED. Collapsible to icon-only (48px).

---

## Component Inventory (what we build)

| Component | Used Where | Notes |
|-----------|-----------|-------|
| `ScoreBox` | Every page KPI row | Label (caption), Value (large number), Sub (delta/context) |
| `DeptCard` | Home page | Department summary card with metrics + status |
| `DataTable` | Buyers, Offers, Bugs, Ad Perf, Problems | Sortable, filterable table with hover + expand |
| `GeoCard` | Buying/Geo tab | Country card with ROI, left border, metrics |
| `TrendChart` | Home, Buying/Overview, Sprint | Area/Line chart (recharts) |
| `VelocityChart` | Engineering/Sprint | Bar chart with % line overlay |
| `ProgressBar` | Epics, Sprint, Problem metrics | Thin bar showing done/total |
| `SignalBadge` | Buyers, Ad Performance | OK/WATCH/STOP/NEW pill |
| `SeverityDot` | Problems | Small colored dot + text |
| `CategoryBadge` | Problems | Subtle pill with category color |
| `StatusBadge` | Problems | Status text with bg tint |
| `AlertCard` | Home, anywhere | Problem/alert summary with severity |
| `SparkLine` | Home, tables | Tiny inline trend chart |
| `FilterChips` | Problems, tables | Toggle filter pills |
| `DateRangeSelector` | Header | 7d/14d/30d/90d pill buttons |
| `SideNav` | Layout | Persistent sidebar navigation |
| `TabBar` | Department pages | Horizontal tab navigation |
| `PipelineStages` | Engineering/Process, Processes page | Horizontal stage indicators with counts |
| `InsightsCard` | Every page (top) | Collapsible card with computed observations, warning/success icons |
| `ProcessSection` | Processes page | Department process table with pipeline diagram + KPI scorecard |
| `KpiScorecard` | Processes page | Grid of score boxes with target, trend, status dot |
| `BottleneckAlert` | Processes, Engineering | Red callout card for critical bottleneck |

---

## What Aligns With Which Problem

| Problem (from calls) | Where it appears | How it's addressed |
|----------------------|-----------------|-------------------|
| "Don't know which buyer works with what efficiency" | Buying/Buyers tab | Sortable buyer table with ROI, profit, signal badges |
| "Need to see ROIs" | Home KPI row, Buying/Geo tab, Buying/Overview | ROI everywhere — score boxes, geo cards, trend charts |
| "Account bans destroying buying" | Problems page, Buying/Problems tab, Home alerts | Problem card with hypothesis, test log, before/after metrics |
| "White pages not rotated" | Problems page | Pre-seeded problem card tracking rejection rate |
| "WebRTC leaks" | Problems page | Pre-seeded problem card tracking account lifespan |
| "iOS conversion gap" | Problems page, Buying/Offers (device split) | Problem card + offer-level device comparison |
| "Event streaming single IP" | Problems page | Problem card tracking account linkage |
| "Funnel migration stuck" | Problems page | Problem card tracking % on in-house funnels |
| "Devs take 6 months for 1-week work" | Engineering/Sprint, Engineering/Bugs | Velocity chart showing decline, cycle time metric |
| "Product owners deliver bad specs" | Engineering/Process tab | Process pipeline showing SLA breaches |
| "50% unplanned work" | Engineering/Sprint | Planned vs Unplanned donut chart |
| "Analytics takes months" | Analytics page | Self-serve tools — no waiting |
| "No unified visibility" | Home page | Executive summary — all departments on one screen |
| "Need before/after metrics for Houston" | Problems page | Every problem has baseline → current → target tracking |
| "Oleh Litvin overloaded" | Engineering/Teams | Workload bars showing 10 items, 4 stuck 11 months |
| "QA bottleneck (Tymofii solo)" | Engineering/Teams | Workload bars showing single QA with 10-item queue |
| "Zombie epics never decomposed" | Engineering/Epics | Red alert card: "8 epics created but never broken down" |
| "FS is 53% bug-fixing" | Engineering/Bugs | Bug density score box showing 53% prominently |

---

## Page 6: Processes & KPIs (`/processes`)
**What it shows**: Every department's actual processes, their health, and AI-generated insights about what's going wrong.

**Layout**:
1. **Header** — "Processes & KPIs" + department filter (All / Media Buying / Product & Engineering / Analytics)
2. **Insights Panel** (top, full-width, highlighted card with left accent border)
3. **Department process sections** (one per department)

### Insights Panel — "What's Happening Now"
A dynamically generated analysis block that reads like a brief from a chief of staff. Computed from real data:

```
⚠️ 3 issues requiring attention

1. FS team spends 53% of capacity on bug-fixing — only 47% goes to features.
   This has been consistent for 90 days. Unless bug root causes are addressed,
   feature delivery will remain constrained.

2. ASD Code Review queue has 13 items. Oleh Litvin holds 10 active items
   including 4 stuck in review since May 2025 (11 months). This is a single
   point of failure for Finance 2.0.

3. Sprint velocity dropped from 92% → 61% in the last ASD sprint (MB AP 19).
   Previous 4 sprints averaged 87%. Investigate scope creep or resource changes.

✅ 2 positive signals

1. Keitaro Manager epic is 90% complete (30/33 items done). On track for closure.
2. FS sprint completion rate is stable at 88-96% over last 4 sprints.
```

**How this is computed**: Not AI-generated in real-time. It's a **rule-based analysis engine** that checks:
- Bug ratio > 40% → flag
- Any person with > 8 active items → flag
- Any item in same status > 30 days → flag
- Sprint velocity drop > 20% from 4-sprint average → flag
- Epic > 75% complete → positive signal
- Sprint completion stable > 85% for 3+ sprints → positive signal

This runs on page load using data from Jira API and problems tracker. No LLM needed.

### Media Buying Processes

| Process | Steps | KPIs | Status |
|---------|-------|------|--------|
| **Campaign Launch** | Hypothesis → Creative → Account Setup → Launch → Monitor → Optimize/Kill | Time to launch, Campaign survival rate (days before ban), CPA vs target | Data from Keitaro + Problems tracker |
| **Cloaking Management** | Select service → Configure → Test → Deploy → Monitor bans | Ban rate reduction %, Pass-through rate | Problem card: "Primitive cloaking" |
| **Account Farming** | Acquire accounts → Farm (2-3 weeks) → Structure (king/slave) → Deploy | Account lifespan (days), Accounts active count | Manual metric input |
| **White Page Rotation** | Generate/acquire → Deploy → Rotate per campaign | Rejection rate %, Unique pages per campaign | Problem card: "White pages" |
| **Funnel Migration** | Identify buyer → Set up in-house funnel → Test → Migrate traffic | % buyers on in-house, Conversion rate comparison | Problem card: "Funnel migration" |

**KPI Scorecards** (from Keitaro):
- Overall ROI: `8.2%` (30-day) — target: `>15%`
- Monthly profit: `$278K` — showing trend
- STOP campaigns: count — target: `0`
- Avg CPA: by geo — vs benchmark
- Ban rate: from manual daily input

### Product & Engineering Processes

| Process | Steps (from Jira workflow) | KPIs | Current Health |
|---------|---------------------------|------|----------------|
| **ASD Dev Pipeline** | Open → In Progress → Code Review → In Review → QA → Ready to Stage → RC → Done | Avg cycle time: `19.1d`, QA time: `22.4h`, Code Review time: `12.7h` | 🟡 QA bottleneck (22h avg), Code Review accumulation (13 items) |
| **FS Dev Pipeline** | To Do → Design → In Progress → Code Review → Ready for Testing → QA in Testing → Ready to Stage → Closed | Avg cycle time: `14.6d`, Staging bottleneck: `2.6 days` | 🔴 "Ready to Stage" is 2.6 days avg — deployment process is manual/batched |
| **Sprint Cadence** | Planning → Daily → Review → Retro (2-week cycles ASD, irregular FS) | Velocity (done/total), Completion rate, Carry-over | 🟡 ASD velocity dropped to 61%. FS cadence is irregular (1-4 weeks) |
| **Hypothesis → Delivery** (Vladov framework) | Screening → Discovery (1 wk) → Prioritization → Spec → Dev → Delivery → Adoption → Impact | Discovery time, Spec completeness, Delivery vs estimate | 🔴 No data yet — process just being established |
| **Bug Triage** | Reported → Reproduced → Prioritized → Fixed → Verified | Bug density (bugs/total), Reopen rate, Time to fix | 🔴 ASD: 44% bugs, FS: 53% bugs, 6 items currently Reopened |

**KPI Scorecards** (from Jira):
- Sprint velocity: ASD `61%` (last) vs `87%` (avg) — 🔴
- Bug density: ASD `44%`, FS `53%` — 🔴
- Blocked items: `12` in ASD — 🟡
- Zombie epics: `8` never decomposed — 🔴
- Avg cycle time: ASD `19d`, FS `15d` — 🟡
- QA queue: Tymofii `10 items` (solo) — 🔴
- Code review queue: Oleh `7 items` (11 months stale) — 🔴

### Analytics Processes

| Process | Steps | KPIs | Current Health |
|---------|-------|------|----------------|
| **Report Request → Delivery** | Request received → Queued → Analysis → Review → Delivered | Time to deliver (currently: weeks/months), Request backlog size | 🔴 Described as "useless" — requests take months |
| **Data Pipeline** | Source sync → Transform → Aggregate → Visualize | Pipeline freshness (Keitaro sync every 15min via Dagster), Data quality (join loss rate) | 🟢 Dagster pipeline exists and runs |
| **Self-Serve Analytics** | User query → Data source → Visualization | Query response time, Coverage (what % of questions can be answered without help) | 🟡 Analytics service exists (ad-performance, traffic quality) but no UI for self-serve |

**KPI Scorecards**:
- Report turnaround: currently `weeks` — target: `< 1 day` (self-serve)
- Data freshness: Keitaro `15 min`, Scaleo `15 min`, Houston `when available`
- Self-serve coverage: `partial` — ad-performance and traffic quality available, but no report builder UI yet

### Visualization

Each department section shows:
1. **Process pipeline diagram** — horizontal boxes connected by arrows, with item counts per stage and color by health (green/yellow/red)
2. **KPI scorecard grid** — score boxes with current value, target, trend arrow, and status dot
3. **Bottleneck highlights** — red callout cards for any KPI in red zone

---

## "Insights" Field — Appears on EVERY Page

Not just the Processes page. Every department page gets a collapsible **"Insights" card** at the top showing computed observations:

**Home page insights** (cross-department):
- "Media Buying profit is $278K on $3.4M spend (8.2% ROI). GB and CA carry 94% of profit. DE is losing $70K/month."
- "Product & Engineering sprint velocity dropped 30% last sprint. 53% of FS work is bug-fixing."
- "12 items are blocked in ASD. Single developer (Oleh Litvin) is a bottleneck."

**Media Buying insights**:
- "Only 5 of top 20 campaigns by spend are profitable. The other 15 are burning money."
- "Germany (DE) is the largest loss-maker at -$70K/30d. Consider pausing or restructuring DE campaigns."
- "Brazil has extremely low CPA ($5) but -54% ROI — high volume, low quality traffic."

**Engineering insights**:
- "Finance 2.0 (ASD-694) is 63% complete but single-threaded through Oleh Litvin. Risk of delay."
- "FS has 76 items in To Do/Backlog but only 11 in progress — pipeline is starved."
- "No issues have been canceled in 90 days. Consider backlog grooming — stale items accumulate."

**All computed from real data.** Rule-based, not AI. Specific thresholds trigger specific observations.

---

## Build Order (Updated)

| Step | What | Dependencies | Duration |
|------|------|-------------|----------|
| 1 | Design system (globals.css, tokens, Inter Tight) | None | Day 1 morning |
| 2 | Layout shell (sidebar, page frame, responsive) | Step 1 | Day 1 afternoon |
| 3 | Shared components (ScoreBox, DataTable, SignalBadge, etc.) | Step 1 | Day 2 |
| 4 | Home page (Executive Summary + insights) | Steps 2-3 | Day 3 |
| 5 | Media Buying page (all tabs + insights) | Steps 2-3 | Day 4 |
| 6 | Product & Engineering page (all tabs + insights) | Steps 2-3 | Day 5 |
| 7 | Processes & KPIs page | Steps 2-3 | Day 6 |
| 8 | Problems page (list + kanban + detail) | Steps 2-3 | Day 7 |
| 9 | Analytics page (all tabs) | Steps 2-3 | Day 8 |
| 10 | Insights engine + polish + responsive | All | Day 9 |

**Total: 9 days to fully functional panel.**

| Step | What | Dependencies | Duration |
|------|------|-------------|----------|
| 1 | Design system (globals.css, tokens, Inter Tight) | None | Day 1 morning |
| 2 | Layout shell (sidebar, page frame, responsive) | Step 1 | Day 1 afternoon |
| 3 | Shared components (ScoreBox, DataTable, SignalBadge, etc.) | Step 1 | Day 2 |
| 4 | Home page (Executive Summary) | Steps 2-3 | Day 3 |
| 5 | Media Buying page (all tabs) | Steps 2-3 | Day 4 |
| 6 | Product & Engineering page (all tabs) | Steps 2-3 | Day 5 |
| 7 | Problems page (list + kanban + detail) | Steps 2-3 | Day 6 |
| 8 | Analytics page (all tabs) | Steps 2-3 | Day 7 |
| 9 | Polish, mobile responsive, edge cases | All | Day 8 |

**Total: 8 days to fully functional panel.**

---

## What We're NOT Building (Scope Control)

- No auth/login (add later)
- No push notifications (add later)
- No dark mode (Vibrant Wellness is light, period)
- No settings page (hardcode configs for now)
- No custom KPI builder (hardcode the metrics)
- No React Flow diagrams (tables and progress bars instead)
- No hypothesis portfolio/Gantt (use Jira, Problems page covers initiatives)
- No PDF reports (screenshots work)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data mapping breaks (like last time) | Every component receives data through a typed adapter function. API response → typed interface → component. One place to fix mappings. |
| Jira/Keitaro services not running | Graceful fallbacks: show "Service unavailable" with last-known data timestamp. Never crash. |
| Design doesn't match reference | Build design system FIRST (step 1). Every component uses CSS variables from the system. No inline hex values except in the design system file. |
| Scope creep | This document IS the scope. 5 pages, 17 components, 8 days. Nothing else. |
