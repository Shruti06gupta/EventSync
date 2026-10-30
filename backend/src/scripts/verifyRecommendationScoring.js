/**
 * Verification Script: Deterministic Recommendation Scoring Service
 * 
 * Validates all 12 required test scenarios for the EventSync recommendation algorithm:
 *  1. Exact category match
 *  2. Partial tag overlap
 *  3. No matching interests
 *  4. Missing/empty user profile (cold start)
 *  5. Missing event metadata
 *  6. Case-insensitive matching
 *  7. Whitespace and duplicate tag normalization
 *  8. Deterministic results (identical input => identical output)
 *  9. Score boundaries strictly between 0 and 100
 * 10. Filtering/exclusion of expired events
 * 11. Explanations matching actual evidence
 * 12. Cold start without fabricated scores
 * 
 * Run with: npm run verify:recommendation-scoring (from backend directory)
 */

const {
  calculateEventRelevance,
  rankEventsForUser,
  normalizeText,
  normalizeTagList,
  matchesWord,
  calculateHaversineKm,
} = require('../services/recommendationScoringService');

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

const futureDate = (daysAhead) => new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
const pastDate = (daysAgo) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

console.log('='.repeat(70));
console.log('EventSync Recommendation Scoring Service Verification');
console.log('='.repeat(70));

// ============================================================================
// SCENARIO 1: Exact category match
// ============================================================================
{
  const user = {
    interests: ['Web Development'],
    college: 'ABC Institute of Technology',
  };
  const event = {
    _id: 'ev-1',
    title: 'Modern Web Stack 2026',
    category: 'Web Development',
    tags: ['React', 'Node.js'],
    college: 'ABC Institute of Technology',
    registrationDeadline: futureDate(5),
  };

  const res = calculateEventRelevance(event, user);
  assert(
    'Scenario 1: Exact category match produces high score and correct signal',
    res.score >= 80 &&
    res.signals.matchedInterests.includes('web development') &&
    res.breakdown.interests.rawScore >= 0.85,
    `Score: ${res.score}, Matched: ${JSON.stringify(res.signals.matchedInterests)}`
  );
}

// ============================================================================
// SCENARIO 2: Partial tag overlap
// ============================================================================
{
  const user = {
    interests: ['Machine Learning', 'Cloud Computing', 'Cybersecurity'],
  };
  const event = {
    _id: 'ev-2',
    title: 'AI Innovators Sprint',
    category: 'Hackathon',
    tags: ['Python', 'Machine Learning', 'Data Science'],
    registrationDeadline: futureDate(7),
  };

  const res = calculateEventRelevance(event, user);
  assert(
    'Scenario 2: Partial tag overlap yields proportional positive score',
    res.score > 0 &&
    res.signals.matchedTags.includes('machine learning') &&
    res.breakdown.interests.rawScore > 0 &&
    res.breakdown.interests.rawScore <= 1.0,
    `Score: ${res.score}, MatchedTags: ${JSON.stringify(res.signals.matchedTags)}`
  );
}

// ============================================================================
// SCENARIO 3: No matching interests
// ============================================================================
{
  const user = {
    interests: ['Biotechnology', 'Classical Music'],
  };
  const event = {
    _id: 'ev-3',
    title: 'Solidity Smart Contract Workshop',
    category: 'Blockchain',
    tags: ['Web3', 'Ethereum', 'DeFi'],
    registrationDeadline: futureDate(10),
  };

  const res = calculateEventRelevance(event, user);
  assert(
    'Scenario 3: No matching interests results in zero interest score and non-personalized status',
    res.signals.matchedInterests.length === 0 &&
    res.signals.matchedTags.length === 0 &&
    res.breakdown.interests.rawScore === 0 &&
    res.isPersonalized === false &&
    res.matchPercentage === null,
    `isPersonalized: ${res.isPersonalized}, matchPercentage: ${res.matchPercentage}`
  );
}

// ============================================================================
// SCENARIO 4: Missing/empty user profile (cold start)
// ============================================================================
{
  const emptyUser1 = {};
  const emptyUser2 = { interests: [], college: '', bookmarks: [], skills: [] };
  const event = {
    _id: 'ev-4',
    title: 'National Coding Championship',
    category: 'Competitive Programming',
    tags: ['C++', 'Algorithms'],
    registrationDeadline: futureDate(12),
  };

  const res1 = calculateEventRelevance(event, emptyUser1);
  const res2 = calculateEventRelevance(event, emptyUser2);

  assert(
    'Scenario 4: Missing or empty user profile triggers cold start with null matchPercentage',
    res1.isColdStart === true &&
    res1.isPersonalized === false &&
    res1.matchPercentage === null &&
    res1.score === 0 &&
    res2.isColdStart === true &&
    res2.matchPercentage === null &&
    res2.score === 0,
    `res1: ${JSON.stringify(res1.isColdStart)}, res2: ${JSON.stringify(res2.isColdStart)}`
  );
}

