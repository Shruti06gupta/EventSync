# 🎓 EventSync — Intelligent Student Event Discovery Platform

> **Discover. Personalize. Participate. Grow.**

**EventSync** is a full-stack **MERN-based student event discovery and recommendation platform** designed to help students discover hackathons, workshops, conferences, competitions, internships, tech events, and other opportunities from multiple platforms — all in one place.

Instead of manually searching across platforms such as **Unstop** and **Devfolio**, EventSync brings relevant opportunities together, filters them based on user preferences and location, and provides personalized event recommendations.

---

## ✨ Why EventSync?

Students often discover events through multiple disconnected platforms, social media posts, college groups, and websites. This makes it difficult to:

- 🔎 Find relevant events
- 📍 Discover events happening nearby
- ⏰ Track registration deadlines
- 🔖 Save interesting opportunities
- 🤖 Find events that match personal interests
- 🔔 Remember upcoming deadlines
- 📊 Track participation and engagement

**EventSync solves this by providing a centralized, intelligent event discovery experience.**

---

# 🚀 Key Features

## 🔐 Authentication & Authorization

EventSync provides secure authentication and role-based access.

### User Authentication

- User registration and login
- JWT-based authentication
- HTTP-only cookie-based token storage
- Password hashing using bcrypt
- Protected routes
- Authentication persistence
- Logout functionality
- Role-based access control

### Roles

**👤 Student/User**
- Discover events
- Search and filter events
- Bookmark events
- Receive notifications
- Set reminders
- Get personalized recommendations
- Track activity

**🛡️ Admin**
- Access admin dashboard
- Create and manage events
- Monitor event data
- View analytics and reports
- Manage event synchronization
- Monitor platform activity

---

# 📅 Event Discovery

EventSync provides a centralized event discovery system.

Users can browse events collected from different sources and manually created events.

### Event information includes:

- Event title
- Description
- Category
- Organizer
- Venue
- Location
- Event mode
- Registration deadline
- Event date
- Registration link
- Source/platform
- Verification status
- Distance from user's selected location

---

# 🔎 Smart Event Search & Filtering

Users can quickly narrow down events using multiple filters.

### Search

Search events based on:

- Event title
- Keywords
- Categories
- Locations
- Other event attributes

### Filters

Users can filter events based on:

- 📂 Category
- 📍 Location
- 🌐 Event mode
- 📅 Registration deadline
- 🔗 Event source
- Other available event attributes

---

# 📍 Location-Based Event Discovery

One of EventSync's major features is **geospatial event discovery**.

Users can search for events within a selected radius of a location.

### Example

> Search for events within **100 km of Chandigarh**

EventSync:

1. Resolves the selected location
2. Converts it into geographic coordinates
3. Performs a MongoDB geospatial search
4. Applies the requested radius
5. Sorts results by distance
6. Displays the nearest events first

### Supported location workflows

- Search using a location name
- Use the browser's current location
- Select a radius
- Clear location filtering
- Preserve location filtering during pagination

### Geospatial implementation

EventSync uses:

- GeoJSON `Point`
- MongoDB `2dsphere` index
- MongoDB `$near`
- `$maxDistance`

Coordinates are stored using the GeoJSON convention:

```text
[longitude, latitude]
```

### Example

For Chandigarh:

```text
Chandigarh
    ↓
Geocoding
    ↓
30.7334421, 76.7797143
    ↓
MongoDB $near
    ↓
100 km radius
    ↓
Nearest events first
```

---

# 🗺️ Intelligent Geocoding & Coordinate Validation

Event data obtained from external sources does not always contain usable geographic coordinates.

EventSync therefore includes a geocoding pipeline that:

- Converts venue/location text into coordinates
- Uses progressive fallback queries when an exact address cannot be resolved
- Avoids geocoding generic values such as:
  - `offline`
  - `online`
  - `hybrid`
  - `TBD`
  - `TBA`
- Preserves real addresses containing words such as `India`
- Validates coordinates against the region mentioned in the venue
- Stores valid GeoJSON coordinates
- Keeps failed events retryable

### Progressive fallback

For example:

```text
Full venue address
        ↓
Simplified venue
        ↓
City / locality
        ↓
Valid city-level coordinates
```

This prevents highly specific addresses from causing an otherwise valid event to become unsearchable.

---

# 🤖 Personalized Event Recommendations

EventSync also provides a **personalized recommendation system** to help users discover events that are relevant to them instead of browsing the entire event catalog.

Recommendations can consider factors such as:

