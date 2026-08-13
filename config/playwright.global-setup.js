import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const localBaseURL = 'http://127.0.0.1:4173';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForUrl = async (url, timeoutMilliseconds = 120_000) => {
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

  throw new Error(`Timed out waiting for ${url}`);
};

/**
 * @returns {Promise<(() => Promise<void>)|undefined>} Resolves to a teardown function that stops the Wrangler dev process, or undefined when PLAYWRIGHT_BASE_URL is provided.
 */
export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return undefined;
  }

  const worker = spawn(process.execPath, [wranglerCli, 'dev', '--port', '4173'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  await waitForUrl(`${localBaseURL}/`);

  return async () => {
    if (!worker.killed) {
      worker.kill('SIGTERM');
    }
  };
}