import { test, expect } from '@playwright/test'
import { HomePage } from './pages/home.page'

test.describe('Home / Dashboard', () => {
  let home: HomePage

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page)
    await home.goto()
    await page.waitForLoadState('networkidle')
  })

  test('renders page heading', async () => {
    await expect(home.heading).toBeVisible()
  })

  test('renders subtitle', async () => {
    await expect(home.subtitle).toBeVisible()
  })

  test('renders at least 4 quick link cards', async ({ page }) => {
    const links = page.locator('main a[href^="/"]')
    const count = await links.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('quick link — Skills navigates to /claude/skills', async ({ page }) => {
    await page.locator('a[href="/claude/skills"]').first().click()
    await expect(page).toHaveURL('/claude/skills')
  })

  test('quick link — Repositories navigates to /repos', async ({ page }) => {
    await page.locator('a[href="/repos"]').first().click()
    await expect(page).toHaveURL('/repos')
  })

  test('dashboard stats section renders', async ({ page }) => {
    const statsSection = page.locator('main').first()
    await expect(statsSection).toBeVisible()
  })
})
