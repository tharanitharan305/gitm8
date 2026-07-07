#!/usr/bin/env node
/**
 * Generate a 128x128 PNG icon for the gitm8 VS Code extension.
 * Uses only Node.js built-ins (zlib) — no external dependencies.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const WIDTH = 128;
const HEIGHT = 128;
const CY = HEIGHT / 2; // center y
const CX = WIDTH / 2;  // center x
const RADIUS = 54;

// ── Create pixel buffer ────────────────────────────────────────
const pixels = Buffer.alloc(WIDTH * HEIGHT * 4, 0);

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const idx = (y * WIDTH + x) * 4;
    const dx = x - CX;
    const dy = y - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Circular background with soft edge
    if (dist < RADIUS - 3) {
      // Gradient from blue (#5B7FFF) to purple (#8B5CF6)
      const t = (dy / RADIUS) * 0.5 + 0.5; // -1..1 mapped to 0..1
      const r = Math.floor(91 - t * 30);    // 91 → 61
      const g = Math.floor(127 - t * 30);   // 127 → 97
      const b = Math.floor(255 - t * 40);   // 255 → 215
      pixels[idx + 0] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    } else if (dist < RADIUS + 2) {
      // Anti-aliased edge
      const aa = Math.max(0, 1 - (dist - RADIUS + 3) / 5);
      const t = (dy / RADIUS) * 0.5 + 0.5;
      const r = Math.floor((91 - t * 30) * aa);
      const g = Math.floor((127 - t * 30) * aa);
      const b = Math.floor((255 - t * 40) * aa);
      pixels[idx + 0] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = Math.floor(255 * aa);
    }

    // ── Draw a stylized "g" letter ──
    // Lowercase "g" drawn with pixel art approach
    // Using a simple 3-pixel-wide stroke

    const isG =
      drawGLetter(x, y, CX - 10, CY - 14, 28, 34);

    if (isG && pixels[idx + 3] > 0) {
      // White with slight anti-alias blend
      const alpha = pixels[idx + 3] / 255;
      pixels[idx + 0] = Math.floor(255 * alpha);
      pixels[idx + 1] = Math.floor(255 * alpha);
      pixels[idx + 2] = Math.floor(255 * alpha);
      pixels[idx + 3] = 255;
    }
  }
}

// ── Build PNG ───────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xffffffff;
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// Raw image data with filter bytes
const rawStride = WIDTH * 4 + 1;
const rawData = Buffer.alloc(rawStride * HEIGHT, 0);
for (let y = 0; y < HEIGHT; y++) {
  rawData[y * rawStride] = 0; // filter: None
  pixels.copy(rawData, y * rawStride + 1, y * WIDTH * 4, (y + 1) * WIDTH * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // default filter
ihdr[12] = 0; // no interlace

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rawData)),
  chunk('IEND', Buffer.alloc(0)),
]);

// ── Write file ──
const outPath = path.join(__dirname, '..', 'icon.png');
fs.writeFileSync(outPath, png);
console.log(`✓ Generated icon: ${outPath} (${png.length} bytes)`);

// ── "g" letter pixel-art renderer ──
function drawGLetter(px, py, gx, gy, gw, gh) {
  // Draw a clean sans-serif "g" using geometric primitives
  const strokeW = 5;
  const half = strokeW / 2;

  // Convert to local coordinates inside the "g" bounding box
  const lx = px - gx;
  const ly = py - gy;

  // The "g" consists of:
  // 1. A circular bowl (top loop)
  // 2. A descender stem curving to the right

  const bowlCx = gw * 0.4;
  const bowlCy = gh * 0.35;
  const bowlR = gh * 0.3;

  // Distance from bowl center
  const db = Math.sqrt((lx - bowlCx) ** 2 + (ly - bowlCy) ** 2);

  // Bowl ring (circle outline)
  if (Math.abs(db - bowlR) < half) {
    // Only the right side and bottom of the bowl
    const angle = Math.atan2(ly - bowlCy, lx - bowlCx);
    if (angle > -Math.PI * 0.9 && angle < Math.PI * 0.3) {
      return true;
    }
  }

  // Descender: vertical line on the right side going down, then curving left
  const stemX = bowlCx + bowlR * 0.7;
  if (lx > stemX - half && lx < stemX + half) {
    if (ly > bowlCy + bowlR * 0.3 && ly < gh * 0.82) {
      return true;
    }
  }

  // Bottom curve (tail curving left)
  const tailY = gh * 0.82;
  const tailStart = stemX;
  const tailEnd = bowlCx;
  if (ly > tailY - half && ly < tailY + half) {
    if (lx > tailEnd && lx < tailStart) {
      return true;
    }
  }

  return false;
}
