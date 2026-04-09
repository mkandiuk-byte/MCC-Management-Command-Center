import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/mcc-db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const result = await query(
      'SELECT * FROM mcc.problem_updates WHERE problem_id = $1 ORDER BY created_at DESC',
      [id],
    )

    return NextResponse.json({ updates: result.rows })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { update_type, content, outcome, metric_value, author } = body

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      )
    }

    // Verify the problem exists
    const problemCheck = await query(
      'SELECT id FROM mcc.problems WHERE id = $1',
      [id],
    )
    if (problemCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
    }

    const result = await query(
      `INSERT INTO mcc.problem_updates (problem_id, update_type, content, outcome, metric_value, author)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, update_type ?? 'note', content, outcome ?? null, metric_value ?? null, author ?? null],
    )

    // Update the problem's updated_at timestamp
    await query(
      'UPDATE mcc.problems SET updated_at = now() WHERE id = $1',
      [id],
    )

    return NextResponse.json({ update: result.rows[0] }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
