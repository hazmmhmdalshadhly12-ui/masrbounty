import { test, expect } from '@playwright/test';

test('home loads with brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /MasrBounty/ })).toBeVisible();
});

test('programs page renders', async ({ page }) => {
  await page.goto('/programs');
  await expect(page.getByRole('heading', { name: /programs|البرامج/i })).toBeVisible();
});

test('login page has form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});
