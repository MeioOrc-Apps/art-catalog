import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('@smoke Coleções', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('navegar para /collections exibe página de coleções', async ({ page }) => {
    await page.getByLabel('Coleções').click()
    await expect(page).toHaveURL('/collections')
    await expect(page.getByText('Coleções').first()).toBeVisible()
  })

  test('botão + abre formulário de criação', async ({ page }) => {
    await page.goto('/collections')
    // Usar o botão visível (desktop ou mobile)
    await page.locator('button', { hasText: /nova coleção/i }).or(
      page.getByLabel('Nova coleção')
    ).first().click()
    await expect(page.getByPlaceholder('Nome da coleção…')).toBeVisible()
  })

  test('criar nova coleção e verificar que aparece na lista', async ({ page }) => {
    await page.goto('/collections')
    await page.locator('button', { hasText: /nova coleção/i }).or(
      page.getByLabel('Nova coleção')
    ).first().click()
    const colName = `E2E Test ${Date.now()}`
    await page.getByPlaceholder('Nome da coleção…').fill(colName)
    await page.getByRole('button', { name: 'Criar' }).click()
    await expect(page.getByText(colName)).toBeVisible({ timeout: 5_000 })
  })

  test('cancelar criação de coleção fecha o formulário', async ({ page }) => {
    await page.goto('/collections')
    await page.locator('button', { hasText: /nova coleção/i }).or(
      page.getByLabel('Nova coleção')
    ).first().click()
    await expect(page.getByPlaceholder('Nome da coleção…')).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByPlaceholder('Nome da coleção…')).not.toBeVisible()
  })

  test('clicar em coleção existente abre detalhe', async ({ page }) => {
    await page.goto('/collections')

    // Criar uma coleção de teste primeiro se não houver nenhuma
    const colCards = page.locator('a[href^="/collections/"]')
    if (await colCards.count() === 0) {
      await page.locator('button', { hasText: /nova coleção/i }).or(
        page.getByLabel('Nova coleção')
      ).first().click()
      await page.getByPlaceholder('Nome da coleção…').fill(`E2E Nav ${Date.now()}`)
      await page.getByRole('button', { name: 'Criar' }).click()
      await expect(colCards.first()).toBeVisible({ timeout: 5_000 })
    }

    await colCards.first().click()
    await expect(page.url()).toContain('/collections/')
    await expect(page.getByText('Art Catalog')).toBeVisible()
  })

  test('modo galeria e moodboard estão acessíveis na coleção', async ({ page }) => {
    await page.goto('/collections')

    const colCards = page.locator('a[href^="/collections/"]')
    if (await colCards.count() === 0) {
      test.skip()
      return
    }

    await colCards.first().click()
    await expect(page.url()).toContain('/collections/')

    // Se tiver obras, botões de modo aparecem
    const moodboardBtn = page.getByTitle('Painel Livre')
    const galleryBtn = page.getByTitle('Visão em Grade')
    if (await moodboardBtn.isVisible()) {
      await moodboardBtn.click()
      await expect(galleryBtn).toBeVisible()
      await galleryBtn.click()
    }
  })
})
