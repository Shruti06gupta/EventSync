require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Notification = require('../models/Notification');

const BASE_URL = 'http://localhost:5173';
const TEMP_ADMIN_EMAIL = 'notifications-admin@eventsync.local';
const TEMP_STUDENT_EMAIL = 'notifications-student@eventsync.local';
const TEMP_PASSWORD = 'Passw0rd!';
const TEMP_EVENT_TITLE = 'Notification Flow Smoke Test Event';

const createCookieJar = () => {
  const store = new Map();

  return {
    apply(headers = {}) {
      if (store.size > 0) {
        headers.Cookie = [...store.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
      }

      return headers;
    },
    capture(response) {
      const setCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [];

      for (const cookie of setCookies) {
        const [nameValue] = cookie.split(';');
        const separatorIndex = nameValue.indexOf('=');
        if (separatorIndex === -1) continue;

        const name = nameValue.slice(0, separatorIndex);
        const value = nameValue.slice(separatorIndex + 1);
        store.set(name, value);
      }
    },
  };
};

const requestJson = async (cookieJar, path, options = {}) => {
  const headers = cookieJar.apply({
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  });

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  cookieJar.capture(response);

  const text = await response.text();
  let body = {};

  if (text) {
    body = JSON.parse(text);
  }

  return { response, body };
};

const ensureTempUsers = async () => {
  await User.deleteMany({ email: { $in: [TEMP_ADMIN_EMAIL, TEMP_STUDENT_EMAIL] } });

  const [admin, student] = await User.create([
    {
      name: 'Notification Admin',
      email: TEMP_ADMIN_EMAIL,
      password: TEMP_PASSWORD,
      college: 'EventSync QA',
      interests: ['qa'],
      role: 'admin',
    },
    {
      name: 'Notification Student',
      email: TEMP_STUDENT_EMAIL,
      password: TEMP_PASSWORD,
      college: 'EventSync QA',
      interests: ['qa'],
      role: 'student',
    },
  ]);

  return { admin, student };
};

const cleanupArtifacts = async () => {
  const users = await User.find({ email: { $in: [TEMP_ADMIN_EMAIL, TEMP_STUDENT_EMAIL] } }).select('_id').lean();
  const userIds = users.map((user) => user._id);

  await Notification.deleteMany({
    $or: [
      { user: { $in: userIds } },
      { message: `New event available: ${TEMP_EVENT_TITLE}` },
    ],
  });

  await Event.deleteMany({ title: TEMP_EVENT_TITLE });
  await User.deleteMany({ _id: { $in: userIds } });
};

const login = async (email, password) => {
  const jar = createCookieJar();
  const { response, body } = await requestJson(jar, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${body.message || response.status}`);
  }

  return jar;
};

const verifyAuthenticatedNotifications = async (jar, expectedUnreadCount) => {
  const { response, body } = await requestJson(jar, '/notifications');

  if (response.status !== 200) {
    throw new Error(`Notifications fetch failed: ${body.message || response.status}`);
  }

  if (body.unreadCount !== expectedUnreadCount) {
    throw new Error(`Expected unreadCount ${expectedUnreadCount}, received ${body.unreadCount}`);
  }

  return body;
};

const createEventThroughApi = async (jar) => {
  const now = new Date();
  const startDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
  const registrationDeadline = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);

  const payload = {
    title: TEMP_EVENT_TITLE,
    description: 'Automated verification event for the notification flow.',
    organizer: 'EventSync QA',
    college: 'EventSync QA',
    category: 'Technology',
    tags: ['qa', 'notifications'],
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    registrationDeadline: registrationDeadline.toISOString(),
    mode: 'Online',
    venue: '',
    image: '',
    eventLink: 'https://example.com/register',
  };

  const { response, body } = await requestJson(jar, '/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (response.status !== 201) {
    throw new Error(`Event creation failed: ${body.message || response.status}`);
  }
};

const main = async () => {
  const mode = process.argv[2] || 'run';

  await mongoose.connect(process.env.MONGO_URI);

  try {
    if (mode === 'cleanup') {
      await cleanupArtifacts();
      console.log('Cleanup completed.');
      return;
    }

    if (mode === 'post-restart') {
      const studentJar = await login(TEMP_STUDENT_EMAIL, TEMP_PASSWORD);
      const body = await verifyAuthenticatedNotifications(studentJar, 0);
      const target = body.notifications.find((notification) => notification.message === `New event available: ${TEMP_EVENT_TITLE}`);

      if (!target) {
        throw new Error('Expected notification was not found after restart.');
      }

      if (!target.read) {
        throw new Error('Expected notification to remain marked as read after restart.');
      }

      console.log('Post-restart notification verification passed.');
      return;
    }

    await cleanupArtifacts();
    await ensureTempUsers();

    const studentJar = await login(TEMP_STUDENT_EMAIL, TEMP_PASSWORD);
    const before = await verifyAuthenticatedNotifications(studentJar, 0);

    if ((before.notifications || []).length !== 0) {
      throw new Error('Expected the temp student to start with zero notifications.');
    }

    const adminJar = await login(TEMP_ADMIN_EMAIL, TEMP_PASSWORD);
    await createEventThroughApi(adminJar);

    const afterCreate = await verifyAuthenticatedNotifications(studentJar, 1);
    const createdNotification = afterCreate.notifications.find(
      (notification) => notification.message === `New event available: ${TEMP_EVENT_TITLE}`
    );

    if (!createdNotification) {
      throw new Error('Expected the newly created event notification to be present.');
    }

    const { response: markReadResponse, body: markReadBody } = await requestJson(
      studentJar,
      `/notifications/${createdNotification._id}/read`,
      { method: 'PATCH' }
    );

    if (markReadResponse.status !== 200) {
      throw new Error(`Mark-as-read failed: ${markReadBody.message || markReadResponse.status}`);
    }

    const afterRead = await verifyAuthenticatedNotifications(studentJar, 0);
    const updatedNotification = afterRead.notifications.find(
      (notification) => notification._id === createdNotification._id
    );

    if (!updatedNotification || !updatedNotification.read) {
      throw new Error('Expected the notification to stay marked as read.');
    }

    console.log('Notification flow verification passed.');
  } finally {
    await mongoose.connection.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
