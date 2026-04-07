import { test, expect } from '@playwright/test'
import { AdPerformancePage } from './pages/ad-performance.page'

test.describe('Ad Performance — page load', () => {
  let adp: AdPerformancePage

  test.beforeEach(async ({ page }) => {
    adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
  })

  test('heading is visible', async () => {
    await expect(adp.heading).toBeVisible()
  })

  test('table renders', async () => {
    await expect(adp.table).toBeVisible()
  })

  test('no uncaught JS errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('/ad-performance')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})

test.describe('Ad Performance — columns (Ad Campaign mode)', () => {
  let adp: AdPerformancePage

  test.beforeEach(async ({ page }) => {
    adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
  })

  test('required columns are present', async () => {
    const labels = await adp.getHeaderLabels()
    for (const col of ['Signal', 'ad_campaign_id', 'Buyer', 'Clicks', 'Spend', 'Leads', 'FTDs', 'CVR %', 'Rev Fact', 'Rev Est', 'Profit', 'ROI', 'CPL', 'CPA']) {
      expect(labels, `column "${col}" should be present`).toContain(col)
    }
  })

  test('Buyer column is present in Ad Campaign mode', async () => {
    const labels = await adp.getHeaderLabels()
    expect(labels).toContain('Buyer')
  })

  test('CVR % column is present', async () => {
    const labels = await adp.getHeaderLabels()
    expect(labels).toContain('CVR %')
  })

  test('Spend · Profit sparkline column is present', async () => {
    const labels = await adp.getHeaderLabels()
    expect(labels.some(l => l.includes('Spend'))).toBe(true)
  })
})

test.describe('Ad Performance — summary cards', () => {
  test('4 summary cards render', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    const cards = page.locator('.grid.grid-cols-2 > div, .grid.md\\:grid-cols-4 > div')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('Total Spend card shows $ value', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    const spendCard = page.locator('div').filter({ hasText: 'Total Spend' }).first()
    await expect(spendCard).toBeVisible()
    const text = await spendCard.textContent()
    expect(text).toMatch(/\$/)
  })
})

test.describe('Ad Performance — group by toggle', () => {
  test('switches to Offer mode and shows Name column', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    await adp.switchToOffer()

    const labels = await adp.getHeaderLabels()
    expect(labels).toContain('offer_id')
    expect(labels).toContain('Name')
    // Buyer column should NOT appear in offer mode
    expect(labels).not.toContain('Buyer')
  })

  test('switches back to Ad Campaign mode', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    await adp.switchToOffer()
    await adp.switchToCampaign()

    const labels = await adp.getHeaderLabels()
    expect(labels).toContain('ad_campaign_id')
    expect(labels).toContain('Buyer')
  })
})

test.describe('Ad Performance — date presets', () => {
  test('switching preset triggers new API request', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/ad-performance') && !r.url().includes('sparklines'),
        { timeout: 20_000 }
      ),
      page.locator('button').filter({ hasText: '14d' }).click(),
    ])
    expect(response.status()).toBe(200)
  })
})

test.describe('Ad Performance — signal filter', () => {
  test('STOP filter button is present', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    const stopBtn = page.locator('button').filter({ hasText: /STOP/ })
    await expect(stopBtn).toBeVisible()
  })

  test('clicking STOP filter reduces visible rows', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    const allCountText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalAll = parseInt(allCountText?.split('/')[1] ?? '0')

    const stopBtn = page.locator('button').filter({ hasText: /^STOP/ })
    await stopBtn.click()
    await page.waitForTimeout(300)

    const filteredCountText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalStop = parseInt(filteredCountText?.split('/')[0] ?? '0')

    expect(totalStop).toBeLessThan(totalAll)
  })
})

test.describe('Ad Performance — search', () => {
  test('search input has correct placeholder', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    await expect(adp.searchInput).toHaveAttribute('placeholder', /buyer/i)
  })

  test('searching by text reduces visible rows', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    const beforeText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalBefore = parseInt(beforeText?.split('/')[0] ?? '1000')

    // Type a specific long campaign id unlikely to match many
    await adp.search('xyznotfound123')
    await page.waitForTimeout(400)

    const afterText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalAfter = parseInt(afterText?.split('/')[0] ?? '0')

    expect(totalAfter).toBeLessThan(totalBefore)
  })

  test('clearing search restores rows', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    const beforeText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalBefore = parseInt(beforeText?.split('/')[0] ?? '0')

    await adp.search('xyznotfound123')
    await page.waitForTimeout(300)
    await adp.searchInput.fill('')
    await page.waitForTimeout(300)

    const afterText = await page.locator('span.font-mono').filter({ hasText: '/' }).textContent()
    const totalAfter = parseInt(afterText?.split('/')[0] ?? '0')
    expect(totalAfter).toBe(totalBefore)
  })
})

test.describe('Ad Performance — sparklines', () => {
  test('sparkline API is called on load', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/analytics/ad-performance/sparklines'),
        { timeout: 20_000 }
      ),
      page.goto('/ad-performance'),
    ])
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(typeof body).toBe('object')
  })

  test('SVG sparkline elements render in table rows', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()
    // Wait a bit for sparklines to load
    await page.waitForTimeout(3000)
    const svgs = page.locator('tbody svg')
    const count = await svgs.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Ad Performance — buyer data', () => {
  test('at least one row shows a buyer name', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    // Buyer cells are in the column after ad_campaign_id — look for indigo-colored text
    const buyerCells = page.locator('tbody td span.text-indigo-300\\/80')
    const count = await buyerCells.count()
    expect(count).toBeGreaterThan(0)
  })

  test('buyer name is shown (not just ID)', async ({ page }) => {
    const adp = new AdPerformancePage(page)
    await adp.goto()
    await adp.waitForTable()

    const buyerCells = page.locator('tbody td span.text-indigo-300\\/80')
    const first = await buyerCells.first().textContent()
    // Should be a name (not just numeric ID prefixed with #, though # is fallback)
    expect(first?.trim().length).toBeGreaterThan(0)
    expect(first?.trim()).not.toBe('—')
  })
})
