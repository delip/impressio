/** Canvas plumbing: creation (DOM, Offscreen, or user supplied), colour parsing, sRGB transfer. */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

let factory: ((w: number, h: number) => AnyCanvas) | null = null;

/** Supply a canvas constructor for environments without a DOM (e.g. `node-canvas`, `@napi-rs/canvas`). */
export function setCanvasFactory(f: (w: number, h: number) => unknown): void {
  factory = f as (w: number, h: number) => AnyCanvas;
}

export function makeCanvas(w: number, h: number, scratch = false): AnyCanvas {
  if (factory) return factory(w, h);
  if (scratch && typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('impressio: no canvas available; call setCanvasFactory() first');
}

const DECODE = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  DECODE[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export const ENCODE = new Uint8ClampedArray(4097);
for (let i = 0; i <= 4096; i++) {
  const c = i / 4096;
  ENCODE[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
}

let probe: Ctx2D | null = null;
const cache = new Map<string, [number, number, number]>();

/** Parse any CSS colour to linear-light RGB. */
export function parseColor(css: string): [number, number, number] {
  const hit = cache.get(css);
  if (hit) return hit;
  let rgb: [number, number, number] | null = null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(css.trim());
  if (m) {
    const s = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    const n = parseInt(s, 16);
    rgb = [n >> 16, (n >> 8) & 255, n & 255];
  } else {
    probe ??= makeCanvas(1, 1, true).getContext('2d', { willReadFrequently: true }) as Ctx2D;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    rgb = [d[0], d[1], d[2]];
  }
  const out: [number, number, number] = [DECODE[rgb[0]], DECODE[rgb[1]], DECODE[rgb[2]]];
  cache.set(css, out);
  return out;
}

/**
 * Register a font from a URL or binary so it can be locked up in a forme.
 * (Fonts already available to the page via CSS need no registration; just name them.)
 */
export async function loadFont(family: string, source: string | ArrayBuffer | ArrayBufferView, descriptors?: FontFaceDescriptors): Promise<void> {
  const src = typeof source === 'string' && !/^url\(/.test(source) ? `url(${JSON.stringify(source)})` : source;
  const face = new FontFace(family, src as string | ArrayBuffer, descriptors);
  await face.load();
  (document.fonts as unknown as { add(f: FontFace): void }).add(face);
}

/** Wait until the given CSS font shorthands (e.g. `italic 48px "EB Garamond"`) are usable on a canvas. */
export async function fontsReady(fonts: string[] = []): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => undefined)));
  await document.fonts.ready;
}
