import { test, expect } from '@playwright/test'
import { KeitaroPage } from './pages/keitaro.page'

test.describe('Keitaro', () => {
  let keitaro: KeitaroPage

  test.beforeEach(async ({ page }) => {
    keitaro = new KeitaroPage(page)
    await keitaro.goto()
    await keitaro.waitForData()
  })

  test('renders page heading', async () => {
    await expect(keitaro.heading).toBeVisible()
  })

  test('refresh button is present (icon-only button with SVG)', async ({ page }) => {
    const refreshBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(refreshBtn).toBeVisible()
  })

  test('page does not navigate away after load', async ({ page }) => {
    await page.waitForTimeout(500)
    await expect(page).toHaveURL('/keitaro')
  })

  test('page does not show 500 or Internal Server Error', async ({ page }) => {
    const bodyText = await page.locator('main, body').first().textContent() ?? ''
    expect(bodyText).not.toContain('Internal Server Error')
    expect(page.url()).toContain('/keitaro')
  })

  test('main content area renders with content', async ({ page }) => {
    const main = page.locator('main')
    await expect(main).toBeVisible()
    const text = await main.textContent()
    expect(text?.length).toBeGreaterThan(10)
  })

  test('calls keitaro API on load', async ({ page }) => {
    // Wait for the first keitaro API request using page.waitForRequest
    const requestPromise = page.waitForRequest(
      req => req.url().includes('/api/keitaro'),
      { timeout: 10_000 }
    )
    await page.goto('/keitaro')
    await requestPromise
  })
})
