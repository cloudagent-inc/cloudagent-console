#!/usr/bin/env node
/**
 * Generate app icons from SVG source
 * Run: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '../build');

async function generateIcons() {
  try {
    const sharp = (await import('sharp')).default;
    const svgPath = join(buildDir, 'icon.svg');
    const svgBuffer = readFileSync(svgPath);

    // Generate PNG icons at different sizes
    const sizes = [16, 32, 64, 128, 256, 512, 1024];
    
    mkdirSync(join(buildDir, 'icons'), { recursive: true });

    for (const size of sizes) {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(buildDir, 'icons', `${size}x${size}.png`));
      console.log(`Generated ${size}x${size}.png`);
    }

    // Generate main icon.png (512x512 for electron-builder)
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(join(buildDir, 'icon.png'));
    console.log('Generated icon.png (512x512)');

    // Generate high-res icon for macOS
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(join(buildDir, 'icon@2x.png'));
    console.log('Generated icon@2x.png (1024x1024)');

    console.log('\nIcons generated successfully!');
    console.log('electron-builder will auto-generate .icns (macOS) and .ico (Windows) from these.');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message?.includes('sharp')) {
      console.error('sharp package not found. Install it first:');
      console.error('  npm install --save-dev sharp');
      console.error('\nAlternatively, you can manually convert the SVG to PNG:');
      console.error('  1. Open build/icon.svg in a browser');
      console.error('  2. Take a screenshot or use an online SVG to PNG converter');
      console.error('  3. Save as build/icon.png (512x512 minimum)');
      process.exit(1);
    }
    throw error;
  }
}

generateIcons();
