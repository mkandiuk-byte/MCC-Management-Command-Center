import { proxyTo, serviceUrl } from '@/lib/service-proxy'

const proxy = proxyTo(serviceUrl('workspace'))

export const GET  = proxy
export const POST = proxy
