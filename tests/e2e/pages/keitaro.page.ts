import { type Page, type Locator } from '@playwright/test'
import { BasePage } from './base.page'

export class KeitaroPage extends BasePage {
  readonly heading: Locator
  readonly refreshButton: Locator
  readonly campaignRows: Locator
  readonly loadingSpinner: Locator
  readonly errorState: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.locator('h1').filter({ hasText: 'Keitaro' })
    this.refreshButton = page.getByRole('button', { name: /refresh/i })
    // Campaign rows are rendered as table rows or card divs
    this.campaignRows = page.locator('[data-campaign-id], table tbody tr').first()
    this.loadingSpinner = page.locator('[class*="animate-spin"]').first()
    this.errorState = page.locator('text=Failed to load, text=Error').first()
  }

  async goto() {
    await super.goto('/keitaro')
  }

  async waitForData() {
    // Wait for spinner to disappear or data to appear
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})
  }
}
