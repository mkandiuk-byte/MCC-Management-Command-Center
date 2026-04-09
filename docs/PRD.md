# PRD: Management Command Center (MCC) — v2

> **v2 changelog**: Rewritten after PM/UX critique. Reordered phases by revenue impact. Killed engineering-first Phase 1. Added workflows and actions to every screen. Defined MVP. Added kill criteria.

---

## Executive Summary

The buying division is bleeding money. FB accounts are getting banned, ads rejected, and campaigns running inefficiently — to the tune of millions in wasted/lost spend. Meanwhile, management has zero unified visibility and the analytics team takes months to answer basic questions.

**This is not a dashboard project. This is a crisis response tool that happens to look like a dashboard.**

We ship the Buying War Room in Week 1. Everything else follows.

---

## 1. Problem Statement (Priority-Ranked)

### P1 🔴 CRITICAL — Buying Division in Crisis
- Massive FB account bans from intensified detection (Feb 2026+)
- Primitive cloaking (geo-only), no behavioral bot detection
- White pages reused hundreds of times (FB has seen them all)
- WebRTC leaks in Dolphin exposing real IPs → account linkage
- Event streaming from single IP → linkage risk
- iOS conversion underperformance on PWAs
- **Impact: millions of dollars in lost/wasted ad spend per month**
- **Urgency: every day without visibility = more burned money**

### P2 🟡 HIGH — No Unified Operational Visibility
- Data siloed across Keitaro, Jira, MetaMind, GitHub, analytics
- Can't answer "how is each division performing vs targets?"
- Analytics requests take months → decisions made blind

### P3 🟡 HIGH — No Process Accountability
- 60 staff, only CTO feels ownership
- Devs: 6-month rewrites of 1-week vibe-code projects
- Product owners: inadequate specs → downstream delays
- 50% of sprint capacity consumed by firefighting
- No enforcement of software adoption post-delivery

### P4 ⚪ MEDIUM — Slow Development Cycle
- No standardized PRD/spec process
- No visibility into dev velocity or quality
- Hypotheses not tracked as investments

---

## 2. Target Users (3 Core Personas, Not 6)

We serve 3 audiences with 3 distinct views. Not 7 modules for 6 roles.

| Persona | View | Daily Use Case |
|---------|------|---------------|
| **Buyer / Division Head** | Buying Operations | "Which campaigns are burning? Which accounts just died? What do I do about it?" |
| **CEO / Head of Product** | Management Overview | "Is the company making money? Where are the fires? Are initiatives on track?" |
| **PM / CTO** | Dev & Process | "Is the team shipping? Where are the bottlenecks? What's the code quality?" |

---

## 3. Design Principles

1. **Action-First**: Every screen answers "what can I DO about this?" — not just "what do I see?"
2. **Mobile-Real**: Buyers live on phones. Two separate experiences: mobile war room (sorted lists, one-tap actions) and desktop full dashboard. Not "responsive" cramming.
3. **Ship-First**: Phase 0 delivers value in 5 days. No 2-week schema-only foundations.
4. **Data Over Architecture**: Use manual input + existing APIs first. Don't wait for blocked integrations.
5. **Kill What Doesn't Work**: Every phase has kill criteria. If nobody logs in, we pivot before building more.

---

## 4. Feature Spec (by View)

### VIEW 1: Buying Operations (Buyers + Division Heads)

#### 4.1 Campaign War Room
**Purpose**: Buyer's daily cockpit — what's burning, what's working, what to do

**Mobile Layout** (375px):
- Sort-by dropdown: "Worst first" / "Biggest spend" / "Most rejected"
- Campaign cards: Name | Status pill | Spend today | CPA | ▲▼ trend
- Tap card → Actions drawer

**Desktop Layout** (1280px+):
- Table view with inline status, sparklines, filters
- Side panel for campaign detail + actions

**Actions per campaign** (not just display):
| Trigger | Action Button | What It Does |
|---------|--------------|--------------|
| CPA > target by 20% | ⚠️ Flag for Review | Creates Jira ticket, notifies buyer + division head |
| Account banned | 🔴 Escalate | Notifies farming team + logs to problem tracker |
| Rejection spike | 📋 Create Task | Pre-fills Jira ticket with campaign context |
| Campaign underperforming | ⏸️ Recommend Pause | Sends push notification to buyer with rationale |

**Data Sources**: Keitaro (existing), Houston DB (Phase 1 fallback: cached Keitaro aggregation)

#### 4.2 Account Health Monitor
**Purpose**: See ban/rejection trends, catch spikes early

**Display**:
- Ban count: today / this week / trend chart
- Rejection rate: today / this week / trend chart
- Account lifespan: avg days before ban (30-day rolling)
- Active accounts count

