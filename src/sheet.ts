import { ENCODE, makeCanvas, parseColor, type AnyCanvas, type Ctx2D } from './canvas';
import { blur, clamp, gauss, mulberry32, noise, smoothstep, type Field, type Rng } from './field';
import { Forme } from './forme';
import {
  impressions, resolveInk, resolvePaper,
  type ImpressionName, type ImpressionSpec, type Light, type PaperSpec,
} from './materials';

export interface SheetOptions {
  /** Sheet size in CSS px. */
  width: number;
  height: number;
  /** A named paper, a CSS colour, or a (partial) PaperSpec. */
  paper?: PaperSpec | Partial<PaperSpec> | string;
  /** Device pixels per CSS px (default: devicePixelRatio, capped at 2). */
  pixelRatio?: number;
  /** Every sheet is unique; the same seed reproduces the same sheet and the same press run. */
  seed?: number;
  light?: Light;
  /** Draw into this canvas instead of creating one. */
  canvas?: AnyCanvas;
}

const DEFAULT_LIGHT: Required<Light> = {
  azimuth: 315, elevation: 42, intensity: 1, ambient: 0.3, shadow: 0.6, occlusion: 0.5, falloff: 0.06, color: '#ffffff',
};

/**
 * A sheet of paper. It carries the physical state the press acts on:
 * a height field (the sheet's body plus its surface tooth), a reflectance map, and a gloss map.
 * `impress()` deforms and inks it; `render()` photographs it under a light.
 */
export class Sheet {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly paper: PaperSpec;
  readonly canvas: AnyCanvas;
  light: Required<Light>;

  private W: number;
  private H: number;
  private rng: Rng;
  /** Linear-light reflectance, RGB interleaved. */
  private albedo: Field;
  /** Body of the sheet: cockle, edge thinning and every impression. Device px. */
  private base: Field;
  /** Surface tooth and fibres, flattened wherever the forme has pressed. Device px. */
  private relief: Field;
  /** Unit-variance tooth: which points of the surface stand proud and meet the forme first. */
  private tooth: Field;
  private gloss: Field;
  private metal: Field;
  private alpha: Field | null = null;
  private dirty = true;
  private cavity: Field | null = null;
  private out: ImageData | null = null;

  constructor(o: SheetOptions) {
    this.width = o.width;
    this.height = o.height;
    const dpr = typeof devicePixelRatio === 'number' ? Math.min(devicePixelRatio, 2) : 1;
    const s = (this.pixelRatio = o.pixelRatio ?? dpr);
    const W = (this.W = Math.max(1, Math.round(o.width * s)));
    const H = (this.H = Math.max(1, Math.round(o.height * s)));
    this.paper = resolvePaper(o.paper);
    this.light = { ...DEFAULT_LIGHT, ...o.light };
    this.rng = mulberry32(o.seed ?? (Math.random() * 2 ** 32) >>> 0);
    this.canvas = o.canvas ?? makeCanvas(W, H);
    this.canvas.width = W;
    this.canvas.height = H;
    const n = W * H;
    this.albedo = new Float32Array(n * 3);
    this.base = new Float32Array(n);
    this.relief = new Float32Array(n);
    this.tooth = new Float32Array(n);
    this.gloss = new Float32Array(n).fill(this.paper.sheen);
    this.metal = new Float32Array(n);
    this.makePaper();
  }

  // ---------------------------------------------------------------- paper

