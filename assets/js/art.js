// Product illustrations drawn in SVG from a shape + a glaze, so a glaze switch redraws the piece.
// Stoneware look: glaze dipped to a wavy line with drips, raw speckled clay below, soft shading.
import { s } from './core.js';

export const GLAZES = {
  celadon: { name: 'Céladon', c: '#a9c2b0', d: '#7d9c88', tint: '#e6eee6' },
  cendre: { name: 'Cendre', c: '#cdc5b8', d: '#a39a8c', tint: '#ece7df', speckle: true },
  miel: { name: 'Miel', c: '#d39a3f', d: '#a86f22', tint: '#f3e6cf' },
  terracotta: { name: 'Terracotta', c: '#c4673f', d: '#954527', tint: '#f2ddd2' },
  cobalt: { name: 'Bleu cobalt', c: '#3b5a92', d: '#243a66', tint: '#dde3ee' },
  noir: { name: 'Noir mat', c: '#3a3633', d: '#211f1d', tint: '#e4e0db' },
  coquille: { name: 'Blanc coquille', c: '#f1ece2', d: '#d3cbbd', tint: '#ece6dc', speckle: true },
  sauge: { name: 'Sauge', c: '#8f9f7f', d: '#69785b', tint: '#e5e9df' },
};

const CLAY = '#c9a37f';
const CLAY_DARK = '#a8805c';

// Body outlines in a 400 x 400 box, ground line around y = 325.
const SHAPES = {
  mug: {
    body: 'M128 140 L272 140 L266 306 Q264 322 248 322 L152 322 Q136 322 134 306 Z',
    mouth: [200, 140, 72, 13], dip: 262,
    handle: 'M268 176 C 336 172, 336 274, 264 270',
  },
  tumbler: {
    body: 'M140 118 L260 118 L252 308 Q250 322 236 322 L164 322 Q150 322 148 308 Z',
    mouth: [200, 118, 60, 11], dip: 268, rings: [170, 215],
  },
  bowl: {
    body: 'M72 196 C 78 282, 140 312, 200 312 C 260 312, 322 282, 328 196 Z',
    foot: 'M162 306 L238 306 L234 326 L166 326 Z',
    mouth: [200, 196, 128, 28], dip: 282,
  },
  plate: { plate: true, ground: 296 },
  vase: {
    body: 'M178 92 L222 92 L220 122 C 224 146, 292 170, 294 240 C 296 300, 252 324, 200 324 C 148 324, 104 300, 106 240 C 108 170, 176 146, 180 122 Z',
    mouth: [200, 92, 23, 6], dip: 276, stem: true,
  },
  budvase: {
    body: 'M191 112 L209 112 L208 208 C 248 222, 262 256, 258 288 C 254 316, 230 326, 200 326 C 170 326, 146 316, 142 288 C 138 256, 152 222, 192 208 Z',
    mouth: [200, 112, 9, 3], dip: 292, stem: true,
  },
  pebble: {
    body: 'M172 150 L228 150 C 232 162, 302 178, 302 246 C 302 306, 256 326, 200 326 C 144 326, 98 306, 98 246 C 98 178, 168 162, 172 150 Z',
    mouth: [200, 150, 28, 6], dip: 290,
  },
  pitcher: {
    body: 'M140 122 L262 122 C 262 152, 292 182, 292 242 C 292 302, 252 324, 200 324 C 148 324, 108 302, 108 242 C 108 182, 140 152, 140 122 Z',
    spout: 'M142 122 L104 106 Q112 126 140 146 Z',
    mouth: [201, 122, 61, 11], dip: 280,
    handle: 'M262 146 C 336 152, 334 258, 284 272',
  },
};

let uidCounter = 0;

