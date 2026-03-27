/**
 * PM2 ecosystem for AAP Panel microservices
 *
 * Start all:    pm2 start ecosystem.config.cjs
 * Stop all:     pm2 stop ecosystem.config.cjs
 * Reload all:   pm2 reload ecosystem.config.cjs
 * Status:       pm2 status
 * Logs:         pm2 logs
 */

const ROOT = __dirname
const fs = require('fs')

// Parse .env.local manually — no dotenv dependency needed
function loadEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .reduce((acc, line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return acc
        const eq = trimmed.indexOf('=')
        if (eq === -1) return acc
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim()
        acc[key] = val
        return acc
      }, {})
  } catch { return {} }
}

const dotenv = loadEnvFile(`${ROOT}/.env.local`)

const SHARED_ENV = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  ...dotenv,
  PANEL_ROOT: ROOT,
  PANEL_CONFIG_PATH: `${ROOT}/.panel-config.json`,
  PANEL_ORIGIN: 'http://localhost:3777',
}

module.exports = {
  apps: [
    // ── Next.js shell (UI + thin proxy) ──────────────────────────────
    {
      name: 'aap-shell',
      cwd: ROOT,
      script: 'node_modules/.bin/next',
      args: 'start -p 3777',
      interpreter: 'none',

      env: { ...SHARED_ENV, PORT: '3777' },
      error_file: `${process.env.HOME}/Library/Logs/aap-panel-error.log`,
      out_file: `${process.env.HOME}/Library/Logs/aap-panel.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 5,
    },

    // ── Keitaro analytics service (port 3801) ─────────────────────────
    {
      name: 'aap-keitaro',
      cwd: `${ROOT}/services/keitaro`,
      script: 'src/index.ts',
      interpreter: `${ROOT}/services/keitaro/node_modules/.bin/tsx`,

      env: { ...SHARED_ENV, PORT: '3801' },
      error_file: `${process.env.HOME}/Library/Logs/aap-keitaro-error.log`,
      out_file: `${process.env.HOME}/Library/Logs/aap-keitaro.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 5,
    },

    // ── Jira / GitHub integration service (port 3802) ─────────────────
    {
      name: 'aap-jira',
      cwd: `${ROOT}/services/jira`,
      script: 'src/index.ts',
      interpreter: `${ROOT}/services/jira/node_modules/.bin/tsx`,

      env: { ...SHARED_ENV, PORT: '3802' },
      error_file: `${process.env.HOME}/Library/Logs/aap-jira-error.log`,
      out_file: `${process.env.HOME}/Library/Logs/aap-jira.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 5,
    },

    // ── Workspace service — isolates node-pty (port 3803) ────────────
    {
      name: 'aap-workspace',
      cwd: `${ROOT}/services/workspace`,
      script: 'src/index.ts',
      interpreter: `${ROOT}/services/workspace/node_modules/.bin/tsx`,

      env: { ...SHARED_ENV, PORT: '3803' },
      error_file: `${process.env.HOME}/Library/Logs/aap-workspace-error.log`,
      out_file: `${process.env.HOME}/Library/Logs/aap-workspace.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 10,
      kill_timeout: 5000,
    },

    // ── Claude config service (port 3804) ────────────────────────────
    {
      name: 'aap-claude',
      cwd: `${ROOT}/services/claude`,
      script: 'src/index.ts',
      interpreter: `${ROOT}/services/claude/node_modules/.bin/tsx`,

      env: { ...SHARED_ENV, PORT: '3804' },
      error_file: `${process.env.HOME}/Library/Logs/aap-claude-error.log`,
      out_file: `${process.env.HOME}/Library/Logs/aap-claude.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 3000,
      max_restarts: 5,
    },
  ],
}