- User interests
- Preferred categories
- Previous event interactions
- Bookmarked events
- Event categories
- Location
- Event mode
- Upcoming deadlines
- Event relevance

### Recommendation experience

Instead of simply displaying:

> "Latest Events"

EventSync can surface:

> **✨ Recommended for You**

with events that are more relevant to the individual user.

---

## 🧠 AI-Assisted Recommendations

EventSync includes AI capabilities through the **Google Gemini API** integration.

The recommendation layer can use AI to understand event information and improve relevance beyond simple keyword matching.

The architecture allows the system to combine:

```text
User Preferences
       +
Event Metadata
       +
User Activity
       +
Location
       +
AI Understanding
       ↓
Personalized Recommendations
```

This makes recommendations more context-aware and useful for students.

---

# 🔖 Bookmark Events

Users can save events that they are interested in.

### Bookmark functionality

- Bookmark an event
- Remove a bookmark
- View saved events
- Receive notifications related to bookmarked events
- Use bookmarked activity as an input for personalization

This makes it easier to maintain a personal list of opportunities.

---

# 🔔 Notifications

EventSync provides an in-app notification system to keep users informed.

Notifications can be generated for events such as:

- 🔖 Bookmark activity
- ⏰ Upcoming deadlines
- 📅 Event reminders
- 🎯 Relevant event updates
- Other important platform events

Notifications can be viewed from the application notification interface.

---

# ⏰ Event Reminders

Users can keep track of important event deadlines and upcoming opportunities.

The backend includes scheduled processing that supports automated event-related tasks.

This helps reduce the chance of students missing:

- Registration deadlines
- Upcoming events
- Important event updates

---

# 🔄 Event Synchronization

EventSync is designed to aggregate events from multiple external platforms.

Currently discussed integrations include:

- **Unstop**
- **Devfolio**

The synchronization system helps bring events from different sources into a common EventSync data model.

### Synchronization flow

```text
External Platforms
      │
      ├── Unstop
      │
      └── Devfolio
             │
             ▼
      Event Synchronization
             │
             ▼
       Data Processing
             │
             ▼
       Event Validation
             │
             ▼
        MongoDB
             │
             ▼
        EventSync UI
```

This creates a single discovery layer over multiple event sources.

---

# 🛡️ Event Verification

Events can be marked as verified before being displayed as trusted opportunities.

The system supports filtering based on verification status so that the discovery experience can prioritize valid event records.

---

# 👨‍💼 Admin Dashboard

EventSync includes a dedicated administration experience.

### Admin features include:

- 📊 KPI overview
- 📅 Event management
- ➕ Create events
- ✏️ Edit events
- 🗑️ Manage events
- 📈 Reports and analytics
- 🔄 Monitor event synchronization
- 🔔 Admin notifications
- 👥 Administrative controls

---

# 📊 Admin Analytics & Reports

The admin dashboard provides visibility into platform activity.

Potential metrics include:

- Total events
- Verified events
- Event categories
- User activity
- Bookmarks
- Recommendations
- Event sources
- Synchronization activity
- Other platform KPIs

The reporting interface helps administrators understand how EventSync is being used.

---

# 🏆 Gamification

EventSync includes a gamification layer designed to encourage students to actively explore opportunities.

The UI supports concepts such as:

- 🏆 Progress
- 🎯 Participation
- ⭐ Achievements
- 🔥 Activity
- Event discovery milestones

Gamification encourages users to interact more consistently with the platform.

---

# 🌐 Event Modes

EventSync supports different event formats, including:

### 🏢 Offline

Physical events that have a geographic location.

### 💻 Online

Virtual events that do not require geographic coordinates.

### 🔀 Hybrid

Events that combine physical and virtual participation.

Geospatial filtering is applied only when meaningful geographic coordinates are available.

---

# 📄 Event Management

Administrators can manage event records through the platform.

Supported operations include:

- Create
- Read
- Update
- Delete
- Verify
- Categorize
- Assign location
- Manage deadlines
- Manage registration information

Manually created events can also be assigned geographic coordinates for radius-based discovery.

---

# ⏱️ Automated Background Jobs

The backend uses scheduled jobs to automate recurring operations.

Powered by:

```text
node-cron
```

These jobs can support tasks such as:

- Deadline-related processing
- Event maintenance
- Notification generation
- Synchronization workflows
- Cleanup operations

---

# 📱 Responsive User Experience

The frontend is designed as a modern responsive web application.

Major UI areas include:

