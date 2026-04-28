import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { bundleAsync } from 'lightningcss';

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'dist/styles/main.css');
const outputPath = path.join(projectRoot, 'dist/styles/main.css');

async function buildCssBundle() {
  const result = await bundleAsync({
    filename: sourcePath,
    minify: true,
    sourceMap: false,
    targets: {
      safari: (16 << 16),
      ios_saf: (16 << 16),
      chrome: (111 << 16),
      firefox: (113 << 16),
      edge: (111 << 16),
    },
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.code);
}

await buildCssBundle();