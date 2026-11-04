import { test, expect } from '@playwright/test';

/**
 * Password-recovery routing checks (guest flows — no real email needed):
 *  - guests without a recovery session are bounced from the change-password
 *    page to /login with a clear message;
 *  - a bare /auth/callback visit lands on /login with an explicit message;
 *  - GoTrue hash-fragment errors (#error=...otp_expired) are converted by the
 *    client handler into a visible ?error= message and a clean URL;
 *  - the forgot-password page renders its form.
 *
 * Real email delivery / Supabase production behaviour is NOT covered here —
 * those require the live project and are verified manually (see PR notes).
 */

test('update-password requires a session: guests bounce to login with a message', async ({ page }) => {
  await page.goto('/auth/update-password');
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByText(/انتهت جلسة الاستعادة/).first()).toBeVisible();
});

test('bare auth callback is rejected with a clear message', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page).toHaveURL(/\/login\?error=/);
  await expect(page.getByText(/رابط غير صالح أو منتهي/).first()).toBeVisible();
});

test('hash-fragment errors (expired link) become a visible message and a clean URL', async ({ page }) => {
  await page.goto(
    '/login#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
  );
  await expect(page).toHaveURL(/\/login\?error=/, { timeout: 10_000 });
  await expect(page.getByText(/انتهت صلاحية رابط الاستعادة أو استُخدم مسبقًا/).first()).toBeVisible();
  // The stale fragment must be gone from the address bar.
  expect(page.url()).not.toContain('#error=');
});

test('forgot-password renders the request form', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: /استعادة كلمة السر/ })).toBeVisible();
  await expect(page.locator('#email')).toBeVisible();
});
