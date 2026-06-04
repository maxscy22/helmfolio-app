// One-off site image optimizer for SEO / Core Web Vitals.
//
// Recompresses the marketing-site images in place (same filenames & formats,
// so no HTML changes are needed) and shrinks the oversized favicon/logo.
// Originals are backed up to site/assets/_original/ the first time it runs, so
// every run re-optimizes from the pristine source (idempotent, reversible).
//
// Usage:  npm run optimize-images
// Requires: sharp (devDependency).

import { readdir, mkdir, copyFile, stat, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, '..', 'site', 'assets');
// Keep backups OUTSIDE site/ so they are never published by Cloudflare Pages.
const BACKUP = path.resolve(__dirname, '..', '.image-originals');

// Per-file optimization plan. Anything not listed is left untouched.
//   logo    -> resize to a sensible max (only ever shown <=64px) + optimize PNG
//   jpg     -> re-encode mozjpeg quality, optionally cap width
//   png     -> optimize / optionally cap width
const PLAN = {
  'helmfolio-mark.png': { kind: 'png', maxWidth: 256 },
  'og-image.jpg': { kind: 'jpg', quality: 82 },
  'screenshot-dashboard.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-kpis.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-benchmark.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-equity.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-cash.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-calendar.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'screenshot-leaderboard.jpg': { kind: 'jpg', quality: 80, maxWidth: 1600 },
  'csv_report.png': { kind: 'png', maxWidth: 1400 },
  'flex-query-config.png': { kind: 'png', maxWidth: 1400 },
};

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function exists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureBackup(name) {
  await mkdir(BACKUP, { recursive: true });
  const backupPath = path.join(BACKUP, name);
  if (!(await exists(backupPath))) {
    await copyFile(path.join(ASSETS, name), backupPath);
  }
  return backupPath;
}

async function optimizeOne(name, opts) {
  const livePath = path.join(ASSETS, name);
  if (!(await exists(livePath))) {
    console.warn(`  skip  ${name} (not found)`);
    return;
  }
  // Always read from the pristine backup so reruns don't recompress JPEG twice.
  const sourcePath = await ensureBackup(name);
  const before = (await stat(sourcePath)).size;

  let pipeline = sharp(sourcePath, { failOn: 'none' });
  const meta = await pipeline.metadata();

  if (opts.maxWidth && meta.width && meta.width > opts.maxWidth) {
    pipeline = pipeline.resize({ width: opts.maxWidth, withoutEnlargement: true });
  }

  if (opts.kind === 'jpg') {
    pipeline = pipeline.jpeg({ quality: opts.quality ?? 80, mozjpeg: true, progressive: true });
  } else {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true, effort: 8 });
  }

  const buf = await pipeline.toBuffer();
  // Guard: never write a result that is somehow larger than the source.
  const { writeFile } = await import('node:fs/promises');
  if (buf.length < before) {
    await writeFile(livePath, buf);
    const pct = (100 * (1 - buf.length / before)).toFixed(0);
    console.log(`  ok    ${name}  ${kb(before)} -> ${kb(buf.length)}  (-${pct}%)`);
  } else {
    await writeFile(livePath, await sharp(sourcePath).toBuffer());
    console.log(`  keep  ${name}  ${kb(before)} (already optimal)`);
  }
}

async function main() {
  console.log(`Optimizing site images in ${ASSETS}\n`);
  const names = await readdir(ASSETS);
  let total = 0;
  for (const name of names) {
    if (PLAN[name]) {
      await optimizeOne(name, PLAN[name]);
      total += 1;
    }
  }
  console.log(`\nDone. Processed ${total} file(s). Backups in ${BACKUP}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
