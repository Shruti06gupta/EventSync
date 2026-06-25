const { execFileSync, spawn } = require('child_process');

const isWindows = process.platform === 'win32';
const managedPorts = [5000, 5173];
const childProcesses = new Set();
let shuttingDown = false;

function parsePids(output) {
  return [...output.matchAll(/LISTENING\s+(\d+)/g)].map((match) => Number(match[1]));
}

function getListeningPids(port) {
  try {
    const output = execFileSync(
      'netstat',
      ['-ano', '-p', 'tcp'],
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
  }
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
    cwd: process.cwd(),
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

ensureManagedPortsAvailable();

startProcess('backend', 'npm run start --prefix backend', process.stderr.write.bind(process.stderr));
startProcess('frontend', 'npm run dev --prefix frontend', process.stderr.write.bind(process.stderr));

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));
