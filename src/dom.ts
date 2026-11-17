import { fontsReady } from './canvas';
import type { Forme } from './forme';
import { impressions, type ImpressionName, type ImpressionSpec, type Light, type PaperSpec } from './materials';
import { Sheet } from './sheet';
import { svgToImage } from './tex';

export interface PressElementOptions {
  paper?: PaperSpec | Partial<PaperSpec> | string;
  /** Default impression for the element. Children can override with `data-press="blind|kiss|woodType|..."`. */
  impression?: ImpressionSpec | ImpressionName;
  /** Default ink. If omitted, each run is printed in its own computed CSS `color`. Override per child with `data-ink`. */
  ink?: ImpressionSpec['ink'];
  light?: Light;
  seed?: number;
  pixelRatio?: number;
  /** Set each word's letters as separate sorts (per-letter inking variation). */
  handset?: boolean;
  /** Move the light with the pointer. */
  interactiveLight?: boolean;
}

export interface Pressed {
  sheet: Sheet;
  canvas: HTMLCanvasElement;
  /** Re-photograph under a new light. */
  relight(light: Light): void;
  /** Re-run the press (after content or size changes). */
  update(): Promise<void>;
  destroy(): void;
}

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent =
    '[data-impressio]{position:relative;isolation:isolate;background:none!important}' +
    '[data-impressio],[data-impressio] *{-webkit-text-fill-color:transparent!important;text-decoration-color:transparent!important;text-shadow:none!important}' +
    '[data-impressio] hr,[data-impressio] [data-rule]{background:none!important;border-color:transparent!important}' +
    '[data-impressio] img[data-cut],[data-impressio] svg[data-cut],[data-impressio] mjx-container>svg{opacity:0}' +
    '[data-impressio]>canvas[data-impressio-sheet]{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}';
  document.head.appendChild(st);
}

interface Job { key: string; spec: ImpressionSpec; ops: ((f: Forme) => void)[] }

/**
 * Letterpress a live DOM element. The browser still lays out the text (so it stays selectable,
 * searchable and accessible, in whatever fonts your CSS uses); its glyphs are made invisible and
 * re-printed onto a sheet of paper placed behind them.
 *
 * Markup hooks: `data-ink="oxblood|#c33|blind"`, `data-press="kiss|woodType|..."`,
 * `<hr>` / `[data-rule]` print as rules, `<img data-cut>` / `<svg data-cut>` print as cuts.
 * Maths already typeset on the page by MathJax's SVG output (with `svg.fontCache` "none" or "local") is printed too.
 */
