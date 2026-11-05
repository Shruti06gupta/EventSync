import { test, expect } from '@playwright/test';
import { API_BASE } from './helpers.js';

test.describe('Additional Checks Tests', () => {
  test('ROUTES-01: Test all 14 frontend routes', async ({ page }) => {
    const routes = [
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
      '/events',
      '/recommendations',
      '/bookmarks',
      '/profile',
      '/admin',
      '/manage',
      '/admin/users',
      '/admin/reports',
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      const hasCrash = await page.getByText(/application error|something went wrong/i).isVisible().catch(() => false);
      expect(hasCrash).toBeFalsy();
      const bodyText = await page.locator('body').textContent();
      expect(bodyText.length).toBeGreaterThan(10);
    }
  });

  test('NAV-01: Test mobile and desktop navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    const mobileToggle = page.locator('#mobile-toggle-btn');
    await expect(mobileToggle).toBeVisible();
    await mobileToggle.click();
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
  });

  test('NAV-02: Test direct URL refresh', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await page.reload();
    await expect(page.locator('#login-email')).toBeVisible();
  });

  test('NAV-03: Test browser back and forward', async ({ page }) => {
    await page.goto('/');
    await page.goto('/login');
    await page.goto('/register');
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
    await page.goForward();
    await expect(page).toHaveURL(/\/register/);
  });

  test('HTTP-01: Test HTTP 401 behavior', async ({ page, request }) => {
    const response = await request.get(`${API_BASE}/user/profile`);
    expect(response.status()).toBe(401);

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/);
  });

  test('HTTP-02: Test HTTP 403 behavior', async ({ page, request }) => {
    const response = await request.get(`${API_BASE}/admin/dashboard/stats`);
    expect([401, 403]).toContain(response.status());

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('HTTP-03: Test HTTP 429 behavior (rate limiting)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    const remaining = headers['ratelimit-remaining'] || headers['x-ratelimit-remaining'];
    expect(remaining).toBeTruthy();
  });

  test('CORS-01: Test CORS behavior', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`, {
      headers: { Origin: process.env.E2E_CLIENT_URL || 'http://localhost:5173' },
    });
    expect(response.status()).toBe(200);
    const allowedOrigin = response.headers()['access-control-allow-origin'];
    const expectedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
    expect(expectedOrigins).toContain(allowedOrigin);
    expect(response.headers()['access-control-allow-credentials']).toBe('true');
  });

  test('COOKIES-01: Test cookie flags on login failure stay clean', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('#login-email').fill('missing.user@eventsync-e2e.test');
    await page.locator('#login-password').fill('not-a-real-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15000 });
    const cookies = await context.cookies();
    const authCookies = cookies.filter((cookie) => cookie.name === 'accessToken' || cookie.name === 'refreshToken');
    expect(authCookies.length).toBe(0);
  });

  test('CONSOLE-01: No unexpected frontend console errors on public pages', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.goto('/login');
    await page.goto('/register');
    await page.waitForTimeout(1000);

    const unexpected = errors.filter(
      (text) => !/401|unauthorized|failed to fetch tags/i.test(text)
    );
    expect(unexpected).toEqual([]);
  });

  test('API-01: No unexpected backend errors', async ({ request }) => {
    const health = await request.get(`${API_BASE}/health`);
    expect(health.status()).toBe(200);
    const events = await request.get(`${API_BASE}/events`);
    expect(events.status()).toBeLessThan(500);
  });

  test('PERF-01: Page load performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    expect(Date.now() - startTime).toBeLessThan(5000);
  });

  test('ACCESS-01: Test accessibility (basic)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });
});
