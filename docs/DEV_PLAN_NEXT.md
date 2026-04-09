# Next Development Plan — MCC v2

> Status: Phase 1-5 live data complete. 67/73 metrics live. Bug fixes deployed. Both themes working.
> This plan covers what's next.

---

## What We Have Now

| Metric | Score |
|--------|-------|
| Pages built | 6/6 (Homepage, Buying, Engineering, Processes, Analytics, Problems) |
| Live metrics | 67/73 (92%) |
| Hardcoded metrics | 0 (all replaced) |
| Blocked metrics | 6 (external access needed) |
| Data sources connected | 5 (Keitaro, Jira, Airtable ×3, In-memory DB) |
| Themes | Light + Dark with toggle |
| Languages | UA (primary) + EN |
| Auto-refresh | 5-min interval on all pages |
| Trend comparisons | vs previous period on KPIs |
| Sparklines | On Profit and key financial KPIs |

---

## Priority 1: UX Polish & Consistency (2 days)

Problems visible from screenshots + audit:

### 1.1 Pipeline Overflow on Processes Page
**Issue**: ASD pipeline has 10+ statuses, wraps badly on smaller screens. FS pipeline is fine (fewer statuses).
**Fix**:
- Add `overflow-x-auto` with horizontal scroll on pipeline container
- Group minor statuses: combine "Reopened" + "Hold" + "Backlog" into "Queued" bucket for display
- Add a "Show all" toggle to expand full pipeline if needed
- Ensure pipeline boxes have `min-width` and `max-width` constraints

### 1.2 Department Cards Sizing Inconsistency
**Issue**: 4 dept cards on homepage — "Аналітика" card has text overflow ("Running" is very large), "Infrastructure" card metrics don't align with others.
**Fix**:
- Normalize ScoreBox text sizes across all dept cards
- Add `line-clamp-1` to large values that might overflow
- Ensure all cards are `h-full` with consistent internal spacing

### 1.3 Chart Readability in Light Mode
**Issue**: Chart grid lines, axis labels, and tooltips were designed for dark mode. Some are still hard to read in light mode.
**Fix**:
- Chart grid: use `strokeOpacity={0.08}` (works both themes)
- Axis labels: use `fill="currentColor"` with opacity instead of hardcoded `#6B7A94`
- Tooltip bg: already using `var(--card)` — verify all charts

### 1.4 Problems Page — Card Layout
**Issue**: Problem cards show truncated titles, category badges overflow on mobile.
**Fix**:
- Problem title: remove `truncate`, allow 2-line wrap with `line-clamp-2`
- Category/status badges: stack vertically on mobile (`flex-wrap`)
- Expand interaction: make the entire card clickable, not just a small area

### 1.5 Mobile Responsiveness Audit
**Issue**: Never tested on 375px. Sidebar may overlap content.
**Fix**:
- Sidebar: auto-collapse to icon-only on `< md` breakpoint
- Period selector: stack below title on mobile
- KPI grid: `grid-cols-2` on mobile (already set but verify)
- Tables: horizontal scroll wrapper on all tables

**Effort**: 2 days

---

## Priority 2: Buying Operations Deep Dive (3 days)

The 10 buying problems need dedicated tracking UI. Currently only 6 generic problem cards exist.

### 2.1 Expand Problem Cards to 10 (from current 6)
Add 4 missing problems from the buying problems spec:
- #2 In-App Browser Limitations
- #7 Buyer Coordination & Discipline
- #9 iOS Conversion Gap
- #10 fb_click_id Filter Gaps

### 2.2 Problem Detail Enhancements
Each problem card expanded view needs:
- **Test Group Tracker**: A/B/C group definition (which buyers, which cloaking, which parameters)
- **Daily Test Log Table**: date, group, campaigns_launched, accounts_alive, accounts_banned, spend
- **Before/After Chart**: line chart showing the key metric over time (e.g., survival rate)
- **Decision Point Card**: when test reaches min sample (30 campaigns per group), show decision prompt

### 2.3 White Page Health Widget
New widget on Buying/Offers tab:
- API: `/api/mcc/keitaro/white-pages` — fetches landing pages, counts reuse, measures freshness
- Display: Active WPs (1,290+), Reuse Rate, New This Week, Avg Page Weight
- Alert if reuse rate > 50%

### 2.4 Campaign Lifecycle Enrichment
Current Operations tab shows test/active/scaled/killed counts. Add:
- **Kill Reason Breakdown**: STOP signal vs manual vs account ban (requires buyer input or inference from timing)
- **Test-to-Scale Funnel**: visual funnel showing conversion rate from test → active → scaled
- **Survival Curve**: line chart showing % of campaigns still alive at day 1, 2, 3, 5, 7, 14

