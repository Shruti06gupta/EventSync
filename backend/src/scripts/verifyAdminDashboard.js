require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const axios = require('axios');
const User = require('../models/User');
const connectDB = require('../config/db');

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;
const ts = Date.now();
const adminEmail = `admin-dashboard-test-${ts}@example.com`;
const studentEmail = `student-dashboard-test-${ts}@example.com`;
const password = 'Passw0rd!';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  validateStatus: () => true,
});

const splitSetCookieHeader = (value) => {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim()).filter(Boolean);
};

const getSetCookieHeaders = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  return splitSetCookieHeader(headers.get('set-cookie'));
};

const login = async (email) => {
  const res = await api.post('/auth/login', { email, password });
  const cookies = getSetCookieHeaders(res.headers);
  return axios.create({
    baseURL: BASE_URL,
    headers: { Cookie: cookies.join('; ') },
    validateStatus: () => true,
  });
};

const cleanup = async () => {
  await User.deleteMany({ email: { $in: [adminEmail, studentEmail] } });
};

const run = async () => {
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

  const isDbReady = await connectDB();
  if (!isDbReady) {
    console.error('Could not connect to MongoDB');
    process.exit(1);
  }

  await cleanup();

  try {
    await User.create([
      {
        name: 'Dashboard Admin',
        email: adminEmail,
        password,
        college: 'EventSync QA',
        role: 'admin',
      },
      {
        name: 'Dashboard Student',
        email: studentEmail,
        password,
        college: 'EventSync QA',
        role: 'student',
      },
    ]);

    const adminClient = await login(adminEmail);
    const studentClient = await login(studentEmail);

    const adminRes = await adminClient.get('/admin/dashboard/stats');
    assert('Admin can access dashboard stats', adminRes.status === 200);
    assert('Dashboard returns KPIs', Boolean(adminRes.data?.kpis?.totalUsers >= 0));
    assert('Dashboard returns events by platform', Array.isArray(adminRes.data?.eventsByPlatform));
    assert('Dashboard marks registrations unavailable', adminRes.data?.kpis?.registrationsAvailable === false);
    assert('Dashboard returns system health', Boolean(adminRes.data?.systemHealth?.database));

    const studentRes = await studentClient.get('/admin/dashboard/stats');
    assert('Student cannot access dashboard stats', studentRes.status === 403);

    const unauthRes = await api.get('/admin/dashboard/stats');
    assert('Unauthenticated request is rejected', unauthRes.status === 401);
  } finally {
    await cleanup();
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
};

run().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exit(1);
});
