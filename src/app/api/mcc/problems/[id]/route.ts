import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/mcc-db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const problemResult = await query(
      'SELECT * FROM mcc.problems WHERE id = $1',
      [id],
    )

    if (problemResult.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
    }

    const updatesResult = await query(
      'SELECT * FROM mcc.problem_updates WHERE problem_id = $1 ORDER BY created_at DESC',
      [id],
    )

    return NextResponse.json({
      problem: problemResult.rows[0],
      updates: updatesResult.rows,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()

    const allowedFields = ['status', 'owner', 'severity', 'baseline_value', 'current_value', 'target_value', 'description', 'hypothesis', 'metric_name']
    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`)
        values.push(body[field])
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 },
      )
    }

    setClauses.push(`updated_at = now()`)
    values.push(id)

    const result = await query(
      `UPDATE mcc.problems SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
    }

    return NextResponse.json({ problem: result.rows[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
