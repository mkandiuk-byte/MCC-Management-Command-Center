# Implementation Plan: MCC — v2

> **v2**: Rewritten to match PRD v2. Phase 0 ships in 5 days. Engineering-first schema removed. Actions and workflows built into every component.

---

## Phase 0: Buying War Room (Days 1-5)

**Goal**: Ship a working tool to the buying team by Friday. Zero external API dependencies.

### Day 1: Scaffold + Problems CRUD

**Task 0.1: Database (lightweight)**
- Use PostgreSQL (same instance as existing, new schema `mcc`)
- Only 3 tables needed for Phase 0:

```sql
CREATE SCHEMA IF NOT EXISTS mcc;

-- Buying problems tracker
CREATE TABLE mcc.problems (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,        -- 'cloaking','white_pages','account_health','ios','event_streaming','funnel_migration'
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'high',  -- 'critical','high','medium','low'
  owner TEXT,                    -- Person name (no FK needed yet)
  status TEXT DEFAULT 'investigating', -- 'investigating','testing','measuring','resolved','failed'
  hypothesis TEXT,               -- "If we do X, we expect Y"
  metric_name TEXT,              -- What metric we're tracking
  baseline_value NUMERIC,        -- Value before fix
  current_value NUMERIC,         -- Latest measured value
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test results / updates log
CREATE TABLE mcc.problem_updates (
  id SERIAL PRIMARY KEY,
  problem_id INT REFERENCES mcc.problems(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL,     -- 'test_result','note','status_change','metric_update'
  content TEXT NOT NULL,
  outcome TEXT,                  -- 'positive','negative','inconclusive' (for test results)
  metric_value NUMERIC,          -- Optional metric snapshot
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual daily metrics input (for account health until MetaMind is ready)
CREATE TABLE mcc.daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  division TEXT NOT NULL,        -- 'meta','google'
  metric_name TEXT NOT NULL,     -- 'bans','rejections','active_accounts','avg_cpa'
  value NUMERIC NOT NULL,
  entered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, division, metric_name)
);
```

**File**: `src/app/api/mcc/setup/route.ts` — runs migration on first call

**Task 0.2: API Routes**

```
src/app/api/mcc/
├── problems/
│   ├── route.ts          GET (list, filter by category/status) + POST (create)
│   └── [id]/
│       ├── route.ts      GET (detail) + PATCH (update status/owner/metrics)
│       └── updates/
│           └── route.ts  GET (list updates) + POST (add test result/note)
├── metrics/
│   └── route.ts          GET (daily metrics) + POST (log daily metric)
└── setup/
    └── route.ts          POST (run migration + seed)
```

**Task 0.3: Seed Data**
Pre-populate 6 problems from meeting analysis:

```typescript
const SEED_PROBLEMS = [
  {
    category: 'cloaking',
    title: 'Primitive cloaking (geo-only) causes account bans',
    description: 'FB killer crawlers bypass geo-based filtering. Need ML-based behavioral detection.',
    severity: 'critical',
    owner: 'Oleksii Kosenko',
    hypothesis: 'Integrating hox.tech or similar ML cloaking will reduce ban rate by 30%',
    metric_name: 'Account ban rate (%)',
    baseline_value: null, // To be measured
  },
  {
    category: 'white_pages',
    title: 'White pages not rotated — reused hundreds of times',
    description: 'FB has seen all our white pages. Need rotation from Google archive (1000+) + generation pipeline.',
    severity: 'critical',
    owner: 'Andrii Laptiev',
    hypothesis: 'Fresh white pages from Google archive will improve ad moderation pass rate',
    metric_name: 'Ad rejection rate (%)',
  },
  {
    category: 'account_health',
    title: 'WebRTC leaks in Dolphin expose real IPs',
    description: 'Dolphin anti-detect browser leaks real IP via WebRTC ~every 3-5 refreshes. Meta can link accounts.',
    severity: 'high',
    owner: 'Serhii Oliinyk',
    hypothesis: 'Disabling WebRTC at profile level will reduce account linkage bans',
    metric_name: 'Account lifespan (days)',
  },
  {
    category: 'ios',
    title: 'iOS conversion underperformance on PWAs',
    description: 'iOS devices show worse conversion vs Android. BetterLink performs better on iOS than our PVAs.',
    severity: 'high',
    owner: 'Dmytro Krutko',
    hypothesis: 'iOS-specific template improvements will close the conversion gap',
    metric_name: 'iOS conversion rate (%)',
  },
  {
    category: 'event_streaming',
    title: 'All pixel events stream from single IP',
    description: 'Server-Side API creates centralized IP fingerprint. FB can link all accounts.',
    severity: 'medium',
    owner: 'Alexander Pravdyvyi',
    hypothesis: 'Routing events through 20+ server proxies will reduce account linkage',
    metric_name: 'Account linkage rate',
  },
  {
    category: 'funnel_migration',
    title: 'Buyers still on external funnels (BetterLink, Skycoin)',
    description: 'Cannot integrate cloaking on external funnels. Need migration to FinalSpace/PVA.',
    severity: 'high',
    owner: 'Andrii Laptiev',
    hypothesis: 'In-house funnels with integrated cloaking will outperform external ones',
    metric_name: 'Buyers on in-house funnels (%)',
  },
];
```

