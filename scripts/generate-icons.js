import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Brand colors
const COLOR_BG = [83, 158, 70, 255]; // #539E46 Rejseplanen green
const COLOR_WHITE = [255, 255, 255, 255]; // #FFFFFF
const COLOR_ACCENT = [254, 240, 138, 255]; // #FEF08A Warm headlight glow
const COLOR_TRANSPARENT = [0, 0, 0, 0];

// Precompute CRC32 table for PNG encoding
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Encodes RGBA pixel buffer to a valid PNG file buffer
 */
function encodePNG(width, height, rgbaBuffer) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0; // Filter: None
    rgbaBuffer.copy(rawData, y * rowSize + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 });
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(12 + len);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    if (len > 0) {
      data.copy(chunk, 8);
    }
    const crc = crc32(chunk.subarray(4, 8 + len));
    chunk.writeUInt32BE(crc, 8 + len);
    return chunk;
  }

  return Buffer.concat([
    header,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflated),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Geometry primitives for 512x512 reference space
function pointInRoundedRect(px, py, rx0, ry0, width, height, radius) {
  const rx1 = rx0 + width;
  const ry1 = ry0 + height;
  if (px < rx0 || px > rx1 || py < ry0 || py > ry1) return false;
  const cx = (rx0 + rx1) / 2;
  const cy = (ry0 + ry1) / 2;
  const hw = width / 2;
  const hh = height / 2;
  const dx = Math.abs(px - cx) - (hw - radius);
  const dy = Math.abs(py - cy) - (hh - radius);
  if (dx <= 0 || dy <= 0) return true;
  return dx * dx + dy * dy <= radius * radius;
}

function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function pointInSegment(px, py, x1, y1, x2, y2, strokeWidth) {
  const half = strokeWidth / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    return pointInCircle(px, py, x1, y1, half);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const qdx = px - qx;
  const qdy = py - qy;
  return qdx * qdx + qdy * qdy <= half * half;
}

/**
 * Evaluates the color at coordinate (x, y) in 512x512 space
 */
function sampleIcon(x, y, isMaskable = false) {
  // Base background
  let color = COLOR_BG;

  // Track: sleeper
  if (pointInSegment(x, y, 148, 416, 364, 416, 14)) {
    color = COLOR_WHITE;
  }
  // Track: left & right angled rails
  if (pointInSegment(x, y, 180, 386, 168, 434, 14)) {
    color = COLOR_WHITE;
  }
  if (pointInSegment(x, y, 332, 386, 344, 434, 14)) {
    color = COLOR_WHITE;
  }

  // Pantograph
  if (pointInRoundedRect(x, y, 226, 76, 60, 8, 4)) {
    color = COLOR_WHITE;
  }
  if (pointInSegment(x, y, 234, 108, 256, 78, 8)) {
    color = COLOR_WHITE;
  }
  if (pointInSegment(x, y, 278, 108, 256, 78, 8)) {
    color = COLOR_WHITE;
  }
  if (pointInRoundedRect(x, y, 238, 104, 36, 8, 3)) {
    color = COLOR_WHITE;
  }

  // Train Body
  if (pointInRoundedRect(x, y, 140, 112, 232, 256, 46)) {
    color = COLOR_WHITE;

    // Windshield Cutout
    if (pointInRoundedRect(x, y, 160, 152, 192, 112, 22)) {
      color = COLOR_BG;
    }

    // Destination display cutout
    if (pointInRoundedRect(x, y, 198, 126, 116, 14, 5)) {
      color = COLOR_BG;
    }

    // Front grille cutout
    if (pointInRoundedRect(x, y, 224, 308, 64, 12, 5)) {
      color = COLOR_BG;
    }

    // Dual Headlights
    if (pointInCircle(x, y, 184, 314, 18) || pointInCircle(x, y, 328, 314, 18)) {
      color = COLOR_BG;
    }
    // Headlight inner glow
    if (pointInCircle(x, y, 184, 314, 9) || pointInCircle(x, y, 328, 314, 9)) {
      color = COLOR_ACCENT;
    }
  }

  return color;
}

/**
 * Render raster icon of dimension (width, height) with 4x4 supersampling anti-aliasing
 */
function renderRasterIcon(width, height, isMaskable = false) {
  const buf = Buffer.alloc(width * height * 4);
  const SAMPLES = 4; // 4x4 = 16 subpixels
  const INV_SAMPLES_SQ = 1 / (SAMPLES * SAMPLES);
  const scale = 512 / width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const subX = (x + (sx + 0.5) / SAMPLES) * scale;
          const subY = (y + (sy + 0.5) / SAMPLES) * scale;

          const [r, g, b, a] = sampleIcon(subX, subY, isMaskable);
          rSum += r;
          gSum += g;
          bSum += b;
          aSum += a;
        }
      }

      const idx = (y * width + x) * 4;
      buf[idx] = Math.round(rSum * INV_SAMPLES_SQ);
      buf[idx + 1] = Math.round(gSum * INV_SAMPLES_SQ);
      buf[idx + 2] = Math.round(bSum * INV_SAMPLES_SQ);
      buf[idx + 3] = Math.round(aSum * INV_SAMPLES_SQ);
    }
  }

  return encodePNG(width, height, buf);
}

