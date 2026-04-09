import { NextRequest, NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN ?? ''
const BASE_ID = 'app7wO1qK4BU9HnPL'

const PEOPLE_TABLE = 'tblyQ5mn6UCle5KM6'
const TEAM_TABLE = 'tblNLPPRTxzIRB8rM'

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

interface AirtableResponse {
  records: AirtableRecord[]
  offset?: string
}

/* ------------------------------------------------------------------ */
/*  Cache (5 min)                                                      */
/* ------------------------------------------------------------------ */

let cachedData: unknown = null
let cachedAt = 0
const CACHE_TTL = 5 * 60 * 1000

/* ------------------------------------------------------------------ */
/*  Airtable paginated fetch                                           */
/* ------------------------------------------------------------------ */

async function airtableFetch(table: string): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = []
  let offset: string | undefined

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}`)
    if (offset) url.searchParams.set('offset', offset)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${table}`)
    const data: AirtableResponse = await res.json()
    allRecords.push(...data.records)
    offset = data.offset
  } while (offset)

  return allRecords
}

/* ------------------------------------------------------------------ */
/*  GET handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET(_request: NextRequest) {
  try {
    // Return cache if fresh
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      return NextResponse.json(cachedData)
    }

    const [peopleRecords, teamRecords] = await Promise.all([
      airtableFetch(PEOPLE_TABLE),
      airtableFetch(TEAM_TABLE),
    ])

    // --- People ---
    const byDepartment: Record<string, number> = {}
    const byTeam: Record<string, number> = {}

    const people = peopleRecords
      .map((rec) => {
        const f = rec.fields
        const name = String(f['name'] ?? f['Name'] ?? '')
        const department = String(f['department'] ?? f['Department'] ?? '')
        // team may be a linked-record array of strings or a plain string
        const rawTeam = f['team'] ?? f['Team'] ?? ''
        const team = Array.isArray(rawTeam) ? String(rawTeam[0] ?? '') : String(rawTeam)
        const position = String(f['position'] ?? f['Position'] ?? '')
        const email = String(f['email'] ?? f['Email'] ?? '')

        if (department) byDepartment[department] = (byDepartment[department] ?? 0) + 1
        if (team) byTeam[team] = (byTeam[team] ?? 0) + 1

        return { name, department, team, position, email }
      })
      .filter((p) => p.name)

    // --- Teams ---
    const teamNames = teamRecords.map((rec) => {
      const f = rec.fields
      return String(f['team_name'] ?? f['Team Name'] ?? f['name'] ?? f['Name'] ?? '')
    }).filter(Boolean)

    const teams = teamNames.map((name) => ({
      name,
      memberCount: byTeam[name] ?? 0,
    }))

    const result = {
      people,
      summary: {
        total: people.length,
        byDepartment,
        byTeam,
      },
      teams,
      source: 'airtable_api' as const,
    }

    cachedData = result
    cachedAt = Date.now()

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[airtable/people] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
