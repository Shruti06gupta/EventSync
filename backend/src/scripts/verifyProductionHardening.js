/**
 * Production Hardening Verification Suite
 * Tests Rate Limiting, Helmet Headers, Winston Logging Redaction,
 * CORS, Security Configuration, Authentication & Authorization.
 */
const http = require('http');
const assert = require('assert');
const { app } = require('../app');
const { sanitize, logger } = require('../config/logger');

let server;
let baseUrl;

const startTestServer = () => {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
};

const stopTestServer = () => {
  return new Promise((resolve) => {
    if (server) {
      server.close(resolve);
    } else {
      resolve();
    }
  });
};

async function testHelmetSecurityHeaders() {
  console.log('\n--- 1. Testing Helmet Security Headers ---');
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200, 'Health endpoint should return 200');

  const headers = res.headers;
  
  // Verify CSP
  const csp = headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy header must be present');
  assert.ok(csp.includes("default-src 'self'"), 'CSP must specify default-src');
  console.log('  ✓ Content-Security-Policy present:', csp.slice(0, 60) + '...');

  // Verify CORP
  const corp = headers.get('cross-origin-resource-policy');
  assert.strictEqual(corp, 'cross-origin', 'Cross-Origin-Resource-Policy must be cross-origin for API');
  console.log('  ✓ Cross-Origin-Resource-Policy:', corp);

  // Verify nosniff
  const nosniff = headers.get('x-content-type-options');
  assert.strictEqual(nosniff, 'nosniff', 'X-Content-Type-Options must be nosniff');
  console.log('  ✓ X-Content-Type-Options:', nosniff);

  // Verify X-Frame-Options
  const frameOptions = headers.get('x-frame-options');
  assert.ok(frameOptions, 'X-Frame-Options header must be present');
  console.log('  ✓ X-Frame-Options:', frameOptions);

  console.log('  -> Helmet Security Headers: PASS');
}

async function testWinstonSanitizeRedaction() {
  console.log('\n--- 2. Testing Winston Sensitive Data Redaction ---');
  const testPayload = {
    name: 'Test Student',
    email: 'student@example.com',
    password: 'SuperSecretPassword123!',
    confirmPassword: 'SuperSecretPassword123!',
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
    apiKey: 'AQ.FakeGeminiApiKey12345',
    adminCode: 'SecretAdminCode999',
    email_pass: 'smtpSecretPassword',
    mongo_uri: 'mongodb+srv://admin:pass@cluster.mongodb.net',
    nested: {
      newPassword: 'AnotherSecretPassword',
      token: 'resetTokenHexValue',
      publicInfo: 'visible data',
    },
    list: [
      { jwt: 'bearerTokenValue', label: 'Item 1' }
    ]
  };

  const sanitized = sanitize(testPayload);

  // Verify non-sensitive fields preserved
  assert.strictEqual(sanitized.name, 'Test Student');
  assert.strictEqual(sanitized.email, 'student@example.com');
  assert.strictEqual(sanitized.nested.publicInfo, 'visible data');
  assert.strictEqual(sanitized.list[0].label, 'Item 1');

  // Verify sensitive fields redacted
  assert.strictEqual(sanitized.password, '[REDACTED]', 'password must be redacted');
  assert.strictEqual(sanitized.confirmPassword, '[REDACTED]', 'confirmPassword must be redacted');
  assert.strictEqual(sanitized.accessToken, '[REDACTED]', 'accessToken must be redacted');
  assert.strictEqual(sanitized.refreshToken, '[REDACTED]', 'refreshToken must be redacted');
  assert.strictEqual(sanitized.apiKey, '[REDACTED]', 'apiKey must be redacted');
  assert.strictEqual(sanitized.adminCode, '[REDACTED]', 'adminCode must be redacted');
  assert.strictEqual(sanitized.email_pass, '[REDACTED]', 'email_pass must be redacted');
  assert.strictEqual(sanitized.mongo_uri, '[REDACTED]', 'mongo_uri must be redacted');
  assert.strictEqual(sanitized.nested.newPassword, '[REDACTED]', 'nested newPassword must be redacted');
  assert.strictEqual(sanitized.nested.token, '[REDACTED]', 'nested token must be redacted');
  assert.strictEqual(sanitized.list[0].jwt, '[REDACTED]', 'array jwt must be redacted');

  console.log('  ✓ All sensitive fields successfully replaced with [REDACTED]');
  console.log('  -> Winston Redaction: PASS');
}

