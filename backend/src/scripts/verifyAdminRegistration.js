require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const axios = require('axios');
const User = require('../models/User');
const connectDB = require('../config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
const ADMIN_CODE = process.env.ADMIN_CODE;

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true,
});

const ts = Date.now();
const studentEmail = `test-student-${ts}@example.com`;
const adminEmail = `test-admin-${ts}@example.com`;
const bypassEmail = `test-bypass-${ts}@example.com`;
const wrongCodeEmail = `test-wrongcode-${ts}@example.com`;
const password = 'testpass123';

const basePayload = (email, overrides = {}) => ({
  name: 'Test User',
  email,
  password,
  confirmPassword: password,
  college: 'Test College',
  interests: [],
  ...overrides,
});

const cleanup = async (emails) => {
  await User.deleteMany({ email: { $in: emails } });
};

const run = async () => {
  const emailsToCleanup = [studentEmail, adminEmail, bypassEmail, wrongCodeEmail];
  let passed = 0;
  let failed = 0;

  const assert = (name, condition, detail = '') => {
    if (condition) {
      console.log(`PASS: ${name}`);
      passed += 1;
    } else {
      console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
      failed += 1;
    }
  };

  if (!ADMIN_CODE) {
    console.error('ADMIN_CODE is not set in backend/.env');
    process.exit(1);
  }

  const isDbReady = await connectDB();
  if (!isDbReady) {
    console.error('Could not connect to MongoDB');
    process.exit(1);
  }

  await cleanup(emailsToCleanup);

  try {
    // TEST 1: Register as Student
    const studentRes = await api.post('/auth/register', basePayload(studentEmail, { accountType: 'student' }));
    const studentUser = await User.findOne({ email: studentEmail });
    assert('TEST 1: student registration succeeds', studentRes.status === 201);
    assert('TEST 1: student role is student', studentUser?.role === 'student');

    // TEST 2: Register as Admin with correct Admin Code
    const adminRes = await api.post('/auth/register', basePayload(adminEmail, {
      accountType: 'admin',
      adminCode: ADMIN_CODE,
    }));
    const adminUser = await User.findOne({ email: adminEmail });
    assert('TEST 2: admin registration succeeds', adminRes.status === 201);
    assert('TEST 2: admin role is admin', adminUser?.role === 'admin');

    // TEST 3: Register as Admin with incorrect Admin Code
    const wrongCodeRes = await api.post('/auth/register', basePayload(wrongCodeEmail, {
      accountType: 'admin',
      adminCode: 'wrong-code-value',
    }));
    const wrongCodeUser = await User.findOne({ email: wrongCodeEmail });
    assert('TEST 3: wrong admin code rejected', wrongCodeRes.status === 403);
    assert('TEST 3: no account created', !wrongCodeUser);

    // TEST 4: role="admin" bypass without admin code
    const bypassRes = await api.post('/auth/register', basePayload(bypassEmail, { role: 'admin' }));
    const bypassUser = await User.findOne({ email: bypassEmail });
    assert('TEST 4: role bypass registration succeeds as student', bypassRes.status === 201);
    assert('TEST 4: role bypass does not create admin', bypassUser?.role === 'student');

    // TEST 5: Login as Student (email + password only)
    const studentLogin = await api.post('/auth/login', { email: studentEmail, password });
    assert('TEST 5: student login succeeds', studentLogin.status === 200);
    assert('TEST 5: student login returns student role', studentLogin.data.user?.role === 'student');

    // TEST 6: Login as Admin (email + password only)
    const adminLogin = await api.post('/auth/login', { email: adminEmail, password });
    assert('TEST 6: admin login succeeds', adminLogin.status === 200);
    assert('TEST 6: admin login returns admin role', adminLogin.data.user?.role === 'admin');

    // TEST 7: Admin accesses admin-only API
    const adminCookie = adminLogin.headers['set-cookie'];
    const adminApi = axios.create({
      baseURL: BASE_URL,
      headers: { Cookie: adminCookie?.join('; ') || '' },
      validateStatus: () => true,
    });
    const adminOnlyRes = await adminApi.get('/user/admin-only');
    assert('TEST 7: admin can access admin-only API', adminOnlyRes.status === 200);

    // TEST 8: Student accesses admin-only API
    const studentCookie = studentLogin.headers['set-cookie'];
    const studentApi = axios.create({
      baseURL: BASE_URL,
      headers: { Cookie: studentCookie?.join('; ') || '' },
      validateStatus: () => true,
    });
    const studentAdminRes = await studentApi.get('/user/admin-only');
    assert('TEST 8: student forbidden from admin-only API', studentAdminRes.status === 403);
  } finally {
    await cleanup(emailsToCleanup);
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
};

run().catch((error) => {
  console.error('Verification script failed:', error.message);
  process.exit(1);
});
