import { Page, Locator } from '@playwright/test'

export class TrafficAnalyticsPage {
  readonly page: Page
  readonly heading:          Locator
  readonly convQualitySection: Locator
  readonly tabOfferApproval: Locator
  readonly tabRevenueDelta:  Locator

  constructor(page: Page) {
    this.page               = page
    this.heading            = page.locator('h1').filter({ hasText: 'Traffic Analytics' })
    this.convQualitySection = page.locator('text=Conversion Quality').first()
    this.tabOfferApproval   = page.locator('button').filter({ hasText: 'Offer Approval' })
    this.tabRevenueDelta    = page.locator('button').filter({ hasText: 'Revenue Delta' })
  }

  async goto() {
    await this.page.goto('/keitaro/analytics')
  }

  async waitForData() {
    await this.page.waitForLoadState('networkidle')
  }

  async waitForConversionQuality() {
    await this.page.waitForResponse(
      r => r.url().includes('/api/analytics/traffic-quality/offers'),
      { timeout: 25_000 }
    )
  }
}
