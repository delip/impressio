/** Scalar fields (Float32Array, row-major) and the few operators the press needs. */
export type Field = Float32Array;
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximately normal variate (sum of uniforms), cheap and bounded. */
export function gauss(rng: Rng): number {
  return (rng() + rng() + rng() + rng() - 2) * 1.732;
}

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function boxLines(src: Field, dst: Field, w: number, h: number, r: number, horiz: boolean) {
  const n = horiz ? w : h, lines = horiz ? h : w, stride = horiz ? 1 : w;
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const o = horiz ? l * w : l;
    const first = src[o], last = src[o + (n - 1) * stride];
    let sum = first * (r + 1);
    for (let k = 1; k <= r; k++) sum += src[o + Math.min(k, n - 1) * stride];
    for (let i = 0; i < n; i++) {
      dst[o + i * stride] = sum * inv;
      const a = i + r + 1, b = i - r;
      sum += (a < n ? src[o + a * stride] : last) - (b >= 0 ? src[o + b * stride] : first);
    }
  }
}

function tap3(src: Field, dst: Field, w: number, h: number, a: number, horiz: boolean) {
  const n = horiz ? w : h, lines = horiz ? h : w, stride = horiz ? 1 : w;
  const c = 1 - 2 * a;
  for (let l = 0; l < lines; l++) {
    const o = horiz ? l * w : l;
    for (let i = 0; i < n; i++) {
      const p = o + i * stride;
      dst[p] = c * src[p] + a * (src[i > 0 ? p - stride : p] + src[i < n - 1 ? p + stride : p]);
    }
  }
}

/** Gaussian-like blur (3 box passes), independent sigma per axis, in pixels. Returns a new field. */
export function blur(src: Field, w: number, h: number, sx: number, sy = sx): Field {
  let a = new Float32Array(src), b = new Float32Array(src.length);
  const axis = (sigma: number, horiz: boolean) => {
    if (sigma < 0.3) return;
    if (sigma < 0.9) {
      tap3(a, b, w, h, Math.min(sigma * sigma * 0.5, 1 / 3), horiz);
      [a, b] = [b, a];
      return;
    }
    const r = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
    for (let p = 0; p < 3; p++) { boxLines(a, b, w, h, r, horiz); [a, b] = [b, a]; }
  };
  axis(sx, true);
  axis(sy, false);
  return a;
}

/**
 * Band-limited noise: white noise blurred to a feature size, normalised to zero mean / unit variance.
 * Large feature sizes are synthesised at reduced resolution and upsampled.
 */
export function noise(w: number, h: number, sx: number, sy: number, rng: Rng): Field {
  const f = Math.max(1, Math.min(8, Math.floor(Math.min(sx, sy) / 2)));
  const lw = Math.ceil(w / f) + 2, lh = Math.ceil(h / f) + 2;
  let lo = new Float32Array(lw * lh);
  for (let i = 0; i < lo.length; i++) lo[i] = rng() * 2 - 1;
  lo = blur(lo, lw, lh, sx / f, sy / f) as Float32Array<ArrayBuffer>;
  let mean = 0;
  for (let i = 0; i < lo.length; i++) mean += lo[i];
  mean /= lo.length;
  let v = 0;
  for (let i = 0; i < lo.length; i++) { lo[i] -= mean; v += lo[i] * lo[i]; }
  const k = 1 / Math.sqrt(v / lo.length || 1);
  for (let i = 0; i < lo.length; i++) lo[i] *= k;
  if (f === 1) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) out.set(lo.subarray(y * lw, y * lw + w), y * w);
    return out;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / f, y0 = fy | 0, ty = fy - y0, r0 = y0 * lw, r1 = r0 + lw;
    for (let x = 0; x < w; x++) {
      const fx = x / f, x0 = fx | 0, tx = fx - x0;
      const a = lo[r0 + x0] + (lo[r0 + x0 + 1] - lo[r0 + x0]) * tx;
      const b = lo[r1 + x0] + (lo[r1 + x0 + 1] - lo[r1 + x0]) * tx;
      out[y * w + x] = a + (b - a) * ty;
    }
  }
  return out;
}