function rng(seed) {
  let a = [...String(seed)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

function wave(y, r) {
  let d = `M0 0 H400 V${y}`;
  for (let x = 400; x > 0; x -= 50) d += ` Q${x - 25} ${y + (r() * 14 - 7)} ${x - 50} ${y + (r() * 8 - 4)}`;
  return `${d} Z`;
}

function drips(y, r, from = 130, to = 270) {
  const out = [];
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = from + r() * (to - from);
    const w = 5 + r() * 6;
    const len = 8 + r() * 22;
    out.push(`M${x - w} ${y - 6} C ${x - w} ${y + len * 0.6}, ${x - w * 0.7} ${y + len}, ${x} ${y + len} C ${x + w * 0.7} ${y + len}, ${x + w} ${y + len * 0.6}, ${x + w} ${y - 6} Z`);
  }
  return out.join(' ');
}

function speckles(r, n, color, opacity) {
  return Array.from({ length: n }, () => s('circle', { cx: (r() * 400).toFixed(1), cy: (r() * 400).toFixed(1), r: (0.6 + r() * 1.6).toFixed(1), fill: color, opacity }));
}

function shading(id) {
  return s('linearGradient', { id, x1: '0', x2: '1', y1: '0', y2: '0' },
    s('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.28' }),
    s('stop', { offset: '.32', 'stop-color': '#fff', 'stop-opacity': '0' }),
    s('stop', { offset: '.68', 'stop-color': '#000', 'stop-opacity': '0' }),
    s('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '.28' }));
}

function piece(shapeId, glaze, seed, defs) {
  const sh = SHAPES[shapeId];
  const g = GLAZES[glaze] || GLAZES.cendre;
  const r = rng(`${seed}-${glaze}`);
  const id = `a${++uidCounter}`;
  if (sh.plate) return plate(g, r, id, defs);

  defs.append(s('clipPath', { id: `${id}-clip` }, s('path', { d: sh.body })), shading(`${id}-shade`));
  const group = s('g', null);
  if (sh.stem) {
    const top = sh.mouth[1];
    const len = Math.min(96, top - 14);
    const leaves = [[236, top - len, 30], [226, top - len * 0.8, -20], [162, top - len * 0.76, -40], [173, top - len * 0.56, 25], [214, top - len * 0.58, 40]];
    group.append(s('g', { stroke: '#7d6a4f', 'stroke-width': '2.5', fill: 'none', 'stroke-linecap': 'round' },
      s('path', { d: `M200 ${top + 4} C 197 ${top - len * 0.4}, 214 ${top - len * 0.75}, 236 ${top - len}` }),
      s('path', { d: `M200 ${top - 8} C 190 ${top - len * 0.35}, 176 ${top - len * 0.6}, 162 ${top - len * 0.76}` })),
    ...leaves.map(([x, y, a]) => s('ellipse', { cx: x, cy: y, rx: 9, ry: 3.6, fill: '#a99a76', transform: `rotate(${a} ${x} ${y})` })));
  }
  if (sh.handle) group.append(s('path', { d: sh.handle, fill: 'none', stroke: g.d, 'stroke-width': '20', 'stroke-linecap': 'round' }),
    s('path', { d: sh.handle, fill: 'none', stroke: g.c, 'stroke-width': '12', 'stroke-linecap': 'round' }));
  if (sh.foot) group.append(s('path', { d: sh.foot, fill: CLAY_DARK }));
  if (sh.spout) group.append(s('path', { d: sh.spout, fill: g.c }));

  const body = s('g', { 'clip-path': `url(#${id}-clip)` },
    s('rect', { width: 400, height: 400, fill: CLAY }),
    speckles(r, 70, '#6b4f36', '.45'),
    s('path', { d: wave(sh.dip, r) + ' ' + drips(sh.dip, r), fill: g.c }),
    g.speckle ? speckles(r, 90, '#5a5248', '.55') : null,
    sh.rings ? sh.rings.map((y) => s('path', { d: `M100 ${y} Q200 ${y + 10} 300 ${y}`, fill: 'none', stroke: g.d, 'stroke-opacity': '.35', 'stroke-width': '2' })) : null,
    s('rect', { width: 400, height: 400, fill: `url(#${id}-shade)` }));
  group.append(body);
  const [cx, cy, rx, ry] = sh.mouth;
  group.append(
    s('ellipse', { cx, cy, rx, ry, fill: g.d }),
    s('ellipse', { cx, cy: cy + ry * 0.25, rx: rx * 0.9, ry: ry * 0.7, fill: '#000', opacity: '.22' }),
    s('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: g.c, 'stroke-width': '3' }));
  return group;
}

function plate(g, r, id, defs) {
  defs.append(s('radialGradient', { id: `${id}-well`, cx: '.45', cy: '.4', r: '.7' },
    s('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.25' }),
    s('stop', { offset: '1', 'stop-color': '#000', 'stop-opacity': '.12' })),
  s('clipPath', { id: `${id}-clip` }, s('ellipse', { cx: 200, cy: 222, rx: 152, ry: 64 })));
  return s('g', null,
    s('ellipse', { cx: 200, cy: 234, rx: 150, ry: 62, fill: CLAY_DARK }),
    s('g', { 'clip-path': `url(#${id}-clip)` },
      s('rect', { width: 400, height: 400, fill: g.c }),
      g.speckle ? speckles(r, 120, '#5a5248', '.5') : null,
      s('ellipse', { cx: 200, cy: 226, rx: 104, ry: 40, fill: g.d, opacity: '.55' }),
      s('ellipse', { cx: 200, cy: 228, rx: 100, ry: 38, fill: g.c }),
      s('ellipse', { cx: 200, cy: 228, rx: 100, ry: 38, fill: `url(#${id}-well)` })),
    s('ellipse', { cx: 200, cy: 222, rx: 151, ry: 63, fill: 'none', stroke: CLAY, 'stroke-width': '3' }));
}

/**
 * Build an illustration. layout: one piece, or a set (e.g. breakfast box).
 * opts.set: list of [shape, glaze, x, y, scale] for composed scenes.
 */
export function art(product, glaze, { label = '', className = 'art' } = {}) {
  const defs = s('defs', null);
  const svg = s('svg', { viewBox: '0 0 400 400', class: className, role: 'img', 'aria-label': label || `${product.name}, émail ${GLAZES[glaze]?.name || ''}` });
  const ground = SHAPES[product.shape]?.ground || 325;
  svg.append(defs);
  if (product.shape === 'set') {
    svg.append(s('ellipse', { cx: 205, cy: 332, rx: 150, ry: 10, fill: '#3b2a1c', opacity: '.16' }));
    const parts = [['mug', 20, 100, 0.55], ['bowl', 172, 110, 0.55], ['mug', 62, 152, 0.55], ['bowl', 150, 156, 0.55]];
    for (const [shape, x, y, k] of parts) {
      svg.append(s('g', { transform: `translate(${x} ${y}) scale(${k})` }, piece(shape, glaze, `${product.id}${x}`, defs)));
    }
    return svg;
  }
  const scaleK = product.scale || 1;
  svg.append(s('ellipse', { cx: 200, cy: ground, rx: 112 * scaleK, ry: 9 * scaleK, fill: '#3b2a1c', opacity: '.16' }));
  const p = piece(product.shape, glaze, product.id, defs);
  if (scaleK !== 1) p.setAttribute('transform', `translate(${200 * (1 - scaleK)} ${ground * (1 - scaleK)}) scale(${scaleK})`);
  svg.append(p);
  return svg;
}

/** Small round swatch for a glaze. */
export function swatch(glaze) {
  const g = GLAZES[glaze];
  return s('svg', { viewBox: '0 0 20 20', class: 'swatch', 'aria-hidden': 'true' },
    s('circle', { cx: 10, cy: 10, r: 9, fill: g.c, stroke: g.d, 'stroke-width': '1.5' }));
}

/** Several pieces on one shelf, for the home page. pieces: [shape, glaze, x, y, scale] */
export function scene(pieces, label) {
  const defs = s('defs', null);
  const svg = s('svg', { viewBox: '0 0 800 460', class: 'scene', role: 'img', 'aria-label': label });
  svg.append(defs,
    s('rect', { x: 20, y: 400, width: 760, height: 14, rx: 7, fill: '#c9a37f' }),
    s('rect', { x: 20, y: 410, width: 760, height: 8, rx: 4, fill: '#a8805c' }));
  for (const [shape, glaze, x, y, k] of pieces) {
    svg.append(s('ellipse', { cx: x + 200 * k, cy: y + 325 * k, rx: 112 * k, ry: 8 * k, fill: '#3b2a1c', opacity: '.18' }),
      s('g', { transform: `translate(${x} ${y}) scale(${k})` }, piece(shape, glaze, `${shape}${x}`, defs)));
  }
  return svg;
}
