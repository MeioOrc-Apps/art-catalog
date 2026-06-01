/**
 * Script de captura de screenshots para o README.
 * Roda separado: npx playwright test e2e/screenshots.spec.ts --headed
 */
import { test } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { login } from './helpers'

const SCREENSHOTS_DIR = path.join(process.cwd(), '..', 'docs', 'screenshots')

test.describe('Screenshots para README', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  })

  test('01-login', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login.png'), fullPage: false })
  })

  test('02-home-empty', async ({ page }) => {
    await login(page)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-home-acervo.png'), fullPage: false })
  })

  test('03-search-result', async ({ page }) => {
    await login(page)
    // Clica no primeiro artista do acervo se houver
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    const count = await artistCards.count()
    if (count > 0) {
      await artistCards.first().click()
      await page.getByLabel('Limite de imagens').waitFor({ timeout: 8_000 })
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-gallery.png'), fullPage: false })
    }
  })

  test('04-explore', async ({ page }) => {
    await login(page)
    await page.goto('/explore')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-explore.png'), fullPage: false })
  })

  test('05-collections', async ({ page }) => {
    await login(page)
    await page.goto('/collections')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-collections.png'), fullPage: false })
  })
})
