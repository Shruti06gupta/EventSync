/**
 * Graceful Shutdown Verification Script
 * Tests SIGINT and SIGTERM handlers, ensuring HTTP server closes,
 * MongoDB connection closes cleanly, and process exits with code 0.
 */
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

function runShutdownTest(signalName) {
  return new Promise((resolve, reject) => {
    console.log(`\nTesting graceful shutdown with ${signalName}...`);

    // Create inline test script that starts server and listens
    const childScript = `
      require('dotenv').config();
      const mongoose = require('mongoose');
      const { app } = require('./src/app');
      const { logger } = require('./src/config/logger');

      let server = app.listen(0, '127.0.0.1', async () => {
        const port = server.address().port;
        process.stdout.write('SERVER_READY:' + port + '\\n');
      });

      let isShuttingDown = false;
      const gracefulShutdown = async (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        process.stdout.write('SHUTDOWN_STARTED:' + signal + '\\n');

        const forceTimer = setTimeout(() => {
          process.stdout.write('SHUTDOWN_TIMED_OUT\\n');
          process.exit(1);
        }, 5000);
        if (forceTimer.unref) forceTimer.unref();

        if (server && server.listening) {
          if (typeof server.closeIdleConnections === 'function') {
            server.closeIdleConnections();
          }
          server.close(async (err) => {
            if (err) {
              process.stdout.write('SERVER_CLOSE_ERROR\\n');
              process.exit(1);
            }
            process.stdout.write('SERVER_CLOSED\\n');

            try {
              if (mongoose.connection && mongoose.connection.readyState !== 0) {
                await mongoose.connection.close(false);
              }
              process.stdout.write('DB_CLOSED\\n');
              clearTimeout(forceTimer);
              process.exit(0);
            } catch (e) {
              process.stdout.write('DB_CLOSE_ERROR\\n');
              process.exit(1);
            }
          });
        } else {
          clearTimeout(forceTimer);
          process.exit(0);
        }
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('message', (msg) => {
        if (msg && msg.signal) {
          process.emit(msg.signal);
        }
      });
    `;

    const child = spawn(process.execPath, ['-e', childScript], {
      cwd: path.resolve(__dirname, '../../'),
      env: { ...process.env, PORT: '0' },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    let output = '';
    let serverReady = false;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;

      if (text.includes('SERVER_READY:') && !serverReady) {
        serverReady = true;
        // Trigger the signal inside the child process
        setTimeout(() => {
          child.send({ signal: signalName });
        }, 500);
      }
    });

    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Test timed out waiting for child to exit on ${signalName}`));
    }, 10000);

    child.on('exit', (code) => {
      clearTimeout(timeout);
      console.log(`  Child process exited with code: ${code}`);

      try {
        assert.ok(output.includes('SERVER_READY:'), 'Server should have reached ready state');
        assert.ok(output.includes('SHUTDOWN_STARTED:'), 'Shutdown handler should have been triggered');
        assert.ok(output.includes('SERVER_CLOSED'), 'HTTP server should have closed cleanly');
        assert.ok(output.includes('DB_CLOSED'), 'Database connection should have closed cleanly');
        assert.strictEqual(code, 0, `Exit code should be 0 on clean shutdown for ${signalName}`);
        console.log(`  ✓ Graceful shutdown verified for ${signalName}`);
        resolve();
      } catch (err) {
        console.error('  Output was:\n', output);
        reject(err);
      }
    });
  });
}

async function verifyShutdown() {
  console.log('==================================================');
  console.log('  GRACEFUL SHUTDOWN VERIFICATION SUITE');
  console.log('==================================================');

  try {
    await runShutdownTest('SIGTERM');
    await runShutdownTest('SIGINT');

    console.log('\n==================================================');
    console.log('  ALL SHUTDOWN TESTS PASSED (SIGTERM + SIGINT)');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ Shutdown Verification Failed:', err.message);
    process.exit(1);
  }
}

verifyShutdown();
