import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const markSvg = readFileSync(join(__dirname, 'rally-logo-mark.svg'));

// Generate apple-touch-icon (180x180) - logomark centered with padding
async function generateAppleTouchIcon() {
  const icon = await sharp(markSvg)
    .resize(140, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  await sharp({
    create: { width: 180, height: 180, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } }
  })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(join(__dirname, 'apple-touch-icon.png'));

  console.log('Created apple-touch-icon.png');
}

// Generate app-icon-1024 - logomark centered on neutral background
async function generateAppIcon() {
  const icon = await sharp(markSvg)
    .resize(700, 700, { fit: 'contain', background: { r: 245, g: 245, b: 245, alpha: 1 } })
    .toBuffer();

  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 245, g: 245, b: 245, alpha: 1 } }
  })
    .composite([{ input: icon, gravity: 'centre' }])
    .png()
    .toFile(join(__dirname, 'app-icon-1024.png'));

  console.log('Created app-icon-1024.png');
}

// Generate favicon.ico (multi-size ICO via PNG layers)
async function generateFaviconIco() {
  // Generate a 32x32 PNG and save as .ico (browsers accept PNG favicons)
  await sharp(markSvg)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer()
    .then(async (png32) => {
      const png16 = await sharp(markSvg)
        .resize(16, 16, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();

      // Create a proper ICO file with both 16x16 and 32x32 PNG entries
      const icoHeader = Buffer.alloc(6);
      icoHeader.writeUInt16LE(0, 0);      // reserved
      icoHeader.writeUInt16LE(1, 2);      // type: ICO
      icoHeader.writeUInt16LE(2, 4);      // count: 2 images

      const entry1 = Buffer.alloc(16);
      entry1.writeUInt8(16, 0);           // width
      entry1.writeUInt8(16, 1);           // height
      entry1.writeUInt8(0, 2);            // color palette
      entry1.writeUInt8(0, 3);            // reserved
      entry1.writeUInt16LE(1, 4);         // color planes
      entry1.writeUInt16LE(32, 6);        // bits per pixel
      entry1.writeUInt32LE(png16.length, 8);  // size
      entry1.writeUInt32LE(6 + 16 + 16, 12); // offset

      const entry2 = Buffer.alloc(16);
      entry2.writeUInt8(32, 0);
      entry2.writeUInt8(32, 1);
      entry2.writeUInt8(0, 2);
      entry2.writeUInt8(0, 3);
      entry2.writeUInt16LE(1, 4);
      entry2.writeUInt16LE(32, 6);
      entry2.writeUInt32LE(png32.length, 8);
      entry2.writeUInt32LE(6 + 16 + 16 + png16.length, 12);

      const ico = Buffer.concat([icoHeader, entry1, entry2, png16, png32]);
      writeFileSync(join(__dirname, 'favicon.ico'), ico);
      console.log('Created favicon.ico');
    });
}

await Promise.all([
  generateAppleTouchIcon(),
  generateAppIcon(),
  generateFaviconIco(),
]);

console.log('All brand assets generated!');
