/**
 * LaTeX. The library stays dependency-free: maths is typeset by an engine you already have
 * (MathJax's SVG output by default), and the resulting outlines become a cut for the forme.
 */

import { makeCanvas, type Ctx2D } from './canvas';
import type { Forme } from './forme';

/** A piece of pre-made artwork with a baseline, ready to lock up with `forme.cut()`. */
export interface Cut {
  image: CanvasImageSource;
  /** Size in CSS px. */
  width: number;
  height: number;
  /** Distance from the top of the cut down to the text baseline, px. */
  baseline: number;
}

/** Turns TeX into SVG (markup or element) whose viewBox is in 1/1000 em with the baseline at y = 0, as MathJax emits. */
export type TexEngine = (tex: string, display: boolean) => string | Element | Promise<string | Element>;

let engine: TexEngine | null = null;

/** Use a TeX engine other than a global MathJax (for example MathJax loaded as a module, or a server-side renderer). */
export function setTexEngine(e: TexEngine | null): void {
  engine = e;
}

interface MathJaxLike {
  startup?: { promise?: Promise<unknown> };
  tex2svgPromise?: (tex: string, o: { display: boolean }) => Promise<Element>;
  tex2svg?: (tex: string, o: { display: boolean }) => Element;
}

const mathjax: TexEngine = async (tex, display) => {
  const mj = (globalThis as { MathJax?: MathJaxLike }).MathJax;
  if (!mj || !(mj.tex2svgPromise || mj.tex2svg)) {
    throw new Error('impressio: no TeX engine. Load MathJax (tex-svg, with svg.fontCache "none" or "local") or call setTexEngine().');
  }
  await mj.startup?.promise;
  return mj.tex2svgPromise ? mj.tex2svgPromise(tex, { display }) : mj.tex2svg!(tex, { display });
};

/** Rasterisable image from an SVG element, at a given CSS px size, painted solid. */
export async function svgToImage(svg: Element, w: number, h: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.removeAttribute('style');
  clone.setAttribute('color', '#000');
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  await img.decode();
  return img;
}

export interface TexOptions {
  /** Font size in px (the em of the maths). Default 24. */
  size?: number;
  /** Display style (large operators, limits above and below) rather than inline style. Default true. */
  display?: boolean;
}

/**
 * Typeset LaTeX maths into a cut. Do this before `impress()`, then place it with `forme.cut()`:
 *
 *     const eq = await typesetTex('e^{i\\pi} + 1 = 0', { size: 48 });
 *     sheet.impress('deep', f => f.cut(eq, 360, 220, { align: 'center' }));
 */
export async function typesetTex(tex: string, o: TexOptions = {}): Promise<Cut> {
  const size = o.size ?? 24;
  let out = await (engine ?? mathjax)(tex, o.display ?? true);
  if (typeof out === 'string') out = new DOMParser().parseFromString(out, 'image/svg+xml').documentElement;
  const svg = out.tagName.toLowerCase() === 'svg' ? out : out.querySelector('svg');
  if (!svg) throw new Error('impressio: TeX engine returned no <svg>');
  const err = svg.querySelector('[data-mjx-error]');
  if (err) throw new Error('impressio: TeX error: ' + (err.getAttribute('data-mjx-error') ?? tex));
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some(Number.isNaN)) throw new Error('impressio: TeX SVG has no viewBox');
  const k = size / 1000, width = vb[2] * k, height = vb[3] * k;
  return { image: await svgToImage(svg, width, height), width, height, baseline: -vb[1] * k };
}

// ------------------------------------------------------------------ type and maths together

export interface RichOptions {
  /** CSS font shorthand for the running text, e.g. `500 22px "EB Garamond", serif`. */
  font: string;
  /** Measure to wrap to, px. Without it, lines break only at newlines. */
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  /** Normal distance between baselines, px (default 1.45 x font size). Lines with tall maths open up as needed. */
  lineHeight?: number;
  tracking?: number;
  /** Set the text letter by letter as separate sorts. */
  handset?: boolean;
  /** Size of the maths relative to the text, to match a face's x-height (default 1). */
  mathScale?: number;
}

type RichItem = { x: number; w: number; text?: string; cut?: Cut };
interface RichLine { baseline: number; width: number; items: RichItem[] }

/** A laid-out block of text with inline and display maths. Place it with `forme.block(block, x, y)`. */
export interface RichBlock {
  width: number;
  height: number;
  /** Draw with the block's top-left corner at (x, y). */
  draw(forme: Forme, x: number, y: number): void;
}

/**
 * Typeset running text that contains LaTeX: `$...$` sits inline on the baseline of the type,
 * `$$...$$` is displayed on its own centred line, and `\$` is a literal dollar sign.
 *
 *     const b = await typesetRich('The area is $A = \\pi r^2$ exactly.', { font: '24px Georgia', maxWidth: 480 });
 *     sheet.impress('deep', f => f.block(b, 40, 60));
 */
