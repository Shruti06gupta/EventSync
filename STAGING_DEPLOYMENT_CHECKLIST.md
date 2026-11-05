# EventSync Staging Deployment Plan & Checklist

**Document Version:** 1.2.0 (Audited, Code-Verified & Final)
**Target Environment:** Staging
**Application:** EventSync (Full-Stack Campus Event & Hackathon Aggregator)
**Date:** November 2026
**Auditor / Author:** DeepMind Advanced Agentic Coding Pair

---

## Executive Overview

This staging deployment plan provides the complete technical specification, infrastructure requirements, configuration matrices, security policies, and operational runbooks necessary to deploy EventSync into a staging environment.

Staging serves as an exact pre-production mirror to validate:
- Production HTTPS and cross-subdomain cookie persistence.
- Multi-tier deployment (SPA frontend on CDN/static host + Express API on managed runtime).
- Isolated staging MongoDB Atlas instance with dedicated credentials.
- Controlled SMTP sandbox validation (Mailtrap) with zero risk of contacting real users.
- Protected aggregation subsystems without unmocked third-party traffic.

---

## 1. Frontend Hosting (React / Vite SPA)

### 1.1 Production Build Command
- **Command:**
  ```bash
  cd frontend && npm ci && npm run build
  ```
- **Build Output Directory:** `frontend/dist/`
- **Output Artifacts:**
  - `dist/index.html` (~1.0 kB)
  - `dist/assets/index-[hash].js` (~632 kB, gzip: ~175 kB)
  - `dist/assets/index-[hash].css` (~60 kB, gzip: ~10 kB)

### 1.2 Hosting Architecture Requirements
- **Hosting Model:** Static web hosting / Content Delivery Network (CDN)
- **Supported Providers:** Cloudflare Pages, AWS S3 + CloudFront, Vercel, Netlify, Render Static Site, or Nginx.
- **Node.js Build Environment:** Node.js 20 LTS or Node.js 22 LTS.

### 1.3 SPA Fallback Routing Configuration
Because EventSync uses client-side routing (`react-router-dom`), browser requests for direct deep links (e.g., `/admin`, `/events`, `/profile`, `/bookmarks`, `/login`) must be served the entrypoint `index.html` with an HTTP 200 response rather than an HTTP 404.

#### Provider Configurations:
- **Nginx:**
  ```nginx
  server {
      listen 443 ssl http2;
      server_name staging.eventsync.example.com;
      root /var/www/eventsync/frontend/dist;
      index index.html;

      # Cache immutable hashed assets
      location /assets/ {
          expires 1y;
          add_header Cache-Control "public, max-age=31536000, immutable";
      }

      # SPA fallback for all routes including /admin, /events, /profile
      location / {
          try_files $uri $uri/ /index.html;
          add_header Cache-Control "no-cache, no-store, must-revalidate";
      }
  }
  ```
- **Cloudflare Pages / Netlify (`_redirects`):**
  ```text
  /*    /index.html   200
  ```
- **Vercel (`vercel.json`):**
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
  }
  ```

### 1.4 Frontend Environment Variables
Vite bundles environment variables with prefix `VITE_` **at build time** into the static JavaScript files.

| Variable Name | Staging Requirement | Notes |
|---|---|---|
| `VITE_API_URL` | `https://staging-api.eventsync.example.com` | Base URL of the staging backend API. If frontend and backend are reverse-proxied under the same origin (e.g. `/api`), leave empty. |

> [!IMPORTANT]
> Because `VITE_API_URL` is baked into the JavaScript bundle during `npm run build`, you must define `VITE_API_URL` in the CI/CD pipeline environment **before** executing `npm run build`. Changing it later requires rebuilding the frontend.

### 1.5 Cache Control & Static Asset Handling
- `index.html`: Must be served with `Cache-Control: no-cache, no-store, must-revalidate` so clients immediately receive updated script hashes upon new deployments.
- `assets/*.js`, `assets/*.css`: Serve with `Cache-Control: public, max-age=31536000, immutable` for maximal CDN caching performance.

---

## 2. Backend Hosting (Node.js / Express API)

### 2.1 Runtime Requirements
- **Engine:** Node.js $\ge 18.17.0$ (Node.js 20 LTS or Node.js 22 LTS recommended).
- **Process Manager:** PM2, Docker container runtime, AWS ECS, or Render Web Service.

