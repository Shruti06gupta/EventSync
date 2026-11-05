/**
 * Isolation verification for the E2E test backend.
 *
 * Checks:
 *  1. Active Mongoose connection database name is eventsync_e2e
 *  2. EMAIL_DRY_RUN=true
 *  3. DISABLE_SCHEDULER=true
 *  4. MONGO_URI does NOT contain the production database name
 *
 * Usage (called automatically by playwright.config.js via the verify:isolation script):
 *   EMAIL_DRY_RUN=true DISABLE_SCHEDULER=true MONGO_URI=<e2e_uri> \
 *     node src/scripts/verifyIsolation.js
 *
 * Exits 0 on success, 1 on any failure.
 * Never prints credentials or connection strings.
 */
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const ISOLATED_DB_NAME = 'eventsync_e2e';

if (process.argv.includes('--apply-isolated') || process.env.APPLY_ISOLATED === 'true') {
  process.env.EMAIL_DRY_RUN = 'true';
  process.env.DISABLE_SCHEDULER = 'true';
  if (process.env.MONGO_URI) {
    process.env.MONGO_URI = process.env.MONGO_URI.replace(/(\/\/[^/]+\/)([^/?]+)/, `$1${ISOLATED_DB_NAME}`);
  }
}

const fail = (msg) => {
  process.stderr.write(`[ISOLATION FAIL] ${msg}\n`);
  process.exitCode = 1;
};

const ok = (msg) => {
  process.stdout.write(`[ISOLATION OK]   ${msg}\n`);
};

const run = async () => {
  // Check 1: EMAIL_DRY_RUN must be 'true'
  if (process.env.EMAIL_DRY_RUN !== 'true') {
    fail(`EMAIL_DRY_RUN is "${process.env.EMAIL_DRY_RUN}" — must be "true" for test server`);
    return;
  }
  ok('EMAIL_DRY_RUN=true');

  // Check 2: DISABLE_SCHEDULER must be 'true'
  if (process.env.DISABLE_SCHEDULER !== 'true') {
    fail(`DISABLE_SCHEDULER is "${process.env.DISABLE_SCHEDULER}" — must be "true" for test server`);
    return;
  }
  ok('DISABLE_SCHEDULER=true');

  // Check 3: MONGO_URI must NOT contain the production database name 'eventsync' as an exact segment
  const uri = process.env.MONGO_URI || '';
  const dbMatch = uri.match(/(\/\/[^/]+\/)([^/?]+)/);
  const actualDbName = dbMatch ? dbMatch[2] : null;

  if (!actualDbName) {
    fail('Could not extract database name from MONGO_URI — check URI format');
    return;
  }

  if (actualDbName !== ISOLATED_DB_NAME) {
    fail(`MONGO_URI points to database "${actualDbName}" — expected "${ISOLATED_DB_NAME}"`);
    return;
  }
  ok(`MONGO_URI database segment is "${ISOLATED_DB_NAME}"`);

  // Check 4: Actual Mongoose connection must report eventsync_e2e
  const ready = await connectDB();
  if (!ready) {
    fail('Could not connect to MongoDB — check MONGO_URI and network');
    return;
  }

  const connectedDb = mongoose.connection.db?.databaseName;
  if (connectedDb !== ISOLATED_DB_NAME) {
    fail(`Mongoose connected to "${connectedDb}" — expected "${ISOLATED_DB_NAME}"`);
    return;
  }
  ok(`Mongoose active connection database: "${connectedDb}"`);

  process.stdout.write('[ISOLATION PASS] All isolation checks passed. Safe to seed and run tests.\n');
};

run()
  .catch((err) => {
    fail(`Unhandled error: ${err.message}`);
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
  });
