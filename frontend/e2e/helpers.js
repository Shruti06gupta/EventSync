import { expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../../backend');
export const API_BASE =
  process.env.E2E_API_BASE || 'http://127.0.0.1:5000';
export const E2E_EVENT_TITLE = '[E2E] Isolated Campus Hackathon';
export const E2E_EMAIL_SUFFIX = '@eventsync-e2e.test';
export const ISOLATED_DB_NAME = 'eventsync_e2e';

export const isolatedBackendEnv = () => {
  loadBackendEnvKeys(['MONGO_URI']);
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DISABLE_SCHEDULER: 'true',
    EMAIL_DRY_RUN: 'true',
  };
  if (env.MONGO_URI) {
    env.MONGO_URI = env.MONGO_URI.replace(/(\/\/[^/]+\/)([^/?]+)/, `$1${ISOLATED_DB_NAME}`);
  }
  return env;
};

export const loadBackendEnvKeys = (keys) => {
  const envPath = path.join(backendRoot, '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!keys.includes(key) || process.env[key]) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

export const runIsolatedSeed = (args) => {
  const result = spawnSync(process.execPath, ['src/scripts/seedIsolatedE2E.js', ...args], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: isolatedBackendEnv(),
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Isolated seed script failed');
  }

  const output = (result.stdout || '')
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });
  return output ? JSON.parse(output) : {};
};

export const uniqueE2EEmail = (role) =>
  `${role}.${Date.now()}.${Math.floor(Math.random() * 10000)}${E2E_EMAIL_SUFFIX}`;

export const registerViaApi = async (request, userData) => {
  const response = await request.post(`${API_BASE}/auth/register`, { data: userData });
  const data = await response.json().catch(() => ({}));
  return { status: response.status(), data };
};

export const fillStudentRegistration = async (page, user) => {
  await page.goto('/register');
  await page.locator('#register-name').fill(user.name);
  await page.locator('#register-email').fill(user.email);
  await page.locator('#register-password').fill(user.password);
  await page.locator('#register-confirm').fill(user.password);
  await page.locator('#register-college').fill(user.college);
  await page.getByRole('button', { name: /^sign up$/i }).click();
};

export const loginViaUi = async (page, email, password) => {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15000 });
};

export const expectLoggedIn = async (page) => {
  await expect(page.getByRole('button', { name: /^logout$/i }).first()).toBeVisible({
    timeout: 15000,
  });
};

export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAhUlEQVR4nO3QMQEAIAwDsUH/nF4h3XKIgh5mZnafnwM4gAMABzCAf9cDWHsf4AAOwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAEcwAHsrQcw9z7AARyAAD4fXgMBl2m3VwAAAABJRU5ErkJggg==',
  'base64'
);