### Day 2: Problems Tracker UI

**Task 0.4: Page — `/problems`**
- File: `src/app/problems/page.tsx`
- Kanban board with 4 columns: Investigating | Testing | Measuring | Resolved
- Cards: title + severity badge + owner + last update time
- Filter bar: by category (6 chips) + by severity
- Mobile: single-column list sorted by severity (kanban on desktop only)

**Task 0.5: Problem Detail — `/problems/[id]`**
- File: `src/app/problems/[id]/page.tsx`
- Header: title, status pill, severity, owner, category
- Hypothesis section: "If we do X, we expect Y"
- Metrics: baseline → current (with delta indicator)
- Timeline: list of updates (test results, notes, status changes)
- Action buttons:
  - "Log Test Result" → modal: description, outcome (positive/negative/inconclusive), metric value
  - "Change Status" → dropdown
  - "Reassign" → name input
  - "Add Note" → text area

**Task 0.6: New Problem Form**
- File: `src/components/mcc/problem-form.tsx`
- Fields: category (select), title, description, severity, owner, hypothesis, metric name
- Pre-validated: hypothesis must contain "If...then..." pattern (soft validation, warning not block)

### Day 3: Manual Metrics Input + Account Health View

**Task 0.7: Daily Metrics Input — `/metrics/input`**
- File: `src/app/metrics/input/page.tsx`
- Simple form: date (default today), division (select), metrics grid
- Grid: ban count, rejection count, active accounts, avg CPA
- One-tap submit. Takes < 2 minutes.
- Mobile-first: large touch targets, clear labels

**Task 0.8: Account Health View — `/divisions/meta/health`**
- File: `src/app/divisions/[slug]/health/page.tsx`
- Charts (recharts): ban trend (7-day), rejection trend (7-day)
- Alert indicators: if today's value > 2x 7-day avg → red banner
- Data source: `mcc.daily_metrics` table

### Day 4: Mobile Layout + PWA Shell

**Task 0.9: New Layout System**
- File: `src/app/(mcc)/layout.tsx` — new route group for MCC pages
- Mobile: bottom tab bar (Problems | Health | Alerts | Settings)
- Desktop: left sidebar nav
- Shared: top bar with role name + notification bell

**Task 0.10: PWA Setup**
- Update `public/manifest.json` — app name, icons, display: standalone
- Create `public/sw.js` — basic service worker for offline shell + push subscription
- Add `<meta>` tags for iOS web app capable

**Task 0.11: Push Notification Foundation**
- File: `src/lib/push.ts` — VAPID key generation, subscription management
- File: `src/app/api/mcc/push/subscribe/route.ts` — save subscription
- File: `src/app/api/mcc/push/send/route.ts` — send notification to subscribers
- For Phase 0: manual trigger only (admin sends test notification)

### Day 5: Polish + Deploy + Seed + Test

**Task 0.12: Seed real data**
- Run migration + seed problems
- Have Alexander + Oleksii fill in today's metrics
- Verify mobile experience on real phones

**Task 0.13: Deploy**
- Same host as AAP Panel (extend existing deployment)
- Verify PWA installable on iOS + Android

