import { test, expect } from '@playwright/test'
import { BasePage } from './pages/base.page'

const ROUTES = [
  { path: '/' },
  { path: '/keitaro' },
  { path: '/jira' },
  { path: '/repos' },
  { path: '/claude/skills' },
  { path: '/claude/mcp' },
  { path: '/files/upstars' },
  { path: '/logs' },
  { path: '/settings' },
]

test.describe('Navigation', () => {
  test('sidebar is visible on all main pages', async ({ page }) => {
    const basePage = new BasePage(page)
    for (const route of ROUTES.slice(0, 4)) {
      await basePage.goto(route.path)
      await expect(basePage.sidebar).toBeVisible()
    }
  })

  test('sidebar links navigate to correct pages', async ({ page }) => {
    const basePage = new BasePage(page)
    await basePage.goto('/')

    await basePage.navigateTo('/keitaro')
    await expect(page).toHaveURL('/keitaro')

    await basePage.navigateTo('/jira')
    await expect(page).toHaveURL('/jira')

    await basePage.navigateTo('/')
    await expect(page).toHaveURL('/')
  })

  test.describe('Smoke — all routes return 200', () => {
    for (const route of ROUTES) {
      test(`GET ${route.path}`, async ({ page }) => {
        const response = await page.goto(route.path)
        expect(response?.status()).toBe(200)
      })
    }
  })

  test('active nav item has data-active attribute for current route', async ({ page }) => {
    await page.goto('/jira')
    await page.waitForLoadState('networkidle')
    // Base UI sets data-active="" (empty string) on the active menu button
    const activeButton = page.locator('[data-sidebar="menu-button"][data-active]')
    await expect(activeButton).toBeVisible()
  })
})
