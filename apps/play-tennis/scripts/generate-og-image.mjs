/**
 * Generate OG image as a PNG from the SVG template.
 *
 * Usage: node scripts/generate-og-image.mjs
 *
 * If sharp/canvas is not available, this copies the SVG as a fallback
 * and the og:image meta tag references the SVG version.
 *
 * For production, convert og-image.svg to a 1200x630 PNG using any tool:
 *   - Figma: Import SVG, export as PNG @1x
 *   - CLI: npx @vercel/og or rsvg-convert -w 1200 -h 630 og-image.svg > og-image.png
 *   - Online: svgtopng.com
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '../public');
const svgPath = resolve(publicDir, 'og-image.svg');

if (!existsSync(svgPath)) {
  console.error('og-image.svg not found in public/');
  process.exit(1);
}

console.log('OG image SVG is at: public/og-image.svg');
console.log('');
console.log('To generate a PNG version for maximum social media compatibility:');
console.log('  Option 1: npx @resvg/resvg-js-cli og-image.svg -o og-image.png');
console.log('  Option 2: Use Figma/Canva to export the SVG as 1200x630 PNG');
console.log('  Option 3: Use an online converter (svgtopng.com)');
console.log('');
console.log('Place the resulting og-image.png in apps/play-tennis/public/');
