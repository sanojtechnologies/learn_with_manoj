#!/usr/bin/env node
/**
 * Re-render the bitmap variants of the brand SVGs that live in `public/`.
 *
 * Why this exists:
 *   - iOS requires PNG for `apple-touch-icon`.
 *   - Most social-card crawlers (LinkedIn, X, Slack, Discord) prefer PNG/JPG.
 *   - Both files need to stay visually identical to their SVG source.
 *
 * Why `sharp`:
 *   - Already installed as an Astro dependency, no extra system tools needed.
 *   - Uses librsvg internally — renders fonts, gradients and rounded corners
 *     correctly, unlike macOS `qlmanage` which just produces a thumbnail.
 *
 * Usage:
 *   npm run icons
 *
 * After regenerating, commit both the .svg and the .png so production matches
 * what was reviewed locally.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const publicDir = join(projectRoot, 'public');

/** @type {{ src: string; out: string; width: number; height: number }[]} */
const TARGETS = [
  {
    src: join(publicDir, 'apple-touch-icon.svg'),
    out: join(publicDir, 'apple-touch-icon.png'),
    width: 180,
    height: 180,
  },
  {
    src: join(publicDir, 'og-default.svg'),
    out: join(publicDir, 'og-default.png'),
    width: 1200,
    height: 630,
  },
];

async function renderOne({ src, out, width, height }) {
  const svg = await readFile(src);
  // density: 96 dpi × scale ensures crisp rasterisation at the target size
  // without librsvg trying to downscale the SVG's intrinsic viewport.
  const buf = await sharp(svg, { density: 384 })
    .resize(width, height, { fit: 'cover' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await writeFile(out, buf);
  console.log(`  ✓ ${out.replace(projectRoot + '/', '')}  (${width}×${height})`);
}

console.log('Rendering brand bitmaps from SVG sources …');
for (const target of TARGETS) {
  try {
    await renderOne(target);
  } catch (err) {
    console.error(`  ✗ failed to render ${target.out}:`, err.message);
    process.exitCode = 1;
  }
}
