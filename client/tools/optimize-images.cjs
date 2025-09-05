#!/usr/bin/env node
/*
  Simple image optimizer: converts JPG/PNG images to WebP using sharp.
  Usage: node tools/optimize-images.cjs
  Runs relative to the client/ folder and targets these folders (if present):
    - ../fotos
    - ./public
    - ../staticfiles/public
  It will create `.webp` files next to originals. It does not overwrite originals.
*/

const fs = require('fs');
const path = require('path');
let sharp;
try {
  // lazy require sharp (native) so environments without libvips don't fail the whole build
  sharp = require('sharp');
} catch (err) {
  console.warn('\n[optimize-images] `sharp` is not installed or failed to load. Skipping image optimization.');
  console.warn('[optimize-images] To enable image optimization install sharp as a devDependency: `npm i -D sharp`');
  // Exit cleanly — optimizer is optional and should not break builds in CI/headless envs
  process.exit(0);
}

const TARGET_DIRS = [
  path.resolve(__dirname, '..', 'fotos'),
  path.resolve(__dirname, '..', 'staticfiles', 'public'),
  path.resolve(__dirname, '..', 'staticfiles', 'src', 'assets'),
  path.resolve(__dirname, 'public'),
];

const extensions = ['.jpg', '.jpeg', '.png'];

async function walk(dir, filelist = []) {
  try {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const file of files) {
      const res = path.resolve(dir, file.name);
      if (file.isDirectory()) {
        await walk(res, filelist);
      } else {
        filelist.push(res);
      }
    }
  } catch (err) {
    // ignore missing directories
  }
  return filelist;
}

async function optimizeFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!extensions.includes(ext)) return false;
  const out = file + '.webp';
  try {
    const img = sharp(file);
    await img.webp({ quality: 75 }).toFile(out);
    return out;
  } catch (err) {
    console.error('Failed to convert', file, err.message || err);
    return false;
  }
}

async function process() {
  const processed = [];
  for (const dir of TARGET_DIRS) {
    const exists = fs.existsSync(dir);
    if (!exists) continue;
    console.log('Scanning', dir);
    const files = await walk(dir);
    for (const f of files) {
      const res = await optimizeFile(f);
      if (res) processed.push(res);
    }
  }
  console.log('\nDone. Created', processed.length, 'webp files.');
  if (processed.length > 0) console.log(processed.slice(0, 20).join('\n'));
}

process().catch(err => {
  console.error(err);
  process.exit(1);
});
