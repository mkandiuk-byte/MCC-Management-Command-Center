import { proxyTo, serviceUrl } from '@/lib/service-proxy'

export const GET = proxyTo(serviceUrl('jira'))
