import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CLAUDE_PATH = process.env.CLAUDE_PATH ?? ''

function parseSkillFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const frontmatter: Record<string, string> = {}
  match[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '')
    }
  })
  return frontmatter
}

export async function GET() {
  const skillsPath = path.join(CLAUDE_PATH, 'Skills')

  if (!fs.existsSync(skillsPath)) {
    return NextResponse.json({ skills: [] })
  }

  const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())

  const skills = skillDirs.map(dir => {
    const skillMdPath = path.join(skillsPath, dir.name, 'SKILL.md')
    let frontmatter: Record<string, string> = {}
    let hasSkillMd = false

    if (fs.existsSync(skillMdPath)) {
      hasSkillMd = true
      const content = fs.readFileSync(skillMdPath, 'utf-8')
      frontmatter = parseSkillFrontmatter(content)
    }

    return {
      id: dir.name,
      name: frontmatter.name || dir.name,
      description: frontmatter.description || '',
      argumentHint: frontmatter['argument-hint'] || '',
      allowedTools: frontmatter['allowed-tools'] || '',
      context: frontmatter.context || '',
      hasSkillMd,
      path: path.join(skillsPath, dir.name)
    }
  })

  return NextResponse.json({ skills })
}

export async function POST(req: NextRequest) {
  const { name, description, allowedTools, argumentHint, context } = await req.json()

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const safeName = name.trim().replace(/[^a-zA-Z0-9\-_]/g, '-').replace(/^-+|-+$/g, '')
  if (!safeName) {
    return NextResponse.json({ error: 'Invalid skill name' }, { status: 400 })
  }

  const skillsPath = path.join(CLAUDE_PATH, 'Skills')
  const skillDir = path.join(skillsPath, safeName)

  if (fs.existsSync(skillDir)) {
    return NextResponse.json({ error: `Skill already exists: ${safeName}` }, { status: 400 })
  }

  fs.mkdirSync(skillDir, { recursive: true })

  const lines: string[] = ['---']
  lines.push(`name: ${safeName}`)
  if (description) lines.push(`description: "${description.replace(/"/g, '\\"')}"`)
  if (argumentHint) lines.push(`argument-hint: "${argumentHint}"`)
  if (allowedTools) lines.push(`allowed-tools: ${allowedTools}`)
  if (context) lines.push(`context: ${context}`)
  lines.push('---', '', `# ${safeName}`, '', '## Overview', '', '## Usage', '', '## Steps', '')

  const skillMdPath = path.join(skillDir, 'SKILL.md')
  fs.writeFileSync(skillMdPath, lines.join('\n'), 'utf-8')

  return NextResponse.json({ ok: true, id: safeName, path: skillDir })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Prevent path traversal
  const safeName = path.basename(id)
  const skillDir = path.join(CLAUDE_PATH, 'Skills', safeName)

  if (!fs.existsSync(skillDir)) {
    return NextResponse.json({ error: `Skill not found: ${safeName}` }, { status: 404 })
  }

  fs.rmSync(skillDir, { recursive: true, force: true })

  return NextResponse.json({ ok: true, id: safeName })
}
