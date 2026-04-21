#!/usr/bin/env node
/**
 * Downloads every photo listed in photos.json from the remote R2 bucket
 * and writes it into the local Wrangler R2 state for use with dev:wrangler.
 */

import { execSync } from 'child_process';
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const photos = JSON.parse(readFileSync(join(root, 'site/_data/photos.json'), 'utf8'));
const BUCKET = 'wallaby-web';

const tmpDir = join(tmpdir(), `r2-sync-${randomBytes(4).toString('hex')}`);
mkdirSync(tmpDir, { recursive: true });

let ok = 0;
let fail = 0;

for (const { id } of photos) {
    const tmpFile = join(tmpDir, id.replaceAll('/', '_'));
    const objectPath = `${BUCKET}/${id}`;

    try {
        process.stdout.write(`  ${id} ... `);
        execSync(`npx wrangler r2 object get "${objectPath}" --remote --file "${tmpFile}"`, { cwd: root, stdio: 'pipe' });
        execSync(`npx wrangler r2 object put "${objectPath}" --local --file "${tmpFile}"`, { cwd: root, stdio: 'pipe' });
        console.log('ok');
        ok++;
    } catch (err) {
        console.log('FAILED');
        console.error(`    ${err.stderr?.toString().trim() || err.message}`);
        fail++;
    }
}

rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n${ok} synced, ${fail} failed.`);
if (fail > 0) process.exit(1);
