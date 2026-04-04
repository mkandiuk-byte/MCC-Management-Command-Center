import { type Page, type Locator } from '@playwright/test'
import { BasePage } from './base.page'

export class HomePage extends BasePage {
  readonly heading: Locator
  readonly subtitle: Locator
  readonly quickLinks: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.locator('h1').filter({ hasText: 'AAP Panel' })
    this.subtitle = page.locator('text=Admin Panel & Claude Workspace')
    this.quickLinks = page.locator('a').filter({ has: page.locator('svg') })
  }

  async goto() {
    await super.goto('/')
  }
}