// ============================================================================
// SCENARIO 5: Missing event metadata
// ============================================================================
{
  const user = {
    interests: ['Artificial Intelligence'],
    college: 'IIT Delhi',
  };
  const minimalEvent = {
    _id: 'ev-5',
    // Missing title, description, category, tags, college, registrationDeadline
  };

  let threw = false;
  let res = null;
  try {
    res = calculateEventRelevance(minimalEvent, user);
  } catch (err) {
    threw = true;
  }

  assert(
    'Scenario 5: Missing event metadata handled safely without throwing',
    !threw && res !== null && res.isEligible === true && typeof res.score === 'number',
    `Threw: ${threw}, res: ${JSON.stringify(res)}`
  );
}

// ============================================================================
// SCENARIO 6: Case-insensitive matching
// ============================================================================
{
  const user = {
    interests: ['aI & mAcHiNe LeArNiNg', 'wEb DeVeLoPmEnT'],
  };
  const event = {
    _id: 'ev-6',
    title: 'Intro to Modern Web',
    category: 'WEB DEVELOPMENT',
    tags: ['AI & MACHINE LEARNING', 'React'],
    registrationDeadline: futureDate(14),
  };

  const res = calculateEventRelevance(event, user);
  assert(
    'Scenario 6: Mixed and upper-case inputs match normalized categories and tags',
    res.signals.matchedInterests.includes('web development') &&
    res.signals.matchedTags.includes('ai machine learning'),
    `MatchedInterests: ${JSON.stringify(res.signals.matchedInterests)}, MatchedTags: ${JSON.stringify(res.signals.matchedTags)}`
  );
}

// ============================================================================
// SCENARIO 7: Whitespace and duplicate tag normalization
// ============================================================================
{
  const rawTags = ['  React.js  ', 'react.js', '  react.js  ', 'NODE.JS', 'node.js '];
  const normalized = normalizeTagList(rawTags);

  const user = {
    interests: ['  Web   Development  ', 'web development'],
  };
  const event = {
    _id: 'ev-7',
    title: 'Demo Event',
    category: 'Web   Development',
    tags: ['  WEB DEVELOPMENT  ', 'REACT'],
    registrationDeadline: futureDate(4),
  };

  const res = calculateEventRelevance(event, user);

  assert(
    'Scenario 7: Whitespace and duplicate tag normalization removes duplicates and matches cleanly',
    normalized.length === 2 &&
    normalized.includes('react js') &&
    normalized.includes('node js') &&
    res.signals.matchedInterests.includes('web development'),
    `Normalized: ${JSON.stringify(normalized)}, Matched: ${JSON.stringify(res.signals.matchedInterests)}`
  );
}

// ============================================================================
// SCENARIO 8: Deterministic results (identical input => identical output)
// ============================================================================
{
  const user = {
    interests: ['Cloud Computing', 'DevOps'],
    college: 'NIT Trichy',
  };
  const fixedNow = new Date('2026-11-01T10:00:00.000Z');
  const event = {
    _id: 'ev-8',
    title: 'Kubernetes Hands-on Sprint',
    description: 'Learn DevOps and Cloud Computing on AWS',
    category: 'Cloud Computing',
    tags: ['DevOps', 'Docker', 'AWS'],
    college: 'NIT Trichy',
    registrationDeadline: new Date('2026-11-10T18:00:00.000Z'),
  };

  const res1 = calculateEventRelevance(event, user, { now: fixedNow });
  const res2 = calculateEventRelevance(event, user, { now: fixedNow });
  const res3 = calculateEventRelevance(event, user, { now: fixedNow });

  const str1 = JSON.stringify(res1);
  const str2 = JSON.stringify(res2);
  const str3 = JSON.stringify(res3);

  assert(
    'Scenario 8: Scoring produces strictly deterministic results across multiple invocations',
    str1 === str2 && str2 === str3,
    `Run 1 Score: ${res1.score}, Run 2 Score: ${res2.score}, Run 3 Score: ${res3.score}`
  );
}

