import { test, expect } from '@playwright/test';
import {
  E2E_EVENT_TITLE,
  expectLoggedIn,
  fillStudentRegistration,
  loginViaUi,
  runIsolatedSeed,
  tinyPng,
  uniqueE2EEmail,
} from './helpers.js';

test.describe.serial('Student Workflow Tests', () => {
  const student = {
    name: 'E2E Student',
    email: uniqueE2EEmail('student'),
    password: 'TestPass123!',
    college: 'E2E Test College',
  };

  let eventId = '';

  test.beforeAll(() => {
    const seeded = runIsolatedSeed(['--action=ensure-event']);
    eventId = seeded.eventId;
  });

  test('STUDENT-01: Open home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EventSync/i);
    await expect(page.locator('body')).toContainText(/EventSync/i);
  });

  test('STUDENT-02: Register a test student', async ({ page }) => {
    await fillStudentRegistration(page, student);
    await expect(page).toHaveURL(/\/profile/, { timeout: 20000 });
    await expectLoggedIn(page);
    await expect(page.locator('#profile-name')).toHaveValue(student.name);
    await expect(page.getByText(student.email)).toBeVisible();
    runIsolatedSeed(['--action=notify', `--email=${student.email}`]);
  });

  test('STUDENT-03: Log in', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await expectLoggedIn(page);
    await expect(page).toHaveURL(/\/profile/);
  });

  test('STUDENT-AUTH: Session persists after refresh and protected routes work', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/events');
    await expect(page).toHaveURL(/\/events/);
    await page.reload();
    await expectLoggedIn(page);
    await expect(page).toHaveURL(/\/events/);
  });

  test('STUDENT-04: Navigate to Events', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/events');
    await expect(page.getByRole('heading', { name: /hackathons, workshops/i })).toBeVisible({ timeout: 15000 });
    await page.getByPlaceholder('Search events, hackathons, workshops...').fill('[E2E] Isolated');
    await expect(page.getByText(E2E_EVENT_TITLE)).toBeVisible({ timeout: 15000 });
  });

  test('STUDENT-05: Open event details and direct URL', async ({ page }) => {
    test.skip(!eventId, 'BLOCKED: isolated event was not seeded');
    await loginViaUi(page, student.email, student.password);
    await page.goto('/events');
    await page.getByPlaceholder('Search events, hackathons, workshops...').fill('[E2E] Isolated');
    await page.getByRole('link', { name: E2E_EVENT_TITLE }).first().click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));
    await expect(page.getByRole('heading', { name: E2E_EVENT_TITLE })).toBeVisible();
    await expect(page.getByText(/Isolated EventSync E2E fixture/)).toBeVisible();

    await page.goto(`/events/${eventId}`);
    await expect(page.getByRole('heading', { name: E2E_EVENT_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: /register|visit|event link|apply/i }).first()).toBeVisible();
  });

  test('STUDENT-BOOKMARKS: Add, persist, and remove a bookmark', async ({ page }) => {
    test.skip(!eventId, 'BLOCKED: isolated event was not seeded');
    await loginViaUi(page, student.email, student.password);
    await page.goto(`/events/${eventId}`);
    const bookmarkButton = page.getByRole('button', { name: /save to bookmarks/i });
    await expect(bookmarkButton).toBeVisible();
    await bookmarkButton.click();
    await expect(page.getByRole('button', { name: /remove from bookmarks/i })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /remove from bookmarks/i })).toBeVisible();

    await page.goto('/bookmarks');
    await expect(page.getByText(E2E_EVENT_TITLE)).toBeVisible();

    await page.getByRole('button', { name: /remove from bookmarks/i }).first().click();
    await expect(page.getByText(E2E_EVENT_TITLE)).toHaveCount(0);
  });

  test('STUDENT-NOTIFICATIONS: Load, mark as read, clear all, persist', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/events');
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('[E2E] New AI Hackathon added')).toBeVisible();
    await expect(page.getByText('[E2E] Registration deadline tomorrow')).toBeVisible();

    await page.getByRole('button', { name: /\[E2E\] New AI Hackathon added/ }).click();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText('Mark as read').first()).toBeVisible();

    await page.getByRole('button', { name: 'Clear All' }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByText("You're all caught up")).toBeVisible();
  });

  test('STUDENT-12: Load and update profile', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    await page.locator('#profile-name').fill('E2E Student Updated');
    await page.locator('#profile-college').fill('E2E Updated College');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/profile updated successfully/i)).toBeVisible();
    await page.reload();
    await expect(page.locator('#profile-name')).toHaveValue('E2E Student Updated');
    await expect(page.locator('#profile-college')).toHaveValue('E2E Updated College');
  });

  test('STUDENT-PROFILE-PHOTO: Upload, crop, zoom, save, persist', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/profile');
    await page.locator('#avatar-file').setInputFiles({
      name: 'e2e-avatar.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    await expect(page.getByRole('heading', { name: 'Adjust Profile Picture' })).toBeVisible();
    const zoom = page.locator('input[type="range"]');
    await zoom.fill('1.5');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('heading', { name: 'Adjust Profile Picture' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText(/profile updated successfully/i)).toBeVisible();
    await page.reload();
    const avatar = page.locator('img[alt="E2E Student Updated"], img[alt="E2E Student"]').first();
    await expect(avatar).toBeVisible();
    const src = await avatar.getAttribute('src');
    expect(src).toMatch(/^data:image\//);
  });

  test('STUDENT-08: Open Recommendations', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await page.goto('/recommendations');
    await expect(page).toHaveURL(/\/recommendations/);
    await expect(page.locator('body')).toContainText(/recommend/i);
  });

  test.afterAll(() => {
    runIsolatedSeed(['--action=cleanup']);
  });

  test('STUDENT-15: Log out', async ({ page }) => {
    await loginViaUi(page, student.email, student.password);
    await expectLoggedIn(page);
    await page.getByRole('button', { name: /^logout$/i }).first().click();
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
    await page.goto('/events');
    await expect(page).toHaveURL(/\/login/);
  });
});