### 2.2 Installation & Production Start Commands
- **Clean Dependency Installation:**
  ```bash
  cd backend && npm ci --omit=dev
  ```
  *(Note: `--omit=dev` ensures `nodemon`, `supertest`, and dev dependencies are excluded from production containers).*
- **Start Command (Direct):**
  ```bash
  node src/server.js
  ```
- **Start Command (PM2 Production Cluster):**
  ```bash
  pm2 start src/server.js --name "eventsync-backend" -i 1 --max-memory-restart 500M
  ```
  *(Note: Run a single instance `-i 1` in staging to ensure in-process `node-cron` schedulers do not run concurrently).*

### 2.3 Port Configuration
- Specified via `process.env.PORT` (defaults to `5000` if omitted).
- Staging container/PaaS platforms automatically inject `PORT`.

### 2.4 Health-Check Endpoint Implementation
- **Route:** `GET /health`
- **Expected Status Code:** `200 OK`
- **Actual Response Payload (from `backend/src/app.js`):**
  ```json
  {
    "message": "EventSync API is running"
  }
  ```
  *(Note: The implementation returns `message: 'EventSync API is running'`. It does not return `status: 'ok'` or uptime metrics).*
- Configure load balancers or cloud platform uptime probes to verify HTTP 200 on `/health`.

### 2.5 CORS and Allowed Origins
The staging backend inspects `process.env.CLIENT_URL` to configure whitelist origins:
- **Environment Variable:** `CLIENT_URL=https://staging.eventsync.example.com`
- Supports comma-separated origins if multiple staging previews are needed:
  `CLIENT_URL=https://staging.eventsync.example.com,https://staging-preview.eventsync.example.com`
- **CORS Credentials:** Enabled (`credentials: true`).
- **Allowed Headers:** `Content-Type, Authorization, X-Requested-With`.
- **Blocked Behavior:** In `NODE_ENV=production` or staging, any unlisted origin triggers an immediate CORS rejection: `CORS blocked for origin: <origin>`.

### 2.6 Logging & Graceful Shutdown
- **Logger:** Winston structured logger with automatic redaction of sensitive fields (`password`, `confirmPassword`, `token`, `accessToken`, `refreshToken`, `authorization`, `cookie`).
- **File Transports:** In `NODE_ENV=production`, error logs are written to `logs/error.log` and combined logs to `logs/combined.log`.
- **Graceful Shutdown:**
  - Listens for `SIGTERM` and `SIGINT`.
  - Closes idle keep-alive connections via `server.closeIdleConnections()`.
  - Allows in-flight requests up to 10 seconds to finish before invoking `process.exit(0)`.
  - Disconnects Mongoose connection cleanly via `mongoose.connection.close(false)`.

---

## 3. MongoDB Staging Database Architecture & Safety

### 3.1 Strict Database Separation
To ensure staging operations can never corrupt or alter production data:
1. **Dedicated Database Name:** The staging database MUST be named `eventsync_staging`.
2. **Dedicated Atlas Database User:** Provision a distinct MongoDB Atlas database user (e.g., `eventsync_staging_user`) whose role-based permissions are strictly scoped to `eventsync_staging` (readWrite). The user must have **zero privileges** on the `eventsync` production database.
3. **Database Segment Validation:** The `MONGO_URI` connection string must explicitly target the staging database:
   `mongodb+srv://eventsync_staging_user:<PASSWORD>@cluster0.mongodb.net/eventsync_staging?retryWrites=true&w=majority`
4. **Startup Verification:** `backend/src/config/db.js` logs the active database name on startup:
   `MongoDB connected successfully to eventsync_staging`. Confirm this log line during staging boot.

### 3.2 Database Indexes & Initialization
EventSync defines the following mission-critical indexes across its models. They must be validated upon initial database connection:

| Model | Index Definition | Options | Purpose |
|---|---|---|---|
| **User** | `{ email: 1 }` | `{ unique: true }` | Fast user lookup & unique email constraint |
| **Event** | `{ isVerified: 1, registrationDeadline: 1 }` | Default | Optimized event discovery queries |
| **Event** | `{ college: 1, category: 1 }` | Default | Compound filtering by institution and domain |
| **Event** | `{ location: '2dsphere' }` | `{ sparse: true }` | Geospatial queries for local campus events |
| **Notification** | `{ user: 1, createdAt: -1 }` | Default | Student notification feed sorted chronologically |
| **Notification** | `{ user: 1, read: 1, createdAt: -1 }` | Default | Filter unread notifications |
| **ReminderLog** | `{ user: 1, event: 1, stage: 1 }` | `{ unique: true }` | **Duplicate email prevention constraint** |

