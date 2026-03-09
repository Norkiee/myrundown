import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const svgPath = join(rootDir, 'app/icon.svg');
const iconsDir = join(rootDir, 'public/icons');

const svgContent = readFileSync(svgPath, 'utf-8');

// Generate icons
async function generateIcons() {
  // 192x192 transparent
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png()
    .toFile(join(iconsDir, 'icon-192.png'));
  console.log('Created icon-192.png');

  // 512x512 transparent
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'icon-512.png'));
  console.log('Created icon-512.png');

  // 512x512 maskable (with background and padding)
  const maskableSize = 512;
  const iconSize = Math.floor(maskableSize * 0.6); // 60% of canvas for safe area
  const padding = Math.floor((maskableSize - iconSize) / 2);

  const iconBuffer = await sharp(Buffer.from(svgContent))
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 8, g: 8, b: 8, alpha: 1 } // #080808
    }
  })
    .composite([{ input: iconBuffer, top: padding, left: padding }])
    .png()
    .toFile(join(iconsDir, 'icon-maskable-512.png'));
  console.log('Created icon-maskable-512.png');

  // Apple touch icon (180x180 with solid background)
  const appleSize = 180;
  const appleIconSize = Math.floor(appleSize * 0.75);
  const applePadding = Math.floor((appleSize - appleIconSize) / 2);

  const appleIconBuffer = await sharp(Buffer.from(svgContent))
    .resize(appleIconSize, appleIconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: appleSize,
      height: appleSize,
      channels: 4,
      background: { r: 8, g: 8, b: 8, alpha: 1 }
    }
  })
    .composite([{ input: appleIconBuffer, top: applePadding, left: applePadding }])
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');
}

generateIcons().catch(console.error);
