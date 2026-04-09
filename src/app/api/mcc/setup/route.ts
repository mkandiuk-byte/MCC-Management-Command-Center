import { NextResponse } from 'next/server'
import { query } from '@/lib/mcc-db'

const CREATE_SCHEMA = `CREATE SCHEMA IF NOT EXISTS mcc`

const CREATE_PROBLEMS = `
CREATE TABLE IF NOT EXISTS mcc.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'identified',
  owner VARCHAR(100),
  hypothesis TEXT,
  metric_name VARCHAR(200),
  baseline_value NUMERIC,
  current_value NUMERIC,
  target_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`

const CREATE_PROBLEM_UPDATES = `
CREATE TABLE IF NOT EXISTS mcc.problem_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES mcc.problems(id) ON DELETE CASCADE,
  update_type VARCHAR(30) NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  outcome VARCHAR(30),
  metric_value NUMERIC,
  author VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`

const CREATE_DAILY_METRICS = `
CREATE TABLE IF NOT EXISTS mcc.daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  division VARCHAR(50) NOT NULL,
  metric_name VARCHAR(200) NOT NULL,
  value NUMERIC NOT NULL,
  entered_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, division, metric_name)
)`

const SEED_PROBLEMS = [
  {
    category: 'cloaking',
    title: 'Primitive cloaking (geo-only) causes account bans',
    owner: 'Oleksii Kosenko',
    severity: 'critical',
    hypothesis: 'Integrating hox.tech ML cloaking will reduce ban rate by 30%',
    metric_name: 'Account ban rate (%)',
  },
  {
    category: 'white_pages',
    title: 'White pages not rotated — reused hundreds of times',
    owner: 'Andrii Laptiev',
    severity: 'critical',
    hypothesis: 'Fresh white pages from Google archive will improve ad moderation pass rate',
    metric_name: 'Ad rejection rate (%)',
  },
  {
    category: 'account_health',
    title: 'WebRTC leaks in Dolphin expose real IPs',
    owner: 'Serhii Oliinyk',
    severity: 'high',
    hypothesis: 'Disabling WebRTC at profile level will reduce account linkage bans',
    metric_name: 'Account lifespan (days)',
  },
  {
    category: 'ios',
    title: 'iOS conversion underperformance on PWAs',
    owner: 'Dmytro Krutko',
    severity: 'high',
    hypothesis: 'iOS-specific template improvements will close the conversion gap',
    metric_name: 'iOS conversion rate (%)',
  },
  {
    category: 'event_streaming',
    title: 'All pixel events stream from single IP',
    owner: 'Alexander Pravdyvyi',
    severity: 'medium',
    hypothesis: 'Routing through 20+ server proxies will reduce account linkage',
    metric_name: 'Account linkage rate',
  },
  {
    category: 'funnel_migration',
    title: 'Buyers still on external funnels (BetterLink, Skycoin)',
    owner: 'Andrii Laptiev',
    severity: 'high',
    hypothesis: 'In-house funnels with integrated cloaking will outperform external ones',
    metric_name: 'Buyers on in-house funnels (%)',
  },
]

export async function POST() {
  try {
    // Create schema and tables
    await query(CREATE_SCHEMA)
    await query(CREATE_PROBLEMS)
    await query(CREATE_PROBLEM_UPDATES)
    await query(CREATE_DAILY_METRICS)

    // Check if already seeded
    const existing = await query('SELECT COUNT(*)::int AS cnt FROM mcc.problems')
    const count = existing.rows[0]?.cnt ?? 0

    let seeded = 0
    if (count === 0) {
      for (const p of SEED_PROBLEMS) {
        await query(
          `INSERT INTO mcc.problems (category, title, severity, owner, hypothesis, metric_name)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.category, p.title, p.severity, p.owner, p.hypothesis, p.metric_name],
        )
        seeded++
      }
    }

    return NextResponse.json({
      success: true,
      tables_created: 3,
      problems_seeded: seeded,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
