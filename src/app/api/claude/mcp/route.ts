import { proxyTo, serviceUrl } from '@/lib/service-proxy'

const proxy = proxyTo(serviceUrl('claude'))

export const GET  = proxy
export const POST = proxy
