// Product illustrations drawn in SVG from a shape and a glaze, so a glaze switch redraws the piece
// and the catalogue needs no photos. Stoneware look: glaze dipped to a wavy line with drips, raw
// speckled clay below, soft shading. Random details come from a seeded generator: stable per piece.
import { useId, useMemo, type ReactNode } from 'react';
import { GLAZES, type GlazeId, type ShapeId } from '../domain/catalog';

const CLAY = '#c9a37f';
const CLAY_DARK = '#a8805c';

interface Body { body: string; mouth: [number, number, number, number]; dip: number; handle?: string; foot?: string; spout?: string; rings?: number[]; stem?: boolean }
const SHAPES: Record<Exclude<ShapeId, 'plate' | 'set'>, Body> = {
  mug: { body: 'M128 140 L272 140 L266 306 Q264 322 248 322 L152 322 Q136 322 134 306 Z', mouth: [200, 140, 72, 13], dip: 262, handle: 'M268 176 C 336 172, 336 274, 264 270' },
  tumbler: { body: 'M140 118 L260 118 L252 308 Q250 322 236 322 L164 322 Q150 322 148 308 Z', mouth: [200, 118, 60, 11], dip: 268, rings: [170, 215] },
  bowl: { body: 'M72 196 C 78 282, 140 312, 200 312 C 260 312, 322 282, 328 196 Z', foot: 'M162 306 L238 306 L234 326 L166 326 Z', mouth: [200, 196, 128, 28], dip: 282 },
  vase: { body: 'M178 92 L222 92 L220 122 C 224 146, 292 170, 294 240 C 296 300, 252 324, 200 324 C 148 324, 104 300, 106 240 C 108 170, 176 146, 180 122 Z', mouth: [200, 92, 23, 6], dip: 276, stem: true },
  budvase: { body: 'M191 112 L209 112 L208 208 C 248 222, 262 256, 258 288 C 254 316, 230 326, 200 326 C 170 326, 146 316, 142 288 C 138 256, 152 222, 192 208 Z', mouth: [200, 112, 9, 3], dip: 292, stem: true },
  pebble: { body: 'M172 150 L228 150 C 232 162, 302 178, 302 246 C 302 306, 256 326, 200 326 C 144 326, 98 306, 98 246 C 98 178, 168 162, 172 150 Z', mouth: [200, 150, 28, 6], dip: 290 },
  pitcher: { body: 'M140 122 L262 122 C 262 152, 292 182, 292 242 C 292 302, 252 324, 200 324 C 148 324, 108 302, 108 242 C 108 182, 140 152, 140 122 Z', spout: 'M142 122 L104 106 Q112 126 140 146 Z', mouth: [201, 122, 61, 11], dip: 280, handle: 'M262 146 C 336 152, 334 258, 284 272' },
};

function rng(seed: string): () => number {
  let a = [...seed].reduce((acc, ch) => (Math.imul(acc, 31) + ch.charCodeAt(0)) >>> 0, 7);
  return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
}

function wave(y: number, r: () => number): string {
  let d = `M0 0 H400 V${y}`;
  for (let x = 400; x > 0; x -= 50) d += ` Q${x - 25} ${(y + (r() * 14 - 7)).toFixed(1)} ${x - 50} ${(y + (r() * 8 - 4)).toFixed(1)}`;
  return `${d} Z`;
}

function drips(y: number, r: () => number, from = 130, to = 270): string {
  const out: string[] = [];
  for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) {
    const x = from + r() * (to - from), w = 5 + r() * 6, len = 8 + r() * 22;
    const f = (v: number) => v.toFixed(1);
    out.push(`M${f(x - w)} ${y - 6} C ${f(x - w)} ${f(y + len * 0.6)}, ${f(x - w * 0.7)} ${f(y + len)}, ${f(x)} ${f(y + len)} C ${f(x + w * 0.7)} ${f(y + len)}, ${f(x + w)} ${f(y + len * 0.6)}, ${f(x + w)} ${y - 6} Z`);
  }
  return out.join(' ');
}

function speckles(r: () => number, n: number, color: string, opacity: number): ReactNode[] {
  return Array.from({ length: n }, (_, i) => (
    <circle key={i} cx={(r() * 400).toFixed(1)} cy={(r() * 400).toFixed(1)} r={(0.6 + r() * 1.6).toFixed(1)} fill={color} opacity={opacity} />
  ));
}