**Actions**:
| Trigger | Action |
|---------|--------|
| Ban spike (>X in Y hours) | Push notification to division head + auto-create problem ticket |
| Rejection rate > threshold | Flag accounts, suggest cloaking rotation |

**Data Source**: MetaMind if available, otherwise **manual daily input form** (takes 2 min, gets us live in Week 1)

#### 4.3 Buying Problems Tracker (THE MVP)
**Purpose**: Track the 6 crisis categories, assign owners, measure fixes

**Categories** (pre-seeded from meeting analysis):
1. 🔒 **Cloaking** — Testing hox.tech, Palladium, HighClick; A/B results
2. 📄 **White Pages** — Rotation freshness, generation pipeline, unique pages per campaign
3. 💀 **Account Health** — Ban patterns, farming quality, WebRTC leaks, Dolphin config
4. 📱 **iOS Performance** — PWA conversion gap vs Android, template improvements
5. 🔗 **Event Streaming** — Single-IP risk, proxy diversification status
6. 🔄 **Funnel Migration** — Progress moving buyers from BetterLink/Skycoin → FinalSpace/PVA

**Per Problem Card**:
- Severity (critical/high/medium/low)
- Owner (assigned person)
- Hypothesis: "If we do X, we expect Y"
- Status: Investigating → Testing → Measuring → Resolved/Failed
- Test log: dated entries with metrics (before/after)
- **One-click actions**: Assign to person, Create Jira ticket, Log test result, Mark resolved

**This is a CRUD app. No external APIs needed. Ships in 3-5 days.**

---

### VIEW 2: Management Overview (CEO + Head of Product)

#### 4.4 Company Dashboard
**Purpose**: One-screen company health

**Layout** (4 quadrants):
1. **Top-left**: Revenue / Spend / Margin — current period vs target (from Keitaro/Houston)
2. **Top-right**: Division cards with traffic light + 1-line summary ("Meta: 🔴 Ban rate +40% this week")
3. **Bottom-left**: Active alerts feed (most critical first)
4. **Bottom-right**: Initiative pipeline — counts per stage

**Actions**:
| Element | Click Action |
|---------|-------------|
| Division card | Drill-down to Division Dashboard |
| Alert | Expand → see context → Assign/Escalate/Dismiss |
| Initiative count | Drill-down to filtered list |

**Traffic Light Logic**:
- 🟢 Green: All KPIs within target
- 🟡 Yellow: Any KPI in warning zone (configurable threshold)
- 🔴 Red: Any KPI in critical zone OR unresolved critical alert

**Who sets thresholds?** Division heads set their own targets in Settings. Head of Product approves. Default: ±20% for yellow, ±40% for red.

#### 4.5 Division Dashboard
**Purpose**: Drill-down per division

**Tabs**:
1. **Performance** — Campaign metrics from Keitaro (reuse existing analytics service)
2. **Account Health** — Ban/rejection trends (MetaMind or manual)
3. **Problems** — Filtered buying problems for this division
4. **Team** — Members, assignments, buyer performance

#### 4.6 Alerts with Escalation
**Purpose**: Not just show alerts — drive resolution

**Escalation Logic**:
```
Alert created → Push to owner
  └─ If unread for 30 min → Push to division head
     └─ If unresolved for 2 hours → Push to Head of Product
        └─ If unresolved for 24 hours → Auto-create weekly report item
```

**Alert Resolution Flow**:
1. Alert fires (auto-generated from thresholds or manual)
2. Owner receives push + in-app notification
3. Owner clicks → sees context + suggested actions
4. Owner picks action: Assign, Create Ticket, Acknowledge, Dismiss (with reason)
5. Resolution logged with timestamp and notes
6. Before/after metric captured

**Alert Fatigue Prevention**:
- Max 5 push notifications per hour per user
- Batch yellow alerts into hourly digest
- Critical (red) always push immediately
- User can mute specific alert types in settings

---

### VIEW 3: Dev & Process (PM + CTO)

#### 4.7 Sprint Analytics
**Purpose**: Vladov's scrum control panel

- Velocity chart (story points per sprint)
- Planned vs Unplanned ratio
- Sprint completion rate
- Carry-over items
- **Action**: Click underperforming sprint → pre-filled retro template

**Source**: Jira API (existing service, add computed routes)

#### 4.8 Process Bottlenecks (Simple Table, Not React Flow)
**Purpose**: Show where things are stuck

| Stage | Items | Avg Time | SLA | Overdue | Action |
|-------|-------|----------|-----|---------|--------|
| Discovery | 3 | 4.2 days | 5 days | 1 | View items → nudge owner |
| Spec Writing | 2 | 8 days | 7 days | 1 | View items → escalate |

