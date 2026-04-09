# Data Sync & Long-Term Storage Algorithm

## Architecture: How We Store and Use Insights

### Problem
Data lives in 5+ systems (Jira, Confluence, Keitaro, MetaMind, Houston DB). Each requires separate API calls, has rate limits, and returns raw data that needs interpretation. We need:
1. A **snapshot system** that captures state periodically
2. A **knowledge base** that persists insights (not just raw data)
3. An **algorithm** that identifies anomalies, trends, and actionable items

---

## 1. Three-Layer Storage Model

```
Layer 1: RAW CACHE (Redis, 5-15 min TTL)
  └─ Live API responses from Jira/Keitaro/Confluence
  └─ Used for real-time dashboard queries
  └─ Existing pattern in analytics/keitaro services

Layer 2: DAILY SNAPSHOTS (PostgreSQL, persistent)
  └─ Computed metrics captured once per day
  └─ Sprint velocity, cycle time, throughput, KPIs
  └─ Enables trend analysis and before/after comparisons
  └─ Source of truth for traffic lights and alerts

Layer 3: KNOWLEDGE BASE (Markdown + PostgreSQL, persistent)
  └─ company-snapshot.md — living document, updated weekly
  └─ Structured insights: "what changed", "what's at risk", "what to do"
  └─ Fed into Claude context for AI-powered queries
  └─ Manual + automated entries
```

---

## 2. Daily Snapshot Schema

```sql
-- Runs daily at 02:00 UTC via cron job

CREATE TABLE mcc.snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  source TEXT NOT NULL,           -- 'jira', 'keitaro', 'confluence', 'metamind', 'manual'
  category TEXT NOT NULL,         -- 'velocity', 'throughput', 'cycle_time', 'blocked', 'kpi', 'team'
  entity_type TEXT,               -- 'project', 'sprint', 'division', 'person', 'campaign'
  entity_id TEXT,                 -- 'ASD', 'FS', 'meta', sprint ID, etc.
  entity_name TEXT,
  metrics JSONB NOT NULL,         -- Flexible metric storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, source, category, entity_type, entity_id)
);

CREATE INDEX idx_snapshots_date ON mcc.snapshots(snapshot_date);
CREATE INDEX idx_snapshots_category ON mcc.snapshots(category);
CREATE INDEX idx_snapshots_entity ON mcc.snapshots(entity_type, entity_id);
```

### Example Snapshot Records

```json
// Sprint velocity snapshot
{
  "snapshot_date": "2026-04-08",
  "source": "jira",
  "category": "velocity",
  "entity_type": "project",
  "entity_id": "ASD",
  "entity_name": "MB Arbitrage Platform",
  "metrics": {
    "sprint_name": "MB AP 20",
    "sprint_state": "active",
    "total_issues": 45,
    "done_issues": 12,
    "in_progress": 18,
    "blocked": 12,
    "completion_rate_pct": 26.7,
    "days_elapsed": 7,
    "days_remaining": 8
  }
}

// Cycle time snapshot
{
  "snapshot_date": "2026-04-08",
  "source": "jira",
  "category": "cycle_time",
  "entity_type": "project",
  "entity_id": "FS",
  "metrics": {
    "period": "30d",
    "resolved_count": 96,
    "avg_days": 14.6,
    "median_days": 9,
    "p90_days": 29,
    "max_days": 113
  }
}

// KPI snapshot (from Keitaro or manual input)
{
  "snapshot_date": "2026-04-08",
  "source": "keitaro",
  "category": "kpi",
  "entity_type": "division",
  "entity_id": "meta",
  "entity_name": "Meta/Facebook",
  "metrics": {
    "active_campaigns": 47,
    "total_spend_usd": 125000,
    "avg_cpa_usd": 42.5,
    "avg_roi_pct": 12.3,
    "active_accounts": 89,
    "bans_today": 3,
    "rejections_today": 15,
    "rejection_rate_pct": 8.2
  }
}

// Blocked items snapshot
{
  "snapshot_date": "2026-04-08",
  "source": "jira",
  "category": "blocked",
  "entity_type": "project",
  "entity_id": "ASD",
  "metrics": {
    "blocked_count": 12,
    "high_priority_blocked": 3,
    "top_blocker_person": "Oleh Litvin",
    "top_blocker_count": 7,
    "oldest_blocked_days": 120,
    "blocked_issues": ["ASD-1582", "ASD-1456", "ASD-1369"]
  }
}
```

---

## 3. Snapshot Collection Algorithm

### 3.1 Jira Snapshots (Daily at 02:00)

