# EventSync Recommendations — Architecture & Technical Reference

This document provides a comprehensive technical reference for the AI-powered recommendation system implemented in EventSync.

---

## 1. System Architecture

The recommendation feature provides personalized and categorized event discovery across five distinct perspectives.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Frontend (React / Vite)                       │
│                                                                        │
│  [ Navbar ] ────> [/recommendations]                                   │
│                         │                                              │
│         ┌───────────────┴─────────────────┐                            │
│         ▼                                 ▼                            │
│  [ Category Tabs (5) ]             [ AI Insights & Preferences Sidebar ] │
│  - For You                         - Dynamic Factor Breakdown         │
│  - Trending                        - Active Profile Preferences        │
│  - Similar to Your Interests       - Evidence-based Context           │
│  - Nearby Events                   - Quick Navigation Links           │
│  - Saved Recommendations                                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP (Axios)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend (Express / Node.js)                     │
│                                                                        │
│  Router:       GET /api/events/recommended                             │
│  Auth:         protectRoute Middleware (JWT Verification)              │
│  Controller:   recommendationsController.js (Validation & Gateway)     │
│  Services:     recommendationService.js                                │
│                └── recommendationScoringService.js (Deterministic Engine)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Mongoose (Queries & Aggregations)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          MongoDB Database                              │
│                                                                        │
│  Collections:                                                          │
│  - events: Verified, active upcoming hackathons & workshops            │
│  - users:  Interests, bookmarks, college affiliation, profile          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Five Recommendation Categories

### 1. For You (`type=for-you`)
- **Purpose**: Fully personalized recommendations matching the student's unique profile.
- **Signals**:
  - Exact category matching & partial tag overlap.
  - Topics extracted from previously bookmarked events.
  - College affiliation (boosts on-campus hackathons and campus club events).
  - Approach of registration deadlines (urgent opportunities prioritized).
  - Publishing recency (recent events boosted).
- **Cold-Start Handling**: If the student hasn't configured interests or saved bookmarks, the engine displays upcoming verified events sorted by deadline with an honest notice encouraging profile completion, rather than fabricating fake match percentages.

### 2. Trending (`type=trending`)
- **Purpose**: Community momentum discovery highlighting events capturing student interest across the platform.
- **Scoring Formula**:
  $$\text{trendingScore} = (\text{bookmarkCount} \times 10) + \text{urgencyBonus} + \text{recencyBonus}$$
  - $\text{bookmarkCount}$: Unique student saves aggregated from `User.bookmarks` using MongoDB `$setUnion` to ensure repeated saves by the same student cannot inflate popularity.
  - $\text{urgencyBonus}$: $+5$ for closing in $\le 3$ days, $+3$ for $\le 7$ days, $+1$ for $\le 14$ days.
  - $\text{recencyBonus}$: $+2$ for events published within the last 7 days.
- **Fallback**: When engagement data is cold (0 saves), events are sorted transparently by registration deadline without fabricating popularity metrics.

### 3. Similar to Your Interests (`type=similar`)
- **Purpose**: Dedicated topical discovery allowing exploration of specific interest fields.
- **Features**:
  - **All Interests view (`interest=all`)**: Combines and ranks opportunities across all of the student's profile topics.
  - **Topic-specific view (`interest=<topic>`)**: Deep dives into a selected interest (e.g. `Web Development`, `Machine Learning`).
  - **Manual keyword exploration**: Allows students (even cold-start profiles) to search any topic on the fly using an inline topic search input.

### 4. Nearby Events (`type=nearby`)
- **Purpose**: Geographic discovery of in-person and hybrid hackathons, workshops, and meetups.
- **Rules & Constraints**:
  - Strictly excludes online events (`mode: { $in: ['Offline', 'Hybrid'] }`).
  - Requires valid coordinate pairs (`latitude: [-90, 90]`, `longitude: [-180, 180]`).
  - Calculates physical distance using the spherical Haversine formula from `event.location.coordinates` (`[longitude, latitude]`).
  - Supports configurable radius boundaries (10 km, 25 km, 50 km, 100 km, 250 km).
  - Falls back to textual venue and college matching if coordinates are not supplied.

### 5. Saved Recommendations (`/user/bookmarks`)
- **Purpose**: Instant access to bookmarked opportunities from discovery feeds.
- **Integration**:
  - Leverages existing `User.bookmarks` persistence (`GET /api/user/bookmarks`).
  - Seamlessly updates the local UI immediately when unbookmarking without requiring a full page refresh.