**Phase 0 Definition of Done**:
- [ ] 6 problems seeded and visible in kanban
- [ ] Test results can be logged with before/after metrics
- [ ] Daily metrics form works on mobile
- [ ] Account health trend charts render from manual data
- [ ] PWA installable on phone
- [ ] At least 3 team members have access and logged in

---

## Phase 1: Division Operations (Weeks 2-3)

### Week 2: Campaign Data + Houston Integration

**Task 1.1: Campaign War Room — `/divisions/[slug]/campaigns`**
- Table/list of campaigns from Keitaro (reuse existing `services/keitaro`)
- Columns: name, status, spend today, CPA, trend (sparkline)
- Sort: "Worst first" (by CPA deviation from target)
- **Mobile**: card list, sorted. Tap → detail drawer
- **Desktop**: table with inline sparklines

**Task 1.2: Houston Service**
```
services/houston/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── lib/db.ts           # PostgreSQL client (read-only to Houston DB)
    └── routes/
        ├── performance.ts  # Aggregated revenue/spend/margin by division
        ├── offers.ts       # Offer-level: B2B/B2C, spend/CPA model
        └── trends.ts       # Historical data for sparklines
```

**Blocked by**: Houston DB access. If not available by Week 2, use Keitaro aggregation as fallback.

**Task 1.3: API Routes for Division Dashboard**
```
src/app/api/mcc/divisions/
├── route.ts                    GET: list divisions with KPI summary
└── [slug]/
    ├── route.ts                GET: division detail
    ├── campaigns/route.ts      GET: campaigns from Keitaro
    ├── health/route.ts         GET: account health from daily_metrics
    └── problems/route.ts       GET: problems filtered by division
```

**Task 1.4: MetaMind Integration (or enhanced manual)**
- If API docs available: create `services/metamind/` with account health routes
- If not: enhance manual input form with:
  - Campaign-level ban/rejection tracking
  - Bulk paste from MetaMind export (CSV upload)
  - Auto-compute trends from entered data

### Week 3: Alert System with Actions

