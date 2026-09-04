import { test, expect } from '@playwright/test';

test('search page has search box', async ({ page }) => {
  await page.goto('/search');
  await expect(page.locator('input[name="q"]')).toBeVisible();
});

test('leaderboard renders', async ({ page }) => {
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: /leaderboard|المتصدرين/i })).toBeVisible();
});

test('unauthenticated dashboard prompts login', async ({ page }) => {
  await page.goto('/dashboard/reports');
  await expect(page.getByText(/login/i).first()).toBeVisible();
});
