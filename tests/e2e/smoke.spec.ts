import { test, expect } from '@playwright/test';

test('home loads with brand', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MasrBounty/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('programs page renders', async ({ page }) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { level: 1, name: /programs|برامج/i })).toBeVisible();
});

test('login page has form', async ({ page }) => {
  await page.goto('/login');
  // `:visible` + first(): during streaming SSR the form can briefly exist twice
  // (hidden Suspense boundary + swapped-in content), which trips strict mode.
  await expect(page.locator('input[name="email"]:visible').first()).toBeVisible();
  await expect(page.locator('input[name="password"]:visible').first()).toBeVisible();
});
