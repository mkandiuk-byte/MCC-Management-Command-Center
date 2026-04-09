import { Pool, QueryResult } from 'pg'

let pool: Pool | null = null
let connected = false

/* ── In-memory fallback store ──────────────────────────────────────────── */
export interface MemRow { [key: string]: unknown }
const tables = new Map<string, MemRow[]>()
let seeded = false

function getTable(name: string): MemRow[] {
  if (!tables.has(name)) tables.set(name, [])
  return tables.get(name)!
}

const SEED_PROBLEMS: MemRow[] = [
  { id: '1', category: 'cloaking', title: 'Primitive cloaking (geo-only) causes account bans', description: 'FB killer crawlers bypass geo-based filtering. Need ML-based behavioral detection (hox.tech, Palladium, HighClick).', severity: 'critical', status: 'investigating', owner: 'Oleksii Kosenko', hypothesis: 'Integrating hox.tech ML cloaking will reduce ban rate by 30%', metric_name: 'Account ban rate (%)', baseline_value: null, current_value: null, target_value: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '2', category: 'white_pages', title: 'White pages not rotated — reused hundreds of times', description: 'FB has seen all our white pages. Google has 1000+ fresh ones. Mitrofanov repository available.', severity: 'critical', status: 'investigating', owner: 'Andrii Laptiev', hypothesis: 'Fresh white pages from Google archive will improve ad moderation pass rate', metric_name: 'Ad rejection rate (%)', baseline_value: null, current_value: null, target_value: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '3', category: 'account_health', title: 'WebRTC leaks in Dolphin expose real IPs', description: 'Dolphin anti-detect browser leaks real IP via WebRTC ~every 3-5 refreshes. Meta can link accounts.', severity: 'high', status: 'investigating', owner: 'Serhii Oliinyk', hypothesis: 'Disabling WebRTC at profile level will reduce account linkage bans', metric_name: 'Account lifespan (days)', baseline_value: null, current_value: null, target_value: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '4', category: 'ios', title: 'iOS conversion underperformance on PWAs', description: 'iOS devices show worse conversion vs Android. BetterLink does better on iOS. Root cause unknown.', severity: 'high', status: 'investigating', owner: 'Dmytro Krutko', hypothesis: 'iOS-specific template improvements will close the conversion gap', metric_name: 'iOS conversion rate (%)', baseline_value: null, current_value: null, target_value: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '5', category: 'event_streaming', title: 'All pixel events stream from single IP', description: 'Server-Side API creates centralized IP fingerprint. FB can link all accounts via event source.', severity: 'medium', status: 'investigating', owner: 'Alexander Pravdyvyi', hypothesis: 'Routing through 20+ server proxies will reduce account linkage', metric_name: 'Account linkage rate', baseline_value: null, current_value: null, target_value: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: '6', category: 'funnel_migration', title: 'Buyers still on external funnels (BetterLink, Skycoin)', description: 'Cannot integrate cloaking on external funnels. Must migrate to FinalSpace/PVA for full control.', severity: 'high', status: 'testing', owner: 'Andrii Laptiev', hypothesis: 'In-house funnels with integrated cloaking will outperform external ones', metric_name: 'Buyers on in-house funnels (%)', baseline_value: 35, current_value: 42, target_value: 80, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
]

function ensureSeeded() {
  if (seeded) return
  seeded = true
  const t = getTable('mcc.problems')
  if (t.length === 0) {
    t.push(...SEED_PROBLEMS)
  }
  // Seed some updates too
  const updates = getTable('mcc.problem_updates')
  if (updates.length === 0) {
    updates.push(
      { id: 'u1', problem_id: '1', update_type: 'note', content: 'Contacted hox.tech — 7-day trial approved, ~$250/month. Setting up test environment.', outcome: null, metric_value: null, author: 'Oleksii Kosenko', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'u2', problem_id: '1', update_type: 'test_result', content: 'First A/B test launched: 3 buyers on hox.tech cloaking vs 3 on existing geo-only. Monitoring for 1 week.', outcome: 'inconclusive', metric_value: null, author: 'Serhii Oliinyk', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 'u3', problem_id: '2', update_type: 'note', content: 'Received 1000+ white pages from Mitrofanov repository. Assessing quality and hosting requirements.', outcome: null, metric_value: null, author: 'Andrii Laptiev', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 'u4', problem_id: '6', update_type: 'metric_update', content: 'Migration progress: 42% of buyers now on in-house funnels (up from 35% baseline).', outcome: 'positive', metric_value: 42, author: 'Andrii Laptiev', created_at: new Date().toISOString() },
    )
  }
}

/* ── PostgreSQL connection ─────────────────────────────────────────────── */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.MCC_DATABASE_URL
    if (!connectionString) throw new Error('MCC_DATABASE_URL is not set')
    pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
    pool.on('error', (err) => { console.error('[mcc-db] Pool error:', err.message); connected = false })
  }
  return pool
}

