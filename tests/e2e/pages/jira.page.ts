import { type Page, type Locator } from '@playwright/test'
import { BasePage } from './base.page'

export class JiraPage extends BasePage {
  readonly heading: Locator
  readonly refreshButton: Locator
  readonly addBoardButton: Locator
  readonly addBoardDialog: Locator
  readonly boardNameInput: Locator
  readonly boardUrlInput: Locator
  readonly submitBoardButton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.locator('h1').filter({ hasText: 'Jira' })
    this.refreshButton = page.getByRole('button', { name: /refresh all/i })
    this.addBoardButton = page.getByRole('button', { name: /add board/i })
    this.addBoardDialog = page.getByRole('dialog')
    this.boardNameInput = page.getByRole('dialog').getByLabel(/name/i)
    this.boardUrlInput = page.getByRole('dialog').getByLabel(/url/i)
    this.submitBoardButton = page.getByRole('dialog').getByRole('button', { name: /^Add Board$/ })
    this.emptyState = page.locator('text=No Jira boards configured')
  }

  async goto() {
    await super.goto('/jira')
  }

  async openAddBoardDialog() {
    await this.addBoardButton.click()
  }

  async closeDialog() {
    await this.page.keyboard.press('Escape')
  }
}
