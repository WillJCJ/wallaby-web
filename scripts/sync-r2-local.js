#!/usr/bin/env node
/**
 * Downloads every photo listed in photos.json from the remote R2 bucket,
 * compresses them aggressively for fast local dev, and writes them into
 * the local Wrangler R2 state for use with dev:wrangler.
 */

import { execSync } from 'child_process';
import { readFileSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const photos = JSON.parse(readFileSync(join(root, 'site/_data/photos.json'), 'utf8'));
const BUCKET = 'wallaby-web';

// Max dimension for local dev — thumbnails are 600px wide, lightbox 2000px.
// 1200px gives a reasonable preview without giant file sizes.
const MAX_PX = 1200;
const JPEG_QUALITY = 55;

// Blur placeholders — tiny images stored as blur/{id} in local R2.
// The router shim serves these for CDN requests with width <= 60.
const BLUR_PX = 40;
const BLUR_QUALITY = 5;

const tmpDir = join(tmpdir(), `r2-sync-${randomBytes(4).toString('hex')}`);
mkdirSync(tmpDir, { recursive: true });

let ok = 0;
let fail = 0;

for (const { id } of photos) {
    const rawFile = join(tmpDir, `raw_${id.replaceAll('/', '_')}`);
    const compressedFile = join(tmpDir, `compressed_${id.replaceAll('/', '_')}`);
    const blurFile = join(tmpDir, `blur_${id.replaceAll('/', '_')}`);
    const objectPath = `${BUCKET}/${id}`;

    try {
        process.stdout.write(`  ${id} ... `);

        // Download from remote R2
        execSync(`npx wrangler r2 object get "${objectPath}" --remote --file "${rawFile}"`, { cwd: root, stdio: 'pipe' });

        // Compressed version: resize to max MAX_PX on longest side
        await sharp(rawFile)
            .resize(MAX_PX, MAX_PX, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toFile(compressedFile);

        // Blur placeholder: tiny image for LQIP blur-up effect
        await sharp(rawFile)
            .resize(BLUR_PX, BLUR_PX, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: BLUR_QUALITY, mozjpeg: true })
            .toFile(blurFile);

        // Write both to local R2
        execSync(`npx wrangler r2 object put "${objectPath}" --local --file "${compressedFile}"`, { cwd: root, stdio: 'pipe' });
        execSync(`npx wrangler r2 object put "${BUCKET}/blur/${id}" --local --file "${blurFile}"`, { cwd: root, stdio: 'pipe' });

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
