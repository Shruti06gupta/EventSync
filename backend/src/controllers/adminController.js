const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const SyncLog = require('../models/SyncLog');
const Notification = require('../models/Notification');
const PDFDocument = require('pdfkit');

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

const exportReports = async (req, res) => {
  try {
    const range = req.query.range || '7d';
    
    // Get the same data as getReports
    const reportsData = await getReportsData(range);
    
    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Set response headers
    const filename = `EventSync_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Helper function for drawing section headers
    const drawSectionHeader = (title, y) => {
      doc.fillColor('#0d9488')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(title, 50, y);
      doc.moveTo(50, y + 20)
         .lineTo(545, y + 20)
         .strokeColor('#0d9488')
         .lineWidth(1)
         .stroke();
      return y + 40;
    };
    
    // Helper function for drawing stat boxes
    const drawStatBox = (label, value, x, y) => {
      doc.rect(x, y, 120, 50)
         .fillColor('#f0fdf4')
         .fill()
         .strokeColor('#0d9488')
         .lineWidth(0.5)
         .stroke();
      
      doc.fillColor('#0f766e')
         .fontSize(10)
         .font('Helvetica')
         .text(label, x + 8, y + 10);
      
      doc.fillColor('#0d9488')
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(String(value), x + 8, y + 25);
    };
    
    // Helper function for drawing simple bar chart
    const drawBarChart = (data, title, startY) => {
      let y = drawSectionHeader(title, startY);
      
      const chartWidth = 495;
      const chartHeight = 100;
      const barWidth = (chartWidth / data.length) - 10;
      const maxCount = Math.max(...data.map(d => d.count)) || 1;
      
      // Draw chart background
      doc.rect(50, y, chartWidth, chartHeight)
         .fillColor('#ffffff')
         .fill()
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();
      
      // Draw bars
      data.forEach((item, index) => {
        const barHeight = (item.count / maxCount) * (chartHeight - 20);
        const x = 50 + index * (barWidth + 10) + 5;
        const barY = y + chartHeight - barHeight - 10;
        
        doc.rect(x, barY, barWidth, barHeight)
           .fillColor('#0d9488')
           .fill();
        
        // Draw label
        doc.fillColor('#64748b')
           .fontSize(8)
           .font('Helvetica')
           .text(item.label, x, y + chartHeight - 5, { width: barWidth, align: 'center' });
        
        // Draw value
        doc.fillColor('#0f766e')
           .fontSize(8)
           .font('Helvetica-Bold')
           .text(String(item.count), x, barY - 12, { width: barWidth, align: 'center' });
      });
      
      return y + chartHeight + 20;
    };
    
    // Helper function for drawing horizontal bars
    const drawHorizontalBars = (items, title, startY) => {
      let y = drawSectionHeader(title, startY);
      
      const chartWidth = 400;
      const barHeight = 20;
      const maxCount = Math.max(...items.map(i => i.count)) || 1;
      
      items.forEach((item, index) => {
        const barWidth = (item.count / maxCount) * chartWidth;
        const labelY = y + index * 30;
        
        // Draw label
        doc.fillColor('#334155')
           .fontSize(10)
           .font('Helvetica')
           .text(item.platform || item.source, 50, labelY, { width: 100 });
        
        // Draw bar background
        doc.rect(160, labelY, chartWidth, barHeight)
           .fillColor('#f1f5f9')
           .fill();
        
        // Draw bar
        doc.rect(160, labelY, barWidth, barHeight)
           .fillColor('#0d9488')
           .fill();
        
        // Draw count
        doc.fillColor('#0f766e')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text(String(item.count), 160 + chartWidth + 10, labelY);
      });
      
      return y + items.length * 30 + 20;
    };
    
    // PAGE 1: Cover and Executive Summary
    doc.fillColor('#0d9488')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('EventSync', 50, 80);
    
    doc.fillColor('#0f766e')
       .fontSize(18)
       .text('Admin Analytics Report', 50, 120);
    
    doc.fillColor('#64748b')
       .fontSize(10)
       .font('Helvetica')
       .text(`Generated: ${new Date().toLocaleString('en-IN')}`, 50, 150);
    
    const rangeLabel = range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'This Month';
    doc.text(`Reporting Period: ${rangeLabel}`, 50, 165);
    
    let y = drawSectionHeader('Executive Summary', 200);
    
    // Executive summary stats
    drawStatBox('Total Users', reportsData.userReports.totalUsers, 50, y);
    drawStatBox('Total Events', reportsData.eventReports.totalEvents, 180, y);
    drawStatBox('Total Bookmarks', reportsData.engagementReports.totalBookmarks, 310, y);
    drawStatBox('Total Notifications', reportsData.engagementReports.totalNotifications, 440, y);
    
    y += 70;
    
    drawStatBox('Sync Success Rate', 
      reportsData.syncReports.totalSyncs > 0 
        ? Math.round((reportsData.syncReports.successfulSyncs / reportsData.syncReports.totalSyncs) * 100) + '%'
        : 'N/A',
      50, y);
    
    y += 80;
    
    // PAGE 2: User Analytics
    doc.addPage();
    y = drawSectionHeader('User Analytics', 50);
    
    drawStatBox('Total Users', reportsData.userReports.totalUsers, 50, y);
    drawStatBox('Students', reportsData.userReports.studentsCount, 180, y);
    drawStatBox('Admins', reportsData.userReports.adminsCount, 310, y);
    drawStatBox('New Users', reportsData.userReports.newUsersWeek, 440, y);
    
    y += 70;
    
    y = drawBarChart(reportsData.userReports.userGrowth, 'User Growth Over Time', y);
    
    // PAGE 3: Event Analytics
    doc.addPage();
    y = drawSectionHeader('Event Analytics', 50);
    
    drawStatBox('Total Events', reportsData.eventReports.totalEvents, 50, y);
    drawStatBox('Upcoming', reportsData.eventReports.upcomingEvents, 180, y);
    drawStatBox('Closing Soon', reportsData.eventReports.closingWithin7d, 310, y);
    drawStatBox('Expired', reportsData.eventReports.expiredEvents, 440, y);
    
    y += 70;
    
    y = drawBarChart(reportsData.eventReports.eventAdditions, 'Event Additions Over Time', y);
    
    if (reportsData.eventReports.eventsByPlatform && reportsData.eventReports.eventsByPlatform.length > 0) {
      y = drawHorizontalBars(reportsData.eventReports.eventsByPlatform, 'Events by Platform', y);
    }
    
    if (reportsData.eventReports.eventsByCategory && reportsData.eventReports.eventsByCategory.length > 0) {
      y = drawHorizontalBars(
        reportsData.eventReports.eventsByCategory.map(cat => ({ platform: cat.category, source: cat.category, count: cat.count })),
        'Events by Category',
        y
      );
    }
    
    // PAGE 4: Engagement
    doc.addPage();
    y = drawSectionHeader('Engagement Metrics', 50);
    
    drawStatBox('Total Bookmarks', reportsData.engagementReports.totalBookmarks, 50, y);
    drawStatBox('Total Notifications', reportsData.engagementReports.totalNotifications, 180, y);
    
    y += 70;
    
    y = drawBarChart(reportsData.engagementReports.notificationActivity, 'Notification Activity', y);
    
    doc.fillColor('#64748b')
       .fontSize(9)
       .font('Helvetica')
       .text('Note: EventSync tracks bookmarks and notifications as in-app engagement metrics. Event registrations happen on external platforms.', 50, y, { width: 495 });
    
    // PAGE 5: Sync & Deadlines
    doc.addPage();
    y = drawSectionHeader('Sync Reports', 50);
    
    drawStatBox('Total Syncs', reportsData.syncReports.totalSyncs, 50, y);
    drawStatBox('Successful', reportsData.syncReports.successfulSyncs, 180, y);
    drawStatBox('Partial', reportsData.syncReports.partialSyncs, 310, y);
    drawStatBox('Failed', reportsData.syncReports.failedSyncs, 440, y);
    
    y += 70;
    
    drawStatBox('Devfolio Events', reportsData.syncReports.devfolioTotal, 50, y);
    drawStatBox('Unstop Events', reportsData.syncReports.unstopTotal, 180, y);
    drawStatBox('Duplicates Skipped', reportsData.syncReports.duplicatesSkipped, 310, y);
    drawStatBox('Sync Errors', reportsData.syncReports.errors, 440, y);
    
    y += 70;
    
    if (reportsData.syncReports.lastSync) {
      doc.fillColor('#334155')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Last Sync:', 50, y);
      
      doc.fillColor('#64748b')
         .fontSize(9)
         .font('Helvetica')
         .text(new Date(reportsData.syncReports.lastSync.createdAt).toLocaleString('en-IN', {
           dateStyle: 'medium',
           timeStyle: 'short',
         }), 50, y + 15);
      
      doc.text(`Status: ${reportsData.syncReports.lastSync.status}`, 50, y + 30);
      
      y += 50;
    }
    
    y = drawSectionHeader('Deadline Reports', y);
    
    drawStatBox('Closing (24h)', reportsData.deadlineReports.closingWithin24h, 50, y);
    drawStatBox('Closing (7d)', reportsData.deadlineReports.closingWithin7d, 180, y);
    drawStatBox('Recently Closed', reportsData.deadlineReports.recentlyClosed, 310, y);
    drawStatBox('Expired', reportsData.deadlineReports.expiredEvents, 440, y);
    
    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('[Export Reports] Error:', error);
    return res.status(500).json({
      message: 'Failed to generate report',
      error: error.message,
    });
  }
};

// Helper function to get reports data (reused from getReports)
const getReportsData = async (range) => {
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
    eventsByPlatform,
    eventsByCategory,
    totalBookmarks,
    notificationsForTrend,
    totalNotifications,
    syncLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: startDate } }),
    User.countDocuments({ createdAt: { $gte: monthStart } }),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'admin' }),
    User.find({ createdAt: { $gte: startDate } }).select('createdAt').lean(),
    Event.countDocuments({ isVerified: true }),
    Event.countDocuments({ isVerified: true, registrationDeadline: { $gte: now } }),
    Event.countDocuments({ isVerified: true, registrationDeadline: { $gte: now, $lt: next24h } }),
    Event.countDocuments({ isVerified: true, registrationDeadline: { $gte: now, $lt: next7d } }),
    Event.countDocuments({ isVerified: true, registrationDeadline: { $lt: now, $gte: threeDaysAgo } }),
    Event.countDocuments({ isVerified: true, registrationDeadline: { $lt: threeDaysAgo } }),
    Event.find({ isVerified: true, createdAt: { $gte: startDate } }).select('createdAt').lean(),
    Event.aggregate([
      { $match: { isVerified: true } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Event.aggregate([
      { $match: { isVerified: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.aggregate([
      { $unwind: '$bookmarks' },
      { $count: 'total' },
    ]).then(result => result[0]?.total || 0),
    Notification.find({ createdAt: { $gte: startDate } }).select('createdAt').lean(),
    Notification.countDocuments(),
    SyncLog.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const eventsByPlatformFormatted = eventsByPlatform.map(item => ({
    platform: formatSourceLabel(item._id),
    source: item._id,
    count: item.count,
  }));

  const eventsByCategoryFormatted = eventsByCategory.map(item => ({
    category: item._id,
    count: item.count,
  }));

  const lastSync = syncLogs[0] || null;

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

  return {
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
      eventsByPlatform: eventsByPlatformFormatted,
      eventsByCategory: eventsByCategoryFormatted,
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
  };
};

module.exports = {
  getDashboardStats,
  getUsers,
  getReports,
  exportReports,
};
