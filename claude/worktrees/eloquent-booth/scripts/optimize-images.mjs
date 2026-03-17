#!/usr/bin/env node

/**
 * Image Optimization Pipeline for Green Room Partners
 *
 * Reads images from assets/originals/, generates multiple size and format
 * variants using sharp, and writes them to assets/optimized/ with
 * content-hash filenames. A manifest.json maps original filenames to
 * their generated variants.
 *
 * Usage:
 *   node scripts/optimize-images.mjs
 *   npm run assets:optimize
 */

import sharp from 'sharp';
import { createHash } from 'crypto';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const ORIGINALS_DIR = path.resolve(PROJECT_ROOT, 'assets/originals');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'assets/optimized');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'assets/manifest.json');

const SIZES = [
  { name: 'thumbnail', width: 320 },
  { name: 'medium', width: 800 },
  { name: 'large', width: 1600 },
  { name: 'original', width: null },
];

const FORMATS = [
  { name: 'webp', ext: 'webp', options: { quality: 80 } },
  { name: 'jpeg', ext: 'jpg', options: { quality: 85 } },
];

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tiff',
  '.tif',
]);

/**
 * Compute the first 8 hex characters of a buffer's SHA-256 digest.
 */
function contentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 8);
}

/**
 * Parse a filename into its base name (without extension) and extension.
 */
function parseFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const name = path.basename(filename, path.extname(filename));
  return { name, ext };
}

/**
 * Process a single image file: generate all size/format variants.
 * Returns the manifest entry for this file.
 */
async function processImage(filename, buffer) {
  const { name } = parseFilename(filename);
  const hash = contentHash(buffer);
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width || 0;

  const entry = {};
  let variantCount = 0;

  for (const size of SIZES) {
    // Skip sizes larger than the original (no upscaling)
    if (size.width !== null && size.width > originalWidth) {
      continue;
    }

    const sizeLabel = size.width !== null ? String(size.width) : 'full';
    const formatVariants = {};

    for (const format of FORMATS) {
      const outFilename = `${name}-${hash}-${sizeLabel}.${format.ext}`;
      const outPath = path.join(OUTPUT_DIR, outFilename);

      let pipeline = sharp(buffer);

      // Resize if this is not the "original" size
      if (size.width !== null) {
        pipeline = pipeline.resize(size.width, null, {
          withoutEnlargement: true,
        });
      }

      // Convert to the target format
      if (format.name === 'webp') {
        pipeline = pipeline.webp(format.options);
      } else if (format.name === 'jpeg') {
        pipeline = pipeline.jpeg(format.options);
      }

      await pipeline.toFile(outPath);
      formatVariants[format.name] = outFilename;
      variantCount++;
    }

    entry[size.name] = formatVariants;
  }

  return { entry, variantCount };
}

/**
 * Main pipeline: read originals, process each, write manifest.
 */
async function main() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Read the originals directory
  if (!existsSync(ORIGINALS_DIR)) {
    console.log(`Originals directory not found: ${ORIGINALS_DIR}`);
    console.log('Creating it now. Place source images there and re-run.');
    await mkdir(ORIGINALS_DIR, { recursive: true });
    return;
  }

  const files = await readdir(ORIGINALS_DIR);
  const imageFiles = files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });

  if (imageFiles.length === 0) {
    console.log('No images found in assets/originals/. Nothing to process.');
    console.log(
      'Supported formats: JPEG, PNG, WebP, AVIF, TIFF. SVGs are skipped.'
    );
    // Write an empty manifest so downstream tooling doesn't break
    await writeFile(MANIFEST_PATH, JSON.stringify({}, null, 2));
    console.log('Wrote empty manifest.json.');
    return;
  }

  console.log(`Found ${imageFiles.length} image(s) to process.\n`);

  const manifest = {};

  for (const filename of imageFiles) {
    const filePath = path.join(ORIGINALS_DIR, filename);
    const buffer = await readFile(filePath);

    try {
      const { entry, variantCount } = await processImage(filename, buffer);
      manifest[filename] = entry;
      console.log(
        `Processing ${filename} \u2192 ${variantCount} variants generated`
      );
    } catch (err) {
      console.error(`Error processing ${filename}: ${err.message}`);
    }
  }

  // Write manifest
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${path.relative(PROJECT_ROOT, MANIFEST_PATH)}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
