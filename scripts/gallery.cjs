// Regenerates docs/header.webp, docs/gallery/*.webp and GALLERY.md from the snippets below.
// Every picture is produced by running exactly the code printed next to it.
// Usage: npm run build && node scripts/gallery.cjs   (needs Playwright with Chromium available)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const R = String.raw;
const S = (paper, extra = '') => `{ width: 420, height: 240, paper: ${paper}, seed: 7${extra} }`;
const WORD = R`f.text('Impressio', 210, 146, { font: 'italic 500 88px "EB Garamond"', align: 'center' })`;
const BIG = R`const big = { font: '112px "Alfa Slab One"', align: 'center' };`;

// Two prints on one sheet: the same forme with a low and a high value of one parameter.
const pair = (key, lo, hi, opts = {}) => ({
  id: 'run-' + key, title: '`' + key + '`', desc: opts.desc, sheet: S(opts.paper || "'cottonWhite'"), light: opts.light,
  code: `${BIG}
const run = ${opts.base || 'impressions.deep'};
sheet.impress({ ...run, ${opts.also ? opts.also + ', ' : ''}${key}: ${lo} }, f => f.text('${opts.word || 'Aa'}', 108, 158, ${opts.textOpts || 'big'}));
sheet.impress({ ...run, ${opts.also ? opts.also + ', ' : ''}${key}: ${hi} }, f => f.text('${opts.word || 'Aa'}', 312, 158, ${opts.textOpts || 'big'}));`,
});

const paperRow = (name, desc, run = "'deep'") => ({ id: 'paper-' + name, title: '`' + name + '`', desc, sheet: S(`'${name}'`), code: `sheet.impress(${run}, f => ${WORD});` });