**Not a React Flow graph** (nobody will use it on mobile; table is more actionable).

**Action per overdue item**: One-click "Nudge" sends message to owner. Two-click "Escalate" notifies their manager.

---

## 5. What We're NOT Building (Scope Cuts)

| Cut Feature | Reason | Alternative |
|-------------|--------|-------------|
| Hypothesis Portfolio (Kanban/Gantt/Investment) | Over-engineering; Jira does this | Use Jira with "Hypothesis" issue type + custom fields |
| React Flow Process Map | Two-person audience; unusable on mobile | Simple bottleneck table (4.8) |
| AI Code Review scores | Doesn't address revenue crisis | Defer to Phase 4+ |
| Custom KPI Formula Builder | Admin tool for later | Hardcode initial KPIs |
| PDF Report Generation | Not urgent; screenshots work | Defer indefinitely |
| Dependency Graph visualization | Cool but not actionable | Track dependencies as text field on hypothesis |
| Developer Performance ranking | Sensitive; needs change management first | Defer to Phase 4 with proper rollout plan |

---

## 6. Data Architecture

### 6.1 Data Sources (by availability)

| Source | Available Now? | Phase |
|--------|---------------|-------|
| **Keitaro** | ✅ Yes (existing service) | Phase 0 |
| **Jira** | ✅ Yes (existing service) | Phase 1 |
| **GitHub** | ✅ Yes (existing service) | Phase 2 |
| **Houston DB** | 🟡 Monday (Oleksii providing access) | Phase 1 |
| **MetaMind** | 🔴 Blocked (no API docs yet) | Phase 1 fallback: manual input |
| **Keitaro Manager** | 🟡 Need access clarification | Phase 1 |

### 6.2 Database: Lean Schema (PostgreSQL)

Only what's needed for MVP:

```
problems          — Buying problems CRUD (Phase 0)
problem_updates   — Test results log per problem
alerts            — Generated + manual alerts
alert_responses   — Resolution tracking
divisions         — Company structure (seed data)
kpi_snapshots     — Daily KPI values (computed from sources)
```

**Deferred tables** (build when needed): `hypotheses`, `process_stages`, `kpi_targets` (per-person), `people` (use Jira/GitHub user data instead).

### 6.3 Manual Input as First-Class Data Source

For MetaMind data (blocked), account health, and anything without an API:
- Simple forms: "Log today's ban count", "Log today's rejection rate"
- Takes 2 minutes per day
- Gets us live immediately instead of waiting for API integration
- When MetaMind API becomes available, auto-populate instead

---

## 7. Technical Architecture

Same stack as existing AAP Panel:

```
┌─────────────────────────────────────────┐
│        Next.js 15 Frontend              │
│   3 Views: Buying | Management | Dev    │
│   Mobile-First + PWA + Push             │
├─────────────────────────────────────────┤
│           API Routes (App Router)       │
│  /api/problems  /api/alerts             │
│  /api/dashboard  /api/divisions         │
├─────────────────────────────────────────┤
│        Backend Services (existing)      │
│  analytics | jira | keitaro | claude    │
│  + houston (new, Phase 1)              │
├─────────────────────────────────────────┤
│  PostgreSQL (new) │ Redis │ External    │
└─────────────────────────────────────────┘
```

**Key decision**: No separate `processes` service for v1. Problems tracker and alerts live in Next.js API routes with direct PostgreSQL access. Extract to service later if needed.

---

## 8. Phased Rollout (Revenue-Impact Order)

### Phase 0: Buying War Room — Week 1
**Ship by Friday. No excuses.**

| Deliverable | Business Value |
|------------|---------------|
| Buying Problems Tracker (6 categories, CRUD, kanban) | Division heads track the crisis in one place |
| Manual account health input form | Daily ban/rejection data without waiting for MetaMind |
| Push notification shell (PWA + service worker) | Foundation for alerts |
| Mobile-responsive layout | Buyers can use on phones |

**Kill criteria**: If < 3 people use it in Week 2, interview them before proceeding.

**No external APIs needed. No schema migrations. SQLite or single PostgreSQL table.**

### Phase 1: Division Operations — Weeks 2-3
**Buyers and division heads make daily decisions faster.**

| Deliverable | Business Value |
|------------|---------------|
| Campaign performance view (from Keitaro) | See what's burning without logging into Keitaro |
| Houston DB integration (if access received) | Historical analytics self-serve |
| Alert system with escalation | Problems get fixed, not just seen |
| Actions on every alert (assign, ticket, escalate) | Transforms passive display into ops tool |
| MetaMind integration OR enhanced manual input | Account health tracking |

