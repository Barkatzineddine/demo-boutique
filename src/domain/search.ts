// Catalogue search and filters. The filters live in the URL (shareable views) and are parsed
// defensively: unknown values are dropped, never trusted.
import { CATEGORY_IDS, GLAZE_IDS, type CategoryId, type GlazeId } from './catalog';
import type { Product } from './schema';

export const SORTS = ['featured', 'price-asc', 'price-desc', 'best'] as const;
export type Sort = (typeof SORTS)[number];

export interface Filters { q: string; cat: CategoryId | ''; glazes: GlazeId[]; max: number | null; inStock: boolean; sort: Sort }
export const NO_FILTERS: Filters = { q: '', cat: '', glazes: [], max: null, inStock: false, sort: 'featured' };

/** Lower case, accents removed: "Céladon" and "celadon" match. */
export const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function parseFilters(params: URLSearchParams): Filters {
  const cat = params.get('cat') ?? '';
  const max = Number(params.get('max'));
  const sort = params.get('tri') ?? '';
  return {
    q: (params.get('q') ?? '').slice(0, 60),
    cat: (CATEGORY_IDS as readonly string[]).includes(cat) ? (cat as CategoryId) : '',
    glazes: (params.get('email') ?? '').split(',').filter((g): g is GlazeId => (GLAZE_IDS as string[]).includes(g)),
    max: Number.isInteger(max) && max > 0 && max <= 5000 ? max : null,
    inStock: params.get('dispo') === '1',
    sort: (SORTS as readonly string[]).includes(sort) ? (sort as Sort) : 'featured',
  };
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.cat) p.set('cat', f.cat);
  if (f.glazes.length) p.set('email', f.glazes.join(','));
  if (f.max) p.set('max', String(f.max));
  if (f.inStock) p.set('dispo', '1');
  if (f.sort !== 'featured') p.set('tri', f.sort);
  return p.toString();
}

/**
 * Published products matching the filters. `words` gives the searchable text of a product in the
 * current language (name, category, glazes, description). Out-of-stock pieces stay visible, last.
 */
export function searchProducts(products: readonly Product[], f: Filters, words: (p: Product) => string): Product[] {
  const terms = fold(f.q).split(/\s+/).filter(Boolean);
  const list = products.filter((p) => {
    if (!p.published) return false;
    if (f.cat && p.cat !== f.cat) return false;
    if (f.glazes.length && !f.glazes.some((g) => p.glazes.includes(g))) return false;
    if (f.max !== null && p.price > f.max * 100) return false;
    if (f.inStock && p.stock <= 0) return false;
    if (terms.length) {
      const hay = fold(words(p));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const order: Record<Sort, (a: Product, b: Product) => number> = {
    featured: () => 0,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    best: (a, b) => b.sold - a.sold,
  };
  return list.sort((a, b) => Number(a.stock <= 0) - Number(b.stock <= 0) || order[f.sort](a, b));
}
