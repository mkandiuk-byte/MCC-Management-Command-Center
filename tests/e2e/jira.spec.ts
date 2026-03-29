import { test, expect } from '@playwright/test'
import { JiraPage } from './pages/jira.page'

test.describe('Jira', () => {
  let jira: JiraPage

  test.beforeEach(async ({ page }) => {
    jira = new JiraPage(page)
    await jira.goto()
    // Wait for /api/jira/config to resolve and loading state to clear
    await expect(jira.refreshButton).toBeEnabled({ timeout: 15_000 })
  })

  test('renders page heading', async () => {
    await expect(jira.heading).toBeVisible()
  })

  test('refresh all button is present and enabled', async () => {
    await expect(jira.refreshButton).toBeVisible()
    await expect(jira.refreshButton).toBeEnabled()
  })

  test('add board button is present and enabled', async () => {
    await expect(jira.addBoardButton).toBeVisible()
    await expect(jira.addBoardButton).toBeEnabled()
  })

  test('add board dialog opens and closes', async ({ page }) => {
    await jira.addBoardButton.click()
    // AddJiraBoardDialog uses shadcn DialogContent — wait for title
    await expect(page.locator('text=Add Jira Board')).toBeVisible()

    await jira.closeDialog()
    await expect(page.locator('text=Add Jira Board')).toBeHidden()
  })

  test('add board dialog has name and url fields', async ({ page }) => {
    await jira.addBoardButton.click()
    await expect(page.locator('text=Add Jira Board')).toBeVisible()
    // Check for input fields inside the open dialog
    const inputs = page.locator('[role="dialog"] input')
    await expect(inputs.first()).toBeVisible()
    const count = await inputs.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('add board dialog — submit button disabled without URL (validation)', async ({ page }) => {
    await jira.addBoardButton.click()
    await expect(page.locator('text=Add Jira Board')).toBeVisible()
    // Submit button is disabled when URL field is empty or invalid
    await expect(jira.submitBoardButton).toBeDisabled()
  })

  test('refresh all button triggers /api/jira requests', async ({ page }) => {
    let refreshCalled = false
    page.on('request', req => {
      if (req.url().includes('/api/jira')) refreshCalled = true
    })
    await jira.refreshButton.click()
    await page.waitForTimeout(1000)
    expect(refreshCalled).toBe(true)
  })
})
