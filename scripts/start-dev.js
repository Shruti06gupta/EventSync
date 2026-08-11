const path = require('path');
const { execFileSync, spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const managedPorts = [5000, 5173];
const childProcesses = new Set();
let shuttingDown = false;
const appRoot = path.resolve(__dirname, '..');

function parsePids(output) {
  return [...output.matchAll(/LISTENING\s+(\d+)/g)].map((match) => Number(match[1]));
}

function getListeningPids(port) {
  try {
    const args = isWindows ? ['-aon'] : ['-ano', '-p', 'tcp'];
    const output = execFileSync(
      'netstat',
      args,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    return [...new Set(
      output
        .split(/\r?\n/)
        .filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'))
        .flatMap((line) => parsePids(line))
    )];
  } catch (error) {
    console.error(`Failed to inspect port ${port}: ${error.message}`);
    return [];
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function killPid(pid, port) {
  if (!pid || pid === process.pid) {
    return;
  }

  try {
    const args = isWindows ? ['/PID', String(pid), '/F', '/T'] : ['-TERM', String(pid)];
    const command = isWindows ? 'taskkill' : 'kill';
    execFileSync(command, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    console.log(`Freed port ${port} by stopping PID ${pid}`);
  } catch (error) {
    console.warn(`Unable to stop PID ${pid} on port ${port}: ${error.message}`);
  }
}

function ensureManagedPortsAvailable() {
  for (const port of managedPorts) {
    const pids = getListeningPids(port);
    for (const pid of pids) {
      killPid(pid, port);
    }

    const deadline = Date.now() + 5000;
    while (getListeningPids(port).length > 0 && Date.now() < deadline) {
      sleep(250);
    }
  }
}

async function waitForManagedPortsToClear() {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const busyPorts = managedPorts.filter((port) => getListeningPids(port).length > 0);

    if (busyPorts.length === 0) {
      return;
    }

    if (attempt === 0) {
      console.log(`Waiting for ports to clear: ${busyPorts.join(', ')}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  console.warn(`Some managed ports are still busy after cleanup: ${managedPorts.filter((port) => getListeningPids(port).length > 0).join(', ')}`);
}

function prefixStream(stream, prefix, writer) {
  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      writer(`${prefix}${line}\n`);
    }
  });

  stream.on('end', () => {
    if (buffer) {
      writer(`${prefix}${buffer}\n`);
    }
  });
}

function stopChildren(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 250);
}

function startProcess(name, command, colorWriter) {
  const child = spawn(command, {
    cwd: appRoot,
    env: process.env,
    shell: isWindows,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  childProcesses.add(child);
  prefixStream(child.stdout, `[${name}] `, process.stdout.write.bind(process.stdout));
  prefixStream(child.stderr, `[${name}] `, colorWriter);

  child.on('exit', (code, signal) => {
    childProcesses.delete(child);

    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === 'SIGTERM') {
      stopChildren(code ?? 0);
      return;
    }

    console.error(`[${name}] exited unexpectedly with code ${code ?? 'unknown'}`);
    stopChildren(code ?? 1);
  });

  return child;
}

async function waitForBackend(maxAttempts = 40, delayMs = 500) {
  const healthUrl = 'http://127.0.0.1:5000/health';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('Backend is ready on port 5000');
        return;
      }
    } catch (error) {
      // Backend not ready yet.
    }

    if (attempt === 1) {
      console.log('Waiting for backend on http://127.0.0.1:5000...');
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.warn('Backend did not respond on port 5000 before frontend startup. API requests may fail until it is running.');
}

async function main() {
  ensureManagedPortsAvailable();
  await waitForManagedPortsToClear();

  startProcess('backend', 'npm run start --prefix backend', process.stderr.write.bind(process.stderr));
  await waitForBackend();
  startProcess('frontend', 'npm run dev --prefix frontend', process.stderr.write.bind(process.stderr));
}

main().catch((error) => {
  console.error(`Dev launcher failed: ${error.message}`);
  process.exit(1);
});

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));