```typescript
async function collectJiraSnapshots(date: Date) {
  const projects = ['ASD', 'FS', 'MP', 'AN', 'RS'];

  for (const project of projects) {
    // 1. Active sprint velocity
    const boards = await getProjectBoards(project);
    for (const board of boards) {
      const sprint = await getActiveSprint(board.id);
      if (sprint) {
        const issues = await getSprintIssues(sprint.id);
        await saveSnapshot({
          date, source: 'jira', category: 'velocity',
          entity_type: 'project', entity_id: project,
          metrics: computeVelocity(sprint, issues)
        });
      }
    }

    // 2. Cycle time (last 30 days)
    const resolved = await getResolvedIssues(project, 30);
    await saveSnapshot({
      date, source: 'jira', category: 'cycle_time',
      entity_type: 'project', entity_id: project,
      metrics: computeCycleTime(resolved)
    });

    // 3. Throughput
    await saveSnapshot({
      date, source: 'jira', category: 'throughput',
      entity_type: 'project', entity_id: project,
      metrics: {
        resolved_30d: resolved.length,
        resolved_7d: resolved.filter(i => daysSince(i.resolved) <= 7).length,
        by_type: groupBy(resolved, 'issuetype')
      }
    });

    // 4. Blocked items
    const blocked = await getBlockedIssues(project);
    await saveSnapshot({
      date, source: 'jira', category: 'blocked',
      entity_type: 'project', entity_id: project,
      metrics: computeBlockedMetrics(blocked)
    });
  }

  // 5. Team workload (cross-project)
  const allInProgress = await getAllInProgressIssues();
  const byAssignee = groupBy(allInProgress, 'assignee');
  for (const [person, issues] of Object.entries(byAssignee)) {
    await saveSnapshot({
      date, source: 'jira', category: 'team',
      entity_type: 'person', entity_id: person,
      metrics: {
        in_progress_count: issues.length,
        projects: [...new Set(issues.map(i => i.project))],
        oldest_issue_days: Math.max(...issues.map(i => daysSince(i.created)))
      }
    });
  }
}
```

### 3.2 Keitaro Snapshots (Daily at 03:00)

```typescript
async function collectKeitaroSnapshots(date: Date) {
  // Campaign-level performance
  const campaigns = await keitaroRequest('/campaigns', {
    date_from: formatDate(date),
    date_to: formatDate(date)
  });

  // Group by type (offer, app, cloak, etc.)
  const byType = groupBy(campaigns, 'type');

  for (const [type, typeCampaigns] of Object.entries(byType)) {
    await saveSnapshot({
      date, source: 'keitaro', category: 'kpi',
      entity_type: 'campaign_type', entity_id: type,
      metrics: {
        count: typeCampaigns.length,
        total_clicks: sum(typeCampaigns, 'clicks'),
        total_conversions: sum(typeCampaigns, 'conversions'),
        total_cost: sum(typeCampaigns, 'cost'),
        total_revenue: sum(typeCampaigns, 'revenue'),
        avg_roi: avg(typeCampaigns, 'roi'),
        avg_cpa: avg(typeCampaigns, 'cpa'),
        avg_cr: avg(typeCampaigns, 'cr')
      }
    });
  }

  // Geo-level performance
  const byGeo = groupBy(campaigns, 'geo');
  for (const [geo, geoCampaigns] of Object.entries(byGeo)) {
    await saveSnapshot({
      date, source: 'keitaro', category: 'kpi',
      entity_type: 'geo', entity_id: geo,
      metrics: computeGeoMetrics(geoCampaigns)
    });
  }

  // Offer performance
  const offers = await keitaroRequest('/offers');
  for (const offer of offers) {
    await saveSnapshot({
      date, source: 'keitaro', category: 'kpi',
      entity_type: 'offer', entity_id: offer.id,
      entity_name: offer.name,
      metrics: computeOfferMetrics(offer)
    });
  }
}
```

### 3.3 Confluence Snapshots (Weekly on Monday at 04:00)

