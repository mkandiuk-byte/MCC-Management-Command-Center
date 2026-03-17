import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CLAUDE_PATH = process.env.CLAUDE_PATH ?? ''

export async function POST(req: NextRequest) {
  const { name, category, content } = await req.json()

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '')
  if (!safeName) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
  }

  const fileName = safeName.endsWith('.md') ? safeName : `${safeName}.md`

  const dirPath = category
    ? path.join(CLAUDE_PATH, 'Instructions', category.trim())
    : path.join(CLAUDE_PATH, 'Instructions')

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const filePath = path.join(dirPath, fileName)

  if (fs.existsSync(filePath)) {
    return NextResponse.json({ error: `File already exists: ${filePath}` }, { status: 400 })
  }

  const fileContent = content || `# ${safeName}\n\n`
  fs.writeFileSync(filePath, fileContent, 'utf-8')

  return NextResponse.json({ ok: true, path: filePath, name: fileName })
}
