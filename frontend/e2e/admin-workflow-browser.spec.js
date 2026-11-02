import { test, expect } from '@playwright/test';
import {
  expectLoggedIn,
  loadBackendEnvKeys,
  loginViaUi,
  runIsolatedSeed,
  uniqueE2EEmail,
} from './helpers.js';

loadBackendEnvKeys(['ADMIN_CODE']);

test.describe.serial('Admin Workflow Tests', () => {
  const admin = {
    name: 'E2E Admin',
    email: uniqueE2EEmail('admin'),
    password: 'AdminPass123!',
    college: 'E2E Admin College',
  };

  const student = {
    name: 'E2E NonAdmin',
    email: uniqueE2EEmail('student'),
    password: 'TestPass123!',
    college: 'E2E Test College',
  };

  test.afterAll(() => {
    runIsolatedSeed(['--action=cleanup']);
  });

  test('ADMIN-CODE: Reject invalid admin code', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#register-name').fill('Bad Admin');
    await page.locator('#register-email').fill(uniqueE2EEmail('badmin'));
    await page.locator('#register-password').fill('AdminPass123!');
    await page.locator('#register-confirm').fill('AdminPass123!');
    await page.locator('#register-college').fill('E2E Admin College');
    await page.locator('input[name="accountType"][value="admin"]').check();
    await page.locator('#register-admin-code').fill('definitely-wrong-admin-code');
    await page.getByRole('button', { name: /^sign up$/i }).click();
    await expect(page.getByText(/invalid admin code/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/register/);
  });

  test('ADMIN-01: Register and log in with a valid admin code', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await page.goto('/register');
    await page.locator('#register-name').fill(admin.name);
    await page.locator('#register-email').fill(admin.email);
    await page.locator('#register-password').fill(admin.password);
    await page.locator('#register-confirm').fill(admin.password);
    await page.locator('#register-college').fill(admin.college);
    await page.locator('input[name="accountType"][value="admin"]').check();
    await page.locator('#register-admin-code').fill(process.env.ADMIN_CODE);
    await page.getByRole('button', { name: /^sign up$/i }).click();
    await expect(page).toHaveURL(/\/(profile|admin)/, { timeout: 20000 });
    await expectLoggedIn(page);

    await page.getByRole('button', { name: /^logout$/i }).first().click();
    await loginViaUi(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);
    await expectLoggedIn(page);
  });

  test('ADMIN-02: Open Admin Dashboard', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /admin system overview/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('Total Users')).toBeVisible();
  });

  test('ADMIN-03: Navigate to Manage Events', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/manage');
    await expect(page.locator('input[name="title"]')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /create event/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sync/i })).toBeVisible();
  });

  test('ADMIN-05: Open Users', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /^users$/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(admin.email)).toBeVisible();
  });

  test('ADMIN-06: Open Reports & Analytics', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /reports & analytics/i })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('User Reports')).toBeVisible();
  });

  test('ADMIN-PDF: Export report PDF', async ({ page }) => {
    test.skip(!process.env.ADMIN_CODE, 'BLOCKED: ADMIN_CODE is not available in the test environment');
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/admin/reports');
    await expect(page.getByRole('heading', { name: /reports & analytics/i })).toBeVisible({
      timeout: 20000,
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.getByRole('button', { name: /export report/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('ADMIN-AUTHZ: Student cannot access admin routes', async ({ page, request }) => {
    await request.post('http://127.0.0.1:5000/auth/register', {
      data: {
        name: student.name,
        email: student.email,
        password: student.password,
        confirmPassword: student.password,
        college: student.college,
        accountType: 'student',
      },
    });
    await loginViaUi(page, student.email, student.password);
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page).toHaveURL(/\/(events|login)/);
  });
});