function Piece({ shape, glaze, seed, uid }: { shape: ShapeId; glaze: GlazeId; seed: string; uid: string }) {
  const g = GLAZES[glaze];
  const r = rng(`${seed}-${glaze}`);
  if (shape === 'plate') {
    return (
      <g>
        <defs>
          <radialGradient id={`${uid}w`} cx=".45" cy=".4" r=".7"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".12" /></radialGradient>
          <clipPath id={`${uid}c`}><ellipse cx="200" cy="222" rx="152" ry="64" /></clipPath>
        </defs>
        <ellipse cx="200" cy="234" rx="150" ry="62" fill={CLAY_DARK} />
        <g clipPath={`url(#${uid}c)`}>
          <rect width="400" height="400" fill={g.c} />
          {g.speckle ? speckles(r, 120, '#5a5248', 0.5) : null}
          <ellipse cx="200" cy="226" rx="104" ry="40" fill={g.d} opacity=".55" />
          <ellipse cx="200" cy="228" rx="100" ry="38" fill={g.c} />
          <ellipse cx="200" cy="228" rx="100" ry="38" fill={`url(#${uid}w)`} />
        </g>
        <ellipse cx="200" cy="222" rx="151" ry="63" fill="none" stroke={CLAY} strokeWidth="3" />
      </g>
    );
  }
  const sh = SHAPES[shape === 'set' ? 'mug' : shape];
  const [cx, cy, rx, ry] = sh.mouth;
  const top = sh.mouth[1];
  const len = Math.min(96, top - 14);
  return (
    <g>
      <defs>
        <clipPath id={`${uid}c`}><path d={sh.body} /></clipPath>
        <linearGradient id={`${uid}s`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".32" stopColor="#fff" stopOpacity="0" />
          <stop offset=".68" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
      </defs>
      {sh.stem ? (
        <g>
          <g stroke="#7d6a4f" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d={`M200 ${top + 4} C 197 ${top - len * 0.4}, 214 ${top - len * 0.75}, 236 ${top - len}`} />
            <path d={`M200 ${top - 8} C 190 ${top - len * 0.35}, 176 ${top - len * 0.6}, 162 ${top - len * 0.76}`} />
          </g>
          {([[236, top - len, 30], [226, top - len * 0.8, -20], [162, top - len * 0.76, -40], [173, top - len * 0.56, 25], [214, top - len * 0.58, 40]] as const).map(([x, y, a]) => (
            <ellipse key={`${x}-${a}`} cx={x} cy={y} rx="9" ry="3.6" fill="#a99a76" transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </g>
      ) : null}
      {sh.handle ? (
        <g fill="none" strokeLinecap="round">
          <path d={sh.handle} stroke={g.d} strokeWidth="20" />
          <path d={sh.handle} stroke={g.c} strokeWidth="12" />
        </g>
      ) : null}
      {sh.foot ? <path d={sh.foot} fill={CLAY_DARK} /> : null}
      {sh.spout ? <path d={sh.spout} fill={g.c} /> : null}
      <g clipPath={`url(#${uid}c)`}>
        <rect width="400" height="400" fill={CLAY} />
        {speckles(r, 70, '#6b4f36', 0.45)}
        <path d={`${wave(sh.dip, r)} ${drips(sh.dip, r)}`} fill={g.c} />
        {g.speckle ? speckles(r, 90, '#5a5248', 0.55) : null}
        {sh.rings?.map((y) => <path key={y} d={`M100 ${y} Q200 ${y + 10} 300 ${y}`} fill="none" stroke={g.d} strokeOpacity=".35" strokeWidth="2" />)}
        <rect width="400" height="400" fill={`url(#${uid}s)`} />
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={g.d} />
      <ellipse cx={cx} cy={cy + ry * 0.25} rx={rx * 0.9} ry={ry * 0.7} fill="#000" opacity=".22" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={g.c} strokeWidth="3" />
    </g>
  );
}

/** One product drawn in one glaze (the breakfast set is composed of four pieces). */
export function ProductArt({ id, shape, scale, glaze, label, className = 'art' }: {
  id: string; shape: ShapeId; scale: number; glaze: GlazeId; label: string; className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const content = useMemo(() => {
    if (shape === 'set') {
      const parts: [ShapeId, number, number, number][] = [['mug', 20, 100, 0.55], ['bowl', 172, 110, 0.55], ['mug', 62, 152, 0.55], ['bowl', 150, 156, 0.55]];
      return (
        <>
          <ellipse cx="205" cy="332" rx="150" ry="10" fill="#3b2a1c" opacity=".16" />
          {parts.map(([s, x, y, k], i) => <g key={i} transform={`translate(${x} ${y}) scale(${k})`}><Piece shape={s} glaze={glaze} seed={`${id}${x}`} uid={`${uid}p${i}`} /></g>)}
        </>
      );
    }
    const ground = shape === 'plate' ? 296 : 325;
    return (
      <>
        <ellipse cx="200" cy={ground} rx={112 * scale} ry={9 * scale} fill="#3b2a1c" opacity=".16" />
        <g transform={scale === 1 ? undefined : `translate(${200 * (1 - scale)} ${ground * (1 - scale)}) scale(${scale})`}>
          <Piece shape={shape} glaze={glaze} seed={id} uid={uid} />
        </g>
      </>
    );
  }, [id, shape, scale, glaze, uid]);
  return <svg viewBox="0 0 400 400" className={className} role="img" aria-label={label}>{content}</svg>;
}

/** Round colour swatch for a glaze (decorative: the name is always written next to it). */
export function Swatch({ glaze, className = 'swatch' }: { glaze: GlazeId; className?: string }) {
  const g = GLAZES[glaze];
  return <svg viewBox="0 0 20 20" className={className} aria-hidden="true"><circle cx="10" cy="10" r="9" fill={g.c} stroke={g.d} strokeWidth="1.5" /></svg>;
}

/** Several pieces on a shelf, for the home page. */
export function Scene({ pieces, label }: { pieces: [ShapeId, GlazeId, number, number, number][]; label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 800 460" className="scene" role="img" aria-label={label}>
      <rect x="20" y="400" width="760" height="14" rx="7" fill={CLAY} />
      <rect x="20" y="410" width="760" height="8" rx="4" fill={CLAY_DARK} />
      {pieces.map(([shape, glaze, x, y, k], i) => (
        <g key={i}>
          <ellipse cx={x + 200 * k} cy={y + 325 * k} rx={112 * k} ry={8 * k} fill="#3b2a1c" opacity=".18" />
          <g transform={`translate(${x} ${y}) scale(${k})`}><Piece shape={shape} glaze={glaze} seed={`${shape}${x}`} uid={`${uid}s${i}`} /></g>
        </g>
      ))}
    </svg>
  );
}
