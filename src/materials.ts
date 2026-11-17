/** Papers and inks: the material vocabulary of the press. All lengths are CSS px. */

export interface PaperSpec {
  /** Base stock colour (any CSS colour). */
  color: string;
  /** Surface relief ("tooth") amplitude, 0 = coated/smooth, 1 = rough cold-press. */
  tooth: number;
  /** Feature size of the tooth, px. */
  toothScale: number;
  /** Cloudy unevenness of the furnish seen in the colour (formation), 0..1. */
  formation: number;
  /** Visible same-colour fibres per 100x100 px. */
  fibers: number;
  /** Rare foreign inclusions (dark/coloured flecks and fibres) per 100x100 px. */
  inclusions: number;
  /** How readily the sheet deforms under the forme: 0 = hard board, 1 = soft cotton. */
  softness: number;
  /** How much the sheet drinks ink: dulls sheen, feathers edges slightly. */
  absorbency: number;
  /** Felt / weave mark amplitude, 0..1. */
  weave: number;
  /** Large-scale waviness of the sheet (cockle), 0..1. */
  cockle: number;
  /** Deckle (torn / mould-made) edge width in px; 0 = guillotined. */
  deckle: number;
  /** Surface sheen, 0 = dead matte. */
  sheen: number;
}

const paper = (p: Partial<PaperSpec>): PaperSpec => ({
  color: '#efece3', tooth: 0.5, toothScale: 1.6, formation: 0.5, fibers: 1.2, inclusions: 0.03,
  softness: 0.8, absorbency: 0.7, weave: 0, cockle: 0.05, deckle: 0, sheen: 0.03, ...p,
});

export const papers = {
  /** 100% cotton, soft and toothy: the classic deep-impression stock (think Lettra pearl). */
  cotton: paper({}),
  /** Bright white cotton. */
  cottonWhite: paper({ color: '#f6f5f0' }),
  /** Warm grey cotton cover. */
  cottonGrey: paper({ color: '#bdb9b0', formation: 0.6 }),
  /** Dyed-through uncoated cover (think Colorplan): firmer, finer tooth. */
  cover: paper({ color: '#f0a81e', tooth: 0.34, toothScale: 1.2, softness: 0.55, absorbency: 0.5, fibers: 0.5, formation: 0.35, weave: 0.12 }),
  /** Handmade rag with felt marks, cockle and a deckle edge. */
  handmade: paper({ color: '#c9c2b8', tooth: 0.75, toothScale: 2.4, formation: 1, fibers: 3, inclusions: 0.12, softness: 1, absorbency: 0.9, weave: 0.55, cockle: 0.8, deckle: 9 }),
  /** Smooth poster cartridge for wood type proofs: hard, little bite. */
  cartridge: paper({ color: '#eeede6', tooth: 0.16, toothScale: 1.1, softness: 0.25, absorbency: 0.55, fibers: 0.3, formation: 0.3, inclusions: 0.02 }),
  /**
   * Ordinary A4 office paper (80 gsm copier bond): brightened blue-white, nearly smooth, thin and hard,
   * so it takes little bite. (A paper quality, not a size: use it at any dimensions.)
   */
  a4: paper({ color: '#f7f8fa', tooth: 0.1, toothScale: 0.9, formation: 0.22, fibers: 0.15, inclusions: 0, softness: 0.15, absorbency: 0.6, cockle: 0.12, sheen: 0.06 }),
  /** Unbleached kraft, flecked. */
  kraft: paper({ color: '#b39068', tooth: 0.45, toothScale: 1.5, softness: 0.45, fibers: 4, inclusions: 0.5, formation: 0.9 }),
  /** Black cover stock, for foil and opaque inks. */
  black: paper({ color: '#1d1c1b', tooth: 0.3, toothScale: 1.3, softness: 0.55, fibers: 0.6, formation: 0.4, inclusions: 0 }),
} satisfies Record<string, PaperSpec>;

export type PaperName = keyof typeof papers;

export interface InkSpec {
  /** Pigment colour (any CSS colour). */
  color: string;
  /** Pigment load: optical density of a nominal film. 1 = dense black, 0.3 = transparent tint. */
  strength: number;
  /** Hiding power. 0 = transparent (multiplies with what is beneath, so overprints mix); 1 = opaque. */
  opacity: number;
  /** Dry film gloss, 0..1. Rubber-base is ~0.1, oil-base ~0.3, foil ~0.9. */
  gloss: number;
  /** Metallic reflection, 0..1 (bronze inks, hot foil). */
  metallic: number;
}

const mkInk = (i: Partial<InkSpec>): InkSpec => ({ color: '#1b1a19', strength: 1, opacity: 0.5, gloss: 0.14, metallic: 0, ...i });