*Index Build Strategy:*
Verify that Mongoose builds indexes on initialization or execute an index synchronization check via mongo shell:
```javascript
use eventsync_staging;
db.users.createIndex({ email: 1 }, { unique: true });
db.events.createIndex({ isVerified: 1, registrationDeadline: 1 });
db.events.createIndex({ college: 1, category: 1 });
db.events.createIndex({ location: "2dsphere" }, { sparse: true });
db.notifications.createIndex({ user: 1, createdAt: -1 });
db.notifications.createIndex({ user: 1, read: 1, createdAt: -1 });
db.reminderlogs.createIndex({ user: 1, event: 1, stage: 1 }, { unique: true });
```

### 3.3 Database Seeding Safety: Prohibiting `seedEvents.js`
> [!CAUTION]
> **DO NOT RUN `backend/src/seeders/seedEvents.js` AGAINST STAGING OR PRODUCTION.**
> In [`backend/src/seeders/seedEvents.js`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/seeders/seedEvents.js#L11), the script executes:
> `await Event.deleteMany({});`
> It has **no database name guard** and will unconditionally wipe all events in the connected database.
> **Recommended Alternative:**
> - Create staging test events safely via the authenticated Admin UI (`/admin`), OR
> - Use a verified non-destructive seeder that performs upserts (`findOneAndUpdate`) without dropping existing records.

### 3.4 Backup & Recovery
- Enable MongoDB Atlas automated daily backups with 7-day retention for the staging cluster.
- Maintain an on-demand snapshot policy before executing any destructive test workflows or migration rehearsals.

---

## 4. Authentication, Cookies & Domain Configuration

### 4.1 JWT & Cookie Specifications
EventSync employs dual-token authentication via HTTP-only cookies:
- **Access Token:** Short-lived JWT signed by `JWT_ACCESS_SECRET` (15-minute expiration).
- **Refresh Token:** Long-lived JWT signed by `JWT_REFRESH_SECRET` (7-day expiration).
- **Refresh Flow:** When an access token expires, the client API interceptor (`frontend/src/api.js`) automatically exchanges the HTTP-only refresh cookie via `POST /auth/refresh-token` without user disruption.

### 4.2 Domain Architecture: Cross-Origin vs. Cross-Site Analysis
To configure cookies and CORS securely and reliably, understand the browser distinction between **Origin** and **Site**:
- **Origin (Scheme + Hostname + Port):**
  - Frontend: `https://staging.eventsync.example.com`
  - Backend: `https://staging-api.eventsync.example.com`
  - Because the hostnames differ, API calls from frontend to backend are **cross-origin** and require CORS preflight headers (`Access-Control-Allow-Origin: https://staging.eventsync.example.com` and `Access-Control-Allow-Credentials: true`).
- **Site (eTLD+1):**
  - The registrable parent domain is `eventsync.example.com`.
  - Because both subdomains share the exact same eTLD+1 (`eventsync.example.com`), requests between them are **SAME-SITE** (specifically, **Same-Site Cross-Origin**).
- **Cross-Site Context:**
  - Only occurs when the eTLD+1 differs (e.g. `eventsync-staging.vercel.app` vs `eventsync-api.onrender.com`).
  - Genuinely cross-site setups force cookies to be treated as third-party, which modern privacy features (Chrome Privacy Sandbox, Safari ITP, Firefox ETP) block by default.

> [!TIP]
> **Recommended Staging Architecture (Same-Site Subdomains):**
> Provision both tiers under the same parent domain:
> - Frontend: `https://staging.eventsync.example.com`
> - Backend: `https://staging-api.eventsync.example.com`
>
> Because this relationship is **same-site**, you do **not** automatically need `SameSite=None` third-party cookies. Standard `SameSite=Lax` cookies over HTTPS are transmitted reliably on same-site credentialed requests while offering strict defense against CSRF.

### 4.3 Cookie Security Configuration (HTTPS)
In `backend/src/controllers/authController.js`, cookie flags are resolved at runtime:

```javascript
const sameSiteOption = process.env.COOKIE_SAME_SITE || (
  process.env.NODE_ENV === 'production'
    ? (process.env.CROSS_SITE_COOKIES === 'true' ? 'none' : 'strict')
    : 'lax'
);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || sameSiteOption === 'none',
  sameSite: sameSiteOption,
};
```

#### Verified Configuration Matrices by Domain Relationship:

1. **Option A: Same-Site Subdomains on Shared Apex (Recommended Staging Architecture)**
   - Domains: `https://staging.eventsync.example.com` and `https://staging-api.eventsync.example.com`
   - Relationship: **Same-Site, Cross-Origin**.
   - Environment Variables:
     - `COOKIE_SAME_SITE=lax`
     - `CROSS_SITE_COOKIES=false`
     - `NODE_ENV=production`
   - Resolved Flags: `HttpOnly; Secure; SameSite=Lax`
   - *Technical Mechanics:* Because both subdomains share `eventsync.example.com`, browsers treat requests as same-site. Credentialed Axios requests (`withCredentials: true`) send `SameSite=Lax` cookies, session persistence works across reloads, and cookies are immune to third-party cookie deprecation.

2. **Option B: Completely Disjoint Domains (Genuinely Cross-Site)**
   - Domains: e.g. `https://eventsync.vercel.app` and `https://eventsync-api.onrender.com`
   - Relationship: **Cross-Site**.
   - Environment Variables:
     - `CROSS_SITE_COOKIES=true`
     - `COOKIE_SAME_SITE=none`
     - `NODE_ENV=production`
   - Resolved Flags: `HttpOnly; Secure; SameSite=None`
   - *Requirements & Risks:* Mandatory HTTPS. Modern browsers may block these cookies under default third-party tracking protection unless partitioned. Strongly discouraged for production/staging.

3. **Option C: Single-Origin Deployment (Reverse Proxy)**
   - Domains: Frontend and API served on `https://staging.eventsync.example.com` (API routed via `/api` or specific path rewrite).
   - Relationship: **Same-Origin**.
   - Environment Variables:
     - `COOKIE_SAME_SITE=strict` (or `lax`)
     - `CROSS_SITE_COOKIES=false`
   - Resolved Flags: `HttpOnly; Secure; SameSite=Strict`

### 4.4 Browser Verification Protocol for Authentication & Cookies
1. Open an incognito/private browser session in Chrome and Safari.
2. Log in at `https://staging.eventsync.example.com/login`.
3. Open DevTools $\rightarrow$ Application $\rightarrow$ Cookies. Verify that `accessToken` and `refreshToken` are stored with `HttpOnly` and `Secure` flags.
4. Reload the page at `/profile`. Verify session persists cleanly without logging out.
5. In DevTools Application $\rightarrow$ Cookies, manually delete `accessToken` (leaving `refreshToken` intact).
6. Click any protected route (e.g., `/bookmarks`). Verify in Network tab that the 401 response triggers an immediate call to `/auth/refresh-token` and transparently recovers without redirecting to `/login`.

### 4.5 Rate Limiting Configuration
The staging backend applies tiered rate limiting to safeguard resources:
1. **General Limiter (`generalLimiter`):** 1,000 requests per 15 minutes per IP.
2. **Auth Limiter (`authLimiter`):** 20 attempts per 15 minutes per IP on `/auth/login` and `/auth/register` (guarded against credential brute-forcing).
3. **Password Reset Limiter (`passwordResetLimiter`):** 5 requests per hour on `/auth/forgot-password`.
4. **Chatbot Limiter (`chatbotLimiter`):** 30 queries per 15 minutes to conserve Gemini quota.
5. **Sync Limiter (`syncLimiter`):** 10 requests per 15 minutes on `/aggregation/sync`.

### 4.6 Secrets Management Checklist
- All secrets must be provisioned via hosting environment variable managers (e.g., AWS Secrets Manager, Doppler, Vault, or Cloud PaaS Environment Configuration).
- `JWT_ACCESS_SECRET`: Generate a random 256-bit hex key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `JWT_REFRESH_SECRET`: Generate a separate, distinct 256-bit hex key using the same generator.
- `ADMIN_CODE`: A strong, distinct passphrase for administrative role registration in staging.

---

## 5. Email Services & Background Job Configuration

### 5.1 Initial Staging Deployment Phase: Mandatory Dry-Run (`EMAIL_DRY_RUN=true`)
- **Initial Staging Requirement:** **`EMAIL_DRY_RUN=true` IS STRICTLY MANDATORY**.
  - In [`backend/src/utils/emailService.js`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/utils/emailService.js), when `EMAIL_DRY_RUN=true`, all outgoing email payloads (password resets, notifications) are intercepted, logged to Winston with `<dry-run-...>` message IDs, and **no network SMTP connection is ever opened**.
  - **No Live SMTP Delivery:** Live SMTP delivery is strictly disabled during initial staging. Staging boot, smoke tests, and user registration flows must proceed exclusively under dry-run mode.
  - SMTP credentials (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`) should remain empty or unconfigured during initial deployment.

### 5.2 Separate Phase: Controlled Mailtrap Sandbox Integration Testing
Live SMTP transmission must only be verified during a separate, explicitly planned testing phase after all initial deployment smoke tests pass:

> [!IMPORTANT]
> **Controlled Sandbox Testing Only (Explicitly Opted-In):**
> Real external email addresses must never be contacted from staging. When validating transactional email formatting and delivery, test exclusively against an isolated virtual inbox provider such as [Mailtrap](https://mailtrap.io). Mailtrap captures all outgoing messages within a sandbox dashboard without delivering them to real recipient inboxes.

> [!WARNING]
> **`EMAIL_SERVICE` Precedence Trap:**
> In [`backend/src/utils/emailService.js#L38-L54`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/utils/emailService.js#L38-L54), the transport configuration uses a ternary operator:
> `process.env.EMAIL_SERVICE ? { service: ... } : { host: process.env.EMAIL_HOST, port: ... }`
> If `EMAIL_SERVICE` is set (even to `smtp`), Nodemailer looks for a predefined well-known service and **completely ignores `EMAIL_HOST` and `EMAIL_PORT`**.
> **Rule:** For custom SMTP hosts like Mailtrap, `EMAIL_SERVICE` **must be omitted or left completely blank**.

> [!WARNING]
> **`EMAIL_FROM` Format Requirement:**
> In [`backend/src/utils/emailService.js#L77-L80`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/utils/emailService.js#L77-L80), `getSenderAddress()` wraps `EMAIL_FROM` in:
> `"EventSync" <${fromAddress}>`
> Setting `EMAIL_FROM` to `"EventSync Staging" <staging@eventsync.example.com>` results in malformed nested angle brackets (`"EventSync" <"EventSync Staging" <...>>`), which causes SMTP transmission failures.
> **Rule:** `EMAIL_FROM` must be a **bare email address** (e.g. `staging@eventsync.example.com`).

#### Phase-Specific Mailtrap Configuration (Explicitly Opted-In):
```env
# Phase 2 Temporary Override Settings:
EMAIL_SERVICE=
EMAIL_HOST=sandbox.smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=<your_mailtrap_username>
EMAIL_PASS=<your_mailtrap_password>
EMAIL_FROM=staging@eventsync.example.com
EMAIL_DRY_RUN=false
```
*Post-Test Protocol:* Once password-reset link generation and email template formatting are verified in the Mailtrap inbox, revert `EMAIL_DRY_RUN=true` to maintain safety during ongoing staging usage.

### 5.3 Background Scheduler & Disabled Functions
EventSync contains two in-process background cron jobs in `server.js`:
1. `scheduler.service.js` (Aggregation sync and catch-up)
2. `deadlineCron.js` (Hourly reminder notifications)

#### Staging Requirement: `DISABLE_SCHEDULER=true`
Setting `DISABLE_SCHEDULER=true` is **mandatory** on staging to prevent automated scraper execution.

#### Functions Disabled While `DISABLE_SCHEDULER=true`:
1. **Startup Catch-Up Sync (`checkOverdueSync`):** Prevented from firing within 3 seconds of server start.
2. **Automated Aggregation Scraping:** 6-hour cron (`30 3,9,15,21 * * *`) is not scheduled.
3. **Expired Events Cleanup:** Hourly cron (`0 * * * *`) that deletes aggregated events older than 3 days is not scheduled.
4. **Automated Deadline Reminders:** Hourly cron (`0 * * * *`) that checks deadlines at `weekly`, `24h`, and `6h` stages is not scheduled.

#### Safe Procedure for Verifying Reminders Without Real Emails or Background Crons:
To verify that deadline reminder logic operates correctly without running the background scheduler or sending real emails:
```bash
npm --prefix backend run verify:deadline-reminders
```
This runs [`backend/src/scripts/verifyDeadlineReminders.js`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/scripts/verifyDeadlineReminders.js), which sets `EMAIL_DRY_RUN=true`, queries deadline windows, creates test reminders, verifies `ReminderLog` duplicate prevention, and exits cleanly.

---

## 6. External Integrations Management

### 6.1 Unstop & Devfolio Aggregation
- **Safety Policy:** Automated and manual live scraping of Devfolio (`api.devfolio.co`) and Unstop (`unstop.com`) is **strictly forbidden** in staging without dedicated proxy mocks.
- **Enforcement:**
  - `DISABLE_SCHEDULER=true` disables automated scraping on startup and schedule.
  - Manual sync endpoint [`POST /aggregation/sync`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/routes/aggregation.routes.js#L8) is restricted to admin credentials.
- **Staging Mocking Strategy:** Populate staging with test hackathons and campus events through the authenticated Admin UI (`/admin`) or non-destructive fixture scripts.

### 6.2 Gemini AI API Configuration
- **Endpoint:** Natural language event search and intelligent chatbot recommendations (`/chatbot`).
- **Configuration:** Set `GEMINI_API_KEY` to a staging Google AI Studio key.
- **Fail-Safe Mechanism:** In `backend/src/utils/gemini.js`, if `GEMINI_API_KEY` is omitted or invalid, `isGeminiAvailable()` automatically falls back to keyword-based search without crashing the server.

---

## 7. Dependency Security & Nodemailer Risk Assessment

### 7.1 Verified Version Matrix

| Package | Installed Version | Lockfile Version | Latest Patched | Vulnerabilities |
|---|---|---|---|---|
| **`nodemailer`** | **`6.10.1`** | **`6.10.1`** | `10.3.1` | 22 GHSA advisories (GHSA-p6gq-j5cr-w38f, GHSA-2x7j-588g-ccc2, GHSA-v53p-9fqp-m79j, GHSA-r7g4-qg5f-qqm2, GHSA-rcmh-qjqh-p98v, etc.) |
| **`bcrypt`** | `^6.0.0` (`6.0.0`) | `6.0.0` | `6.0.0` | 0 vulnerabilities (Fully patched) |
| **`vite`** | `^6.2.0` (`6.2.0`) | `6.2.0` | `8.3.6` | 8 advisories (Dev dependency only; 0 production footprint) |
| **`react-router-dom`** | `^6.30.0` (`6.30.0`) | `6.30.0` | `7.18.5` | 2 advisories in `react-router` (SSR constructor injection & open redirect) |

### 7.2 Staging Risk Assessment for `nodemailer@6.10.1`
- **Applicable Vulnerability Mechanisms:**
  - **ReDoS in Address Parsing:** Unauthenticated endpoints (`/auth/register`, `/auth/forgot-password`) accept user email inputs that are parsed by Nodemailer's `addressparser`.
  - **SSRF / Option Bypass:** Raw option bypasses and comment mis-parsing present latent risks if user input reaches Nodemailer mail options.
- **Application-Layer Mitigations:**
  - [`backend/src/utils/emailService.js`](file:///c:/Users/VANI/OneDrive/Desktop/EventSync/backend/src/utils/emailService.js#L3) executes a strict regex check (`EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`) prior to calling Nodemailer, filtering out complex address-list injection vectors.
  - Setting `EMAIL_DRY_RUN=true` completely isolates the application from SMTP network activity.
- **Production-Readiness Requirement:**
  - Upgrading to `nodemailer >= 10.3.1` (SemVer major upgrade) and performing full email regression testing is a **mandatory gate for production deployment**.

---

## 8. Staging Deployment Runbook & Verification

### 8.1 Configuration Ownership: Application vs Hosting Infrastructure

To ensure clear operational ownership during staging setup, settings are separated into verified application code defaults and external infrastructure configurations:

#### A. Verified Application Defaults (Hardcoded in Repo)
- Authentication rate limiting: 20 requests per 15 minutes in non-test mode (`app.js`).
- Dual-token cookie generation: 15m access, 7d refresh (`tokens.js`).
- Redacted Winston logging on sensitive request keys (`logger.js`).
- Health check route: returns `{ "message": "EventSync API is running" }` (`app.js`).

#### B. External Infrastructure Settings (Must Be Configured Manually)

##### 1. Hosting Dashboard & PaaS Settings (Backend)

**Phase 1 â€” Initial Staging Deployment (required from day one):**
- `NODE_ENV=production`
- `PORT=5000` (or assigned by platform)
- `MONGO_URI=mongodb+srv://eventsync_staging_user:<PASSWORD>@<CLUSTER>.mongodb.net/eventsync_staging?retryWrites=true&w=majority`
- `CLIENT_URL=https://staging.eventsync.example.com`
- `JWT_ACCESS_SECRET=<generated-64-char-hex>`
- `JWT_REFRESH_SECRET=<generated-64-char-hex>`
- `ADMIN_CODE=<staging-admin-passphrase>`
- `EMAIL_DRY_RUN=true` *(Mandatory â€” no SMTP connection is opened; all email payloads are logged locally)*
- `DISABLE_SCHEDULER=true` *(Mandatory â€” prevents automated scraping and background crons)*
- `COOKIE_SAME_SITE=lax` *(Correct for same-site subdomains sharing `eventsync.example.com`)*
- `CROSS_SITE_COOKIES=false` *(No third-party cookie mode required for same-site subdomain architecture)*
- `GEMINI_API_KEY=<staging-google-ai-studio-key>`
- `EMAIL_FROM=staging@eventsync.example.com`

> [!NOTE]
> SMTP credentials (`EMAIL_SERVICE`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`) must remain **unset or empty** during Phase 1. With `EMAIL_DRY_RUN=true`, the application never opens a network SMTP connection, so no credentials are needed. See Section 5.1.

**Phase 2 â€” Controlled Mailtrap Sandbox Testing (explicitly opted-in after Phase 1 smoke tests pass):**

Override only these variables in the hosting environment. All Phase 1 variables remain unless explicitly listed here:
- `EMAIL_DRY_RUN=false` *(Enables real SMTP transmission to Mailtrap sandbox only)*
- `EMAIL_SERVICE=` *(Must remain empty â€” setting this causes EMAIL_HOST/EMAIL_PORT to be ignored)*
- `EMAIL_HOST=sandbox.smtp.mailtrap.io`
- `EMAIL_PORT=2525`
- `EMAIL_SECURE=false`
- `EMAIL_USER=<mailtrap-username>`
- `EMAIL_PASS=<mailtrap-password>`

> [!WARNING]
> Phase 2 must be reverted to `EMAIL_DRY_RUN=true` (and SMTP credentials removed) after Mailtrap testing is complete. Ongoing staging usage must remain in dry-run mode. See Section 5.2.

##### 2. Static Hosting Dashboard (Frontend Build Settings)
- Build Command: `npm ci && npm run build`
- Output Directory: `dist`
- Build Environment Variable: `VITE_API_URL=https://staging-api.eventsync.example.com`
- Rewrite Rule: `/* -> /index.html 200` (SPA redirect fallback)

##### 3. MongoDB Atlas Configuration
- Database: `eventsync_staging`
- User: `eventsync_staging_user` scoped exclusively to `eventsync_staging`
- Network Access: IP Access List allowing staging backend instances

##### 4. DNS Provider Configuration
- `staging.eventsync.example.com` $\rightarrow$ CNAME to Static Hosting (Cloudflare Pages / Vercel)
- `staging-api.eventsync.example.com` $\rightarrow$ CNAME / A record to Backend PaaS (Render / Railway / AWS ALB)
- SSL/TLS: Automatic managed certificates (Let's Encrypt / Cloudflare)

---

### 8.2 Step-by-Step Staging Deployment Instructions

#### Step 1: Database Setup
1. In MongoDB Atlas, create database `eventsync_staging`.
2. Create staging database user with read/write access limited to `eventsync_staging`.
3. Apply indexes as specified in Section 3.2.

#### Step 2: Backend Deployment
1. Provision staging runtime instance (Node.js 20 LTS).
2. Configure backend environment variables as specified in Section 8.1.
3. Install production dependencies: `cd backend && npm ci --omit=dev`.
4. Start backend application: `node src/server.js`.
5. Verify startup logs confirm:
   - `Server running on port ...`
   - `MongoDB connected successfully to eventsync_staging`
   - `Schedulers disabled via DISABLE_SCHEDULER`

#### Step 3: Frontend Build & Deployment
1. Set `VITE_API_URL=https://staging-api.eventsync.example.com` in CI/CD build environment.
2. Build frontend: `cd frontend && npm ci && npm run build`.
3. Deploy `frontend/dist/` to static hosting.
4. Verify SPA redirect fallback rule is active.

---

### 8.3 Post-Deployment Smoke Test Protocol

| Test Case | Procedure | Expected Outcome |
|---|---|---|
| **SMOKE-01: Health Check** | `curl -i https://staging-api.eventsync.example.com/health` | HTTP `200 OK`, JSON body: `{"message":"EventSync API is running"}` |
| **SMOKE-02: CORS Preflight** | `curl -i -X OPTIONS https://staging-api.eventsync.example.com/health -H "Origin: https://staging.eventsync.example.com" -H "Access-Control-Request-Method: GET"` | HTTP `204 No Content`, `Access-Control-Allow-Origin: https://staging.eventsync.example.com`, `Access-Control-Allow-Credentials: true` |
| **SMOKE-03: SPA Direct Routing** | Open browser to `https://staging.eventsync.example.com/events` and refresh | Events page loads cleanly with HTTP 200 (no 404) |
| **SMOKE-04: Student Registration** | Register test account `staging.student@example.com` | User created in `eventsync_staging`; redirected to profile |
| **SMOKE-05: Admin Registration** | Register with valid staging `ADMIN_CODE` | Admin role assigned; `/admin` dashboard accessible |
| **SMOKE-06: Auth Cookie Persistence** | Refresh browser while logged in | Profile data persists; refresh token rotates without error |
| **SMOKE-07: Unauthenticated Routing** | Open private window to `/admin` | Clean redirect to `/login` with zero console error loops |
| **SMOKE-08: Rate Limit Verification** | Submit 21 invalid login attempts rapidly | 21st attempt receives HTTP 429 `"Too many authentication attempts"` |

---

### 8.4 Rollback Procedure
If any critical smoke test fails or security regressions occur:
1. **Frontend Rollback:** In hosting dashboard (Cloudflare/Vercel/Netlify), revert to previous deployment with one click.
2. **Backend Rollback:** Stop backend process (`pm2 stop eventsync-backend`), checkout previous stable commit, reinstall dependencies (`npm ci --omit=dev`), and restart.
3. **Database Rollback:** Restore from pre-deployment MongoDB Atlas snapshot if data corruption occurred.
4. **Post-Mortem Review:** Inspect Winston `logs/error.log` and MongoDB connection logs to isolate root cause.

---

## 9. Final Deployment Gate Checklist

### Phase 1 â€” Initial Staging Deployment
- [ ] MongoDB Atlas `eventsync_staging` database initialized and distinct from production.
- [ ] Staging database user credentials scoped exclusively to `eventsync_staging`.
- [ ] Staging `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` generated independently.
- [ ] `DISABLE_SCHEDULER=true` set in staging backend environment variables.
- [ ] `EMAIL_DRY_RUN=true` set â€” no SMTP credentials configured; no live email delivery.
- [ ] `COOKIE_SAME_SITE=lax` and `CROSS_SITE_COOKIES=false` set for same-site subdomain architecture (`staging.eventsync.example.com` / `staging-api.eventsync.example.com`).
- [ ] `CLIENT_URL` matches staging frontend URL exactly (`https://staging.eventsync.example.com`).
- [ ] Frontend built with `VITE_API_URL` pointing to staging backend API.
- [ ] Web server configured with SPA fallback (`try_files ... /index.html` or `/* â†’ /index.html 200`).
- [ ] `backend/src/seeders/seedEvents.js` is strictly quarantined from staging execution.
- [ ] All Phase 1 smoke tests (SMOKE-01 through SMOKE-08) executed and signed off.

### Phase 2 â€” Controlled Mailtrap Sandbox Testing (Explicitly Opted-In)
- [ ] Phase 1 smoke tests fully passed before enabling Phase 2.
- [ ] `EMAIL_DRY_RUN=false` set only for the duration of Mailtrap testing.
- [ ] `EMAIL_SERVICE` confirmed empty; `EMAIL_HOST=sandbox.smtp.mailtrap.io` in use.
- [ ] `EMAIL_FROM` confirmed as bare email address (not a display-name address).
- [ ] Password-reset email and reminder email templates verified in Mailtrap inbox.
- [ ] `EMAIL_DRY_RUN=true` reinstated and SMTP credentials removed after Phase 2 testing completes.

### Production-Readiness Gate (Before Graduating from Staging)
- [ ] `nodemailer` upgraded from `6.10.1` to `>= 10.3.1` and full email regression tests passed.
- [ ] `DISABLE_SCHEDULER=false` with controlled scraping and reminder integration verified.
- [ ] Final security review of all remaining `npm audit` advisories completed.
