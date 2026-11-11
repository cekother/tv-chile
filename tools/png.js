const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

function icon(width, height = width) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const bg = [14, 17, 22];
  const fg = [255, 176, 32];
  const unit = Math.min(width, height);
  const x0 = width / 2 - unit * 0.12;
  const x1 = width / 2 + unit * 0.2;
  const cy = height / 2;
  const half = unit * 0.2;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const t = (x - x0) / (x1 - x0);
      const inside = t >= 0 && t <= 1 && Math.abs(y - cy) <= half * (1 - t);
      raw.set(inside ? fg : bg, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { icon };
