import { test, expect } from '@playwright/test'

const API = 'http://localhost:3806'
const FROM = '2026-03-04'
const TO   = '2026-04-03'

test.describe('Analytics Service — health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('analytics')
  })
})

test.describe('Analytics API — ad-performance', () => {
  test('returns campaigns array', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.campaigns)).toBe(true)
    expect(body.campaigns.length).toBeGreaterThan(0)
  })

  test('campaign has required fields', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    const body = await res.json()
    const c = body.campaigns[0]
    for (const field of ['groupKey', 'clicks', 'totalCost', 'leads', 'ftds', 'revenue', 'profit', 'signal', 'buyerId', 'buyerName', 'cvr']) {
      expect(c, `field "${field}" should exist`).toHaveProperty(field)
    }
  })

  test('buyerId and buyerName are present for most campaigns', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    const body = await res.json()
    const withBuyer = body.campaigns.filter((c: { buyerId: unknown }) => c.buyerId !== null)
    expect(withBuyer.length).toBeGreaterThan(0)
  })

  test('cvr is null when leads=0, number otherwise', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    const body = await res.json()
    for (const c of body.campaigns) {
      if (c.leads === 0) {
        expect(c.cvr).toBeNull()
      } else {
        expect(typeof c.cvr).toBe('number')
        expect(c.cvr).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('signal values are valid', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    const body = await res.json()
    const validSignals = new Set(['STOP', 'WATCH', 'OK', 'NEW'])
    for (const c of body.campaigns) {
      expect(validSignals.has(c.signal), `signal "${c.signal}" should be valid`).toBe(true)
    }
  })

  test('offer_id groupby works', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=offer_id`
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.campaigns)).toBe(true)
    expect(body.campaigns.length).toBeGreaterThan(0)
  })

  test('totals object is present', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance?from=${FROM}&to=${TO}&min_spend=500&group_by=ad_campaign_id`
    )
    const body = await res.json()
    expect(body.totals).toBeDefined()
    expect(typeof body.totals.totalSpend).toBe('number')
    expect(typeof body.totals.totalRevenue).toBe('number')
  })
})

test.describe('Analytics API — sparklines', () => {
  test('returns object keyed by group_key', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance/sparklines?from=${FROM}&to=${TO}&group_by=ad_campaign_id`
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body).toBe('object')
    expect(Array.isArray(body)).toBe(false)
  })

  test('sparkline points have day/spend/profit fields', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/ad-performance/sparklines?from=${FROM}&to=${TO}&group_by=ad_campaign_id`
    )
    const body = await res.json()
    const keys = Object.keys(body)
    expect(keys.length).toBeGreaterThan(0)
    const points = body[keys[0]]
    expect(Array.isArray(points)).toBe(true)
    if (points.length > 0) {
      expect(points[0]).toHaveProperty('day')
      expect(points[0]).toHaveProperty('spend')
      expect(points[0]).toHaveProperty('profit')
      // Day must be ISO date format
      expect(points[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

test.describe('Analytics API — traffic-quality', () => {
  test('offers endpoint returns array', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/traffic-quality/offers?from=${FROM}&to=${TO}`
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  test('offer quality row has required fields', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/traffic-quality/offers?from=${FROM}&to=${TO}`
    )
    const body = await res.json()
    const o = body[0]
    for (const field of ['offerId', 'offerName', 'totalDep', 'approved', 'pending', 'rejected']) {
      expect(o, `field "${field}" should exist`).toHaveProperty(field)
    }
  })

  test('approvalRate is null or 0–100', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/traffic-quality/offers?from=${FROM}&to=${TO}`
    )
    const body = await res.json()
    for (const o of body) {
      if (o.approvalRate !== null) {
        expect(o.approvalRate).toBeGreaterThanOrEqual(0)
        expect(o.approvalRate).toBeLessThanOrEqual(100)
      }
    }
  })

  test('revenue-delta endpoint returns array', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/traffic-quality/revenue-delta?from=${FROM}&to=${TO}`
    )
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('revenue-delta row has required fields', async ({ request }) => {
    const res = await request.get(
      `${API}/api/analytics/traffic-quality/revenue-delta?from=${FROM}&to=${TO}`
    )
    const body = await res.json()
    if (body.length > 0) {
      const r = body[0]
      for (const field of ['adCampaignId', 'clicks', 'keitaroRevenue', 'scaleoRevenue', 'delta']) {
        expect(r, `field "${field}" should exist`).toHaveProperty(field)
      }
    }
  })
})
