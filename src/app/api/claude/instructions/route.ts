import { proxyTo, serviceUrl } from '@/lib/service-proxy'

export const POST = proxyTo(serviceUrl('claude'))
