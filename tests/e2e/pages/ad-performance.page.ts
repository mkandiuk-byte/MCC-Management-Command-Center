import { Page, Locator } from '@playwright/test'

export class AdPerformancePage {
  readonly page: Page
  readonly heading:        Locator
  readonly table:          Locator
  readonly thead:          Locator
  readonly searchInput:    Locator
  readonly groupCampaign:  Locator
  readonly groupOffer:     Locator
  readonly summaryCards:   Locator
  readonly signalFilter:   Locator

  constructor(page: Page) {
    this.page         = page
    this.heading      = page.locator('h1').filter({ hasText: 'Ad Performance' })
    this.table        = page.locator('table')
    this.thead        = page.locator('table thead')
    this.searchInput  = page.locator('input[placeholder*="Search"]')
    this.groupCampaign = page.locator('button').filter({ hasText: 'Ad Campaign' })
    this.groupOffer   = page.locator('button').filter({ hasText: /^Offer$/ })
    this.summaryCards = page.locator('.grid > div.rounded-xl')
    this.signalFilter = page.locator('button').filter({ hasText: /STOP|WATCH|OK|NEW/ }).first()
  }

  async goto() {
    await this.page.goto('/ad-performance')
  }

  async waitForTable() {
    await this.page.waitForResponse(
      r => r.url().includes('/api/analytics/ad-performance') && !r.url().includes('sparklines'),
      { timeout: 20_000 }
    )
    await this.table.waitFor({ state: 'visible', timeout: 10_000 })
  }

  async getHeaderLabels(): Promise<string[]> {
    const ths = await this.thead.locator('th').allTextContents()
    return ths.map(t => t.trim()).filter(Boolean)
  }

  async search(q: string) {
    await this.searchInput.fill(q)
    await this.page.waitForTimeout(400)
  }

  async clearSearch() {
    const clearBtn = this.page.locator('button').filter({ has: this.page.locator('svg') }).nth(-1)
    await this.searchInput.fill('')
    await this.page.waitForTimeout(200)
  }

  async switchToOffer() {
    await Promise.all([
      this.page.waitForResponse(
        r => r.url().includes('/api/analytics/ad-performance') && r.url().includes('offer_id'),
        { timeout: 20_000 }
      ),
      this.groupOffer.click(),
    ])
    await this.table.waitFor({ state: 'visible', timeout: 10_000 })
  }

  async switchToCampaign() {
    await Promise.all([
      this.page.waitForResponse(
        r => r.url().includes('/api/analytics/ad-performance') && !r.url().includes('sparklines'),
        { timeout: 20_000 }
      ),
      this.groupCampaign.click(),
    ])
    await this.table.waitFor({ state: 'visible', timeout: 10_000 })
  }
}