  private makePaper() {
    const { W, H, rng, paper: p } = this, s = this.pixelRatio, n = W * H;
    const ts = p.toothScale * s;
    const t1 = noise(W, H, ts, ts, rng), t2 = noise(W, H, ts / 2.6, ts / 2.6, rng), t3 = noise(W, H, 0.55 * s, 0.55 * s, rng);
    const cloud = noise(W, H, 22 * s, 22 * s, rng), fine = noise(W, H, 3 * s, 3 * s, rng), tint = noise(W, H, 35 * s, 35 * s, rng);
    const cockle = p.cockle > 0 ? noise(W, H, 45 * s, 45 * s, rng) : null;
    const warp = p.weave > 0 ? noise(W, H, 12 * s, 12 * s, rng) : null;
    const [cr, cg, cb] = parseColor(p.color);
    const amp = p.tooth * 0.27 * s, k = (2 * Math.PI) / (3.4 * s);
    for (let i = 0; i < n; i++) {
      const u = 0.62 * t1[i] + 0.58 * t2[i] + 0.5 * t3[i];
      this.tooth[i] = u;
      let r = u * amp;
      if (warp) {
        const x = i % W, y = (i / W) | 0, w = warp[i] * s;
        r += p.weave * 0.07 * s * (Math.sin((x + w * 1.3) * k) + Math.sin((y - w) * k));
      }
      this.relief[i] = r;
      if (cockle) this.base[i] = cockle[i] * p.cockle * 1.4 * s;
      const l = 1 + p.formation * (0.024 * cloud[i] + 0.012 * fine[i]) - 0.006 * u * p.tooth;
      const j = i * 3, tn = p.formation * tint[i];
      this.albedo[j] = cr * l * (1 + 0.007 * tn);
      this.albedo[j + 1] = cg * l;
      this.albedo[j + 2] = cb * l * (1 - 0.012 * tn);
    }

    // Fibres of the furnish itself: slightly lighter or darker, standing a hair proud.
    const area = (this.width * this.height) / 1e4;
    for (let f = Math.round(p.fibers * area); f > 0; f--) {
      const tone = rng() < 0.65 ? 1 + 0.03 + rng() * 0.05 : 1 - 0.03 - rng() * 0.06;
      this.strand(4 + rng() * rng() * 30, 0.25 + rng() * 0.4, 0.05 + rng() * 0.12, (i, a) => {
        const j = i * 3, m = 1 + (tone - 1) * a;
        this.albedo[j] *= m; this.albedo[j + 1] *= m; this.albedo[j + 2] *= m;
        this.relief[i] += a * 0.1 * s;
      });
    }
    // Rare foreign inclusions: shives, dyed threads, specks.
    const flecks = p.inclusions * area;
    const palette = ['#3a2a1c', '#4a4038', '#2b2b2e', '#5a3d24', '#2a3c66', '#7a2a22'];
    for (let f = Math.floor(flecks) + (rng() < flecks % 1 ? 1 : 0); f > 0; f--) {
      const [fr, fg, fb] = parseColor(palette[Math.floor(rng() * rng() * palette.length)]);
      const op = 0.3 + rng() * 0.45, speck = rng() < 0.4;
      this.strand(speck ? 0.4 : 2 + rng() * 9, speck ? 0.7 + rng() * 0.8 : 0.3 + rng() * 0.35, 0.2, (i, a) => {
        const j = i * 3, t = a * op;
        this.albedo[j] += (fr - this.albedo[j]) * t;
        this.albedo[j + 1] += (fg - this.albedo[j + 1]) * t;
        this.albedo[j + 2] += (fb - this.albedo[j + 2]) * t;
      });
    }

    if (p.deckle > 0) {
      const a = (this.alpha = new Float32Array(n));
      const n1 = noise(W, H, 5 * s, 5 * s, rng), n2 = noise(W, H, 1.1 * s, 1.1 * s, rng);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, d = Math.min(x, W - 1 - x, y, H - 1 - y) / s;
        if (d > p.deckle * 3.5) { a[i] = 1; continue; }
        const edge = Math.max(0.6, p.deckle * (0.5 + 0.28 * n1[i] + 0.1 * n2[i]));
        a[i] = smoothstep(edge - 0.7, edge + 0.7, d);
        const thin = 1 - smoothstep(edge, edge + p.deckle * 1.4, d);
        this.base[i] -= thin * thin * 1.6 * s;
        const j = i * 3, m = 1 + 0.05 * thin;
        this.albedo[j] *= m; this.albedo[j + 1] *= m; this.albedo[j + 2] *= m;
      }
    }
  }

  /** Rasterise one wandering strand; `cb` receives pixel index and coverage. */
  private strand(len: number, width: number, wander: number, cb: (i: number, a: number) => void) {
    const { W, H, rng } = this, s = this.pixelRatio;
    const cov = new Map<number, number>();
    let x = rng() * W, y = rng() * H, ang = rng() * Math.PI * 2;
    const steps = Math.max(1, Math.round((len * s) / 0.6)), r = (width * s) / 2, ext = Math.ceil(r + 1);
    for (let k = 0; k <= steps; k++) {
      const taper = steps > 2 ? Math.sqrt(Math.sin((Math.PI * (k + 0.5)) / (steps + 1))) : 1;
      for (let yy = Math.floor(y - ext); yy <= y + ext; yy++) {
        if (yy < 0 || yy >= H) continue;
        for (let xx = Math.floor(x - ext); xx <= x + ext; xx++) {
          if (xx < 0 || xx >= W) continue;
          const a = clamp(r + 0.5 - Math.hypot(xx + 0.5 - x, yy + 0.5 - y)) * taper;
          if (a > 0) { const i = yy * W + xx; if (a > (cov.get(i) ?? 0)) cov.set(i, a); }
        }
      }
      x += Math.cos(ang) * 0.6; y += Math.sin(ang) * 0.6; ang += gauss(rng) * wander;
    }
    cov.forEach((a, i) => cb(i, a));
  }

  // ---------------------------------------------------------------- press

  /**
   * One pass through the press. Lock up a forme in `draw`, and the sheet is debossed and inked by it.
   * Call repeatedly for multiple colours, blind passes, overprints or foil.
   */
  impress(spec: ImpressionSpec | ImpressionName, draw: (forme: Forme) => void): this {
    const { W, H, rng } = this, s = this.pixelRatio, n = W * H, p = this.paper;
    const o: Required<Omit<ImpressionSpec, 'register'>> & Pick<ImpressionSpec, 'register'> = { ...impressions.deep, ink: 'black', ...(typeof spec === 'string' ? impressions[spec] : spec) };
    const inkSpec = resolveInk(o.ink);

    // 1. The forme: alpha = printing face, red = height off type-high.
    const cv = makeCanvas(W, H, true);
    const ctx = cv.getContext('2d', { willReadFrequently: true }) as Ctx2D;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const reg = o.register;
    if (reg) {
      ctx.translate(this.width / 2 + (reg.x ?? 0), this.height / 2 + (reg.y ?? 0));
      ctx.rotate(((reg.rotate ?? 0) * Math.PI) / 180);
      ctx.translate(-this.width / 2, -this.height / 2);
    }
    ctx.font = '16px serif';
    draw(new Forme(ctx, this.width, this.height, rng));

    // Damage to the face: scratches and nicks are simply missing printing surface.
    if (o.wear > 0) {
      const area = (this.width * this.height) / 1e4;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      const bias = rng() * Math.PI;
      for (let k = Math.round(o.wear * area * 2.2); k > 0; k--) {
        const x = rng() * this.width, y = rng() * this.height, a = bias + gauss(rng) * 0.5, l = 2 + rng() * rng() * 34;
        ctx.globalAlpha = 0.45 + rng() * 0.55;
        ctx.lineWidth = 0.2 + rng() * 0.55;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.2) * l * 0.5, y + Math.sin(a + 0.2) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      for (let k = Math.round(o.wear * area * 5); k > 0; k--) {
        ctx.globalAlpha = 0.5 + rng() * 0.5;
        ctx.beginPath();
        ctx.ellipse(rng() * this.width, rng() * this.height, 0.25 + rng() * rng() * 1.3, 0.2 + rng() * 0.6, rng() * 3, 0, 7);
        ctx.fill();
      }
    }
    const px = ctx.getImageData(0, 0, W, H).data;
    const M = new Float32Array(n), R = new Float32Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = px[i * 4 + 3];
      if (a) { M[i] = a / 255; R[i] = (px[i * 4] - 128) / 127; any = true; }
    }
    if (!any) return this;

    // 2. Deformation. Paper bends rather than shears, so the wall of the bite is a soft shoulder whose
    // width depends on the stock. Pressure is force over area: fine lines bite deeper than big solids.
    // The sheet around the bite is drawn down with it (dishing), which is what makes type read as sunk
    // rather than raised; the displaced fibre shows on the back of the sheet, not the front.
    // The floor of the bite is calendered smooth.
    const ss = (0.3 + 0.7 * p.softness) * s;
    const B = blur(M, W, H, ss), B2 = blur(M, W, H, ss * 3.5 + 1.2 * s), A = blur(M, W, H, 12 * s);
    const depth = o.depth * s * (0.55 + 0.45 * p.softness / 0.8);
    const flat = clamp(0.3 + o.depth * 0.4, 0, 0.9);
    const sv = o.sortVariation;
    for (let i = 0; i < n; i++) {
      const b2 = B2[i];
      if (b2 < 0.002) continue;
      const b = B[i], dn = smoothstep(0.06, 0.8, Math.min(1, b * 1.35));
      this.base[i] += -dn * depth * (1.25 - 0.5 * A[i]) * (1 + 0.2 * sv * R[i]) - o.dish * depth * 0.4 * smoothstep(0, 0.85, b2);
      this.relief[i] *= 1 - flat * dn;
    }

    // 3. Ink transfer.
    if (inkSpec) {
      const [ir, ig, ib] = parseColor(inkSpec.color);
      const gs = Math.max(0.35, o.gain + 0.25 * p.absorbency) * 0.8 * s;
      const G = blur(M, W, H, gs), E = blur(M, W, H, 0.9 * s);
      const th = 0.5 - 0.18 * Math.min(1, o.gain * 2);
      const mk = noise(W, H, 70 * s, 70 * s, rng), grit = noise(W, H, 0.8 * s, 0.8 * s, rng);
      const m1 = noise(W, H, 16 * s, 16 * s, rng), m2 = noise(W, H, 2.2 * s, 2.2 * s, rng), streak = noise(W, H, 4 * s, 120 * s, rng);
      const grain = o.wear > 0 ? noise(W, H, 14 * s, 0.7 * s, rng) : null;
      const pits = o.wear > 0 ? noise(W, H, 0.9 * s, 0.9 * s, rng) : null;
      const k = 4.2 * inkSpec.strength;
      const mid = noise(W, H, 5 * s, 5 * s, rng);
      for (let i = 0; i < n; i++) {
        const face = Math.max(M[i], smoothstep(th - 0.22, th + 0.22, G[i]));
        if (face < 0.004) continue;
        const h = R[i] * sv;
        // Only the parts of the surface that reach the inked face take ink.
        const P = o.contact + o.makeready * 0.1 * mk[i] + 0.09 * h;
        let u = 0.55 * this.tooth[i] + 0.4 * grit[i] + 0.72 * mid[i];
        if (grain) u += o.wear * (0.5 * grain[i] - 5 * smoothstep(2.0, 2.7, pits![i] + 0.5 * mid[i]));
        const L = -3.2 + (1 - P) * 9;
        const cov = face * smoothstep(L - 0.3, L + 0.3, u);
        if (cov < 0.003) continue;
        // Film thickness: brayer streaks, mottle, per-sort height, and squash toward the edge.
        const ring = clamp((1 - E[i]) * 2.2) * M[i];
        const film = o.inking * (1 + o.mottle * (0.2 * m1[i] + 0.12 * m2[i] + 0.14 * streak[i])) * (1 + 0.45 * h) * (1 + o.squash * (0.7 * ring - 0.15));
        const a = cov * (1 - Math.exp(-k * Math.max(0, film)));
        const j = i * 3, t = a * inkSpec.opacity;
        // Transparent pigment filters the light coming back off the paper; opaque pigment replaces it.
        let r = this.albedo[j] * (1 - a + a * ir), g = this.albedo[j + 1] * (1 - a + a * ig), bl = this.albedo[j + 2] * (1 - a + a * ib);
        this.albedo[j] = r + (ir - r) * t;
        this.albedo[j + 1] = g + (ig - g) * t;
        this.albedo[j + 2] = bl + (ib - bl) * t;
        const c = cov * Math.min(1, film);
        this.gloss[i] += (inkSpec.gloss - this.gloss[i]) * c;
        this.metal[i] += (inkSpec.metallic - this.metal[i]) * c;
        this.base[i] += cov * ring * o.squash * 0.1 * s;
      }
    }
    this.dirty = true;
    return this;
  }

  // ---------------------------------------------------------------- light

  /** Photograph the sheet. Cheap to call again with a new light (the press work is not redone). */
  render(light?: Light): AnyCanvas {
    if (light) this.light = { ...this.light, ...light };
    const { W, H, base, relief, albedo, gloss, metal } = this, s = this.pixelRatio, n = W * H, L = this.light;
    if (this.dirty || !this.cavity) {
      const soft = blur(base, W, H, 1.8 * s);
      for (let i = 0; i < n; i++) soft[i] = clamp((soft[i] - base[i]) / (1.2 * s));
      this.cavity = soft;
      this.dirty = false;
    }
    const cav = this.cavity;
    const ctx = this.canvas.getContext('2d') as Ctx2D;
    const img = (this.out ??= ctx.createImageData(W, H)), d = img.data;

    const az = (L.azimuth * Math.PI) / 180, el = (clamp(L.elevation, 4, 90) * Math.PI) / 180;
    const dx = Math.sin(az), dy = -Math.cos(az);
    const lx = dx * Math.cos(el), ly = dy * Math.cos(el), lz = Math.sin(el);
    const hl = Math.hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;
    const tanEl = Math.tan(el);
    const [cr, cg, cb] = parseColor(L.color).map((c) => c * L.intensity);
    const steps = [0.75, 1.5, 2.5, 4, 6].map((k) => k * s);
    const offs = steps.map((k) => [Math.round(dx * k), Math.round(dy * k), Math.hypot(Math.round(dx * k), Math.round(dy * k)) * tanEl]);
    const amb = L.ambient, shK = L.shadow / (0.5 * s);

    for (let y = 0; y < H; y++) {
      const ym = y > 0 ? -W : 0, yp = y < H - 1 ? W : 0;
      const fy = (y / H - 0.5) * dy;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, xm = x > 0 ? -1 : 0, xp = x < W - 1 ? 1 : 0;
        const gx = (base[i + xp] + relief[i + xp] - base[i + xm] - relief[i + xm]) * 0.5;
        const gy = (base[i + yp] + relief[i + yp] - base[i + ym] - relief[i + ym]) * 0.5;
        const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx * inv, ny = -gy * inv, nz = inv;
        let diff = (nx * lx + ny * ly + nz * lz) / lz;
        if (diff < 0) diff = 0; else if (diff > 1.3) diff = 1.3;
        // Cast shadow: does the sheet's body rise above the ray toward the light?
        let occ = 0;
        const b0 = base[i];
        for (let q = 0; q < offs.length; q++) {
          const of = offs[q];
          let xx = x + of[0], yy = y + of[1];
          if (xx < 0) xx = 0; else if (xx >= W) xx = W - 1;
          if (yy < 0) yy = 0; else if (yy >= H) yy = H - 1;
          const v = base[yy * W + xx] - b0 - of[2];
          if (v > occ) occ = v;
        }
        const sh = 1 - Math.min(1, occ * shK);
        const fall = 1 + L.falloff * 2 * ((x / W - 0.5) * dx + fy);
        const shade = (amb + (1 - amb) * diff * sh) * (1 - L.occlusion * 0.5 * cav[i]) * fall;
        const g = gloss[i], m = metal[i], j = i * 3;
        let r = albedo[j] * shade, gg = albedo[j + 1] * shade, b = albedo[j + 2] * shade;
        if (g > 0.02) {
          const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
          const spec = Math.pow(ndh, 10 + 120 * g) * g * 0.3 * sh;
          if (m > 0.01) {
            const refl = (0.42 + 1.7 * Math.pow(ndh, 14) + 0.3 * diff) * (0.55 + 0.45 * sh) * fall;
            r += (albedo[j] * refl - r) * m; gg += (albedo[j + 1] * refl - gg) * m; b += (albedo[j + 2] * refl - b) * m;
          }
          const sp = spec * (1 - m);
          r += sp; gg += sp; b += sp;
        }
        const o = i * 4;
        r *= cr; gg *= cg; b *= cb;
        d[o] = ENCODE[r >= 1 ? 4096 : (r * 4096) | 0];
        d[o + 1] = ENCODE[gg >= 1 ? 4096 : (gg * 4096) | 0];
        d[o + 2] = ENCODE[b >= 1 ? 4096 : (b * 4096) | 0];
        d[o + 3] = 255;
      }
    }
    if (this.alpha) for (let i = 0; i < n; i++) d[i * 4 + 3] = Math.round(this.alpha[i] * 255);
    ctx.putImageData(img, 0, 0);
    return this.canvas;
  }

  /** PNG data URL of the current render (DOM canvases only). */
  toDataURL(type = 'image/png'): string {
    return (this.canvas as HTMLCanvasElement).toDataURL(type);
  }
}

/** Pull a fresh sheet from the ream. */
export function createSheet(o: SheetOptions): Sheet {
  return new Sheet(o);
}