- Dashboard
- Event discovery
- Event cards
- Event details
- Bookmarks
- Notifications
- Recommendations
- Admin dashboard
- Analytics
- Reports

---

# 🏗️ System Architecture

```text
                       ┌─────────────────────┐
                       │      Students       │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   React Frontend    │
                       │       + Vite        │
                       └──────────┬──────────┘
                                  │
                              REST API
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   Express Backend   │
                       │      + Node.js      │
                       └──────────┬──────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             │                    │                    │
             ▼                    ▼                    ▼
      ┌─────────────┐      ┌──────────────┐     ┌─────────────┐
      │  MongoDB    │      │ Gemini / AI   │     │ Cron Jobs   │
      │   Atlas     │      │   Services    │     │             │
      └─────────────┘      └──────────────┘     └─────────────┘
             │
             ▼
      ┌──────────────────────┐
      │ Event / User Data    │
      │ Notifications        │
      │ Bookmarks            │
      │ Reminders            │
      │ Sync Logs            │
      └──────────────────────┘

External Sources
      │
      ├── Unstop
      └── Devfolio
             │
             ▼
      Event Synchronization
             │
             ▼
          MongoDB
```

---

# 🛠️ Tech Stack

## Frontend

| Technology | Purpose |
|---|---|
| ⚛️ React 18 | User interface |
| ⚡ Vite | Development/build tooling |
| 🧭 React Router DOM | Client-side routing |
| 🎨 Tailwind CSS | Styling |
| 📡 Axios | API communication |

## Backend

| Technology | Purpose |
|---|---|
| 🟢 Node.js | Runtime |
| 🚂 Express.js | REST API |
| 🍃 Mongoose | MongoDB ODM |
| 🔐 JWT | Authentication |
| 🔒 bcrypt | Password hashing |
| ⏰ node-cron | Scheduled jobs |
| 📧 Nodemailer | Email functionality |
| 📄 PDFKit | PDF/report generation |
| 🤖 Google Gemini API | AI capabilities |

## Database

```text
MongoDB Atlas
      +
Mongoose
      +
2dsphere Geospatial Index
```

### Core models

- `User`
- `Event`
- `Notification`
- `ReminderLog`
- `SyncLog`

---

# 🔐 Security

EventSync follows several security practices:

- JWT authentication
- HTTP-only cookies
- Password hashing with bcrypt
- Protected backend routes
- Role-based authorization
- Environment-based secret configuration
- Server-side validation
- Authentication-protected event APIs

Sensitive credentials should never be committed to the repository.

---

# 📂 Project Structure

```text
EventSync/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── scripts/
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── .gitignore
└── README.md
```

---

# ⚙️ Getting Started

## Prerequisites

Make sure you have installed:

- Node.js
- npm
- MongoDB Atlas account or MongoDB instance
- Git

Optional integrations:

- Google Gemini API key
- SMTP/Gmail credentials
- External event source credentials/configuration

---

## 1. Clone the Repository

```bash
git clone https://github.com/Shruti06gupta/EventSync.git

cd EventSync
```

---

# 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5000

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

GEMINI_API_KEY=your_gemini_api_key

EMAIL_USER=your_email
EMAIL_PASSWORD=your_email_password
```

> Use the environment variables expected by the current backend configuration. Never commit `.env` files or API keys.

Start the backend:

```bash
npm start
```

or, if a development script is configured:

```bash
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

# 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will normally be available at:

```text
http://localhost:5173
```

---

# 🔄 Typical User Flow

```text
Register / Login
       ↓
   Dashboard
       ↓
Discover Events
       ↓
 ┌─────┼──────────────┐
 ↓     ↓              ↓
Search Filter     Recommendations
 ↓     ↓              ↓
 └─────┼──────────────┘
       ↓
   Event Details
       ↓
 ┌─────┼───────────────┐
 ↓     ↓               ↓
Bookmark Reminder   Register
       ↓
 Notifications
```

---

# 📍 Example: Location Search Flow

```text
User enters:
"Chandigarh"

        ↓

Frontend sends:
locationName=Chandigarh
radiusKm=100

        ↓

Backend geocodes location

        ↓

Chandigarh:
[76.7797143, 30.7334421]

        ↓

MongoDB $near query

        ↓

$maxDistance = 100 km

        ↓

Distance calculation

        ↓

Nearest events first
```

Example results:

```text
Innosprint2.0     0.00 km
Srijan Setu      19.13 km
BIOS V2          71.94 km
```

---

# 🤖 Recommendation Flow

