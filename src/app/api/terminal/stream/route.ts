import { proxyTo, serviceUrl } from '@/lib/service-proxy'

// SSE stream — proxyTo forwards AbortSignal so workspace service
// knows when the browser disconnects
export const GET = proxyTo(serviceUrl('workspace'))
