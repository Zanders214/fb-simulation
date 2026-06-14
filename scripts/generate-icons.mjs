/**
 * App icon generator — zero dependencies.
 *
 * Rasterises a classic soccer ball on a pitch-green background and writes every
 * asset the app needs (`icon`, `adaptive-icon`, `splash-icon`, `favicon`).
 * Shapes are drawn at a super-sampled resolution and box-downsampled for
 * anti-aliasing, then encoded with a tiny hand-rolled PNG writer (node:zlib).
 *
 * Run with: npm run icons
 */
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// ---------------------------------------------------------------- PNG encoder
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
};
function encodePNG(width, height, rgba, alpha) {
  const ch = alpha ? 4 : 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // colour type: 6=RGBA, 2=RGB
  const stride = width * ch;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = y * (stride + 1) + 1 + x * ch;
      raw[d] = rgba[s];
      raw[d + 1] = rgba[s + 1];
      raw[d + 2] = rgba[s + 2];
      if (alpha) raw[d + 3] = rgba[s + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- drawing
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

class Canvas {
  constructor(size) {
    this.size = size;
    this.buf = new Float64Array(size * size * 4); // straight RGBA, a in 0..1
  }
  // source-over compositing of a colour with coverage `a`
  blend(x, y, [r, g, b], a) {
    if (a <= 0) return;
    const i = (y * this.size + x) * 4;
    const da = this.buf[i + 3];
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.buf[i] = (r * a + this.buf[i] * da * (1 - a)) / oa;
    this.buf[i + 1] = (g * a + this.buf[i + 1] * da * (1 - a)) / oa;
    this.buf[i + 2] = (b * a + this.buf[i + 2] * da * (1 - a)) / oa;
    this.buf[i + 3] = oa;
  }
  // fill the whole canvas via a (x,y)->[ [r,g,b], a ] function
  paint(fn) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const [c, a] = fn(x, y);
        this.blend(x, y, c, a);
      }
  }
  forBox(x0, y0, x1, y1, fn) {
    const lo = (v) => Math.max(0, Math.floor(v));
    const hi = (v) => Math.min(this.size - 1, Math.ceil(v));
    for (let y = lo(y0); y <= hi(y1); y++) for (let x = lo(x0); x <= hi(x1); x++) fn(x, y);
  }
  disc(cx, cy, r, color, a = 1, clip) {
    this.forBox(cx - r, cy - r, cx + r, cy + r, (x, y) => {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r && (!clip || clip(x, y))) this.blend(x, y, color, a);
    });
  }
  ring(cx, cy, r, w, color, a = 1) {
    const ro = r + w / 2;
    const ri = r - w / 2;
    this.forBox(cx - ro, cy - ro, cx + ro, cy + ro, (x, y) => {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= ro * ro && d2 >= ri * ri) this.blend(x, y, color, a);
    });
  }
  polygon(pts, color, a = 1, clip) {
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    for (const [px, py] of pts) {
      minx = Math.min(minx, px);
      miny = Math.min(miny, py);
      maxx = Math.max(maxx, px);
      maxy = Math.max(maxy, py);
    }
    this.forBox(minx, miny, maxx, maxy, (x, y) => {
      if (inPoly(x + 0.5, y + 0.5, pts) && (!clip || clip(x, y))) this.blend(x, y, color, a);
    });
  }
  // thick line segment (capsule), optionally clipped
  segment(x1, y1, x2, y2, w, color, a = 1, clip) {
    const r = w / 2;
    this.forBox(Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.max(x1, x2) + r, Math.max(y1, y2) + r, (x, y) => {
      if (distSeg(x + 0.5, y + 0.5, x1, y1, x2, y2) <= r && (!clip || clip(x, y))) this.blend(x, y, color, a);
    });
  }
  // average SSxSS blocks -> target rgba (premultiplied for clean alpha edges)
  downsample(ss) {
    const w = this.size / ss;
    const out = new Uint8ClampedArray(w * w * 4);
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let dy = 0; dy < ss; dy++)
          for (let dx = 0; dx < ss; dx++) {
            const i = ((y * ss + dy) * this.size + (x * ss + dx)) * 4;
            const af = this.buf[i + 3];
            r += this.buf[i] * af;
            g += this.buf[i + 1] * af;
            b += this.buf[i + 2] * af;
            a += af;
          }
        const o = (y * w + x) * 4;
        if (a > 0) {
          out[o] = Math.round(r / a);
          out[o + 1] = Math.round(g / a);
          out[o + 2] = Math.round(b / a);
        }
        out[o + 3] = Math.round((a / (ss * ss)) * 255);
      }
    return { data: out, size: w };
  }
}

function inPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}
const pentagon = (cx, cy, r, rot) => {
  const p = [];
  for (let k = 0; k < 5; k++) {
    const a = rot + (k * 2 * Math.PI) / 5;
    p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return p;
};

// ----------------------------------------------------------------- the mark
const GREEN_TOP = hex('#0e7a58');
const GREEN_BOT = hex('#073f2c');
const GREEN_GLOW = hex('#16996e');
const WHITE = hex('#fdfefe');
const SHADE = hex('#dfe7e3'); // soft shading on the ball
const SEAM = hex('#18211e'); // near-black pattern
const RIM = hex('#0a3b2b'); // ball edge against white

/** Draw the soccer ball centred at (cx,cy) with radius R onto a Canvas. */
function drawBall(c, cx, cy, R) {
  const inBall = (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= R * R;
  };
  // soft contact shadow
  c.disc(cx, cy + R * 0.16, R * 0.98, hex('#04231a'), 0.28);
  // white ball body with a gentle vertical shade for volume
  c.forBox(cx - R, cy - R, cx + R, cy + R, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if (dx * dx + dy * dy > R * R) return;
    const t = (dy / R + 1) / 2; // 0 top -> 1 bottom
    c.blend(x, y, mix(WHITE, SHADE, t * 0.55), 1);
  });
  c.ring(cx, cy, R - R * 0.012, R * 0.024, RIM, 0.7);

  const up = -Math.PI / 2;
  const rc = R * 0.34; // central pentagon circumradius
  const ro = R * 0.26; // rim pentagon circumradius
  const seamW = R * 0.05;

  // 5 seams radiating from the central pentagon's vertices to the rim
  for (let k = 0; k < 5; k++) {
    const a = up + (k * 2 * Math.PI) / 5;
    c.segment(cx + rc * Math.cos(a), cy + rc * Math.sin(a), cx + R * Math.cos(a), cy + R * Math.sin(a), seamW, SEAM, 1, inBall);
  }
  // 5 rim pentagons (clipped by the ball edge) on the central edges
  for (let k = 0; k < 5; k++) {
    const a = up + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    const px = cx + R * 0.92 * Math.cos(a);
    const py = cy + R * 0.92 * Math.sin(a);
    c.polygon(pentagon(px, py, ro, a + Math.PI / 5), SEAM, 1, inBall);
  }
  // central pentagon (point up)
  c.polygon(pentagon(cx, cy, rc, up), SEAM, 1);
}

/** Paint the pitch-green background (vertical gradient + soft top glow). */
function paintPitch(c) {
  const n = c.size;
  c.paint((x, y) => {
    const base = mix(GREEN_TOP, GREEN_BOT, y / n);
    const dx = (x - n * 0.5) / n;
    const dy = (y - n * 0.34) / n;
    const glow = Math.max(0, 1 - (dx * dx + dy * dy) * 3.2);
    return [mix(base, GREEN_GLOW, glow * 0.5), 1];
  });
}

// --------------------------------------------------------------- asset build
function build(target, ss, { pitch, ballFrac }) {
  const c = new Canvas(target * ss);
  const px = c.size;
  if (pitch) paintPitch(c);
  drawBall(c, px / 2, px / 2, px * ballFrac);
  return c.downsample(ss);
}

const write = (name, { data, size }, alpha) => {
  writeFileSync(join(ASSETS, name), encodePNG(size, size, data, alpha));
  console.log(`wrote assets/${name} (${size}x${size})`);
};

// App icon (opaque, full bleed) + web favicon share the pitch-green design.
write('icon.png', build(1024, 4, { pitch: true, ballFrac: 0.34 }), false);
write('favicon.png', build(64, 8, { pitch: true, ballFrac: 0.34 }), false);
// Android adaptive foreground: ball only, inside the safe zone (bg colour is in app.json).
write('adaptive-icon.png', build(1024, 4, { pitch: false, ballFrac: 0.3 }), true);
// Splash: ball only on transparency (splash backgroundColor shows through).
write('splash-icon.png', build(1024, 4, { pitch: false, ballFrac: 0.4 }), true);