// ============================================================================
// SCENARIO 9: Score boundaries strictly between 0 and 100
// ============================================================================
{
  const fixedNow = new Date('2026-11-01T10:00:00.000Z');
  const testProfiles = [
    { interests: ['AI', 'ML', 'Web', 'Cloud', 'Design'], college: 'Stanford', skills: ['Python', 'Docker'] },
    { interests: ['Quantum Physics'] },
    {},
    { college: 'Unknown' },
  ];

  const testEvents = [
    {
      _id: 'b-1',
      title: 'Mega Hackathon',
      description: 'AI, ML, Web, Cloud, Design, Python, Docker',
      category: 'AI',
      tags: ['ML', 'Web', 'Cloud', 'Design', 'Python', 'Docker'],
      college: 'Stanford',
      registrationDeadline: new Date('2026-11-02T10:00:00.000Z'), // urgent 24h
    },
    {
      _id: 'b-2',
      title: 'Completely Unrelated Event',
      category: 'Cooking',
      tags: ['Baking'],
      registrationDeadline: new Date('2027-11-01T10:00:00.000Z'),
    },
    {
      _id: 'b-3',
      title: 'Empty Event',
    },
  ];

  let allBounded = true;
  for (const prof of testProfiles) {
    for (const ev of testEvents) {
      const res = calculateEventRelevance(ev, prof, { now: fixedNow, excludeExpired: false });
      if (res.score < 0 || res.score > 100 || !Number.isInteger(res.score)) {
        allBounded = false;
      }
    }
  }

  assert(
    'Scenario 9: All calculated scores are strictly integers between 0 and 100',
    allBounded === true,
    `allBounded: ${allBounded}`
  );
}

// ============================================================================
// SCENARIO 10: Filtering/exclusion of expired events
// ============================================================================
{
  const fixedNow = new Date('2026-11-01T10:00:00.000Z');
  const user = { interests: ['Web Development'] };

  const expiredEvent = {
    _id: 'ev-expired',
    title: 'Past Web Workshop',
    category: 'Web Development',
    registrationDeadline: new Date('2026-10-25T10:00:00.000Z'), // in past
  };

  const activeEvent = {
    _id: 'ev-active',
    title: 'Upcoming Web Summit',
    category: 'Web Development',
    registrationDeadline: new Date('2026-11-15T10:00:00.000Z'), // in future
  };

  const singleExpiredRes = calculateEventRelevance(expiredEvent, user, { now: fixedNow, excludeExpired: true });
  const ranked = rankEventsForUser([expiredEvent, activeEvent], user, { now: fixedNow, excludeExpired: true });

  assert(
    'Scenario 10: Expired events are marked ineligible and excluded from ranking by default',
    singleExpiredRes.isEligible === false &&
    ranked.results.length === 1 &&
    ranked.results[0].eventId === 'ev-active',
    `singleExpired isEligible: ${singleExpiredRes.isEligible}, ranked count: ${ranked.results.length}`
  );
}

// ============================================================================
// SCENARIO 11: Explanations matching actual evidence
// ============================================================================
{
  const user = {
    interests: ['Robotics'],
    college: 'Carnegie Mellon University',
  };
  const event = {
    _id: 'ev-11',
    title: 'Autonomous Drone Challenge',
    category: 'Robotics',
    tags: ['Robotics', 'Embedded'],
    college: 'Carnegie Mellon University',
    registrationDeadline: futureDate(15),
  };

  const res = calculateEventRelevance(event, user);
  const mentionsRobotics = res.explanation.toLowerCase().includes('robotics') ||
    res.reasons.some(r => r.toLowerCase().includes('robotics'));
  const mentionsCollege = res.reasons.some(r => r.toLowerCase().includes('institution') || r.toLowerCase().includes('carnegie'));

  assert(
    'Scenario 11: Recommendation explanation reflects actual evidence (category & college)',
    mentionsRobotics && mentionsCollege,
    `Explanation: "${res.explanation}", Reasons: ${JSON.stringify(res.reasons)}`
  );
}

// ============================================================================
// SCENARIO 12: Cold start without fabricated scores
// ============================================================================
{
  const coldUser = { interests: [] };
  const events = [
    {
      _id: 'ev-c1',
      title: 'Event Closing in 2 days',
      category: 'Design',
      registrationDeadline: futureDate(2),
    },
    {
      _id: 'ev-c2',
      title: 'Event Closing in 10 days',
      category: 'Finance',
      registrationDeadline: futureDate(10),
    },
  ];

  const ranked = rankEventsForUser(events, coldUser);

  const coldStartHonest =
    ranked.isColdStart === true &&
    ranked.results.length === 2 &&
    ranked.results.every(r => r.matchPercentage === null && r.isPersonalized === false && r.score === 0) &&
    ranked.results[0].eventId === 'ev-c1'; // sorted by earlier deadline first

  assert(
    'Scenario 12: Cold start users receive honest null match percentages and deadline-based sorting',
    coldStartHonest === true,
    `isColdStart: ${ranked.isColdStart}, results: ${JSON.stringify(ranked.results.map(r => ({ id: r.eventId, match: r.matchPercentage, score: r.score })))}`
  );
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================
console.log('='.repeat(70));
console.log(`Verification Complete: ${passed} passed, ${failed} failed.`);
console.log('='.repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