export async function pressElement(el: HTMLElement, opts: PressElementOptions = {}): Promise<Pressed> {
  injectStyle();
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-impressio-sheet', '');
  canvas.setAttribute('aria-hidden', 'true');
  let sheet!: Sheet;

  const baseSpec: ImpressionSpec = typeof opts.impression === 'string' ? impressions[opts.impression] : opts.impression ?? impressions.deep;

  const specFor = (node: Element): { key: string; spec: ImpressionSpec } => {
    const pressAttr = node.closest('[data-press]')?.getAttribute('data-press') as ImpressionName | null;
    const inkAttr = node.closest('[data-ink]')?.getAttribute('data-ink');
    const spec: ImpressionSpec = { ...baseSpec, ...(pressAttr && impressions[pressAttr] ? impressions[pressAttr] : {}) };
    if (inkAttr) spec.ink = inkAttr;
    else if (!('ink' in spec) || spec.ink === undefined) spec.ink = opts.ink !== undefined ? opts.ink : getComputedStyle(node).color;
    return { key: `${pressAttr ?? ''}|${typeof spec.ink === 'string' ? spec.ink : JSON.stringify(spec.ink)}`, spec };
  };

  async function run() {
    el.removeAttribute('data-impressio'); // measure colours with text visible
    const root = el.getBoundingClientRect();
    const jobs = new Map<string, Job>();
    const jobFor = (node: Element) => {
      const { key, spec } = specFor(node);
      let j = jobs.get(key);
      if (!j) jobs.set(key, (j = { key, spec, ops: [] }));
      return j;
    };
    const fontOf = (cs: CSSStyleDeclaration) =>
      `${cs.fontStyle} ${cs.fontVariantCaps === 'small-caps' ? 'small-caps ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const probe = document.createElement('canvas').getContext('2d')!;
    const baselineOf = (cs: CSSStyleDeclaration, rect: DOMRect) => {
      probe.font = fontOf(cs);
      const m = probe.measureText('Hg');
      const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent, desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      return rect.top + (rect.height - (asc + desc)) / 2 + asc - root.top;
    };

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      const parent = node.parentElement;
      if (!parent || !node.data.trim()) continue;
      const cs = getComputedStyle(parent);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const job = jobFor(parent), font = fontOf(cs);
      const tt = cs.textTransform, ls = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      const emit = (start: number, end: number) => {
        range.setStart(node!, start);
        range.setEnd(node!, end);
        const rects = range.getClientRects();
        if (rects.length !== 1) {
          if (end - start > 1) for (let i = start; i < end; i++) emit(i, i + 1);
          else if (rects.length) emitAt(rects[0], node!.data.slice(start, end));
          return;
        }
        emitAt(rects[0], node!.data.slice(start, end));
      };
      const emitAt = (rect: DOMRect, raw: string) => {
        let str = raw;
        if (tt === 'uppercase') str = str.toUpperCase();
        else if (tt === 'lowercase') str = str.toLowerCase();
        else if (tt === 'capitalize') str = str.replace(/^\p{L}/u, (c) => c.toUpperCase());
        const x = rect.left - root.left, y = baselineOf(cs, rect);
        job.ops.push((f) => {
          if ('fontKerning' in f.ctx) f.ctx.fontKerning = 'normal';
          f.text(str, x, y, { font, tracking: parseFloat(ls) || 0, handset: opts.handset });
        });
      };
      const re = /\S+/g;
      for (let m = re.exec(node.data); m; m = re.exec(node.data)) emit(m.index, m.index + m[0].length);
    }

    // Underlines, rules and cuts.
    const all = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))];
    const pending: Promise<void>[] = [];
    for (const node of all) {
      if (node === canvas) continue;
      const cs = getComputedStyle(node);
      if (cs.textDecorationLine.includes('underline')) {
        const size = parseFloat(cs.fontSize), job = jobFor(node);
        for (const r of Array.from(node.getClientRects())) {
          const y = baselineOf(cs, r) + size * 0.14, x = r.left - root.left, w = r.width;
          job.ops.push((f) => f.rule(x, y, w, Math.max(1, size / 15)));
        }
      }
      if (node.tagName === 'HR' || node.hasAttribute('data-rule')) {
        const r = node.getBoundingClientRect(), job = jobFor(node);
        job.ops.push((f) => f.rule(r.left - root.left, r.top - root.top, r.width, Math.max(1, r.height)));
      }
      if (node.hasAttribute('data-cut') || (node.tagName.toLowerCase() === 'svg' && node.parentElement?.tagName.toLowerCase() === 'mjx-container')) {
        const r = node.getBoundingClientRect(), job = jobFor(node);
        const svgNode = node as unknown as SVGSVGElement;
        pending.push(
          (node.tagName.toLowerCase() === 'svg' ? svgToImage(svgNode, r.width, r.height) : (node as HTMLImageElement).decode().then(() => node as HTMLImageElement))
            .then((img) => { job.ops.push((f) => f.image(img, r.left - root.left, r.top - root.top, r.width, r.height)); })
            .catch(() => undefined),
        );
      }
    }
    await Promise.all(pending);

    sheet = new Sheet({ width: root.width, height: root.height, paper: opts.paper, seed: opts.seed, pixelRatio: opts.pixelRatio, light: sheet?.light ?? opts.light, canvas });
    // Blind passes first, as a printer would, then inks.
    const ordered = [...jobs.values()].sort((a, b) => Number(a.spec.ink != null && a.spec.ink !== 'blind') - Number(b.spec.ink != null && b.spec.ink !== 'blind'));
    for (const job of ordered) sheet.impress(job.spec, (f) => job.ops.forEach((op) => op(f)));
    sheet.render();
    el.setAttribute('data-impressio', '');
    if (canvas.parentElement !== el) el.prepend(canvas);
  }

  await run();

  let raf = 0;
  const onMove = (e: PointerEvent) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(x, y) / Math.max(r.width, r.height);
      sheet.render({ azimuth: (Math.atan2(x, -y) * 180) / Math.PI, elevation: Math.max(14, 62 - dist * 60) });
    });
  };
  if (opts.interactiveLight) window.addEventListener('pointermove', onMove, { passive: true });

  return {
    get sheet() { return sheet; },
    canvas,
    relight: (light) => { sheet.render(light); },
    update: run,
    destroy() {
      window.removeEventListener('pointermove', onMove);
      canvas.remove();
      el.removeAttribute('data-impressio');
    },
  };
}