---

## 3. Scoring Formula & Deterministic Engine

The scoring engine (`recommendationScoringService.js`) calculates a normalized relevance score between 0 and 100 using active weighted signals:

$$\text{Weighted Score} = \frac{\sum (\text{weight}_i \times \text{rawScore}_i)}{\sum \text{weight}_i} \times 100$$

### Default Signal Weights (For You)
| Signal Name | Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **Technical Interests** | 40 | Category exact match ($1.0$), tag overlap ratio ($0.2\text{--}0.85$), title/description keyword match ($0.3\text{--}0.6$). |
| **College Affiliation** | 20 | Matches user's registered college ($1.0$). |
| **Saved Topic History** | 20 | Matches categories or tags of events previously bookmarked by the user ($0.5\text{--}1.0$). |
| **Registration Urgency**| 10 | Closes in $\le 24$ hours ($1.0$), $\le 3$ days ($0.85$), $\le 7$ days ($0.65$), $\le 14$ days ($0.45$). |
| **Content Recency**     | 10 | Created $\le 3$ days ago ($1.0$), $\le 7$ days ago ($0.8$), $\le 14$ days ago ($0.5$). |

### Tie-Breaking & Determinism
All sorting operations implement strict three-tier deterministic tie-breaking:
1. Primary: Calculated relevance score (descending).
2. Secondary: Registration deadline (earliest closing first).
3. Tertiary: Unique `eventId.localeCompare` ensuring identical ordering across runs.

---

## 4. Haversine Distance Formula

Geographic distance between user coordinates $(lat_1, lon_1)$ and event coordinates $(lat_2, lon_2)$ is computed via:

$$d = 2 R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta lat}{2}\right) + \cos(lat_1) \cos(lat_2) \sin^2\left(\frac{\Delta lon}{2}\right)}\right)$$

Where $R = 6371\text{ km}$ (Earth mean radius).

MongoDB GeoJSON coordinates are formatted as `[longitude, latitude]`, mapped accurately as:
`calculateHaversineKm(userLat, userLon, event.location.coordinates[1], event.location.coordinates[0])`.

---

## 5. Backend API Reference

### `GET /api/events/recommended`
Authenticated endpoint (requires `jwt` cookie or `Authorization: Bearer <token>`).

#### Query Parameters:
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | `for-you` | One of `for-you`, `trending`, `similar`, `nearby`. |
| `page` | integer | `1` | Pagination page number ($\ge 1$). |
| `limit` | integer | `12` | Events per page ($1\text{--}100$). |
| `interest` | string | `null` | Target topic for `type=similar` (or `'all'`). |
| `latitude` | number | `null` | User latitude ($-90$ to $90$). |
| `longitude` | number | `null` | User longitude ($-180$ to $180$). |
| `radiusKm` | number | `100` | Search radius in km ($1\text{--}5000$). |
| `locationName` | string | `null` | Textual location/venue search query. |

#### Sample Response:
```json
{
  "success": true,
  "message": "Recommendations fetched successfully",
  "type": "for-you",
  "recommendations": [
    {
      "eventId": "65b...",
      "score": 88,
      "matchPercentage": 88,
      "isPersonalized": true,
      "isColdStart": false,
      "explanation": "Matches your Web Development interest. Hosted by Delhi Technological University.",
      "event": {
        "_id": "65b...",
        "title": "Fullstack Hackathon 2026",
        "category": "Web Development",
        "mode": "Hybrid",
        "college": "Delhi Technological University"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "totalEvents": 42,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "isColdStart": false
}
```

---

## 6. How to Run Verification & Tests

### Backend Test Suites:
Run from `EventSync/backend`:
```bash
# 1. Verify deterministic recommendation scoring algorithm (12 tests)
npm run verify:recommendation-scoring

# 2. Verify recommendation backend API and category dispatching (20 tests)
npm run verify:recommendation-api

# 3. Verify Step 8 QA edge cases, security, tie-breaking, and deduplication (8 tests)
npm run verify:step8-qa
```

### Frontend Production Build:
Run from `EventSync/frontend`:
```bash
npm run build
```
*(On Windows systems with file locks, set a local temporary directory: `$env:TEMP = "$pwd/esbuild_temp"; npm run build`)*
