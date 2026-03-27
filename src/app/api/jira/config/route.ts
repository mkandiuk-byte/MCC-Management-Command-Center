import { proxyTo, serviceUrl } from '@/lib/service-proxy'

const proxy = proxyTo(serviceUrl('jira'))

export const GET    = proxy
export const POST   = proxy
export const PATCH  = proxy
export const DELETE = proxy