```typescript
async function collectConfluenceSnapshots(date: Date) {
  // Track key pages for changes
  const watchedPages = [
    { id: '2295595186', name: 'Houston V1.0' },
    // Add more pages as identified
  ];

  for (const page of watchedPages) {
    const content = await getConfluencePage(page.id);
    await saveSnapshot({
      date, source: 'confluence', category: 'doc_version',
      entity_type: 'page', entity_id: page.id,
      entity_name: page.name,
      metrics: {
        version: content.version.number,
        last_modified: content.version.createdAt,
        last_author: content.version.authorId,
        word_count: stripHtml(content.body.storage.value).split(/\s+/).length
      }
    });
  }

  // Track space activity
  const spaces = ['Upservice', 'MIP', 'MS', 'AN', 'SOS'];
  for (const spaceKey of spaces) {
    const recentPages = await searchConfluence(
      `space=${spaceKey} AND lastModified > now("-7d")`
    );
    await saveSnapshot({
      date, source: 'confluence', category: 'space_activity',
      entity_type: 'space', entity_id: spaceKey,
      metrics: {
        pages_modified_7d: recentPages.length,
        modified_pages: recentPages.map(p => ({ id: p.id, title: p.title }))
      }
    });
  }
}
```

---

## 4. Insight Generation Algorithm

### 4.1 Trend Detection (runs after each snapshot)

```typescript
async function detectTrends(date: Date) {
  const insights: Insight[] = [];

  // Compare today vs 7-day and 30-day averages
  for (const project of ['ASD', 'FS']) {
    const today = await getSnapshot(date, 'velocity', project);
    const last7 = await getSnapshots(date, -7, 'velocity', project);
    const last30 = await getSnapshots(date, -30, 'velocity', project);

    const avg7 = average(last7.map(s => s.metrics.completion_rate_pct));
    const avg30 = average(last30.map(s => s.metrics.completion_rate_pct));

    // Velocity drop detection
    if (today.metrics.completion_rate_pct < avg7 * 0.8) {
      insights.push({
        type: 'velocity_drop',
        severity: 'warning',
        entity: project,
        message: `${project} sprint completion ${today.metrics.completion_rate_pct}% is 20%+ below 7-day avg (${avg7}%)`,
        suggested_action: 'Check for scope creep or blocked items'
      });
    }

    // Cycle time increase
    const todayCT = await getSnapshot(date, 'cycle_time', project);
    const prevCT = await getSnapshot(date - 7, 'cycle_time', project);
    if (todayCT && prevCT && todayCT.metrics.median_days > prevCT.metrics.median_days * 1.3) {
      insights.push({
        type: 'cycle_time_increase',
        severity: 'warning',
        entity: project,
        message: `${project} median cycle time increased from ${prevCT.metrics.median_days}d to ${todayCT.metrics.median_days}d`,
        suggested_action: 'Review WIP limits and blocked items'
      });
    }

    // Blocked items growing
    const todayBlocked = await getSnapshot(date, 'blocked', project);
    const prevBlocked = await getSnapshot(date - 7, 'blocked', project);
    if (todayBlocked.metrics.blocked_count > (prevBlocked?.metrics.blocked_count || 0) + 3) {
      insights.push({
        type: 'blocked_spike',
        severity: 'critical',
        entity: project,
        message: `${project} has ${todayBlocked.metrics.blocked_count} blocked items (+${todayBlocked.metrics.blocked_count - (prevBlocked?.metrics.blocked_count || 0)} vs last week)`,
        suggested_action: `Top blocker: ${todayBlocked.metrics.top_blocker_person} (${todayBlocked.metrics.top_blocker_count} items)`
      });
    }
  }

  // KPI threshold alerts (Keitaro)
  const kpis = await getSnapshot(date, 'kpi', 'meta');
  if (kpis) {
    // Houston CPA thresholds
    if (kpis.metrics.avg_cpa_usd > kpis.metrics.target_cpa * 1.15) {
      insights.push({
        type: 'cpa_hard_stop',
        severity: 'critical',
        entity: 'meta',
        message: `Meta avg CPA $${kpis.metrics.avg_cpa_usd} exceeds 115% of target ($${kpis.metrics.target_cpa})`,
        suggested_action: 'Houston rule: HARD STOP — pause underperforming campaigns'
      });
    } else if (kpis.metrics.avg_cpa_usd > kpis.metrics.target_cpa * 0.95) {
      insights.push({
        type: 'cpa_warning',
        severity: 'warning',
        entity: 'meta',
        message: `Meta avg CPA $${kpis.metrics.avg_cpa_usd} in yellow zone (95-110% of target)`,
        suggested_action: 'Monitor closely; prepare reallocation candidates'
      });
    }

    // Ban rate anomaly
    if (kpis.metrics.bans_today > kpis.metrics.avg_bans_7d * 2) {
      insights.push({
        type: 'ban_spike',
        severity: 'critical',
        entity: 'meta',
        message: `${kpis.metrics.bans_today} bans today vs 7-day avg of ${kpis.metrics.avg_bans_7d}`,
        suggested_action: 'Check cloaking service status; review recent campaign changes'
      });
    }
  }

  return insights;
}
```