export async function typesetRich(src: string, o: RichOptions): Promise<RichBlock> {
  const ctx = makeCanvas(1, 1, true).getContext('2d') as Ctx2D;
  ctx.font = o.font;
  const size = parseFloat(/(\d*\.?\d+)px/.exec(ctx.font)?.[1] ?? '16');
  const tracking = o.tracking ?? 0;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D).letterSpacing = `${tracking}px`;
  const measure = (s: string) => ctx.measureText(s).width + ('letterSpacing' in ctx ? 0 : tracking * s.length);
  const fm = ctx.measureText('Hg');
  const fAsc = fm.fontBoundingBoxAscent ?? size * 0.8, fDesc = fm.fontBoundingBoxDescent ?? size * 0.25;
  const space = measure(' '), lh = o.lineHeight ?? size * 1.45, mathSize = size * (o.mathScale ?? 1);
  const maxW = o.maxWidth ?? Infinity;

  // Tokenise into words, inline maths, display maths and hard breaks.
  type Tok = { kind: 'word' | 'math' | 'display' | 'break'; text: string; glue: boolean; cut?: Cut };
  const toks: Tok[] = [];
  let glue = true; // true = no space before this token
  const parts = src.replace(/\\\$/g, '\u0001').split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('$$') && part.length > 4) { toks.push({ kind: 'display', text: part.slice(2, -2), glue: false }); glue = true; continue; }
    if (part.startsWith('$') && part.length > 2) { toks.push({ kind: 'math', text: part.slice(1, -1), glue }); glue = true; continue; }
    for (const m of part.matchAll(/(\s+)|(\S+)/g)) {
      if (m[1]) {
        const n = (m[1].match(/\n/g) ?? []).length;
        for (let i = 0; i < n; i++) toks.push({ kind: 'break', text: '', glue: false });
        glue = n > 0;
        if (!n) glue = false;
      } else { toks.push({ kind: 'word', text: m[2].replace(/\u0001/g, '$'), glue }); glue = true; }
    }
  }
  await Promise.all(toks.filter((t) => t.kind === 'math' || t.kind === 'display').map(async (t) => {
    const c = await typesetTex(t.text, { size: mathSize, display: t.kind === 'display' });
    // A formula wider than the measure is reduced to fit it rather than running off the sheet.
    const k = c.width > maxW ? maxW / c.width : 1;
    t.cut = k < 1 ? { image: c.image, width: c.width * k, height: c.height * k, baseline: c.baseline * k } : c;
  }));

  // Break into lines, then stack them, opening the leading where maths is tall.
  const lines: (RichLine & { asc: number; desc: number; display?: boolean })[] = [];
  let cur: RichItem[] = [], curW = 0, asc = fAsc, desc = fDesc;
  const flush = (display = false) => {
    lines.push({ baseline: 0, width: curW, items: cur, asc, desc, display });
    cur = []; curW = 0; asc = fAsc; desc = fDesc;
  };
  for (const t of toks) {
    if (t.kind === 'break') { flush(); continue; }
    if (t.kind === 'display') {
      if (cur.length) flush();
      const c = t.cut!;
      cur = [{ x: 0, w: c.width, cut: c }]; curW = c.width;
      asc = c.baseline + size * 0.45; desc = c.height - c.baseline + size * 0.45;
      flush(true);
      continue;
    }
    const w = t.cut ? t.cut.width : measure(t.text);
    const gap = t.glue || !cur.length ? 0 : space;
    if (cur.length && !t.glue && curW + gap + w > maxW) flush();
    const last = cur[cur.length - 1];
    if (!t.cut && last && last.text != null && cur.length) {
      // Extend the running text so kerning and shaping carry across words.
      last.text += (t.glue ? '' : ' ') + t.text;
      last.w = measure(last.text);
      curW = last.x + last.w;
    } else {
      const x = cur.length ? curW + gap : 0;
      cur.push(t.cut ? { x, w, cut: t.cut } : { x, w, text: t.text });
      curW = x + w;
      if (t.cut) { asc = Math.max(asc, t.cut.baseline); desc = Math.max(desc, t.cut.height - t.cut.baseline); }
    }
  }
  if (cur.length || !lines.length) flush();

  let y = 0, prevDesc = 0, width = 0;
  lines.forEach((l, i) => {
    y = i === 0 ? l.asc : y + Math.max(lh, prevDesc + l.asc + size * 0.12);
    l.baseline = y; prevDesc = l.desc; width = Math.max(width, l.width);
  });
  const boxW = Number.isFinite(maxW) ? Math.max(maxW, width) : width;
  const height = y + prevDesc;

  return {
    width: boxW,
    height,
    draw(forme, x, y0) {
      for (const l of lines) {
        const a = l.display ? 'center' : o.align ?? 'left';
        const lx = x + (a === 'center' ? (boxW - l.width) / 2 : a === 'right' ? boxW - l.width : 0);
        for (const it of l.items) {
          if (it.cut) forme.ctx.drawImage(it.cut.image, lx + it.x, y0 + l.baseline - it.cut.baseline, it.cut.width, it.cut.height);
          else forme.text(it.text!, lx + it.x, y0 + l.baseline, { font: o.font, tracking, handset: o.handset });
        }
      }
    },
  };
}
