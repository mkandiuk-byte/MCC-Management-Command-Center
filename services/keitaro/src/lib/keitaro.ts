import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Makes an HTTP request to the Keitaro Admin API using curl (async).
 * curl is used instead of fetch to bypass Cloudflare JA3 TLS fingerprinting.
 */
export async function keitaroRequest(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: object,
): Promise<unknown> {
  const url = `${baseUrl}/admin_api/v1${path}`
  const args = [
    '-s', '-S', '--fail-with-body',
    '-X', method,
    '-H', `Api-Key: ${apiKey}`,
    '-H', 'Content-Type: application/json',
    '-H', 'Accept: application/json',
    '--max-time', '30',
    '-w', '\n%{http_code}',
  ]

  if (body) args.push('-d', JSON.stringify(body))
  args.push(url)

  const { stdout } = await execFileAsync('curl', args, {
    timeout: 35000,
    maxBuffer: 100 * 1024 * 1024,
  })

  const output = stdout.trim()
  const lastNL = output.lastIndexOf('\n')
  const status = lastNL >= 0 ? parseInt(output.substring(lastNL + 1)) : 0
  const responseBody = lastNL >= 0 ? output.substring(0, lastNL) : output

  if (status >= 400) throw new Error(`Keitaro ${status}: ${responseBody.substring(0, 300)}`)

  return responseBody ? JSON.parse(responseBody) : {}
}

/**
 * Campaign type based on emoji prefix in the name (per Confluence doc).
 * 🟢 GEO|OFFERS  → 'offer'        (final CPA campaigns, revenue tracked)
 * 🟠 APP/PWA     → 'app'          (app/PWA routing, spend model)
 * 🟡 CLOAK       → 'cloak'        (entry filter, no conversions)
 * 🟦 FUNNEL OWNER→ 'funnel_owner' (landing redirects)
 * 🟩 OFFER MGR   → 'offer_manager'(traffic split routing)
 * 🟨 DEFAULT APP → 'default_app'  (organic traffic normalisation)
 */
export type CampaignType = 'offer' | 'app' | 'cloak' | 'funnel_owner' | 'offer_manager' | 'default_app' | 'unknown'

export function detectCampaignType(name: string): CampaignType {
  if (name.startsWith('🟢')) return 'offer'
  if (name.startsWith('🟠')) return 'app'
  if (name.startsWith('🟡')) return 'cloak'
  if (name.startsWith('🟦')) return 'funnel_owner'
  if (name.startsWith('🟩')) return 'offer_manager'
  if (name.startsWith('🟨')) return 'default_app'
  return 'unknown'
}

/** Extract 2–3 letter geo/country code from a campaign name. */
export function extractGeo(name: string): string {
  // Pattern: starts with "[AU]", "(AU)", "AU_", "AU-", "AU " etc.
  const prefix = name.match(/^[\[{(]?([A-Z]{2,3})[\]})\s_\-|]/)?.[1]
  if (prefix) return prefix

  // Fallback: known codes anywhere as a whole word
  const m = name.match(
    /\b(AU|NZ|GB|IE|CA|US|BR|MX|AR|CL|CO|PE|DE|FR|ES|IT|PL|NL|PT|RU|UA|TR|ZA|NG|KE|GH|IN|PH|TH|VN|ID|MY|SG|JP|KR)\b/,
  )
  return m ? m[1] : 'Unknown'
}

export function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}
