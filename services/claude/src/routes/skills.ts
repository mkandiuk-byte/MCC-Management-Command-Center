import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

const CLAUDE_PATH = process.env.CLAUDE_PATH ?? ''

function parseSkillFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, string> = {}
  match[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':')
    if (key && valueParts.length) fm[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '')
  })
  return fm
}

export async function skillsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const skillsPath = path.join(CLAUDE_PATH, 'Skills')
    if (!fs.existsSync(skillsPath)) return { skills: [] }
    const skillDirs = fs.readdirSync(skillsPath, { withFileTypes: true }).filter(d => d.isDirectory())
    const skills = skillDirs.map(dir => {
      const skillMdPath = path.join(skillsPath, dir.name, 'SKILL.md')
      let frontmatter: Record<string, string> = {}
      let hasSkillMd = false
      if (fs.existsSync(skillMdPath)) {
        hasSkillMd = true
        frontmatter = parseSkillFrontmatter(fs.readFileSync(skillMdPath, 'utf-8'))
      }
      return { name: dir.name, path: path.join(skillsPath, dir.name), hasSkillMd, frontmatter }
    })
    return { skills }
  })

  app.post('/', async (req, reply) => {
    const { name, content } = (req.body ?? {}) as { name?: string; content?: string }
    if (!name) return reply.status(400).send({ error: 'name is required' })
    const safeName = name.trim().replace(/[^a-zA-Z0-9\-_ ]/g, '')
    if (!safeName) return reply.status(400).send({ error: 'Invalid skill name' })
    const skillDir = path.join(CLAUDE_PATH, 'Skills', safeName)
    if (fs.existsSync(skillDir)) return reply.status(400).send({ error: `Skill already exists: ${safeName}` })
    fs.mkdirSync(skillDir, { recursive: true })
    const skillMdPath = path.join(skillDir, 'SKILL.md')
    fs.writeFileSync(skillMdPath, content || `---\nname: ${safeName}\ndescription: ""\n---\n\n`, 'utf-8')
    return { ok: true, path: skillMdPath, name: safeName }
  })
}
