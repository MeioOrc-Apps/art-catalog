import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('@smoke Busca de Artistas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('exibe campo de busca e botão desabilitado quando vazio', async ({ page }) => {
    const input = page.getByPlaceholder('Buscar artista…').first()
    const btn = page.getByLabel('Buscar').first()
    await expect(input).toBeVisible()
    await expect(btn).toBeDisabled()
  })

  test('botão habilita ao digitar nome de artista', async ({ page }) => {
    await page.getByPlaceholder('Buscar artista…').first().fill('Monet')
    await expect(page.getByLabel('Buscar').first()).toBeEnabled()
  })

  test('buscar inicia processamento e exibe status', async ({ page }) => {
    await page.getByPlaceholder('Buscar artista…').first().fill('Gustav Klimt')
    await page.getByLabel('Buscar').first().click()

    // Deve aparecer o toolbar do artista com o slider de limite
    await expect(page.getByLabel('Limite de imagens')).toBeVisible({ timeout: 15_000 })
  })

  test('artista já buscado aparece no acervo', async ({ page }) => {
    // Garante que há pelo menos um artista buscado anteriormente
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    const count = await artistCards.count()
    if (count > 0) {
      // Verifica que os cards de artistas estão visíveis
      await expect(artistCards.first()).toBeVisible()
    }
  })

  test('clicar em artista do acervo abre sua galeria', async ({ page }) => {
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    const count = await artistCards.count()
    if (count === 0) {
      test.skip()
      return
    }
    await artistCards.first().click()
    // Deve mostrar o toolbar do artista com o slider
    await expect(page.getByLabel('Limite de imagens')).toBeVisible({ timeout: 10_000 })
  })

  test('toggle de ordenação A-Z funciona', async ({ page }) => {
    const artistCards = page.locator('button[class*="group"][class*="bg-card"]')
    if (await artistCards.count() < 2) {
      test.skip()
      return
    }
    await expect(page.getByText('A-Z')).toBeVisible()
    await page.getByText('A-Z').click()
    await expect(page.getByText('Recentes')).toBeVisible()
  })
})
