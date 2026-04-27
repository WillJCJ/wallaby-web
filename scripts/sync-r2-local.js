#!/usr/bin/env node
/**
 * Downloads media listed in photos.json from the remote R2 bucket,
 * compresses photos aggressively for fast local dev, and writes them into
 * the local Wrangler R2 state for use with dev:wrangler.
 *
 * Optional filter:
 *   node scripts/sync-r2-local.js --target grannie
 *   node scripts/sync-r2-local.js 2025-stu-skankin.mp4
 */

import { execSync } from 'child_process';
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const items = JSON.parse(readFileSync(join(root, 'site/_data/photos.json'), 'utf8'));
const BUCKET = 'wallaby-web';

// Max dimension for local dev — thumbnails are 600px wide, lightbox 2000px.
// 1200px gives a reasonable preview without giant file sizes.
const MAX_PX = 1200;
const JPEG_QUALITY = 55;

const args = process.argv.slice(2);
const targetArgIndex = args.findIndex((arg) => arg === '--target' || arg.startsWith('--target='));
const target = (() => {
    if (targetArgIndex >= 0) {
        const flag = args[targetArgIndex];
        return flag.includes('=') ? (flag.split('=').slice(1).join('=') || '') : (args[targetArgIndex + 1] || '');
    }
    return args.find((arg) => !arg.startsWith('--')) || '';
})();

const isVideo = (item) => {
    if (item.type === 'video') return true;
    return /\.(mp4|webm|mov|m4v)$/i.test(item.id || '');
};

const objectKeyFor = (item) => `${isVideo(item) ? 'videos' : 'photos'}/${item.id}`;

const targetNeedle = target.trim().toLowerCase();
const selectedItems = !targetNeedle
    ? items
    : items.filter((item) => {
            const key = objectKeyFor(item).toLowerCase();
            return item.id.toLowerCase().includes(targetNeedle) || key.includes(targetNeedle);
        });

if (selectedItems.length === 0) {
    console.log(`No matching media for target: "${target}"`);
    process.exit(0);
}

if (targetNeedle) {
    console.log(`Sync target: "${target}" (${selectedItems.length} item${selectedItems.length === 1 ? '' : 's'})`);
}

const tmpDir = join(tmpdir(), `r2-sync-${randomBytes(4).toString('hex')}`);
mkdirSync(tmpDir, { recursive: true });

let ok = 0;
let fail = 0;

for (const item of selectedItems) {
    const { id } = item;
    const safeId = id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const rawFile = join(tmpDir, `raw_${safeId}`);
    const compressedFile = join(tmpDir, `compressed_${safeId}.jpg`);
    const objectPath = `${BUCKET}/${objectKeyFor(item)}`;
    const isVideoItem = isVideo(item);

    try {
        process.stdout.write(`  ${objectKeyFor(item)} ... `);

        // Download from remote R2
        execSync(`npx wrangler r2 object get "${objectPath}" --remote --file "${rawFile}"`, { cwd: root, stdio: 'pipe' });

        if (isVideoItem) {
            // Keep videos as-is so local behaviour matches production playback.
            execSync(`npx wrangler r2 object put "${objectPath}" --local --file "${rawFile}"`, { cwd: root, stdio: 'pipe' });
        } else {
            // Compressed version: resize to max MAX_PX on longest side
            await sharp(rawFile)
                .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
                .toFile(compressedFile);

            // Write to local R2
            execSync(`npx wrangler r2 object put "${objectPath}" --local --file "${compressedFile}"`, { cwd: root, stdio: 'pipe' });
        }

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
