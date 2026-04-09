import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/mcc-db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const division = searchParams.get('division')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (division) {
      conditions.push(`division = $${idx++}`)
      params.push(division)
    }

    if (from) {
      conditions.push(`date >= $${idx++}`)
      params.push(from)
    } else {
      // Default: last 30 days
      conditions.push(`date >= CURRENT_DATE - INTERVAL '30 days'`)
    }

    if (to) {
      conditions.push(`date <= $${idx++}`)
      params.push(to)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(
      `SELECT * FROM mcc.daily_metrics ${where} ORDER BY date DESC, division, metric_name`,
      params,
    )

    return NextResponse.json({ metrics: result.rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, division, metric_name, value, entered_by } = body

    if (!date || !division || !metric_name || value === undefined) {
      return NextResponse.json(
        { error: 'date, division, metric_name, and value are required' },
        { status: 400 },
      )
    }

    const result = await query(
      `INSERT INTO mcc.daily_metrics (date, division, metric_name, value, entered_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date, division, metric_name) DO UPDATE SET value = $4, entered_by = $5
       RETURNING *`,
      [date, division, metric_name, value, entered_by ?? null],
    )

    return NextResponse.json({ metric: result.rows[0] }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
