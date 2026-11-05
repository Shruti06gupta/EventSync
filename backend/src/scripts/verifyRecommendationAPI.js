/**
 * Verification Script: Recommendation API & Backend Integration (Step 6)
 *
 * Validates all 16 required verification scenarios:
 *  1. Authenticated users can retrieve recommendations
 *  2. Unauthenticated requests are rejected (HTTP 401)
 *  3. Recommendations use the correct authenticated user's profile
 *  4. Actual MongoDB event fields are returned
 *  5. The existing scoring service calculates the results
 *  6. Results are ordered by relevance
 *  7. Match scores remain strictly within 0-100
 *  8. Explanations match the actual scoring signals
 *  9. Expired events are excluded
 * 10. Duplicate events are handled
 * 11. Missing profile information is handled safely (cold-start)
 * 12. Pagination works correctly (page, limit, totalPages, hasNextPage)
 * 13. Invalid query parameters are rejected appropriately (HTTP 400)
 * 14. Empty results return a valid response (HTTP 200 with empty array)
 * 15. Database failures are handled gracefully (HTTP 500)
 * 16. Existing event APIs and routing order remain functional
 *
 * Run with: npm run verify:recommendation-api (from backend directory)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_secret_key_12345';

const User = require('../models/User');
const Event = require('../models/Event');
const { getRecommendedEventsForUser, deduplicateEvents } = require('../services/recommendationService');
const { getRecommendedEvents } = require('../controllers/recommendationsController');

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

console.log('='.repeat(70));
console.log('EventSync Recommendation Backend API Verification (Step 6)');
console.log('='.repeat(70));

// Create mock response helper
function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

async function runTests() {
  // Save original Mongoose methods to restore later
  const origUserFindById = User.findById;
  const origEventFind = Event.find;
  const origUserAggregate = User.aggregate;

  try {
    // --------------------------------------------------------------------------
    // Test Fixtures
    // --------------------------------------------------------------------------
    const testUser = {
      _id: 'user_dev_123',
      name: 'Shruti Gupta',
      email: 'shruti@example.com',
      college: 'Delhi Technological University',
      interests: ['Web Development', 'Machine Learning'],
      bookmarks: [
        {
          _id: 'bm_1',
          category: 'Web Development',
          tags: ['React', 'Node.js'],
          title: 'Fullstack Bootcamp',
          college: 'Delhi Technological University',
        },
      ],
      role: 'student',
    };

    const mockEvents = [
      {
        _id: 'ev_high_match',
        title: 'Fullstack Web Dev Hackathon',
        description: 'Build web development apps with React and Node.js',
        category: 'Web Development',
        tags: ['React', 'Node.js', 'Web Development'],
        college: 'Delhi Technological University',
        organizer: 'Tech Club DTU',
        startDate: futureDate(10),
        registrationDeadline: futureDate(5),
        mode: 'Online',
        isVerified: true,
      },
      {
        _id: 'ev_partial_match',
        title: 'AI Innovators Summit',
        description: 'Explore Machine Learning and neural networks',
        category: 'Machine Learning',
        tags: ['Python', 'Machine Learning'],
        college: 'IIT Bombay',
        organizer: 'AI Society',
        startDate: futureDate(15),
        registrationDeadline: futureDate(7),
        mode: 'Hybrid',
        location: {
          type: 'Point',
          coordinates: [72.8777, 19.076], // Mumbai [lon, lat]
        },
        venue: 'IIT Bombay Powai Campus',
        isVerified: true,
      },
      {
        _id: 'ev_unrelated',
        title: 'Dance & Cultural Fest',
        description: 'Annual cultural extravaganza',
        category: 'Cultural',
        tags: ['Music', 'Dance'],
        college: 'Other Institute',
        organizer: 'Cultural Society',
        startDate: futureDate(20),
        registrationDeadline: futureDate(12),
        mode: 'Offline',
        location: {
          type: 'Point',
          coordinates: [77.1175, 28.7501], // Delhi [lon, lat]
        },
        venue: 'Main Auditorium, Delhi',
        isVerified: true,
      },
      {
        _id: 'ev_expired',
        title: 'Past Workshop on Cloud',
        description: 'Expired workshop',
        category: 'Cloud',
        tags: ['AWS'],
        college: 'Delhi Technological University',
        organizer: 'Cloud Club',
        startDate: pastDate(2),
        registrationDeadline: pastDate(5), // Passed deadline
        mode: 'Online',
        isVerified: true,
      },
    ];

    const usersMap = new Map();
    usersMap.set('user_dev_123', testUser);

    // Helper to mock Event.find
    const setupEventFindMock = (eventsList = mockEvents) => {
      Event.find = (filter) => {
        let list = [...eventsList];

        // Apply basic filter simulation
        if (filter) {
          if (filter.isVerified !== undefined) {
            list = list.filter((e) => e.isVerified === filter.isVerified);
          }
          if (filter.mode?.$in) {
            list = list.filter((e) => filter.mode.$in.includes(e.mode));
          } else if (filter.mode) {
            if (filter.mode instanceof RegExp) {
              list = list.filter((e) => filter.mode.test(e.mode));
            } else {
              list = list.filter((e) => e.mode === filter.mode);
            }
          }
          if (filter.category) {
            if (filter.category instanceof RegExp) {
              list = list.filter((e) => filter.category.test(e.category));
            } else {
              list = list.filter((e) => e.category === filter.category);
            }
          }
          if (filter.registrationDeadline?.$gte) {
            const threshold = filter.registrationDeadline.$gte;
            list = list.filter((e) => e.registrationDeadline && new Date(e.registrationDeadline) >= threshold);
          }
          if (Array.isArray(filter.$and)) {
            for (const cond of filter.$and) {
              if (Array.isArray(cond.$or)) {
                list = list.filter((e) => {
                  return cond.$or.some((sub) => {
                    if (sub.category instanceof RegExp) return sub.category.test(e.category);
                    if (sub.title?.$regex) return new RegExp(sub.title.$regex, sub.title.$options).test(e.title);
                    if (sub.tags?.$in) {
                      return (e.tags || []).some((t) => sub.tags.$in.some((rx) => rx.test(t)));
                    }
                    return false;
                  });
                });
              }
            }
          }
        }

        return {
          lean: () => Promise.resolve(list),
        };
      };
    };

    // Helper to mock User.findById
    const setupUserFindByIdMock = () => {
      User.findById = (id) => {
        const idStr = id ? String(id) : '';
        const doc = usersMap.get(idStr) || null;
        return {
          select: () => ({
            populate: () => ({
              lean: () => Promise.resolve(doc ? { ...doc } : null),
            }),
          }),
        };
      };
    };

    setupUserFindByIdMock();
    setupEventFindMock(mockEvents);

    // ==========================================================================
    // SCENARIO 1: Authenticated users can retrieve recommendations
    // ==========================================================================
    {
      const req = {
        user: testUser,
        query: { page: '1', limit: '10' },
      };
      const res = createMockRes();

      await getRecommendedEvents(req, res);

      assert(
        'Scenario 1: Authenticated user receives HTTP 200 with recommendations array and success flag',
        res.statusCode === 200 &&
        res.body.success === true &&
        Array.isArray(res.body.recommendations) &&
        res.body.recommendations.length > 0,
        `Status: ${res.statusCode}, Success: ${res.body?.success}, Count: ${res.body?.recommendations?.length}`
      );
    }

    // ==========================================================================
    // SCENARIO 2: Unauthenticated requests are rejected
    // ==========================================================================
    {
      const req = {
        user: null, // No authenticated user
        query: {},
      };
      const res = createMockRes();

      await getRecommendedEvents(req, res);

      assert(
        'Scenario 2: Unauthenticated request is rejected with HTTP 401',
        res.statusCode === 401 && res.body.message.includes('Not authorized'),
        `Status: ${res.statusCode}, Message: ${res.body?.message}`
      );
    }

    // ==========================================================================
    // SCENARIO 3: Recommendations use the correct authenticated user's profile
    // ==========================================================================
    {
      const userA = {
        _id: 'user_A',
        name: 'User A',
        interests: ['Web Development'],
        college: 'Delhi Technological University',
        bookmarks: [],
      };
      const userB = {
        _id: 'user_B',
        name: 'User B',
        interests: ['Machine Learning'],
        college: 'IIT Bombay',
        bookmarks: [],
      };

      usersMap.set('user_A', userA);
      usersMap.set('user_B', userB);

      const resA = await getRecommendedEventsForUser(userA, { now: new Date() });
      const resB = await getRecommendedEventsForUser(userB, { now: new Date() });

      const topEventA = resA.recommendations[0]?.event?._id;
      const topEventB = resB.recommendations[0]?.event?._id;

      assert(
        'Scenario 3: Recommendations adapt distinctly to the authenticated user profile',
        topEventA === 'ev_high_match' && topEventB === 'ev_partial_match',
        `User A top: ${topEventA}, User B top: ${topEventB}`
      );
    }

    // ==========================================================================
    // SCENARIO 4: Actual MongoDB events are returned
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const firstEvent = res.events[0];

      assert(
        'Scenario 4: Returns actual event schema fields (title, category, college, dates)',
        firstEvent &&
        typeof firstEvent.title === 'string' &&
        typeof firstEvent.category === 'string' &&
        firstEvent.registrationDeadline !== undefined &&
        firstEvent.mode !== undefined,
        `Event fields: ${Object.keys(firstEvent || {}).slice(0, 6).join(', ')}`
      );
    }

    // ==========================================================================
    // SCENARIO 5: The existing scoring service calculates the results
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const firstRec = res.recommendations[0];

      assert(
        'Scenario 5: Scoring engine calculates matchPercentage, signals, breakdown, and score',
        firstRec &&
        typeof firstRec.score === 'number' &&
        typeof firstRec.matchPercentage === 'number' &&
        firstRec.breakdown !== undefined &&
        firstRec.signals !== undefined,
        `Score: ${firstRec?.score}, Match%: ${firstRec?.matchPercentage}`
      );
    }

    // ==========================================================================
    // SCENARIO 6: Results are ordered by relevance
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const scores = res.recommendations.map((r) => r.score);

      let isDescending = true;
      for (let i = 0; i < scores.length - 1; i++) {
        if (scores[i] < scores[i + 1]) {
          isDescending = false;
          break;
        }
      }

      assert(
        'Scenario 6: Recommendations are strictly ordered by relevance score descending',
        isDescending && scores.length > 1,
        `Scores: ${scores.join(', ')}`
      );
    }

    // ==========================================================================
    // SCENARIO 7: Match scores remain within 0-100
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const scoresValid = res.recommendations.every((r) => {
        if (r.matchPercentage === null) return true;
        return Number.isInteger(r.matchPercentage) && r.matchPercentage >= 0 && r.matchPercentage <= 100;
      });

      assert(
        'Scenario 7: All match scores are strictly within [0, 100]',
        scoresValid === true,
        `Valid: ${scoresValid}`
      );
    }

    // ==========================================================================
    // SCENARIO 8: Explanations match the actual scoring signals
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const topRec = res.recommendations[0];
      const explanationLower = (topRec.explanation || '').toLowerCase();
      const reasonsJoined = (topRec.reasons || []).join(' ').toLowerCase();

      const mentionsInterestsOrCollege =
        explanationLower.includes('web development') ||
        reasonsJoined.includes('web development') ||
        reasonsJoined.includes('institution');

      assert(
        'Scenario 8: Explanation accurately reflects matched interests / institution evidence',
        mentionsInterestsOrCollege,
        `Explanation: "${topRec.explanation}", Reasons: ${JSON.stringify(topRec.reasons)}`
      );
    }

    // ==========================================================================
    // SCENARIO 9: Expired events are excluded
    // ==========================================================================
    {
      const res = await getRecommendedEventsForUser(testUser, { now: new Date() });
      const hasExpired = res.recommendations.some((r) => r.eventId === 'ev_expired');

      assert(
        'Scenario 9: Expired events are excluded from the recommended results',
        hasExpired === false,
        `Included expired: ${hasExpired}`
      );
    }

    // ==========================================================================
    // SCENARIO 10: Duplicate events are handled
    // ==========================================================================
    {
      const duplicateList = [
        mockEvents[0],
        { ...mockEvents[0], _id: 'ev_high_match' }, // identical ID
        { ...mockEvents[0], _id: 'ev_dup_2' }, // identical title + organizer
        mockEvents[1],
      ];

      const deduped = deduplicateEvents(duplicateList);

      assert(
        'Scenario 10: Duplicate event records are safely filtered out',
        deduped.length === 2 && deduped[0]._id === 'ev_high_match' && deduped[1]._id === 'ev_partial_match',
        `Original: ${duplicateList.length}, Deduped: ${deduped.length}`
      );
    }

    // ==========================================================================
    // SCENARIO 11: Missing profile information is handled safely
    // ==========================================================================
    {
      const coldUser = {
        _id: 'user_cold',
        name: 'Cold User',
        email: 'cold@example.com',
        college: '',
        interests: [],
        bookmarks: [],
      };
      usersMap.set('user_cold', coldUser);

      const res = await getRecommendedEventsForUser(coldUser, { now: new Date() });

      assert(
        'Scenario 11: Cold start profile handled safely without crashing, with null match scores',
        res.isColdStart === true &&
        res.recommendations.length > 0 &&
        res.recommendations.every((r) => r.matchPercentage === null && r.isPersonalized === false),
        `isColdStart: ${res.isColdStart}, matchPercentage: ${res.recommendations[0]?.matchPercentage}`
      );
    }

    // ==========================================================================
    // SCENARIO 12: Pagination works correctly
    // ==========================================================================
    {
      const manyEvents = Array.from({ length: 15 }, (_, i) => ({
        _id: `ev_page_${i}`,
        title: `Event Number ${i}`,
        category: 'Web Development',
        registrationDeadline: futureDate(i + 2),
        isVerified: true,
      }));

      setupEventFindMock(manyEvents);

      const page1 = await getRecommendedEventsForUser(testUser, { page: 1, limit: 5 });
      const page2 = await getRecommendedEventsForUser(testUser, { page: 2, limit: 5 });

      assert(
        'Scenario 12: Pagination slices correctly with matching metadata',
        page1.recommendations.length === 5 &&
        page2.recommendations.length === 5 &&
        page1.pagination.page === 1 &&
        page1.pagination.totalPages === 3 &&
        page1.pagination.hasNextPage === true &&
        page1.recommendations[0].eventId !== page2.recommendations[0].eventId,
        `Page 1 count: ${page1.recommendations.length}, Page 2 count: ${page2.recommendations.length}`
      );

      // Restore mock events
      setupEventFindMock(mockEvents);
    }

    // ==========================================================================
    // SCENARIO 13: Invalid query parameters are rejected appropriately
    // ==========================================================================
    {
      const reqBadPage = { user: testUser, query: { page: '-1' } };
      const resBadPage = createMockRes();
      await getRecommendedEvents(reqBadPage, resBadPage);

      const reqBadLimit = { user: testUser, query: { limit: '999' } };
      const resBadLimit = createMockRes();
      await getRecommendedEvents(reqBadLimit, resBadLimit);

      assert(
        'Scenario 13: Invalid page or limit parameters return HTTP 400 Bad Request',
        resBadPage.statusCode === 400 &&
        resBadLimit.statusCode === 400 &&
        resBadPage.body.message.includes('Invalid page') &&
        resBadLimit.body.message.includes('Invalid limit'),
        `Page status: ${resBadPage.statusCode}, Limit status: ${resBadLimit.statusCode}`
      );
    }

    // ==========================================================================
    // SCENARIO 14: Empty results return a valid response
    // ==========================================================================
    {
      setupEventFindMock([]); // No events in database

      const req = { user: testUser, query: {} };
      const res = createMockRes();
      await getRecommendedEvents(req, res);

      assert(
        'Scenario 14: Empty database results return HTTP 200 with empty array and zero total',
        res.statusCode === 200 &&
        Array.isArray(res.body.recommendations) &&
        res.body.recommendations.length === 0 &&
        res.body.pagination.totalEvents === 0,
        `Status: ${res.statusCode}, Total: ${res.body?.pagination?.totalEvents}`
      );

      // Restore mock events
      setupEventFindMock(mockEvents);
    }

    // ==========================================================================
    // SCENARIO 15: Database failures are handled gracefully
    // ==========================================================================
    {
      Event.find = () => {
        throw new Error('Database connection timeout simulated');
      };

      const req = { user: testUser, query: {} };
      const res = createMockRes();
      await getRecommendedEvents(req, res);

      assert(
        'Scenario 15: Database failure caught gracefully returning HTTP 500 without crashing',
        res.statusCode === 500 &&
        res.body.message.includes('Failed to fetch recommendations'),
        `Status: ${res.statusCode}, Message: ${res.body?.message}`
      );

      // Restore mock events
      setupEventFindMock(mockEvents);
    }

    // ==========================================================================
    // SCENARIO 16: Existing event APIs and routing order remain functional
    // ==========================================================================
    {
      // Verify Express route stack on eventRoutes
      const eventRouter = require('../routes/eventRoutes');
      const routes = eventRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const recIndex = routes.findIndex((r) => r.path === '/recommended');
      const idIndex = routes.findIndex((r) => r.path === '/:id');

      assert(
        'Scenario 16: /recommended route is registered before /:id route, preserving existing APIs',
        recIndex !== -1 && idIndex !== -1 && recIndex < idIndex,
        `/recommended index: ${recIndex}, /:id index: ${idIndex}`
      );
    }

    // ==========================================================================
    // SCENARIO 17: Trending events with genuine engagement vs cold-start fallback
    // ==========================================================================
    {
      // Subtest 17A: When bookmark engagement data exists, events are ordered by trending score
      User.aggregate = () => Promise.resolve([
        { _id: 'ev_partial_match', count: 18 },
        { _id: 'ev_high_match', count: 3 },
      ]);

      const reqTrendingEngaged = { user: testUser, query: { type: 'trending' } };
      const resTrendingEngaged = createMockRes();
      await getRecommendedEvents(reqTrendingEngaged, resTrendingEngaged);

      const topTrending = resTrendingEngaged.body.recommendations[0];
      const hasEngagement = resTrendingEngaged.body.hasEngagementData;

      // Subtest 17B: When no bookmark data exists, fallback provides honest upcoming events
      User.aggregate = () => Promise.resolve([]);
      const reqTrendingCold = { user: testUser, query: { type: 'trending' } };
      const resTrendingCold = createMockRes();
      await getRecommendedEvents(reqTrendingCold, resTrendingCold);

      assert(
        'Scenario 17: Trending events uses genuine saves when available and transparent fallback when cold',
        resTrendingEngaged.statusCode === 200 &&
        topTrending.eventId === 'ev_partial_match' &&
        topTrending.bookmarkCount === 18 &&
        topTrending.isTrending === true &&
        hasEngagement === true &&
        resTrendingCold.statusCode === 200 &&
        resTrendingCold.body.hasEngagementData === false,
        `Top trending: ${topTrending?.eventId}, Saves: ${topTrending?.bookmarkCount}, Cold hasEngagement: ${resTrendingCold.body?.hasEngagementData}`
      );
    }

    // ==========================================================================
    // SCENARIO 18: Similar to Your Interests matches user interests and specific queries
    // ==========================================================================
    {
      // Query specific interest
      const reqSimilar = { user: testUser, query: { type: 'similar', interest: 'Machine Learning' } };
      const resSimilar = createMockRes();
      await getRecommendedEvents(reqSimilar, resSimilar);

      const mlRecs = resSimilar.body.recommendations;
      const allMatchML = mlRecs.every((r) => r.event.category === 'Machine Learning' || r.event.tags?.includes('Machine Learning'));

      // Cold start user with no interests
      const coldUser = usersMap.get('user_cold');
      const reqSimilarCold = { user: coldUser, query: { type: 'similar' } };
      const resSimilarCold = createMockRes();
      await getRecommendedEvents(reqSimilarCold, resSimilarCold);

      assert(
        'Scenario 18: Similar tab filters by interest and handles cold start users without crashing',
        resSimilar.statusCode === 200 &&
        mlRecs.length > 0 &&
        allMatchML &&
        resSimilarCold.statusCode === 200 &&
        resSimilarCold.body.isColdStart === true &&
        resSimilarCold.body.recommendations.length === 0,
        `ML count: ${mlRecs.length}, Cold status: ${resSimilarCold.statusCode}, isColdStart: ${resSimilarCold.body?.isColdStart}`
      );
    }

    // ==========================================================================
    // SCENARIO 19: Nearby Events strictly excludes online events and computes Haversine distances
    // ==========================================================================
    {
      // Search near Delhi coordinates (28.7501, 77.1175)
      const reqNearby = {
        user: testUser,
        query: {
          type: 'nearby',
          latitude: '28.7501',
          longitude: '77.1175',
          radiusKm: '50',
        },
      };
      const resNearby = createMockRes();
      await getRecommendedEvents(reqNearby, resNearby);

      const nearbyRecs = resNearby.body.recommendations;
      const noOnline = nearbyRecs.every((r) => r.event.mode !== 'Online');
      const delhiFirst = nearbyRecs.length > 0 && nearbyRecs[0].eventId === 'ev_unrelated' && nearbyRecs[0].distanceKm < 5;

      assert(
        'Scenario 19: Nearby events strictly excludes online events and sorts by proximity',
        resNearby.statusCode === 200 &&
        noOnline &&
        delhiFirst,
        `Nearby count: ${nearbyRecs.length}, First: ${nearbyRecs[0]?.eventId}, Dist: ${nearbyRecs[0]?.distanceKm} km`
      );
    }

    // ==========================================================================
    // SCENARIO 20: Type validation and location parameter bounds
    // ==========================================================================
    {
      const reqInvalidType = { user: testUser, query: { type: 'nonexistent_tab' } };
      const resInvalidType = createMockRes();
      await getRecommendedEvents(reqInvalidType, resInvalidType);

      const reqBadLat = { user: testUser, query: { type: 'nearby', latitude: '999', longitude: '77.1' } };
      const resBadLat = createMockRes();
      await getRecommendedEvents(reqBadLat, resBadLat);

      const reqMissingLon = { user: testUser, query: { type: 'nearby', latitude: '28.7' } };
      const resMissingLon = createMockRes();
      await getRecommendedEvents(reqMissingLon, resMissingLon);

      const reqBadRadius = { user: testUser, query: { type: 'nearby', radiusKm: '99999' } };
      const resBadRadius = createMockRes();
      await getRecommendedEvents(reqBadRadius, resBadRadius);

      assert(
        'Scenario 20: Invalid category type and out-of-bounds coordinates return HTTP 400',
        resInvalidType.statusCode === 400 &&
        resBadLat.statusCode === 400 &&
        resMissingLon.statusCode === 400 &&
        resBadRadius.statusCode === 400 &&
        resInvalidType.body.message.includes('Invalid type parameter') &&
        resBadLat.body.message.includes('Invalid latitude') &&
        resMissingLon.body.message.includes('Both latitude and longitude') &&
        resBadRadius.body.message.includes('Invalid radiusKm'),
        `Invalid type: ${resInvalidType.statusCode}, Bad lat: ${resBadLat.statusCode}, Missing lon: ${resMissingLon.statusCode}, Bad radius: ${resBadRadius.statusCode}`
      );
    }
  } finally {
    // Restore original Mongoose functions
    User.findById = origUserFindById;
    Event.find = origEventFind;
    User.aggregate = origUserAggregate;
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('='.repeat(70));
  console.log(`Verification Complete: ${passed} passed, ${failed} failed.`);
  console.log('='.repeat(70));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
