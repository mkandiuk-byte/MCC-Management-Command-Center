import type { FastifyInstance } from 'fastify'
import { exec } from 'child_process'

const PATHS: Record<string, string> = {
  workspace: process.env.WORKSPACE_PATH ?? '',
  claude: process.env.CLAUDE_PATH ?? '',
}

export async function actionsRoutes(app: FastifyInstance) {
  app.post('/open-vscode', async (req) => {
    const { path: target = 'workspace' } = req.query as { path?: string }
    const dirPath = PATHS[target] || PATHS.workspace
    exec(`open -a "Visual Studio Code" "${dirPath}"`, (err) => {
      if (err) exec(`code "${dirPath}"`)
    })
    return { ok: true, path: dirPath }
  })
}
