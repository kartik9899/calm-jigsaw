/**
 * Creates minimal valid PNG placeholder files for assets/.
 * Run once before first `expo prebuild` or `expo start`:
 *   node scripts/create-placeholder-assets.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function solidPNG(w, h, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = 1 + w * 3;
  const raw = Buffer.allocUnsafe(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * stride + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'assets', 'puzzles'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets', 'sfx'), { recursive: true });

// accent blue — used for icon / adaptive-icon
const accent = solidPNG(1024, 1024, 107, 127, 160);
fs.writeFileSync(path.join(root, 'assets', 'icon.png'), accent);
fs.writeFileSync(path.join(root, 'assets', 'adaptive-icon.png'), accent);
fs.writeFileSync(path.join(root, 'assets', 'favicon.png'), solidPNG(48, 48, 107, 127, 160));

// sand background — splash
fs.writeFileSync(path.join(root, 'assets', 'splash-icon.png'), solidPNG(1284, 2778, 250, 249, 247));

// sample puzzle image (soft blue-grey)
fs.writeFileSync(path.join(root, 'assets', 'puzzles', 'sample.png'), solidPNG(1024, 768, 139, 166, 206));

console.log('Placeholder assets created in assets/');
