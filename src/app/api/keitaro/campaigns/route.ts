import { proxyTo, serviceUrl } from '@/lib/service-proxy'

const proxy = proxyTo(serviceUrl('keitaro'))

export const GET = proxy
export const POST = proxy
