import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/mcc-db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (category) {
      conditions.push(`category = $${idx++}`)
      params.push(category)
    }
    if (status) {
      conditions.push(`status = $${idx++}`)
      params.push(status)
    }
    if (severity) {
      conditions.push(`severity = $${idx++}`)
      params.push(severity)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await query(
      `SELECT * FROM mcc.problems ${where} ORDER BY created_at DESC`,
      params,
    )

    return NextResponse.json({ problems: result.rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, title, description, severity, owner, hypothesis, metric_name } = body

    if (!category || !title) {
      return NextResponse.json(
        { error: 'category and title are required' },
        { status: 400 },
      )
    }

    const result = await query(
      `INSERT INTO mcc.problems (category, title, description, severity, owner, hypothesis, metric_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [category, title, description ?? null, severity ?? 'medium', owner ?? null, hypothesis ?? null, metric_name ?? null],
    )

    return NextResponse.json({ problem: result.rows[0] }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