### 4.2 Weekly Knowledge Base Update (runs Monday at 06:00)

```typescript
async function updateKnowledgeBase() {
  // 1. Collect all snapshots from last 7 days
  const weekSnapshots = await getSnapshotsRange(today - 7, today);

  // 2. Compute week-over-week deltas
  const deltas = computeDeltas(weekSnapshots);

  // 3. Generate insights
  const insights = await detectTrends(today);

  // 4. Update company-snapshot.md
  // Section 3 (velocity), Section 4 (cycle time), Section 5 (blocked)
  // are auto-updated with latest numbers

  // 5. Generate weekly digest
  const digest = {
    period: `${formatDate(today - 7)} to ${formatDate(today)}`,
    highlights: insights.filter(i => i.severity === 'critical'),
    velocity_change: deltas.velocity,
    throughput: deltas.throughput,
    new_blocked: deltas.new_blocked,
    resolved_blocked: deltas.resolved_blocked,
    kpi_movements: deltas.kpis,
    confluence_changes: deltas.doc_changes
  };

  // 6. Save digest as snapshot
  await saveSnapshot({
    date: today, source: 'system', category: 'weekly_digest',
    entity_type: 'company', entity_id: 'upstars',
    metrics: digest
  });

  // 7. Push digest notification to management
  await sendPushNotification('management', {
    title: 'Weekly MCC Digest',
    body: `${insights.filter(i => i.severity === 'critical').length} critical issues. Velocity: ${deltas.velocity.direction}. Click to review.`
  });
}
```

---

## 5. Data Retention Policy

| Layer | Retention | Storage |
|-------|-----------|---------|
| Raw cache (Redis) | 5-15 min TTL | Redis |
| Daily snapshots | 365 days | PostgreSQL |
| Weekly digests | Forever | PostgreSQL |
| Knowledge base (markdown) | Forever (git versioned) | Git repo |
| Confluence page versions | Tracked weekly | PostgreSQL (version numbers) |

### Storage Estimate
- ~20 snapshot records/day × 365 days × ~2KB avg = ~14 MB/year
- Negligible storage cost. No need for archival strategy.

---

## 6. Access Patterns (How the Panel Uses This Data)

### Dashboard Queries (real-time, Layer 1)
```
GET /api/mcc/dashboard → Redis cache → Keitaro/Jira APIs
```

### Trend Charts (historical, Layer 2)
```
GET /api/mcc/trends?entity=ASD&category=velocity&days=90
→ SELECT * FROM mcc.snapshots WHERE entity_id='ASD' AND category='velocity' ORDER BY snapshot_date
```

### Alert Generation (Layer 2 → Layer 3)
```
Cron every 5 min → compare latest snapshot vs thresholds → create alert if exceeded
```

### AI Context (Layer 3)
```
Claude query: "How is the ASD team performing?"
→ Load company-snapshot.md + last 7 daily snapshots + current sprint data
→ Generate contextual answer with specific numbers and trends
```

---

## 7. Implementation Priority

| Step | What | When |
|------|------|------|
| 1 | Create `mcc.snapshots` table | Phase 0 (Day 1) |
| 2 | Manual snapshot script (run from CLI) | Phase 0 (Day 2) |
| 3 | Jira snapshot collector (cron) | Phase 1 (Week 2) |
| 4 | Keitaro snapshot collector (cron) | Phase 1 (Week 2) |
| 5 | Trend detection + alert generation | Phase 1 (Week 3) |
| 6 | Confluence page watcher | Phase 2 (Week 4) |
| 7 | Weekly digest generation | Phase 3 (Week 5) |
| 8 | Knowledge base auto-update | Phase 3 (Week 6) |

---

## 8. Credentials & API Access

| Service | Auth Method | Rate Limits | Notes |
|---------|------------|-------------|-------|
| **Jira** | Basic Auth (email + API token) | 100 req/sec | Cloud instance |
| **Confluence** | Same Atlassian token | 100 req/sec | Same instance as Jira |
| **Keitaro** | API Key header | Unknown (use curl for Cloudflare bypass) | Existing service handles this |
| **MetaMind** | TBD (internal extension) | TBD | Data quality issues being fixed (FS-691-694) |
| **Houston DB** | PostgreSQL connection | N/A (direct DB) | Read-only access from Oleksii |
| **GitHub** | Personal Access Token | 5000 req/hr | Already authenticated via gh CLI |
