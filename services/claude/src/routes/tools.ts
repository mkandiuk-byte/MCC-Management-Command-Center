import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

const CLAUDE_PATH = process.env.CLAUDE_PATH ?? ''

export async function toolsRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const { name, category, content } = (req.body ?? {}) as { name?: string; category?: string; content?: string }
    if (!name || typeof name !== 'string') return reply.status(400).send({ error: 'name is required' })
    const safeName = name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '')
    if (!safeName) return reply.status(400).send({ error: 'Invalid file name' })
    const fileName = safeName.endsWith('.md') ? safeName : `${safeName}.md`
    const dirPath = category ? path.join(CLAUDE_PATH, 'Tools', category.trim()) : path.join(CLAUDE_PATH, 'Tools')
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
    const filePath = path.join(dirPath, fileName)
    if (fs.existsSync(filePath)) return reply.status(400).send({ error: `File already exists: ${filePath}` })
    fs.writeFileSync(filePath, content || `# ${safeName}\n\n`, 'utf-8')
    return { ok: true, path: filePath, name: fileName }
  })
}
