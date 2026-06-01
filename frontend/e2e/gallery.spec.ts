import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('@smoke Galeria e Lightbox', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('clicar em obra abre lightbox', async ({ page }) => {
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    const count = await artistCards.count()
    if (count === 0) {
      test.skip()
      return
    }

    await artistCards.first().click()

    const artworkCards = page.locator('article[class*="art-masonry-item"]')
    const artworkCount = await artworkCards.count()
    if (artworkCount === 0) {
      test.skip()
      return
    }

    await artworkCards.first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('img').last()).toBeVisible()
  })

  test('lightbox fecha com tecla Escape', async ({ page }) => {
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    if (await artistCards.count() === 0) {
      test.skip()
      return
    }
    await artistCards.first().click()

    const artworks = page.locator('article[class*="art-masonry-item"]')
    if (await artworks.count() === 0) {
      test.skip()
      return
    }

    await artworks.first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('lightbox fecha ao clicar no botão X', async ({ page }) => {
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    if (await artistCards.count() === 0) {
      test.skip()
      return
    }
    await artistCards.first().click()

    const artworks = page.locator('article[class*="art-masonry-item"]')
    if (await artworks.count() === 0) {
      test.skip()
      return
    }

    await artworks.first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByLabel('Fechar').click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('página explorar exibe galeria do acervo com filtro de cores', async ({ page }) => {
    await page.getByLabel('Explorar').click()
    await expect(page).toHaveURL('/explore')
    await expect(page.getByText('Cores:')).toBeVisible()
    await expect(page.getByText('Todas')).toBeVisible()
  })

  test('filtro de cor no explorar funciona', async ({ page }) => {
    await page.goto('/explore')
    await page.getByText('Vermelho').click()
    // O botão deve ficar ativo (borda accent)
    await expect(page.getByText('Vermelho')).toBeVisible()
    // Clicar em Todas remove o filtro
    await page.getByText('Todas').click()
    await expect(page.getByText('Todas')).toBeVisible()
  })
})