async function testRateLimiting() {
  console.log('\n--- 3. Testing Rate Limiting (express-rate-limit) ---');
  
  // Test password reset limiter (max 5 requests per hour)
  console.log('  Testing Password Reset Rate Limiting (threshold: 5 requests)...');
  let hitRateLimit = false;
  let status429Count = 0;
  let lastMessage = '';

  for (let i = 1; i <= 8; i++) {
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // empty body fails input validation instantly (400) without touching DB
    });

    if (res.status === 429) {
      hitRateLimit = true;
      status429Count++;
      const data = await res.json();
      lastMessage = data.message;
    }
  }

  assert.ok(hitRateLimit, 'Rate limiter must return HTTP 429 when threshold is exceeded');
  assert.ok(status429Count >= 1, 'Should receive at least one 429 response');
  assert.ok(lastMessage.includes('Too many password reset attempts'), 'Should return clear error message');
  console.log(`  ✓ Successfully triggered 429 Too Many Requests (caught ${status429Count} 429 responses)`);
  console.log(`  ✓ 429 Response message: "${lastMessage}"`);
  console.log('  -> Rate Limiting: PASS');
}

async function testAuthenticationAndProtectedEndpoints() {
  console.log('\n--- 4. Testing Authentication & Protected API Endpoints ---');

  // Test registration validation
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'incomplete@example.com' }), // missing fields
  });
  assert.strictEqual(regRes.status, 400, 'Registration with missing fields must return 400');
  const regData = await regRes.json();
  assert.ok(regData.message.includes('required'), 'Must indicate required fields');
  console.log('  ✓ Missing registration fields rejected with 400 Bad Request');

  // Test unauthenticated access to protected routes
  const protectedEndpoints = [
    { path: '/notifications', method: 'GET', expectedStatus: 401 },
    { path: '/events', method: 'GET', expectedStatus: 401 },
    { path: '/user/profile', method: 'GET', expectedStatus: 401 },
    { path: '/admin/dashboard/stats', method: 'GET', expectedStatus: 401 },
    { path: '/aggregation/sync', method: 'POST', expectedStatus: 401 },
    { path: '/chatbot', method: 'POST', expectedStatus: 401 },
  ];

  for (const ep of protectedEndpoints) {
    const res = await fetch(`${baseUrl}${ep.path}`, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
    });
    assert.strictEqual(
      res.status,
      ep.expectedStatus,
      `Unauthenticated ${ep.method} ${ep.path} must return ${ep.expectedStatus}`
    );
    console.log(`  ✓ ${ep.method} ${ep.path} rejected unauthenticated request with ${res.status}`);
  }

  console.log('  -> Authentication & Protected Endpoints: PASS');
}

async function testCorsOrigins() {
  console.log('\n--- 5. Testing CORS Allowed Origins ---');

  // Test allowed origin (localhost:5173)
  const allowedRes = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.strictEqual(
    allowedRes.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
    'Origin http://localhost:5173 must be allowed'
  );
  assert.strictEqual(
    allowedRes.headers.get('access-control-allow-credentials'),
    'true',
    'Credentials must be allowed for authentication cookies'
  );
  console.log('  ✓ Allowed origin http://localhost:5173 accepted with credentials: true');

  console.log('  -> CORS Configuration: PASS');
}

async function runAllTests() {
  console.log('==================================================');
  console.log('  EVENT-SYNC PRODUCTION HARDENING TEST SUITE');
  console.log('==================================================');

  try {
    await startTestServer();
    console.log(`Test server running at ${baseUrl}`);

    await testHelmetSecurityHeaders();
    await testWinstonSanitizeRedaction();
    await testRateLimiting();
    await testAuthenticationAndProtectedEndpoints();
    await testCorsOrigins();

    console.log('\n==================================================');
    console.log('  ALL PRODUCTION HARDENING TESTS PASSED (5/5)');
    console.log('==================================================\n');
  } catch (error) {
    console.error('\n❌ Test Failure:', error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await stopTestServer();
  }
}

runAllTests();
