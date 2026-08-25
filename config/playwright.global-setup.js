import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const localPort = 4173;
const localBaseURL = `http://127.0.0.1:${localPort}`;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForUrl = async (url, timeoutMilliseconds = 10_000) => {
  const deadline = Date.now() + timeoutMilliseconds;

  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: 'manual' });
      return;
    } catch {
      // Keep polling until wrangler is ready.
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${url} hello`);
};

// Kills any process left bound to the port, e.g. an orphaned wrangler/workerd process from a previous run.
const killStaleListeners = (port) => {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`).toString().trim();
    if (pids) {
      execSync(`kill -9 ${pids.split('\n').join(' ')}`);
    }
  } catch {
    // No process is listening on the port, nothing to clean up.
  }
};

const isServerUp = async (url) => {
  try {
    await fetch(url, { redirect: 'manual' });
    return true;
  } catch {
    return false;
  }
};

/**
 * @returns {Promise<(() => Promise<void>)|undefined>} Resolves to a teardown function that stops the Wrangler dev process, or undefined when PLAYWRIGHT_BASE_URL is provided or a server is already running.
 */
export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return undefined;
  }

  // The VS Code test runner keeps a warm test server across runs and doesn't reliably call
  // the returned teardown between them. Reuse an already-running dev server instead of
  // spawning a second one that would fail to bind the port.
  if (await isServerUp(`${localBaseURL}/`)) {
    return undefined;
  }

  killStaleListeners(localPort);

  // Run detached so wrangler's child workerd process shares a process group we can kill as a whole.
  const worker = spawn(process.execPath, [wranglerCli, 'dev', '--port', String(localPort)], {
    cwd: rootDir,
    stdio: 'inherit',
    detached: true,
  });

  try {
    await waitForUrl(`${localBaseURL}/`);
  } catch (error) {
    worker.kill('SIGKILL');
    throw error;
  }

  return async () => {
    if (worker.killed || worker.pid === undefined) {
      return;
    }

    try {
      // Negative pid targets the whole process group, killing wrangler and the workerd process it spawns.
      process.kill(-worker.pid, 'SIGTERM');
    } catch {
      // Process group is already gone.
    }

    await sleep(500);
    killStaleListeners(localPort);
  };
}