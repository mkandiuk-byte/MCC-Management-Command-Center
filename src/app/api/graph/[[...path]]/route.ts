import { proxyTo, serviceUrl } from '@/lib/service-proxy'

export const GET  = proxyTo(serviceUrl('graph'))
export const POST = proxyTo(serviceUrl('graph'))
