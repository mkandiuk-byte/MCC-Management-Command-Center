import { NextRequest, NextResponse } from 'next/server'

const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN ?? ''
const BASE_ID = 'app7wO1qK4BU9HnPL'

const OFFERS_TABLE = 'tblihAMJn3UiCFNKP'
const BRANDS_TABLE = 'tblRmZzvOvEnEb8Le'
const GEO_TABLE = 'tblacMVjbYtaxzc6p'

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

    const [offerRecords, brandRecords, geoRecords] = await Promise.all([
      airtableFetch(OFFERS_TABLE),
      airtableFetch(BRANDS_TABLE),
      airtableFetch(GEO_TABLE),
    ])

    // --- Offers ---
    const byStatus: Record<string, number> = {}
    const byQuality: Record<string, number> = {}
    const byWorkModel: Record<string, number> = {}
    let active = 0
    let withProblems = 0

    for (const rec of offerRecords) {
      const f = rec.fields
      const status = String(f['status'] ?? f['Status'] ?? '')
      const quality = String(f['offer quality'] ?? f['Offer Quality'] ?? '')
      const workModel = String(f['work_model_from_offer'] ?? '')

      if (status) byStatus[status] = (byStatus[status] ?? 0) + 1
      if (quality) byQuality[quality] = (byQuality[quality] ?? 0) + 1
      if (workModel) byWorkModel[workModel] = (byWorkModel[workModel] ?? 0) + 1

      if (status !== 'Arhive' && status !== 'Trash') active++
      if (quality && quality !== 'No Quality') withProblems++
    }

    // --- Brands ---
    const brandList = brandRecords
      .map((rec) => {
        const f = rec.fields
        return {
          name: String(f['name'] ?? f['Name'] ?? ''),
          id: Number(f['brand_id'] ?? f['Brand ID'] ?? 0),
        }
      })
      .filter((b) => b.name)

    // --- Geos ---
    const geoList = geoRecords
      .map((rec) => {
        const f = rec.fields
        const emoji = String(f['emoji'] ?? '')
        const geo = String(f['geo'] ?? f['Geo'] ?? '')
        return emoji ? `${emoji} ${geo}` : geo
      })
      .filter(Boolean)

    const result = {
      offers: {
        total: offerRecords.length,
        byStatus,
        byQuality,
        byWorkModel,
        active,
        withProblems,
      },
      brands: {
        total: brandList.length,
        list: brandList,
      },
      geos: {
        total: geoList.length,
        list: geoList,
      },
      source: 'airtable_api' as const,
    }

    cachedData = result
    cachedAt = Date.now()

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[airtable/offers] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
