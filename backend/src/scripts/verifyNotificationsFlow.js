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

const splitSetCookieHeader = (value) => {
  if (!value) return [];

  return value.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim()).filter(Boolean);
};

const getSetCookieHeaders = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  if (typeof headers.raw === 'function') {
    const rawHeaders = headers.raw();
    if (Array.isArray(rawHeaders['set-cookie'])) {
      return rawHeaders['set-cookie'];
    }
  }

  return splitSetCookieHeader(headers.get('set-cookie'));
};

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
      const setCookies = getSetCookieHeaders(response.headers);

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

  return body.event;
};

const addBookmarkThroughApi = async (jar, eventId) => {
  const { response, body } = await requestJson(jar, `/user/bookmarks/${eventId}`, {
    method: 'POST',
  });

  if (response.status !== 201) {
    throw new Error(`Bookmark creation failed: ${body.message || response.status}`);
  }
};

const verifyErrorCases = async ({ studentJar, adminJar, studentNotificationId }) => {
  const unauthenticatedJar = createCookieJar();
  const { response: unauthResponse } = await requestJson(unauthenticatedJar, '/notifications');

  if (unauthResponse.status !== 401) {
    throw new Error(`Expected unauthenticated notifications request to return 401, received ${unauthResponse.status}`);
  }

  const { response: invalidIdResponse } = await requestJson(
    studentJar,
    '/notifications/not-a-valid-id/read',
    { method: 'PATCH' }
  );

  if (invalidIdResponse.status !== 400) {
    throw new Error(`Expected invalid notification id to return 400, received ${invalidIdResponse.status}`);
  }

  const { response: otherUserResponse } = await requestJson(
    adminJar,
    `/notifications/${studentNotificationId}/read`,
    { method: 'PATCH' }
  );

  if (otherUserResponse.status !== 404) {
    throw new Error(`Expected another user's notification to return 404, received ${otherUserResponse.status}`);
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
    const createdEvent = await createEventThroughApi(adminJar);

    const afterCreate = await verifyAuthenticatedNotifications(studentJar, 1);
    const createdNotification = afterCreate.notifications.find(
      (notification) => notification.message === `New event available: ${TEMP_EVENT_TITLE}`
    );

    if (!createdNotification) {
      throw new Error('Expected the newly created event notification to be present.');
    }

    if (createdNotification.type !== 'event_created') {
      throw new Error(`Expected event notification type "event_created", received "${createdNotification.type}"`);
    }

    await verifyErrorCases({
      studentJar,
      adminJar,
      studentNotificationId: createdNotification._id,
    });

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

    await addBookmarkThroughApi(studentJar, createdEvent._id);

    const afterBookmark = await verifyAuthenticatedNotifications(studentJar, 1);
    const bookmarkNotification = afterBookmark.notifications.find(
      (notification) =>
        notification.type === 'bookmark_added' &&
        notification.message === `You bookmarked: ${TEMP_EVENT_TITLE}`
    );

    if (!bookmarkNotification) {
      throw new Error('Expected the bookmark notification to be present.');
    }

    const { response: markBookmarkReadResponse, body: markBookmarkReadBody } = await requestJson(
      studentJar,
      `/notifications/${bookmarkNotification._id}/read`,
      { method: 'PATCH' }
    );

    if (markBookmarkReadResponse.status !== 200) {
      throw new Error(`Bookmark mark-as-read failed: ${markBookmarkReadBody.message || markBookmarkReadResponse.status}`);
    }

    await verifyAuthenticatedNotifications(studentJar, 0);

    console.log('Notification flow verification passed.');
  } finally {
    await mongoose.connection.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