const sections = [
  { title: 'Stocks', intro: 'Pass a name, any CSS colour, or a (partial) `PaperSpec` as `paper`.', items: [
    paperRow('cotton', 'Soft, toothy 100% cotton in a pearl white. The classic stock for a deep impression.'),
    paperRow('cottonWhite', 'The same cotton in bright white.'),
    paperRow('cottonGrey', 'Warm grey cotton cover.'),
    paperRow('cover', 'Dyed-through uncoated cover: firmer, with a finer tooth and a faint felt mark.'),
    paperRow('handmade', 'Handmade rag: heavy tooth, felt marks, cockle, visible fibres and a deckle edge (the picture has a transparent edge).'),
    paperRow('cartridge', 'Smooth, hard poster cartridge. Takes little bite.'),
    paperRow('a4', 'Ordinary 80 gsm printer paper: bright blue-white, nearly smooth, thin and hard.'),
    paperRow('kraft', 'Unbleached kraft, full of fibres and flecks.'),
    paperRow('black', 'Black cover stock, for opaque inks and foil.', "{ ...impressions.deep, ink: 'white' }"),
    { id: 'paper-colour', title: 'Any colour', desc: 'A CSS colour string gives the default stock in that colour.', sheet: S("'#e7c6bd'"), code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'paper-custom', title: 'Custom `PaperSpec`', desc: 'Every property can be set: tooth and its scale, cloudiness (`formation`), `fibers`, `inclusions` (stray flecks), `softness`, `absorbency`, felt marks (`weave`), `cockle`, `deckle` edge and `sheen`.',
      sheet: S("{ color: '#a9bfae', tooth: 0.85, toothScale: 2.6, formation: 1.2, fibers: 6, inclusions: 0.8, weave: 0.4, cockle: 0.6, deckle: 7 }"), code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'paper-seed', title: '`seed`', desc: 'Every sheet is generated. The same seed reproduces the same sheet and print exactly; leave it out and every pull is unique.', sheet: "{ width: 420, height: 240, paper: 'kraft', seed: 1234 }", code: `sheet.impress('deep', f => ${WORD});` },
  ] },
  { title: 'Press runs', intro: 'Presets in `impressions`; each call to `impress()` is one pass through the press.', items: [
    { id: 'run-deep', title: '`deep`', desc: 'Photopolymer plate pressed hard into soft paper: crisp, dark and sculpted.', sheet: S("'cotton'"), code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'run-kiss', title: '`kiss`', desc: 'Traditional kiss impression: the ink sits on the surface with barely any bite.', sheet: S("'cotton'"), code: `sheet.impress('kiss', f => ${WORD});` },
    { id: 'run-handset', title: '`handset`', desc: 'Hand-set metal type on a platen. With `handset: true` each letter is its own sort, so each sits and inks a little differently.', sheet: S("'cotton'"),
      code: R`sheet.impress('handset', f =>
  f.text('IMPRESSIO', 210, 142, { font: '500 62px "EB Garamond"', align: 'center', tracking: 4, handset: true }));` },
    { id: 'run-woodtype', title: '`woodType`', desc: 'Worn wood type inked with a hand brayer on a proof press: salty, scratched and uneven from letter to letter.', sheet: S("'cartridge'"),
      code: R`sheet.impress({ ...impressions.woodType, ink: 'posterBlack' }, f =>
  f.text('IMPRESSIO', 210, 166, { font: '112px "League Gothic"', align: 'center', handset: true, jitter: 0.5, tilt: 0.3 }));` },
    { id: 'run-blind', title: '`blind`', desc: 'No ink at all: the forme is only pressed into the sheet.', sheet: S("'cotton'"), light: '{ elevation: 24 }', code: `sheet.impress('blind', f => ${WORD});` },
    { id: 'run-foil', title: '`foil`', desc: 'Hot foil stamping: shallow and perfectly solid, with a metallic film.', sheet: S("'black'"), code: `sheet.impress({ ...impressions.foil, ink: 'goldFoil' }, f => ${WORD});` },
  ] },
  { title: 'Press parameters', intro: 'Each picture prints the same forme twice, with a low value on the left and a high value on the right.', items: [
    pair('depth', 0.2, 4, { paper: "'cotton'", light: '{ elevation: 26 }', desc: 'Bite: how far the forme sinks into the sheet, in px. The wall of the bite is a soft shoulder whose width follows the paper\'s `softness`.' }),
    pair('dish', 0, 1, { paper: "'cotton'", light: '{ elevation: 22 }', also: 'ink: null, depth: 3', desc: 'How much the paper around the bite is drawn down with it. Shown on a blind impression.' }),
    pair('contact', 0.78, 1.05, { desc: 'Completeness of contact. Below 1 only the high points of the paper meet the forme, leaving a salty print.' }),
    pair('inking', 0.4, 1.5, { desc: 'How much ink is on the forme: starved on the left, flooded on the right.' }),
    pair('squash', 0, 1, { also: 'inking: 0.7', desc: 'Ink squeezed to the edge of the face under pressure: a darker rim and a lighter centre.' }),
    pair('mottle', 0, 1, { also: 'inking: 0.7', desc: 'Roller streaks and blotches inside solid areas, so black is never one flat black.' }),
    pair('wear', 0, 1, { desc: 'Damage to the printing surface: nicks, scratches and grain that print as missing ink.' }),
    pair('sortVariation', 0, 1, { word: 'AbC', also: 'inking: 0.75', textOpts: '{ ...big, font: \'84px "Alfa Slab One"\', handset: true }', desc: 'How far individual sorts sit off type-high. With hand-set type some letters print darker and some lighter.' }),
    pair('makeready', 0, 1, { also: 'contact: 0.88', desc: 'Slow pressure variation across the bed, as with careless makeready. Shown with slightly low contact.' }),
    pair('gain', 0, 1.5, { desc: 'How far ink spreads beyond the edge of the face, in px.' }),
    { id: 'run-register', title: '`register`', desc: 'Offset and rotation of one pass, for honest multi-colour work. Transparent inks mix where they overlap.', sheet: S("'cottonWhite'"),
      code: `${BIG}
const forme = f => f.text('Aa', 210, 158, big);
sheet.impress({ ...impressions.deep, ink: 'cyan' }, forme);
sheet.impress({ ...impressions.deep, ink: 'magenta', register: { x: 7, y: 4, rotate: 1.2 } }, forme);` },
  ] },
  { title: 'Inks', intro: 'A named ink, any CSS colour, an `InkSpec`, or `null` for blind.', items: [
    { id: 'ink-named', title: 'Named inks', desc: '`black`, `posterBlack`, `warmGrey`, `oxblood`, `navy`, `forest`, the transparent `cyan` / `magenta` / `yellow`, opaque `white`, metallic `gold`, and `goldFoil` / `copperFoil` / `silverFoil`. Shown: oxblood, navy, forest.', sheet: S("'cotton'"),
      code: R`const t = { font: 'italic 500 96px "EB Garamond"', align: 'center' };
['oxblood', 'navy', 'forest'].forEach((ink, i) =>
  sheet.impress({ ...impressions.deep, ink }, f => f.text('Aa', 80 + i * 130, 150, t)));` },
    { id: 'ink-css', title: 'Any CSS colour', desc: 'A colour string is an ink. `ink(color, overrides)` builds one with its own properties.', sheet: S("'cotton'"),
      code: R`const t = { font: 'italic 500 96px "EB Garamond"', align: 'center' };
sheet.impress({ ...impressions.deep, ink: 'rebeccapurple' }, f => f.text('Aa', 120, 150, t));
sheet.impress({ ...impressions.deep, ink: ink('#e4572e', { gloss: 0.5 }) }, f => f.text('Aa', 300, 150, t));` },
    { id: 'ink-overprint', title: 'Transparent overprint', desc: 'Transparent pigment filters the light coming back off the paper, so overlapping passes mix as real inks do.', sheet: S("'cottonWhite'"),
      code: R`const dot = (x, y) => f => { f.ctx.beginPath(); f.ctx.arc(x, y, 70, 0, 7); f.ctx.fill(); };
sheet.impress({ ...impressions.kiss, ink: 'yellow' }, dot(210, 92));
sheet.impress({ ...impressions.kiss, ink: 'magenta' }, dot(168, 150));
sheet.impress({ ...impressions.kiss, ink: 'cyan' }, dot(252, 150));` },
    { ...pair('strength', 0.25, 1.6, {}), id: 'ink-strength', title: '`strength`', desc: 'Pigment load: a pale tint on the left, a dense film on the right.',
      code: `${BIG}
sheet.impress({ ...impressions.deep, ink: ink('#1d2f55', { strength: 0.25 }) }, f => f.text('Aa', 108, 158, big));
sheet.impress({ ...impressions.deep, ink: ink('#1d2f55', { strength: 1.6 }) }, f => f.text('Aa', 312, 158, big));` },
    { id: 'ink-opacity', title: '`opacity`', desc: 'Hiding power. Yellow printed over a navy bar: transparent on the left (it only tints), opaque on the right (it covers).', sheet: S("'cottonWhite'"),
      code: `${BIG}
sheet.impress({ ...impressions.kiss, ink: 'navy' }, f => f.rule(20, 96, 380, 56));
sheet.impress({ ...impressions.deep, ink: ink('#f6d21d', { opacity: 0 }) }, f => f.text('Aa', 108, 158, big));
sheet.impress({ ...impressions.deep, ink: ink('#f6d21d', { opacity: 1 }) }, f => f.text('Aa', 312, 158, big));` },
    { id: 'ink-gloss', title: '`gloss`', desc: 'Sheen of the dry film: matte on the left, glossy on the right. Most visible on dark stock under a low light.', sheet: S("'black'"), light: '{ elevation: 30 }',
      code: `${BIG}
sheet.impress({ ...impressions.foil, ink: ink('#30343c', { gloss: 0, opacity: 1 }) }, f => f.text('Aa', 108, 158, big));
sheet.impress({ ...impressions.foil, ink: ink('#30343c', { gloss: 1, opacity: 1 }) }, f => f.text('Aa', 312, 158, big));` },
    { id: 'ink-metallic', title: '`metallic`', desc: 'Metallic reflection, for bronze inks and foil: plain pigment on the left, metal on the right.', sheet: S("'black'"),
      code: `${BIG}
const bronze = m => ink('#b08a3c', { opacity: 1, gloss: 0.6, metallic: m });
sheet.impress({ ...impressions.foil, ink: bronze(0) }, f => f.text('Aa', 108, 158, big));
sheet.impress({ ...impressions.foil, ink: bronze(1) }, f => f.text('Aa', 312, 158, big));` },
    { id: 'ink-foils', title: 'Foils', desc: 'Gold, copper and silver foil on black stock.', sheet: S("'black'"),
      code: R`const t = { font: 'italic 500 96px "EB Garamond"', align: 'center' };
['goldFoil', 'copperFoil', 'silverFoil'].forEach((ink, i) =>
  sheet.impress({ ...impressions.foil, ink }, f => f.text('Aa', 80 + i * 130, 150, t)));` },
    { id: 'ink-white', title: 'Opaque white', desc: 'An opaque ink covers a dark or coloured stock.', sheet: S("'kraft'"), code: `sheet.impress({ ...impressions.deep, ink: 'white' }, f => ${WORD});` },
  ] },
  { title: 'Formes', intro: 'A forme is a Canvas 2D context plus a few helpers. Anything drawn becomes printing surface.', items: [
    { id: 'forme-font', title: 'Any font', desc: 'Any font the page can render: CSS `@font-face`, web fonts, or a file registered with `loadFont(family, urlOrBuffer)`.', sheet: S("'cotton'"),
      code: R`sheet.impress('kiss', f =>
  f.text('Impressio', 210, 160, { font: '110px "Mrs Saint Delafield"', align: 'center' }));` },
    { id: 'forme-lines', title: 'Lines, measure, alignment', desc: '`\\n` starts a new line, `maxWidth` wraps to a measure, `align` and `lineHeight` set the block.', sheet: S("'cotton'"),
      code: R`sheet.impress('deep', f =>
  f.text('Lock the type in the chase, ' +
    'plane it down, and pull a proof.', 400, 70,
    { font: '500 30px "EB Garamond"', align: 'right', maxWidth: 380, lineHeight: 44 }));` },
    { id: 'forme-tracking', title: 'Letterspacing and underline', desc: '`tracking` adds space between letters; `underline` prints a rule beneath the line.', sheet: S("'cotton'"),
      code: R`sheet.impress('deep', f =>
  f.text('IMPRESSIO', 210, 135, { font: '500 34px "EB Garamond"', align: 'center', tracking: 14, underline: true }));` },
    { id: 'forme-handset', title: 'Hand-set slop', desc: '`handset` sets each letter separately; `jitter` (px) and `tilt` (degrees) are how far each sort wanders. Exaggerated here.', sheet: S("'cartridge'"),
      code: R`sheet.impress('woodType', f =>
  f.text('SORTS', 210, 172, { font: '140px "League Gothic"', align: 'center', handset: true, jitter: 2.5, tilt: 3 }));` },
    { id: 'forme-rule', title: 'Rules', desc: '`rule(x, y, width, height)` prints a brass rule or any solid rectangle.', sheet: S("'cotton'"),
      code: R`sheet.impress('deep', f => {
  f.rule(40, 70, 340, 6); f.rule(40, 84, 340, 1.5);
  f.text('Double rule', 210, 150, { font: 'italic 500 44px "EB Garamond"', align: 'center' });
  f.rule(40, 180, 340, 1.5); f.rule(40, 190, 340, 6);
});` },
    { id: 'forme-path', title: 'Vector cuts', desc: '`path(d, { x, y, scale, stroke })` prints SVG path data or a `Path2D`, filled or stroked.', sheet: S("'cotton'"),
      code: R`const heart = 'M0 -18 C-25 -50 -60 -10 0 40 ' +
  'C60 -10 25 -50 0 -18 Z';
sheet.impress({ ...impressions.deep, ink: 'oxblood' }, f => f.path(heart, { x: 120, y: 118, scale: 1.8 }));
sheet.impress('blind', f => f.path(heart, { x: 300, y: 118, scale: 1.8, stroke: 3 }));` },
    { id: 'forme-image', title: 'Image cuts', desc: '`image(source, x, y, w, h)` prints any image, canvas or bitmap; its alpha channel is the printing surface.', sheet: S("'cotton'"),
      code: R`const cut = document.createElement('canvas');
cut.width = cut.height = 200;
const c = cut.getContext('2d');
c.translate(100, 100);
for (let i = 0; i < 12; i++) {
  c.rotate(Math.PI / 6);
  c.fillRect(-4, 34, 8, 60);
}
c.beginPath(); c.arc(0, 0, 26, 0, 7); c.fill();
sheet.impress('deep', f => f.image(cut, 120, 30, 180, 180));` },
    { id: 'forme-ctx', title: 'Raw Canvas 2D', desc: '`f.ctx` is the real context, so any drawing code works. Colour is ignored; coverage is what prints.', sheet: S("'cotton'"),
      code: R`sheet.impress({ ...impressions.deep, ink: 'navy' }, f => {
  f.ctx.lineWidth = 3;
  for (let r = 14; r < 100; r += 14) {
    f.ctx.beginPath();
    f.ctx.arc(210, 120, r, 0, 7);
    f.ctx.stroke();
  }
});` },
    { id: 'forme-passes', title: 'Several passes', desc: 'Call `impress()` as often as you like: blind ornaments, a second colour, foil on top.', sheet: S("'cotton'"),
      code: R`sheet.impress('blind', f => { f.ctx.lineWidth = 3; f.ctx.strokeRect(22, 22, 376, 196); });
sheet.impress('deep', f => f.text('Impressio', 210, 128, { font: 'italic 500 72px "EB Garamond"', align: 'center' }));
sheet.impress({ ...impressions.deep, depth: 1.2, ink: 'oxblood' }, f =>
  f.text('FINE PRINTING', 210, 176, { font: '500 15px "EB Garamond"', align: 'center', tracking: 6 }));` },
  ] },
  { title: 'Mathematics', intro: 'LaTeX is typeset by MathJax\'s SVG output (or any engine given to `setTexEngine()`), and the outlines are printed.', items: [
    { id: 'tex-cut', title: '`typesetTex`', desc: 'One formula as a cut with a baseline. `f.cut(eq, x, baselineY, { align, scale })` places it.', sheet: S("'cottonWhite'"),
      code: R`const eq = await typesetTex(
  '\\hat{H}\\Psi = i\\hbar' +
  '\\frac{\\partial}{\\partial t}\\Psi',
  { size: 44 });
sheet.impress('deep', f => f.cut(eq, 210, 132, { align: 'center' }));` },
    { id: 'tex-rich', title: '`typesetRich`', desc: 'Running text with maths: `$…$` sits inline on the baseline and wraps with the text, `$$…$$` takes its own centred line, `\\$` is a dollar sign.', sheet: S("'cottonWhite'"),
      code: R`const block = await typesetRich(
  'A circle of radius $r$ has area ' +
  '$A = \\pi r^{2}$. Summing the squares, ' +
  '$$\\sum_{n=1}^{\\infty} \\frac{1}{n^{2}}' +
  ' = \\frac{\\pi^{2}}{6}$$',
  { font: '500 21px "EB Garamond"', maxWidth: 360 });
sheet.impress('deep', f => f.block(block, 30, 38));` },
  ] },
  { title: 'Light', intro: '`render(light)` re-photographs the sheet without redoing the press work, so the light can move freely.', items: [
    { id: 'light-raking', title: 'Raking light', desc: 'A low `elevation` rakes across the surface and exaggerates tooth and depth.', sheet: S("'cotton'"), light: '{ azimuth: 315, elevation: 12 }', code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'light-overhead', title: 'Overhead light', desc: 'A high `elevation` flattens the relief.', sheet: S("'cotton'"), light: '{ elevation: 85 }', code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'light-azimuth', title: '`azimuth`', desc: 'Where the light sits, in degrees clockwise from the top. Here it comes from the right.', sheet: S("'cotton'"), light: '{ azimuth: 90, elevation: 22 }', code: `sheet.impress('blind', f => ${WORD});` },
    { id: 'light-colour', title: 'Colour and exposure', desc: '`color` tints the light and `intensity` sets the exposure.', sheet: S("'cotton'"), light: "{ color: '#ffd9a0', intensity: 0.92, elevation: 30 }", code: `sheet.impress('deep', f => ${WORD});` },
    { id: 'light-fill', title: 'Fill, shadow, cavity, falloff', desc: '`ambient` fills the shadows, `shadow` and `occlusion` darken the bite, `falloff` darkens the side away from the light.', sheet: S("'cotton'"), light: '{ elevation: 24, ambient: 0.1, shadow: 1, occlusion: 1, falloff: 0.4 }', code: `sheet.impress('blind', f => ${WORD});` },
  ] },
];

