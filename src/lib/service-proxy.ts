/**
 * Proxy helper — forwards Next.js API requests to internal Fastify services.
 *
 * Usage in a route file:
 *   import { proxyTo, serviceUrl } from '@/lib/service-proxy'
 *   export const GET = proxyTo(serviceUrl('keitaro'))
 *   export const POST = proxyTo(serviceUrl('keitaro'))
 */

const SERVICE_PORTS: Record<string, number> = {
  keitaro:   3801,
  jira:      3802,
  workspace: 3803,
  claude:    3804,
  graph:     3805,
  analytics: 3806,
}

export function serviceUrl(name: keyof typeof SERVICE_PORTS): string {
  return `http://127.0.0.1:${SERVICE_PORTS[name]}`
}

/**
 * Returns a Next.js Route Handler that proxies to a Fastify service.
 * Preserves method, headers, body, query string, and AbortSignal (for SSE).
 */
export function proxyTo(baseUrl: string) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const targetUrl = `${baseUrl}${url.pathname}${url.search}`

    const headers = new Headers(req.headers)
    headers.delete('host')
    headers.delete('connection')
    headers.delete('transfer-encoding')

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'

    try {
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: hasBody ? req.body : undefined,
        signal: req.signal,
        // @ts-expect-error — required for streaming body in Node 18+
        duplex: 'half',
      })

      // Strip hop-by-hop headers before forwarding
      const respHeaders = new Headers(upstream.headers)
      respHeaders.delete('transfer-encoding')
      respHeaders.delete('connection')

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
      })
    } catch (err) {
      // Ignore abort errors (client disconnected)
      if (err instanceof Error && err.name === 'AbortError') {
        return new Response(null, { status: 499 })
      }
      const message = err instanceof Error ? err.message : String(err)
      return Response.json({ error: `Service unavailable: ${message}` }, { status: 503 })
    }
  }
}
