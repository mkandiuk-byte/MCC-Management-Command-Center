import { createStore } from '@tobilu/qmd'
import os from 'os'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(os.homedir(), '.cache', 'qmd')
const DB_PATH = path.join(DB_DIR, 'aap_panel.sqlite')

const COLLECTIONS = {
  claude: {
    path: process.env.CLAUDE_PATH ?? '',
    pattern: '**/*.{md,mdx,txt,ts,tsx,js,py}',
    ignore: ['node_modules/**', '.git/**'],
  },
  upstars: {
    path: process.env.WORKSPACE_PATH ?? '',
    pattern: '**/*.{md,mdx,txt}',
    ignore: ['node_modules/**', '.git/**', '.venv/**', '__pycache__/**'],
  },
}

let storePromise: ReturnType<typeof createStore> | null = null

export function getStore() {
  if (!storePromise) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
    storePromise = createStore({
      dbPath: DB_PATH,
      config: { collections: COLLECTIONS },
    })
  }
  return storePromise
}