const cardCss = `font: 400 19px/1.6 'EB Garamond', Georgia, serif; color: #1b1a19; padding: 44px 56px 48px; box-sizing: border-box;`;
const cardHtml = `<p style="font: 500 12px/1.4 'EB Garamond'; letter-spacing: .22em; text-transform: uppercase; margin: 0" data-ink="oxblood">Notice to the trade</p>
<h3 style="font: italic 500 34px/1.1 'EB Garamond'; margin: 0 0 6px">On the making-ready of a forme</h3>
<hr style="border: 0; height: 1.5px; margin: 18px 0">
<p style="margin: 0">Lock the type in the chase, plane it down, and pull a proof. Where the print is weak, <u style="text-underline-offset: 3px">build up the packing</u> with tissue; where it punches, cut it away. A good makeready is <span data-ink="navy">felt more than seen</span>.</p>
<hr style="border: 0; height: 1.5px; margin: 18px 0" data-press="blind">
<p style="font: 500 12px/1.4 'EB Garamond'; letter-spacing: .22em; text-transform: uppercase; margin: 0" data-press="blind">Blind stamped · no ink</p>`;

const pageHtml = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=League+Gothic&family=Mrs+Saint+Delafield&display=swap">
<script>window.MathJax = { svg: { fontCache: 'none' }, startup: { typeset: false } };</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js"></script>
<body style="margin:0"><div id="stage"></div>`;

// Wrap long lines of displayed code at commas and arrows outside string literals, so the code
// column stays narrow and the picture column keeps its width on GitHub.
function wrap(code, max = 44) {
  return code.split('\n').map((line) => {
    if (line.length <= max) return line;
    const indent = /^\s*/.exec(line)[0], parts = [];
    let quote = null, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      cur += ch;
      if (quote) { if (ch === quote && line[i - 1] !== '\\') quote = null; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
      if ((ch === ',' && line[i + 1] === ' ') || (ch === '>' && line[i - 1] === '=' && line[i + 1] === ' ')) { parts.push(cur); cur = ''; i++; }
    }
    parts.push(cur);
    const out = [];
    let row = '';
    for (const part of parts) {
      const piece = part.replace(/^\s+/, '');
      if (!row) row = out.length ? indent + '  ' + piece : part;
      else if ((row + ' ' + piece).length <= max) row += ' ' + piece;
      else { out.push(row); row = indent + '  ' + piece; }
    }
    out.push(row);
    return out.join('\n');
  }).join('\n');
}
const pad = (n) => '&nbsp;'.repeat(n);

(async () => {
  const outDir = path.join(root, 'docs', 'gallery');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.setContent(pageHtml, { waitUntil: 'load' });
  await page.addScriptTag({ path: path.join(root, 'dist', 'impressio.global.js') });
  await page.evaluate(() => Impressio.fontsReady(['italic 500 40px "EB Garamond"', '500 40px "EB Garamond"', '40px "EB Garamond"', '40px "League Gothic"', '40px "Alfa Slab One"', '40px "Mrs Saint Delafield"']));
  const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

  // Header: a live DOM element pressed in place.
  const header = await page.evaluate(async ([css, html]) => {
    const el = document.createElement('div');
    el.style.cssText = css + 'width: 640px;';
    el.innerHTML = html;
    document.getElementById('stage').append(el);
    const pressed = await Impressio.pressElement(el, { paper: 'cotton', impression: 'deep', seed: 9, pixelRatio: 2, light: { azimuth: 315, elevation: 34 } });
    const url = pressed.canvas.toDataURL('image/webp', 0.92);
    el.remove();
    return url;
  }, [cardCss, cardHtml]);
  save(path.join(root, 'docs', 'header.webp'), header);

  for (const sec of sections) for (const it of sec.items) {
    const url = await page.evaluate(async (it) => {
      const names = Object.keys(Impressio);
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction(...names, `const sheet = createSheet({ ...(${it.sheet}), pixelRatio: 2 });\n${it.code}\nreturn sheet.render(${it.light || ''});`);
      const canvas = await fn(...names.map((n) => Impressio[n]));
      return canvas.toDataURL('image/webp', 0.9);
    }, it).catch((e) => { console.error(it.id, e.message.split('\n')[0]); return null; });
    if (url) save(path.join(outDir, it.id + '.webp'), url);
    process.stdout.write(url ? '.' : 'x');
  }
  await browser.close();

  let md = `# Gallery\n\nEvery feature of Impressio, with the code that made each picture. The pictures are generated by \`scripts/gallery.cjs\`, which runs exactly the snippets shown here. Each snippet assumes:\n\n\`\`\`ts\nimport { createSheet, impressions, ink, typesetTex, typesetRich } from 'impressio';\n\`\`\`\n\n`;
  md += sections.map((s) => `- [${s.title}](#${s.title.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '-')})`).join('\n') + '\n- [Live DOM text](#live-dom-text)\n- [Also](#also)\n';
  for (const sec of sections) {
    md += `\n## ${sec.title}\n\n${sec.intro}\n\n<table>\n<tr><th>Print<br>${pad(78)}</th><th>What it shows<br>${pad(40)}</th><th>Code</th></tr>\n`;
    for (const it of sec.items) {
      const code = `const sheet = createSheet(${it.sheet});\n${it.code}\nsheet.render(${it.light || ''});`;
      md += `<tr>\n<td><img src="docs/gallery/${it.id}.webp" width="300" alt="${it.title.replace(/`/g, '')}"></td>\n<td>\n\n**${it.title}**\n\n${it.desc}\n\n</td>\n<td>\n\n\`\`\`ts\n${wrap(code)}\n\`\`\`\n\n</td>\n</tr>\n`;
    }
    md += '</table>\n';
  }
  md += `\n## Live DOM text\n\n\`pressElement()\` prints an element's existing text onto a sheet placed behind it. The real text stays in the page, invisible but selectable, searchable and readable by assistive technology. CSS \`color\` is the ink; \`data-ink\` and \`data-press\` override it per element, \`<hr>\` and \`[data-rule]\` print as rules, \`<img data-cut>\` and \`<svg data-cut>\` print as cuts, and underlines are printed as rules.\n\n<img src="docs/header.webp" width="640" alt="A notice card pressed from live HTML">\n\n\`\`\`html\n<div class="card" style="${cardCss} width: 640px">\n${cardHtml}\n</div>\n\`\`\`\n\n\`\`\`ts\nimport { pressElement } from 'impressio';\n\nconst pressed = await pressElement(document.querySelector('.card'), {\n  paper: 'cotton', impression: 'deep', seed: 9, light: { azimuth: 315, elevation: 34 },\n});\npressed.relight({ elevation: 20 }); // re-photograph\nawait pressed.update();             // after the content or size changes\npressed.destroy();                  // put the element back as it was\n\`\`\`\n\nPass \`interactiveLight: true\` to make the light follow the pointer, and \`handset: true\` to set each letter as its own sort.\n`;
  md += `\n## Also\n\n| API | What it does |\n| --- | --- |\n| \`loadFont(family, urlOrBuffer)\` | Registers a font file so it can be named in a forme. |\n| \`fontsReady([...fonts])\` | Waits until the given CSS fonts can be drawn on a canvas. |\n| \`setTexEngine(fn)\` | Uses a TeX engine other than a global MathJax. |\n| \`setCanvasFactory(fn)\` | Supplies a canvas constructor where there is no DOM. |\n| \`createSheet({ canvas, pixelRatio })\` | Draws into an existing canvas, at a chosen device pixel ratio. |\n| \`sheet.toDataURL()\` | Exports the current render. |\n`;
  fs.writeFileSync(path.join(root, 'GALLERY.md'), md);
  console.log('\nwrote GALLERY.md');
})();
