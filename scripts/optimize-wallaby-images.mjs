/**
 * Optimise wallaby images for the web.
 *
 * For each wallaby card image (thumbnail + feature):
 *   - Pre-crops to 16:9 using the per-wallaby y-offset stored in wallabies.json,
 *     so the CSS object-position hack is no longer needed.
 *   - Outputs 480w and 960w webp variants at quality 85.
 *
 * For andrew-snoozing (404 page, full-width display):
 *   - Resizes only (no crop) to 480w, 960w, 1920w.
 *
 * Originals are deleted after all output files are confirmed written.
 *
 * Run once with: node scripts/optimize-wallaby-images.mjs
 */

import sharp from 'sharp';
import { readFile, unlink } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const imagesDir = resolve(root, 'images/wallabies');

/**
 * Parse an offset value from wallabies.json into a fraction.
 * "-20%" → -0.2, "25%" → 0.25, "0px" or undefined → 0.
 */
function parseOffset(value) {
  if (!value || value === '0px') return 0;
  if (value.endsWith('%')) return parseFloat(value) / 100;
  return 0;
}

/**
 * Resize an image to targetWidth then crop to 16:9 using the given y-offset.
 * yOffsetFraction: -0.2 shifts the crop window upward (shows more of the top).
 */
async function processCardImage(inputPath, outputPath, targetWidth, yOffsetFraction) {
  const { width: origWidth, height: origHeight } = await sharp(inputPath).metadata();

  const scaledHeight = Math.round(origHeight * targetWidth / origWidth);
  const targetHeight = Math.round(targetWidth * 9 / 16);
  const overflow = Math.max(0, scaledHeight - targetHeight);

  // y-position: 0 = top, 0.5 = centre, 1 = bottom.
  const yPositionFraction = Math.min(1, Math.max(0, 0.5 + yOffsetFraction));
  const cropTop = Math.round(yPositionFraction * overflow);

  await sharp(inputPath)
    .resize(targetWidth, scaledHeight)
    .extract({ left: 0, top: cropTop, width: targetWidth, height: Math.min(targetHeight, scaledHeight) })
    .webp({ quality: 85 })
    .toFile(outputPath);

  console.log(`  ${outputPath.split('/').pop()} (${targetWidth}×${Math.min(targetHeight, scaledHeight)})`);
}

/**
 * Resize without cropping — preserves the original aspect ratio.
 * Skips upscaling: if the image is narrower than targetWidth, outputs at natural size instead.
 */
async function processFullImage(inputPath, outputPath, targetWidth) {
  const { width: origWidth } = await sharp(inputPath).metadata();
  const clampedWidth = Math.min(targetWidth, origWidth);

  await sharp(inputPath)
    .resize(clampedWidth, null)
    .webp({ quality: 85 })
    .toFile(outputPath);

  const { width, height } = await sharp(outputPath).metadata();
  console.log(`  ${outputPath.split('/').pop()} (${width}×${height})`);
}

// ---------------------------------------------------------------------------
// Load wallaby data
// ---------------------------------------------------------------------------

const wallabiesJson = JSON.parse(
  await readFile(resolve(root, 'site/_data/wallabies.json'), 'utf-8')
);

const CARD_WIDTHS = [480, 960];
const FULL_WIDTHS = [480, 960, 1920];

const originalsToDelete = new Set();

// ---------------------------------------------------------------------------
// Process wallaby card images
// ---------------------------------------------------------------------------

// Track processed files to avoid double-processing when thumbnail === img (e.g. joey).
const processed = new Set();

for (const wallaby of wallabiesJson) {
  console.log(`\n${wallaby.id}:`);

  const thumbBasename = wallaby.thumbnail.replace('/images/wallabies/', '').replace('.webp', '');
  const imgBasename = wallaby.img.replace('/images/wallabies/', '').replace('.webp', '');
  const thumbOffset = parseOffset(wallaby.thumbnailYOffset);
  const imgOffset = parseOffset(wallaby.imgYOffset);

  const thumbSrc = resolve(imagesDir, `${thumbBasename}.webp`);
  originalsToDelete.add(thumbSrc);

  if (!processed.has(`${thumbBasename}:${thumbOffset}`)) {
    processed.add(`${thumbBasename}:${thumbOffset}`);
    for (const width of CARD_WIDTHS) {
      await processCardImage(
        thumbSrc,
        resolve(imagesDir, `${thumbBasename}-${width}w.webp`),
        width,
        thumbOffset
      );
    }
  }

  const imgSrc = resolve(imagesDir, `${imgBasename}.webp`);
  originalsToDelete.add(imgSrc);

  if (!processed.has(`${imgBasename}:${imgOffset}`)) {
    processed.add(`${imgBasename}:${imgOffset}`);
    for (const width of CARD_WIDTHS) {
      await processCardImage(
        imgSrc,
        resolve(imagesDir, `${imgBasename}-${width}w.webp`),
        width,
        imgOffset
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Process 404 snoozing image
// ---------------------------------------------------------------------------

console.log('\nandrew-snoozing:');
const snoozingSrc = resolve(imagesDir, 'andrew-snoozing.webp');
originalsToDelete.add(snoozingSrc);

for (const width of FULL_WIDTHS) {
  await processFullImage(
    snoozingSrc,
    resolve(imagesDir, `andrew-snoozing-${width}w.webp`),
    width
  );
}

// ---------------------------------------------------------------------------
// joey-feature.webp exists on disk but is unreferenced — delete with originals
// ---------------------------------------------------------------------------

const joeyFeatureSrc = resolve(imagesDir, 'joey-feature.webp');
originalsToDelete.add(joeyFeatureSrc);

// ---------------------------------------------------------------------------
// Delete originals
// ---------------------------------------------------------------------------

console.log('\nDeleting originals...');
for (const src of originalsToDelete) {
  await unlink(src);
  console.log(`  Deleted ${src.split('/').pop()}`);
}

console.log('\nDone.');
