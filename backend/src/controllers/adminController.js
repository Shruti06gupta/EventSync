const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const SyncLog = require('../models/SyncLog');
const Notification = require('../models/Notification');

const MS_DAY = 24 * 60 * 60 * 1000;

const startOfDayUTC = (date) => {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
};

const formatSourceLabel = (source) => {
  if (!source) return 'Other';
  if (source === 'devfolio') return 'Devfolio';
  if (source === 'unstop') return 'Unstop';
  if (source === 'manual') return 'Manual';
  return source.charAt(0).toUpperCase() + source.slice(1);
};

const buildDailyTrend = (records, days = 7) => {
  const today = startOfDayUTC(new Date());
  const buckets = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = new Date(today.getTime() - index * MS_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY);
    const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });

    const count = records.filter((record) => {
      const createdAt = new Date(record.createdAt);
      return createdAt >= dayStart && createdAt < dayEnd;
    }).length;

    buckets.push({ label, count });
  }

  return buckets;
};

const formatTimeRemaining = (deadline) => {
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return 'Closed';

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `Closes in ${hours}h`;

  const days = Math.floor(hours / 24);
  return `Closes in ${days}d`;
};

const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - MS_DAY);
    const last7d = new Date(now.getTime() - 7 * MS_DAY);
    const last30d = new Date(now.getTime() - 30 * MS_DAY);
    const todayStart = startOfDayUTC(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next24h = new Date(now.getTime() + MS_DAY);
    const next7d = new Date(now.getTime() + 7 * MS_DAY);

    const [
      totalUsers,
      newUsers24h,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      totalEvents,
      newEvents24h,
      newEventsMonth,
      eventsBySourceRaw,
      upcomingEvents,
      closingWithin24h,
      closingWithin7d,
      expiredEvents,
      totalBookmarksAgg,
      recentUsers,
      recentEvents,
      usersForTrend,
      eventsForTrend,
      closingEventsRaw,
      bookmarkCountsRaw,
      lastSync,
      notificationsForTrend,
      totalNotifications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: last24h } }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: last7d } }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      Event.countDocuments(),
      Event.countDocuments({ createdAt: { $gte: last24h } }),
      Event.countDocuments({ createdAt: { $gte: monthStart } }),
      Event.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Event.countDocuments({ registrationDeadline: { $gt: now } }),
      Event.countDocuments({
        registrationDeadline: { $gt: now, $lte: next24h },
      }),
      Event.countDocuments({
        registrationDeadline: { $gt: now, $lte: next7d },
      }),
      Event.countDocuments({ registrationDeadline: { $lt: now } }),
      User.aggregate([
        { $project: { bookmarkCount: { $size: { $ifNull: ['$bookmarks', []] } } } },
        { $group: { _id: null, total: { $sum: '$bookmarkCount' } } },
      ]),
      User.find({ createdAt: { $gte: last24h } })
        .select('name createdAt')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      Event.find({ createdAt: { $gte: last24h } })
        .select('title source createdAt registrationDeadline')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      User.find({ createdAt: { $gte: last7d } }).select('createdAt').lean(),
      Event.find({ createdAt: { $gte: last7d } }).select('createdAt').lean(),
      Event.find({
        registrationDeadline: { $gt: now, $lte: next7d },
        isVerified: true,
      })
        .select('title source registrationDeadline')
        .sort({ registrationDeadline: 1 })
        .limit(8)
        .lean(),
      User.aggregate([
        { $unwind: '$bookmarks' },
        { $group: { _id: '$bookmarks', count: { $sum: 1 } } },
      ]),
      SyncLog.findOne().sort({ createdAt: -1 }).lean(),
      Notification.find({ createdAt: { $gte: last7d } }).select('createdAt').lean(),
      Notification.countDocuments(),
    ]);

    const totalBookmarks = totalBookmarksAgg[0]?.total || 0;
    const bookmarkCountMap = new Map(
      bookmarkCountsRaw.map((entry) => [String(entry._id), entry.count])
    );

    const eventsByPlatform = eventsBySourceRaw.map((entry) => ({
      platform: formatSourceLabel(entry._id),
      source: entry._id || 'other',
      count: entry.count,
    }));

    const recentActivity = [
      ...recentUsers.map((user) => ({
        id: `user-${user._id}`,
        type: 'user_registered',
        title: user.name,
        subtitle: 'New user registered',
        timestamp: user.createdAt,
      })),
      ...recentEvents.map((event) => ({
        id: `event-${event._id}`,
        type: 'event_added',
        title: event.title,
        subtitle: `New event added${event.source ? ` (${formatSourceLabel(event.source)})` : ''}`,
        timestamp: event.createdAt,
      })),
    ]
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
      .slice(0, 30);

    const closingEvents = closingEventsRaw.map((event) => ({
      id: event._id,
      title: event.title,
      platform: formatSourceLabel(event.source),
      registrationDeadline: event.registrationDeadline,
      timeRemaining: formatTimeRemaining(event.registrationDeadline),
      bookmarkCount: bookmarkCountMap.get(String(event._id)) || 0,
    }));

    const adminAlerts = [];

    if (newUsers24h > 0) {
      adminAlerts.push({
        id: 'users-24h',
        level: 'info',
        message: `${newUsers24h} new user${newUsers24h === 1 ? '' : 's'} registered in the last 24 hours`,
      });
    }

    if (newEvents24h > 0) {
      adminAlerts.push({
        id: 'events-24h',
        level: 'info',
        message: `${newEvents24h} new event${newEvents24h === 1 ? '' : 's'} added in the last 24 hours`,
      });
    }

    if (closingWithin24h > 0) {
      adminAlerts.push({
        id: 'closing-24h',
        level: 'warning',
        message: `${closingWithin24h} event${closingWithin24h === 1 ? '' : 's'} closing within 24 hours`,
      });
    }

    if (lastSync?.status === 'failed') {
      adminAlerts.push({
        id: 'sync-failed',
        level: 'error',
        message: 'Latest event platform sync failed',
      });
    } else if (lastSync?.status === 'partial') {
      const sourceErrors = lastSync.sourceStats ? 
        Object.entries(lastSync.sourceStats)
          .filter(([_, stats]) => stats.errors && stats.errors.length > 0)
          .map(([source, _]) => source.charAt(0).toUpperCase() + source.slice(1))
          .join(', ') : 'Some sources';
      
      adminAlerts.push({
        id: 'sync-partial',
        level: 'warning',
        message: `Latest event platform sync completed with warnings (${sourceErrors})`,
      });
    }

    const emailConfigured = Boolean(
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS &&
      (process.env.EMAIL_SERVICE || process.env.EMAIL_HOST)
    );

    const systemHealth = {
      backend: { status: 'operational', label: 'Operational' },
      database: {
        status: mongoose.connection.readyState === 1 ? 'operational' : 'degraded',
        label: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
      },
      email: {
        status: emailConfigured ? 'operational' : 'unknown',
        label: emailConfigured ? 'Configured' : 'Not configured',
      },
      eventSync: {
        status: lastSync
          ? lastSync.status === 'failed'
            ? 'degraded'
            : 'operational'
          : 'unknown',
        label: lastSync
          ? `Last sync: ${lastSync.status}`
          : 'No sync history',
      },
    };

    return res.status(200).json({
      kpis: {
        totalUsers,
        newUsers24h,
        totalEvents,
        newEventsMonth,
        totalBookmarks,
        registrationsAvailable: false,
      },
      eventOverview: {
        totalEvents,
        upcomingEvents,
        closingWithin24h,
        closingWithin7d,
        expiredEvents,
      },
      eventsByPlatform,
      userGrowth: {
        totalUsers,
        newUsersToday,
        newUsersWeek,
        newUsersMonth,
        trend7d: buildDailyTrend(usersForTrend, 7),
      },
      engagement: {
        totalBookmarks,
        totalNotifications,
        registrationsTracked: false,
        registrationsNote:
          'Event registrations happen on external platforms and are not stored in EventSync. Bookmarks and notifications are shown as in-app engagement.',
      },
      eventCreationTrend: buildDailyTrend(eventsForTrend, 7),
      notificationActivity: buildDailyTrend(notificationsForTrend, 7),
      recentActivity,
      closingEvents,
      adminAlerts,
      systemHealth,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to load admin dashboard stats',
      error: error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    const role = req.query.role?.trim();

    const filter = {};

    if (role === 'student' || role === 'admin') {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { college: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, totalUsers, totalStudents, totalAdmins] = await Promise.all([
      User.find(filter)
        .select('name email college role profilePicture createdAt lastLoginAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
    ]);

    const activeUsers = users.filter(u => u.lastLoginAt && (Date.now() - new Date(u.lastLoginAt).getTime()) < 30 * 24 * 60 * 60 * 1000).length;
    const inactiveUsers = users.length - activeUsers;

    return res.status(200).json({
      message: 'Users fetched successfully',
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        hasNextPage: page * limit < totalUsers,
        hasPrevPage: page > 1,
      },
      summary: {
        totalUsers,
        totalStudents,
        totalAdmins,
        activeUsers,
        inactiveUsers,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch users',
      error: error.message,
    });
  }
};

const getReports = async (req, res) => {
  try {
    const range = req.query.range || '7d';
    const now = new Date();
    let startDate;

    if (range === '7d') {
      startDate = new Date(now.getTime() - 7 * MS_DAY);
    } else if (range === '30d') {
      startDate = new Date(now.getTime() - 30 * MS_DAY);
    } else if (range === 'month') {
      startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else {
      startDate = new Date(now.getTime() - 7 * MS_DAY);
    }

    const last24h = new Date(now.getTime() - MS_DAY);
    const todayStart = startOfDayUTC(now);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next24h = new Date(now.getTime() + MS_DAY);
    const next7d = new Date(now.getTime() + 7 * MS_DAY);
    const threeDaysAgo = new Date(now.getTime() - 3 * MS_DAY);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      studentsCount,
      adminsCount,
      usersForTrend,
      totalEvents,
      upcomingEvents,
      closingWithin24h,
      closingWithin7d,
      recentlyClosed,
      expiredEvents,
      eventsForTrend,
      eventsBySourceRaw,
      eventsByCategoryRaw,
      totalBookmarksAgg,
      bookmarkCountsRaw,
      totalNotifications,
      notificationsForTrend,
      syncLogs,
      lastSync,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      User.find({ createdAt: { $gte: startDate } }).select('createdAt').lean(),
      Event.countDocuments(),
      Event.countDocuments({ registrationDeadline: { $gt: now } }),
      Event.countDocuments({ registrationDeadline: { $gt: now, $lte: next24h } }),
      Event.countDocuments({ registrationDeadline: { $gt: now, $lte: next7d } }),
      Event.countDocuments({ registrationDeadline: { $lt: now, $gte: threeDaysAgo } }),
      Event.countDocuments({ registrationDeadline: { $lt: threeDaysAgo } }),
      Event.find({ createdAt: { $gte: startDate } }).select('createdAt').lean(),
      Event.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Event.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.aggregate([
        { $project: { bookmarkCount: { $size: { $ifNull: ['$bookmarks', []] } } } },
        { $group: { _id: null, total: { $sum: '$bookmarkCount' } } },
      ]),
      User.aggregate([
        { $unwind: '$bookmarks' },
        { $group: { _id: '$bookmarks', count: { $sum: 1 } } },
      ]),
      Notification.countDocuments({ createdAt: { $gte: startDate } }),
      Notification.find({ createdAt: { $gte: startDate } }).select('createdAt').lean(),
      SyncLog.find({ createdAt: { $gte: startDate } }).sort({ createdAt: -1 }).limit(10).lean(),
      SyncLog.findOne().sort({ createdAt: -1 }).lean(),
    ]);

    const totalBookmarks = totalBookmarksAgg[0]?.total || 0;
    const bookmarkCountMap = new Map(
      bookmarkCountsRaw.map((entry) => [String(entry._id), entry.count])
    );

    const eventsByPlatform = eventsBySourceRaw.map((entry) => ({
      platform: formatSourceLabel(entry._id),
      source: entry._id || 'other',
      count: entry.count,
    }));

    const eventsByCategory = eventsByCategoryRaw.map((entry) => ({
      category: entry._id || 'Other',
      count: entry.count,
    }));

    const syncStats = {
      totalSyncs: syncLogs.length,
      successfulSyncs: syncLogs.filter(s => s.status === 'success').length,
      partialSyncs: syncLogs.filter(s => s.status === 'partial').length,
      failedSyncs: syncLogs.filter(s => s.status === 'failed').length,
      lastSync,
      devfolioTotal: syncLogs.reduce((sum, s) => sum + (s.devfolioCount || 0), 0),
      unstopTotal: syncLogs.reduce((sum, s) => sum + (s.unstopCount || 0), 0),
      duplicatesSkipped: syncLogs.reduce((sum, s) => sum + (s.duplicatesSkipped || 0), 0),
      errors: syncLogs.reduce((sum, s) => sum + (s.errors?.length || 0), 0),
    };

    return res.status(200).json({
      userReports: {
        totalUsers,
        newUsersToday,
        newUsersWeek,
        newUsersMonth,
        studentsCount,
        adminsCount,
        userGrowth: buildDailyTrend(usersForTrend, range === '30d' ? 30 : 7),
      },
      eventReports: {
        totalEvents,
        upcomingEvents,
        closingWithin24h,
        closingWithin7d,
        recentlyClosed,
        expiredEvents,
        eventAdditions: buildDailyTrend(eventsForTrend, range === '30d' ? 30 : 7),
        eventsByPlatform,
        eventsByCategory,
      },
      engagementReports: {
        totalBookmarks,
        totalNotifications,
        notificationActivity: buildDailyTrend(notificationsForTrend, range === '30d' ? 30 : 7),
      },
      syncReports: syncStats,
      deadlineReports: {
        closingWithin24h,
        closingWithin7d,
        recentlyClosed,
        expiredEvents,
      },
      range,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch reports',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getReports,
};
