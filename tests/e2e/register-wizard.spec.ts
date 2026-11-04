import { expect, test } from '@playwright/test';

/**
 * Registration wizard (UI-level only — no real accounts are created).
 * Verifies the two-step flow, progress indicator, role-card switching and
 * per-step validation blocking.
 */
test.describe('register wizard', () => {
  test('renders step 1 with role cards and progress indicator', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /حساب جديد/ })).toBeVisible();
    await expect(page.getByText('الخطوة 1 من 2')).toBeVisible();
    const radios = page.getByRole('radiogroup', { name: 'نوع الحساب' });
    await expect(radios.getByRole('radio', { name: /باحث أمني/ })).toBeVisible();
    await expect(radios.getByRole('radio', { name: /شركة/ })).toBeVisible();
  });

  test('step 1 blocks advancing with empty required fields', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /متابعة للتخصيص/ }).click();
    // invalid values -> error summary, still on step 1
    await expect(page.getByText(/بيانات غير صالحة/)).toBeVisible();
    await expect(page.getByText('الخطوة 1 من 2')).toBeVisible();
  });

  test('valid step-1 data advances to the researcher personalization step', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('اسم المستخدم').fill('e2e_wizard');
    await page.getByLabel('الاسم الكامل').fill('اختبار وايزارد');
    await page.getByLabel('البريد الإلكتروني').fill('e2e-wizard@example.com');
    await page.getByLabel('رقم الهاتف').fill('01012345678');
    await page.getByLabel('كلمة السر (8+ أحرف)').fill('S3curePass!');
    await page.getByLabel('تأكيد كلمة السر').fill('S3curePass!');
    await page.getByRole('button', { name: /متابعة للتخصيص/ }).click();
    await expect(page.getByText('الخطوة 2 من 2')).toBeVisible();
    // researcher personalization questions are visible
    await expect(page.getByText('مستوى خبرتك')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'مستوى الخبرة' })).toBeVisible();
    // skill suggestions exist
    await expect(page.getByRole('button', { name: '+ XSS' })).toBeVisible();
  });

  test('company role switches step 2 to company questions', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('radio', { name: /شركة/ }).click();
    await page.getByLabel('اسم المستخدم').fill('e2e_company');
    await page.getByLabel('الاسم الكامل').fill('فريق الشركات');
    await page.getByLabel('البريد الإلكتروني').fill('e2e-company@example.com');
    await page.getByLabel('رقم الهاتف').fill('01098765432');
    await page.getByLabel('كلمة السر (8+ أحرف)').fill('S3curePass!');
    await page.getByLabel('تأكيد كلمة السر').fill('S3curePass!');
    await page.getByRole('button', { name: /متابعة للتخصيص/ }).click();
    await expect(page.getByText('الخطوة 2 من 2')).toBeVisible();
    await expect(page.getByLabel('اسم الشركة')).toBeVisible();
    await expect(page.getByLabel('حجم الشركة')).toBeVisible();
  });
});
