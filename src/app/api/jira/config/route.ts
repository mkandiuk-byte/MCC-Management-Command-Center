import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getBoard, parseBoardUrl } from '@/lib/jira'

const CONFIG_PATH = path.join(process.cwd(), '.panel-config.json')

interface JiraBoardConfig {
  id: string          // boardId as string (used as key)
  boardId: number
  projectKey: string
  displayName: string
  url: string
}

interface PanelConfig {
  scanDirs: string[]
  jiraBoards?: JiraBoardConfig[]
}

function readConfig(): PanelConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return { scanDirs: [] }
  }
}

function writeConfig(config: PanelConfig) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// GET — list configured boards
export async function GET() {
  const config = readConfig()
  return NextResponse.json({ boards: config.jiraBoards ?? [] })
}

// POST — add board by URL
export async function POST(req: NextRequest) {
  const { url, displayName } = await req.json()

  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const parsed = parseBoardUrl(url)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Could not parse board URL. Expected format: .../projects/KEY/boards/ID' },
      { status: 400 }
    )
  }

  const { boardId, projectKey } = parsed

  // Fetch board metadata from Jira to validate and get name
  let boardName = displayName
  try {
    const board = await getBoard(boardId)
    boardName = displayName || board.name
  } catch {
    boardName = displayName || `Board #${boardId}`
  }

  const config = readConfig()
  if (!config.jiraBoards) config.jiraBoards = []

  // Prevent duplicates
  if (config.jiraBoards.some(b => b.boardId === boardId)) {
    return NextResponse.json({ error: 'Board already added' }, { status: 409 })
  }

  const entry: JiraBoardConfig = {
    id: String(boardId),
    boardId,
    projectKey,
    displayName: boardName,
    url,
  }

  config.jiraBoards.push(entry)
  writeConfig(config)

  return NextResponse.json({ board: entry })
}

// PATCH — update display name
export async function PATCH(req: NextRequest) {
  const { boardId, displayName } = await req.json()
  const config = readConfig()
  const board = config.jiraBoards?.find(b => b.boardId === boardId)
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  board.displayName = displayName
  writeConfig(config)
  return NextResponse.json({ board })
}

// DELETE — remove board
export async function DELETE(req: NextRequest) {
  const { boardId } = await req.json()
  const config = readConfig()
  config.jiraBoards = (config.jiraBoards ?? []).filter(b => b.boardId !== boardId)
  writeConfig(config)
  return NextResponse.json({ ok: true })
}