**Kill criteria**: If buyers still prefer going to Keitaro directly after 2 weeks, we're building the wrong thing.

### Phase 2: Management Overview — Week 4
**CEO and Head of Product get the "one screen" they need.**

| Deliverable | Business Value |
|------------|---------------|
| Company overview dashboard (KPIs from Keitaro/Houston) | Single source of truth for leadership |
| Division traffic lights with drill-down | Instantly see which division needs attention |
| Alert feed on dashboard | Management sees problems as they happen |
| KPI threshold configuration | Division heads set their own targets |

**Kill criteria**: If management checks it < 3x/week after 2 weeks, the KPIs are wrong — revisit with stakeholders.

### Phase 3: Workflows & Actions — Weeks 5-6
**Turn the dashboard from a display into an operations tool.**

| Deliverable | Business Value |
|------------|---------------|
| One-click Jira ticket from any alert/problem | Bridges dashboard to execution |
| Escalation rules engine | Problems don't get ignored |
| Buyer push notifications for campaign issues | Real-time awareness on mobile |
| Notification preferences per user | Prevent alert fatigue |

### Phase 4: Dev Analytics — Weeks 7-8 (if needed)
**Only if buying crisis is stabilized.**

| Deliverable | Business Value |
|------------|---------------|
| Sprint analytics from Jira | PM sees velocity and bottlenecks |
| Process bottleneck table | SLA tracking for stages |
| PR metrics from GitHub | Development quality visibility |

**Decision gate**: Only start Phase 4 if Phase 0-2 are adopted and buying metrics show improvement.

---

## 9. Success Metrics (Per Phase)

| Phase | Metric | Target | Measurement |
|-------|--------|--------|-------------|
| Phase 0 | Daily active users (buying team) | ≥ 3 | Analytics |
| Phase 0 | Problems tracked with test results | ≥ 10 entries in week 1 | DB count |
| Phase 1 | Time to detect campaign anomaly | < 30 min (from hours) | Alert timestamp vs incident |
| Phase 1 | Alerts with resolution logged | ≥ 70% | DB query |
| Phase 2 | Management weekly logins | 100% target roles | Analytics |
| Phase 2 | Buying ban rate | -15% from baseline | MetaMind/manual data |
| Phase 3 | Avg alert resolution time | < 4 hours | DB query |

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| MetaMind API never materializes | Manual input form (Phase 0) is the fallback AND the MVP |
| Houston DB access delayed | Use Keitaro aggregation directly; slower but works |
| Buying team doesn't adopt | Ship in Week 1, interview by Week 2, pivot by Week 3 |
| Alert fatigue (too many notifications) | Hard caps + digests + severity filtering from day 1 |
| Scope creep from stakeholders | This PRD is the scope. Hypothesis portfolio, React Flow, AI code review are explicitly cut. |
| Building for managers, not users | Phase 0 ships to BUYERS (the actual users), not management |

---

## 11. Open Questions (Blocking)

| Question | Blocker For | Owner | Deadline |
|----------|------------|-------|----------|
| Houston DB access + schema docs | Phase 1 | Oleksii | This Monday |
| MetaMind API availability | Phase 1 (non-blocking: fallback to manual) | Oleksii/Alexander | This week |
| KPI thresholds: who sets, what values? | Phase 2 traffic lights | Alexander | Before Phase 2 |
| Keitaro Manager vs Keitaro: offer metadata access | Phase 1 CPA/spend model | Alexander | This week |

---

## 12. What Changed from v1

| v1 (Original) | v2 (This Version) | Why |
|---------------|-------------------|-----|
| Phase 1: DB schema + PWA shell (2 weeks, zero business value) | Phase 0: Buying Problems Tracker (1 week, immediate value) | Ship something useful first |
| 7 feature modules | 3 focused views (Buying / Management / Dev) | Less is more; each view has a clear owner |
| React Flow process map | Simple bottleneck table | Nobody uses graph visualizations on mobile |
| Hypothesis Portfolio (Kanban/Gantt/Investment) | Cut — use Jira | Don't build Jira on top of Jira |
| Traffic lights without actions | Every element has an action button | Dashboards without actions are wallpaper |
| 10-week timeline | 8-week timeline with value at Week 1 | Crisis demands speed |
| No kill criteria | Kill criteria per phase | Know when to pivot |
| "Mobile-first" (claimed) | Separate mobile/desktop experiences designed | Actually usable on phones |
| Alert system (display only) | Alerts with escalation, resolution tracking, fatigue prevention | Alerts that drive action, not anxiety |
