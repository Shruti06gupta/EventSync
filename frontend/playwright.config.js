import { defineConfig, devices } from '@playwright/test';
import { loadBackendEnvKeys, isolatedBackendEnv } from './e2e/helpers.js';

loadBackendEnvKeys(['ADMIN_CODE', 'MONGO_URI']);

// Build the isolated backend environment once, at config evaluation time
const e2eBackendEnv = isolatedBackendEnv();

// Expose E2E_API_BASE and E2E_CLIENT_URL for helpers.js and test specs
process.env.E2E_API_BASE = 'http://127.0.0.1:5001';
process.env.E2E_CLIENT_URL = 'http://localhost:5174';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Isolated test backend — connects to eventsync_e2e only
      command: 'node src/server.js',
      cwd: '../backend',
      url: 'http://127.0.0.1:5001/health',
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        ...e2eBackendEnv,
        NODE_ENV: 'test',
        PORT: '5001',
      },
    },
    {
      // E2E frontend — proxies to port 5001 via vite.config.e2e.js
      command: 'npx vite --config vite.config.e2e.js',
      url: 'http://localhost:5174',
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        E2E_BACKEND_PORT: '5001',
      },
    },
  ],
});