```text
                 User Activity
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   Interests      Bookmarks     Preferences
        │             │             │
        └─────────────┼─────────────┘
                      ▼
              Recommendation
                  Engine
                      │
              ┌───────┴───────┐
              │               │
        Event Metadata     Location
              │               │
              └───────┬───────┘
                      ▼
               AI / Ranking
                      │
                      ▼
             Recommended Events
```

---

# 📈 Data Flow

```text
External Event Sources
        │
        ▼
Synchronization Layer
        │
        ▼
Validation / Processing
        │
        ▼
MongoDB
        │
        ├───────────────┐
        │               │
        ▼               ▼
 Search / Filters   Recommendation
        │               │
        └───────┬───────┘
                ▼
           React UI
```

---

# 🧪 Testing & Verification

Important functionality can be tested through:

### Authentication

- Registration
- Login
- Logout
- Protected routes
- Role-based access

### Event Discovery

- Search
- Category filtering
- Location filtering
- Pagination
- Event details

### Geospatial Search

Example:

```text
Chandigarh + 100 km
```

Expected nearby events should be returned and sorted by distance.

### Recommendation System

Verify that:

- Relevant events are recommended
- User preferences affect recommendations
- Bookmarked/activity data can influence personalization

### Admin

Verify:

- Event creation
- Event editing
- Event management
- Analytics
- Reports
- Administrative access control

---

# 📊 Current Geospatial Data Strategy

EventSync stores physical event locations as GeoJSON:

```javascript
{
  type: "Point",
  coordinates: [longitude, latitude]
}
```

A MongoDB geospatial index is used:

```javascript
location: "2dsphere"
```

Radius searches use:

```javascript
$near
```

with:

```javascript
$maxDistance
```

This provides:

- Radius filtering
- Nearest-first ordering
- Efficient geographic queries

Online events without geographic coordinates are naturally excluded from geographic-radius searches.

---

# 🧠 Engineering Highlights

EventSync demonstrates several real-world software engineering concepts:

### Full-Stack Development

- React frontend
- Node.js backend
- Express REST APIs
- MongoDB database

### Authentication

- JWT
- HTTP-only cookies
- bcrypt
- Protected routes
- RBAC

### Data Engineering

- External event aggregation
- Data normalization
- Event validation
- Geocoding
- Coordinate validation
- Background processing

### Search

- Keyword search
- Filtering
- Pagination
- Geospatial search

### AI

- Gemini API integration
- Personalized event recommendations
- AI-assisted relevance

### Automation

- Scheduled jobs
- Deadline processing
- Notifications
- Event synchronization

### Analytics

- Admin KPIs
- Event statistics
- Reports
- Synchronization logs

---

# 🚧 Future Enhancements

Potential future improvements include:

- 🧠 More advanced hybrid recommendation algorithms
- 📍 Interactive map-based event discovery
- 🗺️ Route/distance visualization
- 🔔 Push notifications
- 📱 Progressive Web App support
- 📊 More advanced analytics
- 🤖 Improved AI recommendation explanations
- 🎯 User preference learning
- 🔄 More event-source integrations
- 📅 Calendar integration
- 🏆 Expanded gamification and achievement system
- ⚡ Real-time event updates

---

# 👥 Team

**EventSync** was developed as a collaborative student project focused on solving the problem of fragmented event discovery.

### Contributors

- Shruti Gupta
- Vani Gupta
- Team members and project contributors

---

# 📌 Project Highlights

### EventSync combines:

```text
MERN
  +
Authentication
  +
Event Aggregation
  +
Geospatial Search
  +
AI Recommendations
  +
Notifications
  +
Bookmarks
  +
Reminders
  +
Gamification
  +
Admin Analytics
```

into a single student-focused event discovery platform.

---

# 🌟 What Makes EventSync Different?

Traditional event platforms generally require students to search for opportunities individually.

EventSync instead creates a **personalized event discovery ecosystem**:

> **Find events → Filter what matters → Discover nearby opportunities → Get personalized recommendations → Save them → Track deadlines → Participate**

The goal is simple:

### **Spend less time searching. Spend more time participating. 🚀**

---

## 📄 License

This project is developed for educational and project purposes.

See the repository license for applicable terms.

---

## ⭐ Support the Project

If you find EventSync useful or interesting:

- ⭐ Star the repository
- 🍴 Fork the project
- 🐛 Report issues
- 💡 Suggest improvements
- 🤝 Contribute to the project

**Built with ❤️ using the MERN stack.**