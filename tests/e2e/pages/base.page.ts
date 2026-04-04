import { type Page, type Locator } from '@playwright/test'

export class BasePage {
  readonly page: Page

  readonly sidebar: Locator
  readonly sidebarTrigger: Locator
  readonly commandPaletteInput: Locator

  constructor(page: Page) {
    this.page = page
    this.sidebar = page.locator('[data-sidebar="sidebar"]')
    this.sidebarTrigger = page.getByRole('button', { name: /toggle sidebar/i }).first()
    this.commandPaletteInput = page.getByPlaceholder(/search/i)
  }

  async goto(path: string) {
    await this.page.goto(path)
  }

  async openCommandPalette() {
    await this.page.keyboard.press('Meta+k')
  }

  async navigateTo(href: string) {
    await this.page.locator(`a[href="${href}"]`).first().click()
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle')
  }
}
