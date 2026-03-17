import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), '.panel-config.json')

function loadConfig(): { scanDirs: string[]; clonedRepos?: { url: string; name: string; path: string }[] } {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) }
  catch { return { scanDirs: [], clonedRepos: [] } }
}

function saveConfig(config: object) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function POST(req: NextRequest) {
  const { url, name, targetDir } = await req.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const resolvedTarget = (targetDir || process.env.WORKSPACE_PATH || '').replace(
    /^~/,
    process.env.HOME || ''
  )

  if (!fs.existsSync(resolvedTarget)) {
    return NextResponse.json({ error: `Target directory not found: ${resolvedTarget}` }, { status: 400 })
  }

  // Derive repo name from URL if not provided
  const repoName = (name?.trim()) || url.split('/').pop()?.replace(/\.git$/, '') || 'repo'
  const destPath = path.join(resolvedTarget, repoName)

  if (fs.existsSync(destPath)) {
    return NextResponse.json({ error: `Directory already exists: ${destPath}` }, { status: 400 })
  }

  try {
    execSync(`git clone ${JSON.stringify(url)} ${JSON.stringify(destPath)}`, {
      stdio: 'pipe',
      timeout: 120000,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Clone failed: ${msg}` }, { status: 500 })
  }

  // Save to config
  const config = loadConfig()
  if (!config.clonedRepos) config.clonedRepos = []
  config.clonedRepos.push({ url, name: repoName, path: destPath })
  saveConfig(config)

  return NextResponse.json({ ok: true, path: destPath, name: repoName })
}
