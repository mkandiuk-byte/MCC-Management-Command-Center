import postgres from 'postgres'

const ANALYTICS_DB_URL = process.env.ANALYTICS_DB_URL

if (!ANALYTICS_DB_URL) {
  throw new Error('ANALYTICS_DB_URL environment variable is not set')
}

export const sql = postgres(ANALYTICS_DB_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
})