**Task 1.5: Alert Engine**
```sql
-- Add to mcc schema
CREATE TABLE mcc.alerts (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,           -- 'ban_spike','rejection_rate','spend_exceeded','cpa_exceeded','sla_breach'
  severity TEXT NOT NULL,       -- 'critical','warning','info'
  title TEXT NOT NULL,
  body TEXT,
  division TEXT,
  related_type TEXT,            -- 'campaign','account','problem'
  related_id TEXT,
  assigned_to TEXT,
  status TEXT DEFAULT 'open',   -- 'open','acknowledged','resolved','dismissed'
  escalation_level INT DEFAULT 0, -- 0=owner, 1=division_head, 2=head_of_product
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Task 1.6: Alert Generation (cron, every 5 min)**
- File: `src/lib/alert-engine.ts`
- Checks:
  - Daily metrics: if today's ban count > 2x 7-day avg → critical alert
  - Keitaro: if campaign CPA > target × 1.2 → warning
  - Keitaro: if campaign spend > budget × 1.4 → critical
  - Problems: if problem in "investigating" for > 5 days → SLA warning
- De-duplication: don't create duplicate alert for same entity within 1 hour

**Task 1.7: Alert Actions UI — `/alerts`**
- File: `src/app/alerts/page.tsx`
- Mobile: sorted list, most critical first. Swipe actions.
- Each alert card has:
  - Context (what triggered it, current values)
  - **Action buttons**:
    - ✅ Acknowledge (I'm on it)
    - 📋 Create Jira Ticket (pre-filled from alert context)
    - 👤 Assign to Person
    - ⬆️ Escalate to Next Level
    - ❌ Dismiss (requires reason)

**Task 1.8: Escalation Logic**
- File: `src/lib/escalation.ts`
- Cron (every 15 min):
  - Open + unacknowledged for 30 min → push to division head
  - Open for 2 hours → push to Head of Product
  - Resolved alerts: capture before/after metrics

**Task 1.9: Push Notification Integration**
- Hook alert creation → push notification to assigned user
- Respect limits: max 5 push/hour, batch warnings into digest
- Critical alerts always push immediately

**Phase 1 Definition of Done**:
- [ ] Campaign list shows real Keitaro data with CPA/spend
- [ ] Alerts fire automatically when metrics cross thresholds
- [ ] Every alert has action buttons that work
- [ ] Escalation pushes to next level after timeout
- [ ] Houston data flowing (or fallback working)

---

## Phase 2: Management Overview (Week 4)

**Task 2.1: Company Dashboard — `/dashboard`**
- File: `src/app/dashboard/page.tsx`
- 4 quadrants:
  1. KPI cards: Revenue, Spend, Margin, Active Campaigns (from Houston/Keitaro)
  2. Division cards with traffic light + 1-line summary
  3. Active alerts feed (top 10, sorted by severity)
  4. Buying problems summary (counts by status)
- Click division → `/divisions/[slug]`
- Click alert → expand with actions

**Task 2.2: Traffic Light Computation**
- File: `src/lib/traffic-light.ts`
- Logic:
  - Green: all KPIs within target ± 10%
  - Yellow: any KPI outside ± 10% but within ± 25%
  - Red: any KPI outside ± 25% OR unresolved critical alert
- Default thresholds. Configurable in Settings (Phase 2).

**Task 2.3: KPI Configuration — `/settings/kpis`**
- File: `src/app/settings/kpis/page.tsx`
- Division heads set: target CPA, target spend, target revenue, ban rate threshold
- Simple form. Stored in `mcc.kpi_config` table.

**Task 2.4: Division Dashboard — `/divisions/[slug]`**
- Tabs: Campaigns | Health | Problems | Team
- Reuses components from Phase 0 + Phase 1
- Team tab: simple list from Jira assignees (no separate people table needed)

**Phase 2 Definition of Done**:
- [ ] CEO opens `/dashboard` and sees company health in one screen
- [ ] Traffic lights are computed from real data
- [ ] Drill-down from division → campaigns works
- [ ] Division heads can set their own KPI targets

---

## Phase 3: Workflows & Actions (Weeks 5-6)

**Task 3.1: Jira Integration for Actions**
- "Create Jira Ticket" button on alerts/problems → calls existing Jira service
- Pre-fills: title, description, assignee, labels
- Links created ticket back to alert/problem

**Task 3.2: Notification Preferences — `/settings/notifications`**
- Per-user settings:
  - Which alert types to receive
  - Which divisions to watch
  - Severity threshold (only critical, or warning+)
  - Quiet hours

**Task 3.3: Alert Digest**
- Daily summary push at 9am: "3 critical alerts, 7 warnings. Top issue: ban spike in Meta division."
- Weekly summary: before/after metrics for resolved problems

**Task 3.4: Quick Actions Enhancement**
- Campaign card → "Recommend Pause" action
- Problem card → "Request Resources" → creates staffing request
- Alert → "Schedule Meeting" → creates calendar invite

---

## Phase 4: Dev Analytics (Weeks 7-8, conditional)

**Gate**: Only start if Phase 0-2 adopted AND buying metrics improving.

**Task 4.1: Sprint Analytics — `/dev/sprints`**
- Extend `services/jira` with velocity computation
- Charts: velocity trend, planned vs unplanned, completion rate

**Task 4.2: Process Bottleneck Table — `/dev/bottlenecks`**
- Simple table: stage | items | avg time | SLA | overdue count
- "Nudge" button per overdue item → sends message to owner

**Task 4.3: PR Metrics — `/dev/prs`**
- From GitHub: PRs per dev, avg time to merge, review turnaround
- No AI review scoring yet (defer)

---

## File Structure (New Files Only)

```
src/
├── app/
│   ├── (mcc)/                          ← NEW route group
│   │   ├── layout.tsx                  ← MCC layout (mobile tabs + desktop sidebar)
│   │   ├── dashboard/page.tsx          ← Phase 2
│   │   ├── problems/
│   │   │   ├── page.tsx                ← Phase 0 (kanban)
│   │   │   └── [id]/page.tsx           ← Phase 0 (detail + actions)
│   │   ├── divisions/
│   │   │   └── [slug]/
│   │   │       ├── page.tsx            ← Phase 1 (division dashboard)
│   │   │       ├── campaigns/page.tsx  ← Phase 1
│   │   │       └── health/page.tsx     ← Phase 0 (manual metrics view)
│   │   ├── alerts/page.tsx             ← Phase 1
│   │   ├── metrics/input/page.tsx      ← Phase 0 (manual daily input)
│   │   ├── settings/
│   │   │   ├── kpis/page.tsx           ← Phase 2
│   │   │   └── notifications/page.tsx  ← Phase 3
│   │   └── dev/                        ← Phase 4
│   │       ├── sprints/page.tsx
│   │       ├── bottlenecks/page.tsx
│   │       └── prs/page.tsx
│   └── api/mcc/
│       ├── problems/route.ts           ← Phase 0
│       ├── problems/[id]/route.ts      ← Phase 0
│       ├── problems/[id]/updates/route.ts ← Phase 0
│       ├── metrics/route.ts            ← Phase 0
│       ├── alerts/route.ts             ← Phase 1
│       ├── alerts/[id]/route.ts        ← Phase 1
│       ├── divisions/route.ts          ← Phase 1
│       ├── divisions/[slug]/route.ts   ← Phase 1
│       ├── dashboard/route.ts          ← Phase 2
│       ├── push/subscribe/route.ts     ← Phase 0
│       ├── push/send/route.ts          ← Phase 0
│       └── setup/route.ts             ← Phase 0 (migration)
├── components/mcc/
│   ├── problem-card.tsx                ← Phase 0
│   ├── problem-form.tsx                ← Phase 0
│   ├── problem-kanban.tsx              ← Phase 0
│   ├── metric-input-form.tsx           ← Phase 0
│   ├── health-charts.tsx               ← Phase 0
│   ├── alert-card.tsx                  ← Phase 1
│   ├── alert-actions.tsx               ← Phase 1
│   ├── campaign-table.tsx              ← Phase 1
│   ├── campaign-card.tsx               ← Phase 1
│   ├── kpi-card.tsx                    ← Phase 2
│   ├── traffic-light.tsx               ← Phase 2
│   ├── division-card.tsx               ← Phase 2
│   └── mobile-nav.tsx                  ← Phase 0
├── lib/
│   ├── mcc-db.ts                       ← Phase 0 (pg client for mcc schema)
│   ├── push.ts                         ← Phase 0
│   ├── alert-engine.ts                 ← Phase 1
│   ├── escalation.ts                   ← Phase 1
│   └── traffic-light.ts               ← Phase 2
services/
└── houston/                            ← Phase 1 (if DB access received)
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── lib/db.ts
        └── routes/
            ├── performance.ts
            ├── offers.ts
            └── trends.ts