export const inks = {
  black: mkInk({}),
  /** Dense oil-base poster black with a little shine. */
  posterBlack: mkInk({ color: '#151414', strength: 1.1, gloss: 0.3, opacity: 0.6 }),
  warmGrey: mkInk({ color: '#5d5750', strength: 0.8 }),
  oxblood: mkInk({ color: '#7a1f1c', strength: 0.95 }),
  navy: mkInk({ color: '#1d2f55', strength: 0.95 }),
  forest: mkInk({ color: '#24513a', strength: 0.9 }),
  /** Transparent process tints: overprint them to mix. */
  cyan: mkInk({ color: '#19a7d8', strength: 0.75, opacity: 0 }),
  magenta: mkInk({ color: '#e0327c', strength: 0.75, opacity: 0 }),
  yellow: mkInk({ color: '#f6d21d', strength: 0.75, opacity: 0 }),
  /** Opaque white, needs dark stock; real printers hit it twice. */
  white: mkInk({ color: '#f4f1e8', strength: 0.9, opacity: 0.85, gloss: 0.1 }),
  /** Bronze metallic ink. */
  gold: mkInk({ color: '#b08a3c', strength: 1, opacity: 0.9, gloss: 0.5, metallic: 0.7 }),
  /** Hot foil: not letterpress, but it runs on the same press. */
  goldFoil: mkInk({ color: '#d9b25a', strength: 2, opacity: 1, gloss: 0.92, metallic: 1 }),
  copperFoil: mkInk({ color: '#cf8156', strength: 2, opacity: 1, gloss: 0.92, metallic: 1 }),
  silverFoil: mkInk({ color: '#d5d7da', strength: 2, opacity: 1, gloss: 0.92, metallic: 1 }),
} satisfies Record<string, InkSpec>;

export type InkName = keyof typeof inks;

/** Build an ink from any CSS colour. */
export function ink(color: string, overrides: Partial<InkSpec> = {}): InkSpec {
  return mkInk({ color, ...overrides });
}

export function resolveInk(i: InkSpec | string | null | undefined): InkSpec | null {
  if (i == null || i === 'blind' || i === 'none') return null;
  if (typeof i === 'string') return (inks as Record<string, InkSpec>)[i] ?? ink(i);
  return mkInk(i);
}

export function resolvePaper(p: PaperSpec | Partial<PaperSpec> | string | undefined): PaperSpec {
  if (p == null) return papers.cotton;
  if (typeof p === 'string') return (papers as Record<string, PaperSpec>)[p] ?? paper({ color: p });
  return paper(p);
}

/** How the forme meets the sheet. Every field is optional on `impress()`. */
export interface ImpressionSpec {
  /** Ink, a named ink, a CSS colour, or null / 'blind' for an uninked (blind) impression. */
  ink?: InkSpec | string | null;
  /** Bite: how far the forme sinks into the sheet, px. 0 = kiss impression. */
  depth?: number;
  /** Completeness of contact. 1 = solid; lower and only the paper's high points take ink ("salty"). */
  contact?: number;
  /** Ink film on the forme. 1 = nominal, <1 starved, >1 flooded. */
  inking?: number;
  /** Ink squeezed to the edge of the face: the dark rim / halo of real letterpress. 0..1. */
  squash?: number;
  /** Uneven density inside solids: roller streaks and mottle. 0..1. */
  mottle?: number;
  /** Plate / type damage: nicks, scratches, wood grain. 0..1. */
  wear?: number;
  /** How far individual sorts sit off type-high, so each letter inks differently. 0..1. */
  sortVariation?: number;
  /** Slow unevenness of pressure across the bed (imperfect makeready). 0..1. */
  makeready?: number;
  /** Ink spread beyond the face, px. */
  gain?: number;
  /** How much the paper around the bite is drawn down with it, giving a soft sunken hollow. 0..1. */
  dish?: number;
  /** Misregistration of this pass: px offset and rotation in degrees. */
  register?: { x?: number; y?: number; rotate?: number };
}

export const impressions = {
  /** Photopolymer plate, deep into cotton: crisp, dark, sculptural. */
  deep: { depth: 2.2, contact: 1.04, inking: 1, squash: 0.45, mottle: 0.35, wear: 0, sortVariation: 0, makeready: 0.15, gain: 0.25, dish: 0.6 },
  /** Traditional kiss impression: ink sits on the surface, barely any bite. */
  kiss: { depth: 0.25, contact: 0.96, inking: 0.95, squash: 0.3, mottle: 0.4, wear: 0, sortVariation: 0.1, makeready: 0.3, gain: 0.15, dish: 0.15 },
  /** Hand-set metal type on a platen: moderate bite, sorts vary. */
  handset: { depth: 1.1, contact: 0.99, inking: 1, squash: 0.5, mottle: 0.5, wear: 0.12, sortVariation: 0.5, makeready: 0.4, gain: 0.3, dish: 0.35 },
  /** Worn wood type on a proof press with a hand brayer: salty, scratched, uneven. */
  woodType: { depth: 0.2, contact: 0.86, inking: 1.1, squash: 0.25, mottle: 0.9, wear: 0.75, sortVariation: 0.8, makeready: 0.7, gain: 0.2, dish: 0.05 },
  /** Blind deboss: no ink, just the sculpture. */
  blind: { ink: null, depth: 2.6, dish: 0.7 },
  /** Hot foil stamp: shallow, perfectly solid. */
  foil: { depth: 0.9, contact: 1.2, inking: 1.2, squash: 0, mottle: 0.05, wear: 0, sortVariation: 0, makeready: 0, gain: 0.05, dish: 0.2 },
} satisfies Record<string, ImpressionSpec>;

export type ImpressionName = keyof typeof impressions;

export interface Light {
  /** Where the light sits, degrees clockwise from the top of the sheet. 315 = upper left. */
  azimuth?: number;
  /** Height of the light above the sheet, degrees. Low = raking light, strong relief. */
  elevation?: number;
  /** Overall exposure. */
  intensity?: number;
  /** Fill light, 0..1. */
  ambient?: number;
  /** Cast-shadow strength, 0..1. */
  shadow?: number;
  /** Cavity darkening, 0..1. */
  occlusion?: number;
  /** Brightness falloff across the sheet away from the light, 0..1. */
  falloff?: number;
  /** Light colour. */
  color?: string;
}