/**
 * Generate standard SVG icon
 */
function generateSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Rejseplanen Brand Green Background -->
  <rect width="512" height="512" rx="96" fill="#539E46"/>

  <!-- Track: Sleeper and Rails -->
  <line x1="148" y1="416" x2="364" y2="416" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>
  <line x1="180" y1="386" x2="168" y2="434" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>
  <line x1="332" y1="386" x2="344" y2="434" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round"/>

  <!-- Pantograph -->
  <rect x="226" y="76" width="60" height="8" rx="4" fill="#FFFFFF"/>
  <polyline points="234,108 256,78 278,108" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="238" y="104" width="36" height="8" rx="3" fill="#FFFFFF"/>

  <!-- Train Body -->
  <rect x="140" y="112" width="232" height="256" rx="46" fill="#FFFFFF"/>

  <!-- Destination Display Cutout -->
  <rect x="198" y="126" width="116" height="14" rx="5" fill="#539E46"/>

  <!-- Windshield Cutout -->
  <rect x="160" y="152" width="192" height="112" rx="22" fill="#539E46"/>

  <!-- Center Grille Cutout -->
  <rect x="224" y="308" width="64" height="12" rx="5" fill="#539E46"/>

  <!-- Dual Headlights -->
  <!-- Left Headlight -->
  <circle cx="184" cy="314" r="18" fill="#539E46"/>
  <circle cx="184" cy="314" r="9" fill="#FEF08A"/>

  <!-- Right Headlight -->
  <circle cx="328" cy="314" r="18" fill="#539E46"/>
  <circle cx="328" cy="314" r="9" fill="#FEF08A"/>
</svg>
`;
}

// Generate all target files in public/
function main() {
  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Generating PWA icons in:', publicDir);

  // 1. favicon.svg
  const svgPath = path.join(publicDir, 'favicon.svg');
  fs.writeFileSync(svgPath, generateSVG(), 'utf8');
  console.log('Created: favicon.svg');

  // 2. pwa-192x192.png
  const pwa192Path = path.join(publicDir, 'pwa-192x192.png');
  fs.writeFileSync(pwa192Path, renderRasterIcon(192, 192, false));
  console.log('Created: pwa-192x192.png (192x192)');

  // 3. pwa-512x512.png
  const pwa512Path = path.join(publicDir, 'pwa-512x512.png');
  fs.writeFileSync(pwa512Path, renderRasterIcon(512, 512, false));
  console.log('Created: pwa-512x512.png (512x512)');

  // 4. maskable-icon-512x512.png
  const maskablePath = path.join(publicDir, 'maskable-icon-512x512.png');
  fs.writeFileSync(maskablePath, renderRasterIcon(512, 512, true));
  console.log('Created: maskable-icon-512x512.png (512x512, maskable safe-zone padded)');

  // 5. apple-touch-icon.png
  const applePath = path.join(publicDir, 'apple-touch-icon.png');
  fs.writeFileSync(applePath, renderRasterIcon(180, 180, false));
  console.log('Created: apple-touch-icon.png (180x180)');

  console.log('All brand icon assets generated successfully.');
}

main();
