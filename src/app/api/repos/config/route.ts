import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), '.panel-config.json')

function loadConfig(): { scanDirs: string[] } {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { scanDirs: [] }
  }
}

function saveConfig(config: { scanDirs: string[] }) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function GET() {
  return NextResponse.json(loadConfig())
}

export async function POST(req: NextRequest) {
  const { dir } = await req.json()
  if (!dir || typeof dir !== 'string') {
    return NextResponse.json({ error: 'dir is required' }, { status: 400 })
  }

  const resolved = dir.replace(/^~/, process.env.HOME || '')
  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: `Directory not found: ${resolved}` }, { status: 400 })
  }

  const config = loadConfig()
  if (!config.scanDirs.includes(resolved)) {
    config.scanDirs.push(resolved)
    saveConfig(config)
  }

  return NextResponse.json(config)
}

export async function DELETE(req: NextRequest) {
  const { dir } = await req.json()
  if (!dir) {
    return NextResponse.json({ error: 'dir is required' }, { status: 400 })
  }

  const config = loadConfig()
  config.scanDirs = config.scanDirs.filter(d => d !== dir)
  saveConfig(config)

  return NextResponse.json(config)
}
