import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'

export async function POST(req: NextRequest) {
  const { repoPath } = await req.json()

  if (!repoPath || typeof repoPath !== 'string') {
    return NextResponse.json({ error: 'repoPath is required' }, { status: 400 })
  }

  if (!fs.existsSync(repoPath)) {
    return NextResponse.json({ error: `Path not found: ${repoPath}` }, { status: 400 })
  }

  try {
    const output = execSync('git pull --ff-only', {
      cwd: repoPath,
      stdio: 'pipe',
      timeout: 60000,
    }).toString().trim()

    return NextResponse.json({ ok: true, output })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Pull failed: ${msg}` }, { status: 500 })
  }
}
