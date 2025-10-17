import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: null })
    });
  });
});

test('landing page renders and shows connection status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenido a CoMutiNy' })).toBeVisible();
  await expect(page.getByText('Estado de red', { exact: false })).toBeVisible();
});