### 2.5 Device Split Widget
New on Buying/Overview tab:
- API: Keitaro report grouped by `device_type`
- Display: iOS vs Android conversion rate, side by side
- Highlights the conversion gap (Problem #9)

**Effort**: 3 days

---

## Priority 3: Live Engineering Enhancements (2 days)

### 3.1 Code Review Age Tracking
**What**: Show how long items have been stuck in Code Review.
**How**: The Jira engineering API already fetches sprint issues with status. Need to add `updated_at` or changelog query to compute time-in-status for Code Review items.
**Display**: On Engineering/Teams tab — additional alert: "4 items in Code Review > 30 days" (Oleh Litvin's items)

### 3.2 Planned vs Unplanned Ratio
**What**: What % of sprint work was added mid-sprint (not in original scope).
**How**: Compare sprint scope at start vs end. Jira's sprint API may include `issueKeysAddedDuringSprint`. Alternatively, compare sprint start date with issue `created_at` — if created after sprint start, it's unplanned.
**Display**: Donut chart on Engineering/Sprint tab

### 3.3 Carry-Over Tracking
**What**: Issues not completed in sprint, moved to next.
**How**: When a sprint closes, issues still in active states are carry-overs. Compare current sprint issues with previous sprint — items in both = carry-over.
**Display**: Number on Sprint tab with trend arrow

### 3.4 Time-in-Status (Time to Market)
**What**: How long issues spend in each pipeline stage (average).
**How**: Jira issue changelog API (`expand=changelog`). For each resolved issue, compute duration between status transitions.
**Display**: On Processes page — additional row below pipeline boxes showing "avg 22h" for QA, "avg 2.6d" for Staging, etc.
**Note**: This is what Oleh Rakhliy is building separately. We should show a simplified version or integrate his data.

**Effort**: 2 days

---

## Priority 4: Deployment & Sharing (1 day)

### 4.1 GitHub Pages or Vercel Deploy
The app needs a public URL for the 9 team members who need access.
**Options**:
- **Vercel** (recommended): `npx vercel` — free tier, auto-deploy from GitHub, environment variables in dashboard
- **GitHub Pages**: static export won't work (we have API routes)
- **VPS**: if company has a server, deploy with PM2

**Action**: Deploy to Vercel, set env vars, share URL

### 4.2 Environment Variable Security
Current `.env.local` has tokens in plaintext. For production:
- Move secrets to Vercel Environment Variables (encrypted at rest)
- Remove `.env.local` from git (already in `.gitignore`)
- Rotate Airtable/Keitaro tokens after deploy (they've been in chat history)

### 4.3 Basic Access Control
No auth currently. For MVP:
- Add a simple shared password (`MCC_ACCESS_PASSWORD` env var)
- Middleware checks `Authorization` header or cookie
- Login page: single password input

**Effort**: 1 day

---

## Priority 5: AI Agent Layer (3 days)

From the Ivan call — Mykola's vision: "AI agents that continuously mine data for problems."

### 5.1 Insights Engine v2
Current: rule-based (hardcoded thresholds). Next: configurable rules + natural language summaries.

- Define rules in a JSON config:
```json
[
  { "metric": "bugDensity", "operator": ">", "threshold": 40, "severity": "warning", "message_uk": "Щільність багів {team} {value}% — майже половина спринту", "message_en": "..." },
  { "metric": "velocity", "operator": "<", "threshold": 70, "severity": "critical", "message_uk": "..." }
]
```
- Load rules from config on each page render
- Generate insights dynamically from current data + rules
- Admin can edit thresholds in Settings page

### 5.2 Daily Digest Notification
- Cron job (or scheduled task): every morning at 9:00
- Computes: top 3 warnings, top 2 positive signals, key KPI changes
- Sends to Slack channel (via webhook) or email
- Markdown format: "🔴 3 buyer groups STOP signal. 🟡 Sprint velocity 27%. 🟢 6 buyer groups profitable."

### 5.3 Problem Auto-Detection
Instead of manually seeding problems, detect them:
- If bug density > 50% for 3 consecutive sprints → auto-create problem card "High bug density in {team}"
- If any person has > 10 WIP items → auto-create "Bottleneck: {person}"
- If campaign ROI < -50% for > 7 days → auto-create "Unprofitable campaign group: {geo}"

### 5.4 Knowledge Base Wiki (Karpathy-style)
From the call: "I want a central knowledge base that agents maintain."
- Auto-update `docs/knowledge-base/company-snapshot.md` daily with fresh data
- Version in git → full history of how metrics changed
- Searchable from the panel (future: chat interface)

**Effort**: 3 days

---

## Priority 6: Additional Data Sources (2 days)

### 6.1 Scaleo Integration
Serhii said Scaleo has minimal extra data, but if we need conversion approval rates:
- API: `GET /api/v2/conversions?status=approved|pending|rejected`
- Maps to: Analytics/Conversion Quality tab (currently placeholder)
- Need: Scaleo API key (from Ivan)

### 6.2 MetaMind Extension Data
When FS-691-694 bugs are fixed:
- MetaMind provides: FB account status, ad campaign data, ban events, rejection counts
- Replaces manual daily input for ban/rejection tracking
- Need: MetaMind API endpoint from Yurii Pustovyi

### 6.3 Houston PostgreSQL
When Oleksii provides access:
- Direct DB queries for: `agg_clicks`, `raw_scaleo_conversions`, `dict_buyers`
- Enables true buyer-level analytics (not just campaign grouping)
- Buyer names (dict_buyers) replace "GB | FB" with actual person names

### 6.4 HiBob HR System
For headcount vs output efficiency:
- API: salary data per employee
- Maps to: `cost_per_output = total_salary / issues_resolved`
- Need: HiBob API key from Alexander/Ivan
- SENSITIVE: show only to Head of Product + VP

**Effort**: 2 days (per source, as access becomes available)

---

## Priority 7: Airtable Base `appLF7Y6WvJpwZkJ5` Deep Integration (1 day)

We discovered 10 tables in this base. Currently only using it for the infra route. Expand:

### 7.1 INT Tasks Table → Operations Dashboard
- 100+ infrastructure tasks with status tracking
- Feed into a dedicated "Operations" section on the Processes page
- Show task velocity, completion trends

### 7.2 Weekly Report Integration
- `weekly_report_inf` + `weekly_report_main` tables
- Auto-pull latest week's accomplishments, blockers, plans
- Display as collapsible card on homepage or Processes page

### 7.3 Landing Requests Tracking
- `landing_requests` table tracks landing page creation pipeline
- Feed into Buying/Offers tab as "Landing Pipeline" section
- Connects to funnel migration tracking (Problem #8)

### 7.4 Landing Feedback
- `landing_feedback` table has quality scores and issue tracking
- Feed into quality metrics on Engineering page

**Effort**: 1 day

---

## Execution Timeline

| Week | Priority | What |
|------|----------|------|
| **Week 1** | P1 + P4 | UX polish (2d) + Deploy to Vercel (1d) → **team has access by Friday** |
| **Week 2** | P2 | Buying operations deep dive (3d) → white pages, device split, test tracking |
| **Week 2** | P3 | Engineering enhancements (2d) → code review age, planned vs unplanned |
| **Week 3** | P5 | AI agent layer (3d) → configurable insights, Slack digest, auto-detection |
| **Week 3** | P7 | Airtable deep integration (1d) |
| **Ongoing** | P6 | Additional data sources → as access is provided |

### Total: 14 working days across 3 weeks

### After 3 Weeks

| Metric | Before | After |
|--------|--------|-------|
| Live metrics | 67/73 | **73/73** (if all access provided) |
| Problems tracked | 6 | **10** (all buying problems) |
| Data sources | 5 | **8+** (add Scaleo, MetaMind, Houston) |
| Team access | 1 (Mykola local) | **9+ people via URL** |
| Insights | Rule-based | **Configurable + Slack digest** |
| Problem auto-detection | None | **3 auto-detection rules** |

---

## What NOT To Build (Scope Control)

| Feature | Why Not | Alternative |
|---------|---------|-------------|
| Custom KPI formula builder | Over-engineering for now | Hardcode in API routes, change as needed |
| PDF/Excel export | Not urgent | Screenshots + browser print |
| Real-time WebSocket updates | 5-min polling is sufficient | Auto-refresh already works |
| Mobile native app | PWA is enough for now | Add to home screen works |
| Full Gantt chart for roadmap | Jira already has this | Link to Jira plan 682 |
| Chat interface with AI | Cool but premature | Insights engine covers 80% of use case |
| Multi-tenant (different companies) | Single company tool | Hardcode everything for Makeberry |
| Audit log / activity tracking | Not urgent | Git history on knowledge base files |
