import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'

const ALLOWED_ROOTS = [
  process.env.WORKSPACE_PATH,
  process.env.CLAUDE_PATH,
].filter(Boolean) as string[]

const MAX_SIZE = 500 * 1024 // 500KB

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 })
  }

  const isAllowed = ALLOWED_ROOTS.some(root => filePath.startsWith(root))
  if (!isAllowed) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const stat = fs.statSync(filePath)
  if (!stat.isFile()) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 })
  }

  if (stat.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 500KB)' }, { status: 413 })
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  return NextResponse.json({ content })
}
