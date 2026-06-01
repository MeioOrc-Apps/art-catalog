import { test, expect } from '@playwright/test'
import { login, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers'

test.describe('@smoke Autenticação', () => {
  test('redireciona para /login quando não autenticado', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Entrar na sua conta')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('login bem-sucedido redireciona para busca', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL('/')
    await expect(page.getByPlaceholder('Buscar artista…').first()).toBeVisible()
  })

  test('login com credenciais erradas exibe erro', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(ADMIN_EMAIL)
    await page.locator('#password').fill('senha-errada')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText(/inválid|Email ou senha/i)).toBeVisible()
  })

  test('logout redireciona para login', async ({ page }) => {
    await login(page)
    await logout(page)
    await expect(page).toHaveURL('/login')
  })

  test('usuário logado não é redirecionado ao acessar /', async ({ page }) => {
    await login(page)
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Art Catalog')).toBeVisible()
  })
})
