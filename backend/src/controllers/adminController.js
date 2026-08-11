const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const SyncLog = require('../models/SyncLog');

const MS_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
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
  const today = startOfDay(new Date());
  const buckets = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const dayStart = new Date(today.getTime() - index * MS_DAY);
    const dayEnd = new Date(dayStart.getTime() + MS_DAY);
    const label = dayStart.toLocaleDateString('en-IN', { weekday: 'short' });

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
    const todayStart = startOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
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
        .limit(10)
        .lean(),
      Event.find({ createdAt: { $gte: last24h } })
        .select('title source createdAt registrationDeadline')
        .sort({ createdAt: -1 })
        .limit(10)
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
      .slice(0, 12);

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
      adminAlerts.push({
        id: 'sync-partial',
        level: 'warning',
        message: 'Latest event platform sync completed with warnings',
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
        registrationsTracked: false,
        registrationsNote:
          'Event registrations happen on external platforms and are not stored in EventSync. Bookmarks are shown as in-app engagement.',
      },
      eventCreationTrend: buildDailyTrend(eventsForTrend, 7),
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

module.exports = {
  getDashboardStats,
};
