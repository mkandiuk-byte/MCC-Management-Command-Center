import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'

const PATHS: Record<string, string> = {
  workspace: process.env.WORKSPACE_PATH ?? '',
  claude: process.env.CLAUDE_PATH ?? '',
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const target = searchParams.get('path') || 'workspace'
  const dirPath = PATHS[target] || PATHS.workspace

  exec(`open -a "Visual Studio Code" "${dirPath}"`, (err) => {
    if (err) exec(`code "${dirPath}"`)
  })

  return NextResponse.json({ ok: true, path: dirPath })
}
