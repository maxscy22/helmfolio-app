// Generates the desktop app icons from a single source PNG.
//
//   build/icon-source.png  ->  build/icon.ico  (Windows, multi-resolution)
//                              build/icon.icns (macOS)
//                              build/icon.png  (Linux, cleaned 1024)
//
// The source is an AI-generated rounded-square icon on a WHITE canvas. App
// icons should have transparent corners, so we flood-fill the near-white
// background inward from the four canvas corners and make it transparent. The
// white monitor base inside the artwork is enclosed by a black outline, so it
// is never connected to the edges and is left untouched.
//
// Pure-JS deps only (pngjs + png2icons) so there is no native build step.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';
import png2icons from 'png2icons';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(here, '..', 'build');
const sourcePath = resolve(buildDir, 'icon-source.png');

// Pixels brighter than this (all channels) are treated as background white.
const WHITE_THRESHOLD = 235;

function makeCornersTransparent(png) {
  const { width, height, data } = png;
  const visited = new Uint8Array(width * height);
  const stack = [];

  const isWhite = (idx) => {
    const o = idx * 4;
    return data[o] >= WHITE_THRESHOLD && data[o + 1] >= WHITE_THRESHOLD && data[o + 2] >= WHITE_THRESHOLD;
  };

  const seed = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx] && isWhite(idx)) {
      visited[idx] = 1;
      stack.push(idx);
    }
  };

  // Seed from every edge pixel so background is removed even if a corner is
  // slightly off-white.
  for (let x = 0; x < width; x += 1) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y += 1) { seed(0, y); seed(width - 1, y); }

  let cleared = 0;
  while (stack.length) {
    const idx = stack.pop();
    data[idx * 4 + 3] = 0; // transparent
    cleared += 1;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
  return cleared;
}

const source = PNG.sync.read(readFileSync(sourcePath));
if (source.width !== source.height) {
  console.warn(`[make-icons] Warning: source is ${source.width}x${source.height} (not square). A square 1024x1024 PNG is recommended.`);
}
const clearedPixels = makeCornersTransparent(source);
const cleanedPng = PNG.sync.write(source);

writeFileSync(resolve(buildDir, 'icon.png'), cleanedPng);

const ico = png2icons.createICO(cleanedPng, png2icons.BICUBIC2, 0, true);
if (!ico) throw new Error('Failed to generate icon.ico');
writeFileSync(resolve(buildDir, 'icon.ico'), ico);

const icns = png2icons.createICNS(cleanedPng, png2icons.BICUBIC2, 0);
if (!icns) throw new Error('Failed to generate icon.icns');
writeFileSync(resolve(buildDir, 'icon.icns'), icns);

console.log(`[make-icons] Done. Source ${source.width}x${source.height}, made ${clearedPixels.toLocaleString()} background pixels transparent.`);
console.log('[make-icons] Wrote build/icon.png, build/icon.ico, build/icon.icns');
