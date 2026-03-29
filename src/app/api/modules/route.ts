import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Module {
  id: string
  label: string
  href: string
  icon: string
  service: string | null
  alwaysVisible: boolean
}

interface ModuleWithStatus extends Module {
  available: boolean
}

const MODULES_PATH = path.join(process.cwd(), 'modules.json')

function loadModules(): Module[] {
  try {
    return JSON.parse(fs.readFileSync(MODULES_PATH, 'utf-8'))
  } catch {
    return []
  }
}

async function checkService(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
    return res.ok
  } catch {
    return false
  }
}

export async function GET() {
  const modules = loadModules()

  // Check all services in parallel
  const checks = await Promise.all(
    modules.map(async (m): Promise<ModuleWithStatus> => {
      if (m.alwaysVisible || !m.service) return { ...m, available: true }
      const available = await checkService(m.service)
      return { ...m, available }
    })
  )

  return NextResponse.json({ modules: checks })
}
