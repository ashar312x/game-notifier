/**
 * Generates assets/icon.png — a 16x16 gamepad-colored square.
 * Run once via: npm run setup
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

const W = 16, H = 16;
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

const rows = [];
for (let y = 0; y < H; y++) {
  const row = Buffer.alloc(1 + W * 3);
  row[0] = 0;
  for (let x = 0; x < W; x++) {
    const i = 1 + x * 3;
    const border = x === 0 || x === W - 1 || y === 0 || y === H - 1;
    row[i]   = border ? 0x00 : 0x5B; // R
    row[i+1] = border ? 0xB4 : 0xE2; // G
    row[i+2] = border ? 0xFF : 0xFF; // B — blue gradient
  }
  rows.push(row);
}

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
  chunk('IEND', Buffer.alloc(0)),
]);

const dir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon.png'), png);
console.log('Icon created at assets/icon.png');