async function tryConnect(): Promise<boolean> {
  try {
    const p = getPool()
    const client = await p.connect()
    client.release()
    connected = true
    return true
  } catch {
    connected = false
    return false
  }
}

export async function isConnected(): Promise<boolean> {
  if (connected) return true
  if (!process.env.MCC_DATABASE_URL) return false
  return tryConnect()
}

/* ── Unified query interface ───────────────────────────────────────────── */
export async function query(sql: string, params?: unknown[]): Promise<QueryResult> {
  const pgAvailable = await isConnected()
  if (pgAvailable) return getPool().query(sql, params)
  return memoryQuery(sql, params)
}

/* ── In-memory query engine (covers our API patterns) ──────────────────── */
function memoryQuery(sql: string, params?: unknown[]): QueryResult {
  ensureSeeded()
  const norm = sql.replace(/\s+/g, ' ').trim().toLowerCase()

  // CREATE — no-op
  if (norm.startsWith('create')) {
    return mkResult([], 'CREATE')
  }

  // SELECT COUNT
  if (norm.includes('count(')) {
    const table = extractTable(sql, 'from')
    const rows = getTable(table)
    return mkResult([{ cnt: rows.length }], 'SELECT')
  }

  // SELECT with possible WHERE
  if (norm.startsWith('select')) {
    const table = extractTable(sql, 'from')
    let rows = [...getTable(table)]

    // Apply WHERE filters
    const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s*$)/is)
    if (whereMatch && params?.length) {
      const conditions = whereMatch[1]
      // Parse $1, $2 etc parameter references
      const condParts = conditions.split(/\s+AND\s+/i)
      rows = rows.filter(row => {
        return condParts.every((cond, i) => {
          const colMatch = cond.match(/([\w.]+)\s*=\s*\$\d+/i)
            || cond.match(/([\w.]+)\s*=\s*\$\d+/i)
          if (colMatch) {
            const col = colMatch[1].trim()
            return String(row[col]) === String(params[i])
          }
          // date range
          if (cond.includes('>=') && params[i]) {
            const col = cond.match(/([\w.]+)\s*>=/)?.[1]?.trim()
            if (col) return String(row[col]) >= String(params[i])
          }
          if (cond.includes('<=') && params[i]) {
            const col = cond.match(/([\w.]+)\s*<=/)?.[1]?.trim()
            if (col) return String(row[col]) <= String(params[i])
          }
          return true
        })
      })
    }

    // ORDER BY
    if (norm.includes('order by')) {
      const orderMatch = sql.match(/ORDER\s+BY\s+([\w.]+)\s*(ASC|DESC)?/i)
      if (orderMatch) {
        const col = orderMatch[1]
        const desc = orderMatch[2]?.toUpperCase() === 'DESC'
        rows.sort((a, b) => {
          const va = String(a[col] ?? '')
          const vb = String(b[col] ?? '')
          return desc ? vb.localeCompare(va) : va.localeCompare(vb)
        })
      }
    }

    return mkResult(rows, 'SELECT')
  }

  // INSERT
  if (norm.startsWith('insert')) {
    const table = extractTable(sql, 'into')
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
    if (!colMatch) return mkResult([], 'INSERT')
    const cols = colMatch[1].split(',').map(c => c.trim())
    const row: MemRow = {}
    cols.forEach((col, i) => { row[col] = params?.[i] ?? null })
    if (!row.id) row.id = String(Date.now()) + Math.random().toString(36).slice(2, 6)
    if (!row.created_at) row.created_at = new Date().toISOString()
    if (!row.updated_at) row.updated_at = new Date().toISOString()
    getTable(table).push(row)
    return mkResult([row], 'INSERT')
  }

  // UPDATE
  if (norm.startsWith('update')) {
    const table = extractTable(sql, 'update')
    const rows = getTable(table)
    // Last param is the ID (WHERE id = $N pattern)
    const id = params?.[params.length - 1]
    const target = rows.find(r => String(r.id) === String(id))
    if (target) {
      const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is)
      if (setMatch) {
        const assignments = setMatch[1].split(',').map(a => a.trim())
        assignments.forEach((a, i) => {
          const col = a.split('=')[0].trim()
          if (col !== 'updated_at') target[col] = params?.[i] ?? null
        })
        target.updated_at = new Date().toISOString()
      }
    }
    return mkResult(target ? [target] : [], 'UPDATE')
  }

  return mkResult([], 'UNKNOWN')
}

function extractTable(sql: string, keyword: string): string {
  const re = new RegExp(`${keyword}\\s+([\\w.]+)`, 'i')
  return sql.match(re)?.[1] ?? 'unknown'
}

function mkResult(rows: MemRow[], command: string): QueryResult {
  return { rows, rowCount: rows.length, command, oid: 0, fields: [] } as unknown as QueryResult
}

export { getPool }