public/
├── manifest.json                       ← Phase 0 (update)
└── sw.js                               ← Phase 0 (new)
```

---

## Dependencies (Minimal)

```json
{
  "dependencies": {
    "pg": "^8.13.0",
    "web-push": "^3.6.0"
  },
  "devDependencies": {
    "@types/pg": "^8.0.0",
    "@types/web-push": "^3.6.0"
  }
}
```

No auth library for Phase 0. Simple shared-secret or IP whitelist. Add proper auth in Phase 2.

---

## New Environment Variables

```env
# PostgreSQL (MCC data — can reuse existing PG or separate)
MCC_DATABASE_URL=postgresql://user:pass@localhost:5432/mcc

# Houston (read-only, Phase 1)
HOUSTON_DATABASE_URL=postgresql://user:pass@host:5432/houston

# Push (Phase 0)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@company.com
```

---

## Timeline Summary

| Phase | Duration | Ships | Business Value |
|-------|----------|-------|---------------|
| **Phase 0** | 5 days | Week 1 | Buying team tracks crisis; daily metrics visible |
| **Phase 1** | 2 weeks | Week 3 | Campaign data live; alerts drive action |
| **Phase 2** | 1 week | Week 4 | CEO/management has single-screen company view |
| **Phase 3** | 2 weeks | Week 6 | Full workflow: alert → ticket → resolution |
| **Phase 4** | 2 weeks | Week 8 | Dev analytics (conditional on adoption) |

**Total: 8 weeks, with usable product from Day 5.**
