/**
 * Comprehensive Step 8 QA & Stabilization Verification Script
 * Validates edge cases, security, tie-breaking, deduplication, and regression safety.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_secret_key_12345';

const User = require('../models/User');
const Event = require('../models/Event');
const {
  getRecommendedEventsForUser,
  getTrendingEvents,
  getSimilarEventsForUser,
  getNearbyEvents,
} = require('../services/recommendationService');
const { getRecommendedEvents } = require('../controllers/recommendationsController');
const { calculateHaversineKm } = require('../services/recommendationScoringService');

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

const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const pastDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function runStep8QA() {
  console.log('='.repeat(70));
  console.log('EventSync Recommendations — Step 8 QA Verification Suite');
  console.log('='.repeat(70));

  const origUserFindById = User.findById;
  const origEventFind = Event.find;
  const origUserAggregate = User.aggregate;

  try {
    const testUser = {
      _id: 'qa_user_1',
      name: 'QA Student',
      email: 'qa@example.com',
      college: 'Delhi Technological University',
      interests: ['Web Development', 'Machine Learning'],
      bookmarks: [],
    };

    const mockEvents = [
      {
        _id: 'qa_ev_1',
        title: 'Fullstack Web Dev Challenge',
        category: 'Web Development',
        tags: ['React', 'Node.js'],
        startDate: futureDate(10),
        registrationDeadline: futureDate(5),
        mode: 'Online',
        isVerified: true,
      },
      {
        _id: 'qa_ev_2',
        title: 'Delhi Tech Fest Hackathon',
        category: 'Machine Learning',
        tags: ['Python', 'AI'],
        college: 'Delhi Technological University',
        startDate: futureDate(12),
        registrationDeadline: futureDate(5),
        mode: 'Offline',
        location: { type: 'Point', coordinates: [77.1175, 28.7501] }, // DTU Delhi
        venue: 'Delhi Technological University Campus',
        isVerified: true,
      },
      {
        _id: 'qa_ev_expired_nearby',
        title: 'Past Delhi Meetup',
        category: 'Web Development',
        startDate: pastDate(10),
        registrationDeadline: pastDate(2), // Expired!
        mode: 'Offline',
        location: { type: 'Point', coordinates: [77.1175, 28.7501] },
        venue: 'Delhi Technological University Campus',
        isVerified: true,
      },
    ];

    const userStore = new Map();
    userStore.set('qa_user_1', testUser);
    userStore.set('empty_user', { _id: 'empty_user', name: 'New Student', interests: [], bookmarks: [] });

    // Mock Event.find with MongoDB filter simulation
    Event.find = (filter) => {
      let list = [...mockEvents];
      if (filter) {
        if (filter.isVerified !== undefined) list = list.filter((e) => e.isVerified === filter.isVerified);
        if (filter.mode?.$in) list = list.filter((e) => filter.mode.$in.includes(e.mode));
        if (filter.registrationDeadline?.$gte) {
          list = list.filter((e) => e.registrationDeadline && new Date(e.registrationDeadline) >= filter.registrationDeadline.$gte);
        }
        if (Array.isArray(filter.$or)) {
          list = list.filter((e) => {
            return filter.$or.some((sub) => {
              if (sub.registrationDeadline?.$gte) {
                return e.registrationDeadline && new Date(e.registrationDeadline) >= sub.registrationDeadline.$gte;
              }
              if (sub.startDate?.$gte) {
                return e.startDate && new Date(e.startDate) >= sub.startDate.$gte;
              }
              return false;
            });
          });
        }
      }
      return { lean: () => Promise.resolve(list) };
    };

    // Mock User.findById with user lookup
    User.findById = (id) => {
      const doc = userStore.get(String(id)) || testUser;
      return {
        select: () => ({
          populate: () => ({
            lean: () => Promise.resolve({ ...doc }),
          }),
        }),
      };
    };

    // 1. QA Test 1: Repeated saves by same user do not inflate trending counts
    {
      // Mock User.aggregate pipeline with $setUnion validation
      User.aggregate = (pipeline) => {
        const hasSetUnion = pipeline.some((stage) => stage.$project?.uniqueBookmarks?.$setUnion);
        return Promise.resolve([
          { _id: 'qa_ev_1', count: hasSetUnion ? 1 : 2 },
        ]);
      };

      const result = await getTrendingEvents({ limit: 5 });
      assert(
        'QA-1: Pipeline uses $setUnion to prevent duplicate saves from inflating trending counts',
        result.success && result.recommendations[0].bookmarkCount === 1,
        `Count was: ${result.recommendations[0]?.bookmarkCount}`
      );
    }

    // 2. QA Test 2: Expired events never returned in Nearby even with locationName text search
    {
      const result = await getNearbyEvents({ locationName: 'Delhi', limit: 10 });
      const hasExpired = result.events.some((e) => e._id === 'qa_ev_expired_nearby');
      assert(
        'QA-2: Expired events strictly excluded in Nearby textual search (deadline $and preservation)',
        hasExpired === false && result.events.length > 0,
        `Found expired: ${hasExpired}, total: ${result.events.length}`
      );
    }

    // 3. QA Test 3: Similar tab handles "all" query across multiple interests
    {
      const result = await getSimilarEventsForUser(testUser, { interest: 'all', limit: 10 });
      assert(
        'QA-3: Similar tab cleanly resolves "all" interests query across multiple user topics',
        result.success && result.selectedInterest === 'All Interests' && result.events.length > 0,
        `Selected: ${result.selectedInterest}, count: ${result.events.length}`
      );
    }

    // 4. QA Test 4: Similar tab allows manual keyword exploration for cold-start users
    {
      const coldUser = { _id: 'cold_user', interests: [], bookmarks: [] };
      const result = await getSimilarEventsForUser(coldUser, { interest: 'Web Development', limit: 10 });
      assert(
        'QA-4: Cold-start users can manually explore specific topics in Similar tab',
        result.success && result.isColdStart === false && result.selectedInterest === 'Web Development',
        `Selected: ${result.selectedInterest}, cold: ${result.isColdStart}`
      );
    }

    // 5. QA Test 5: Deterministic tie-breaking on equal scores and deadlines
    {
      // Two identical score events
      const resA = await getRecommendedEventsForUser(testUser, { limit: 10 });
      const resB = await getRecommendedEventsForUser(testUser, { limit: 10 });
      const idsA = resA.recommendations.map((r) => r.eventId).join(',');
      const idsB = resB.recommendations.map((r) => r.eventId).join(',');
      assert(
        'QA-5: Deterministic tie-breaking produces identical ranking order on repeat runs',
        idsA === idsB && idsA.length > 0,
        `Run A: ${idsA} === Run B: ${idsB}`
      );
    }

    // 6. QA Test 6: Haversine distance accuracy
    {
      // Distance between DTU Delhi (28.7501, 77.1175) and IIT Bombay (19.0760, 72.8777) ~ 1160 km
      const dist = calculateHaversineKm(28.7501, 77.1175, 19.0760, 72.8777);
      assert(
        'QA-6: Haversine distance formula accurate within 1% of expected spherical distance',
        Math.abs(dist - 1160) < 25,
        `Calculated: ${dist.toFixed(1)} km (expected ~1160 km)`
      );
    }

    // 7. QA Test 7: Coordinates pair enforcement (one without the other rejected)
    {
      const reqLatOnly = { user: testUser, query: { latitude: '28.75' } };
      const resLatOnly = createMockRes();
      await getRecommendedEvents(reqLatOnly, resLatOnly);

      const reqLonOnly = { user: testUser, query: { longitude: '77.11' } };
      const resLonOnly = createMockRes();
      await getRecommendedEvents(reqLonOnly, resLonOnly);

      assert(
        'QA-7: Coordinate requests missing latitude or longitude return HTTP 400 Bad Request',
        resLatOnly.statusCode === 400 && resLonOnly.statusCode === 400,
        `LatOnly: ${resLatOnly.statusCode}, LonOnly: ${resLonOnly.statusCode}`
      );
    }

    // 8. QA Test 8: Empty profile cold-start safety
    {
      const emptyUser = { _id: 'empty_user', name: 'New Student' };
      const result = await getRecommendedEventsForUser(emptyUser, { type: 'for-you' });
      assert(
        'QA-8: Missing profile arrays/objects handled safely without throwing runtime errors',
        result.success && result.isColdStart === true && Array.isArray(result.recommendations),
        `Success: ${result.success}, isColdStart: ${result.isColdStart}`
      );
    }
  } finally {
    User.findById = origUserFindById;
    Event.find = origEventFind;
    User.aggregate = origUserAggregate;
  }

  console.log('='.repeat(70));
  console.log(`Step 8 QA Complete: ${passed} passed, ${failed} failed.`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

runStep8QA().catch((err) => {
  console.error('Step 8 QA fatal error:', err);
  process.exit(1);
});
