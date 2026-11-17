import type { Ctx2D } from './canvas';
import { gauss, type Rng } from './field';
import type { Cut } from './tex';

export interface TextOptions {
  /** CSS font shorthand, e.g. `italic 600 42px "EB Garamond", serif`. Any font the page can render works. */
  font?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: CanvasTextBaseline;
  /** Extra letterspacing, px. */
  tracking?: number;
  /** Line height in px for multi-line strings (default 1.25 x font size). */
  lineHeight?: number;
  /** Wrap to this measure, px. */
  maxWidth?: number;
  /**
   * Set each glyph as its own sort, as with foundry or wood type: every letter gets its own
   * height off type-high (so it inks differently) and a hair of positional slop.
   * Leave off for plates, scripts and ligature-heavy faces, which are cast in one piece.
   */
  handset?: boolean;
  /** Positional slop per sort, px (handset only). */
  jitter?: number;
  /** Rotational slop per sort, degrees (handset only). */
  tilt?: number;
  /** Underline the run with a rule. */
  underline?: boolean;
}

/**
 * The forme: everything locked up in the bed for one pass through the press.
 * Draw with the helpers, or use `ctx` directly. Any Canvas 2D drawing becomes printing surface;
 * alpha is the face of the type. Colour is ignored, except that the red channel encodes how far
 * a piece sits off type-high (128 = type-high), which the helpers use for per-sort variation.
 */
export class Forme {
  constructor(
    readonly ctx: Ctx2D,
    readonly width: number,
    readonly height: number,
    readonly rng: Rng,
  ) {
    this.setHeight(0);
  }

  /** Set the height off type-high (-1..1) for subsequent drawing. */
  setHeight(h: number): this {
    const v = Math.round(128 + 127 * Math.max(-1, Math.min(1, h)));
    this.ctx.fillStyle = this.ctx.strokeStyle = `rgb(${v},${v},${v})`;
    return this;
  }

  private wrap(text: string, maxWidth?: number): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
      if (!maxWidth) { out.push(para); continue; }
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? line + ' ' + word : word;
        if (line && this.ctx.measureText(t).width > maxWidth) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  /** Set type. Returns the block's width and height. */
  text(str: string, x: number, y: number, o: TextOptions = {}): { width: number; height: number } {
    const ctx = this.ctx;
    ctx.save();
    if (o.font) ctx.font = o.font;
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    ctx.textAlign = 'left';
    const size = parseFloat(/(\d*\.?\d+)px/.exec(ctx.font)?.[1] ?? '16');
    const tracking = o.tracking ?? 0;
    const native = 'letterSpacing' in ctx;
    if (native) (ctx as CanvasRenderingContext2D).letterSpacing = `${tracking}px`;
    const lh = o.lineHeight ?? size * 1.25;
    const lines = this.wrap(str, o.maxWidth);
    let widest = 0;
    lines.forEach((line, li) => {
      const chars = Array.from(line);
      const measure = (s: string, count: number) =>
        ctx.measureText(s).width + (native ? 0 : tracking * count);
      const w = measure(line, chars.length) - tracking;
      widest = Math.max(widest, w);
      const x0 = x - (o.align === 'center' ? w / 2 : o.align === 'right' ? w : 0);
      const yy = y + li * lh;
      if (o.handset) {
        let prefix = '';
        chars.forEach((ch, i) => {
          const gx = x0 + measure(prefix, i);
          prefix += ch;
          if (!ch.trim()) return;
          this.setHeight(gauss(this.rng) * 0.6);
          ctx.save();
          ctx.translate(gx + gauss(this.rng) * (o.jitter ?? 0.15), yy + gauss(this.rng) * (o.jitter ?? 0.15));
          ctx.rotate((gauss(this.rng) * (o.tilt ?? 0.15) * Math.PI) / 180);
          if (native) (ctx as CanvasRenderingContext2D).letterSpacing = '0px';
          ctx.fillText(ch, 0, 0);
          ctx.restore();
        });
        this.setHeight(0);
      } else if (native || !tracking) {
        ctx.fillText(line, x0, yy);
      } else {
        let prefix = '';
        chars.forEach((ch, i) => { (ctx as Ctx2D).fillText(ch, x0 + measure(prefix, i), yy); prefix += ch; });
      }
      if (o.underline) ctx.fillRect(x0, yy + size * 0.12, w, Math.max(1, size / 16));
    });
    ctx.restore();
    return { width: widest, height: lines.length * lh };
  }

  /** A brass rule (or any solid rectangle). */
  rule(x: number, y: number, w: number, h = 1): this {
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  /** A cut: any image, canvas or bitmap. Its alpha channel is the printing surface. */
  image(src: CanvasImageSource, x: number, y: number, w: number, h: number): this {
    this.ctx.drawImage(src, x, y, w, h);
    return this;
  }

  /**
   * Place a cut that has a baseline, such as LaTeX from `typesetTex()`. `y` is the baseline,
   * so maths sits on the same line as type set at that `y`.
   */
  cut(c: Cut, x: number, y: number, o: { align?: 'left' | 'center' | 'right'; scale?: number } = {}): this {
    const k = o.scale ?? 1, w = c.width * k;
    const x0 = x - (o.align === 'center' ? w / 2 : o.align === 'right' ? w : 0);
    this.ctx.drawImage(c.image, x0, y - c.baseline * k, w, c.height * k);
    return this;
  }

  /** Place a laid-out block of mixed type and maths from `typesetRich()`, top-left corner at (x, y). */
  block(b: { draw(forme: Forme, x: number, y: number): void }, x: number, y: number): this {
    b.draw(this, x, y);
    return this;
  }

  /** A vector cut from SVG path data or a Path2D, filled (default) or stroked. */
  path(d: string | Path2D, o: { x?: number; y?: number; scale?: number; stroke?: number } = {}): this {
    const ctx = this.ctx, p = typeof d === 'string' ? new Path2D(d) : d;
    ctx.save();
    ctx.translate(o.x ?? 0, o.y ?? 0);
    ctx.scale(o.scale ?? 1, o.scale ?? 1);
    if (o.stroke) { ctx.lineWidth = o.stroke; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke(p); } else ctx.fill(p);
    ctx.restore();
    return this;
  }
}
