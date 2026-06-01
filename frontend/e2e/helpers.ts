import { type Page, expect } from '@playwright/test'

export const ADMIN_EMAIL = 'sergio@meioorc.com'
export const ADMIN_PASSWORD = 'admin123'
export const BASE_URL = 'http://localhost:5173'

export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Art Catalog')).toBeVisible()
}

export async function logout(page: Page) {
  await page.getByLabel('Sair').click()
  await expect(page).toHaveURL('/login')
}
