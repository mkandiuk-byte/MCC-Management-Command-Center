import { test, expect } from '@playwright/test'
import { TrafficAnalyticsPage } from './pages/traffic-analytics.page'

test.describe('Traffic Analytics — page load', () => {
  test('heading is visible', async ({ page }) => {
    const tap = new TrafficAnalyticsPage(page)
    await tap.goto()
    await tap.waitForData()
    await expect(tap.heading).toBeVisible()
  })

  test('no uncaught JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/keitaro/analytics')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})

test.describe('Traffic Analytics — KeitaroAnalytics section', () => {
  test('main analytics section renders', async ({ page }) => {
    await page.goto('/keitaro/analytics')
    await page.waitForLoadState('networkidle')
    const main = page.locator('main')
    await expect(main).toBeVisible()
    const text = await main.textContent()
    expect(text?.length).toBeGreaterThan(20)
  })

  test('calls keitaro report API on load', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/report') && r.status() === 200,
        { timeout: 20_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    expect(response.ok()).toBe(true)
  })
})

test.describe('Traffic Analytics — Conversion Quality section', () => {
  test('"Conversion Quality" heading is visible', async ({ page }) => {
    await page.goto('/keitaro/analytics')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const heading = page.locator('h2').filter({ hasText: 'Conversion Quality' })
    await expect(heading).toBeVisible()
  })

  test('Offer Approval tab is present', async ({ page }) => {
    await page.goto('/keitaro/analytics')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const tap = new TrafficAnalyticsPage(page)
    await expect(tap.tabOfferApproval).toBeVisible()
  })

  test('Revenue Delta tab is present', async ({ page }) => {
    await page.goto('/keitaro/analytics')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const tap = new TrafficAnalyticsPage(page)
    await expect(tap.tabRevenueDelta).toBeVisible()
  })

  test('calls traffic-quality/offers API', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/offers'),
        { timeout: 25_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
  })

  test('Offer Approval table renders rows', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/offers'),
        { timeout: 25_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    await page.waitForTimeout(1000)
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('revenue-delta API loads on mount and tab shows data', async ({ page }) => {
    // Both offers and delta are fetched on mount — wait for delta during navigation
    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/revenue-delta') && r.status() === 200,
        { timeout: 25_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)

    // Click Revenue Delta tab and verify table renders
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const tap = new TrafficAnalyticsPage(page)
    await tap.tabRevenueDelta.click()
    await page.waitForTimeout(300)
    // Delta table should now be visible
    const table = page.locator('table')
    await expect(table).toBeVisible()
  })

  test('summary cards show totals', async ({ page }) => {
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/offers'),
        { timeout: 25_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    await page.waitForTimeout(800)
    // Cards show numbers like "300", "99,158" etc.
    const cards = page.locator('div.rounded-xl').filter({ has: page.locator('div.text-lg.font-bold') })
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Traffic Analytics — preset change', () => {
  test('switching from 90d to 30d triggers new API call', async ({ page }) => {
    // Navigate and wait for initial load
    await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/offers'),
        { timeout: 25_000 }
      ),
      page.goto('/keitaro/analytics'),
    ])
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/traffic-quality/offers') && r.url().includes('from='),
        { timeout: 20_000 }
      ),
      page.locator('button').filter({ hasText: '30d' }).last().click(),
    ])
    expect(response.status()).toBe(200)
  })
})
