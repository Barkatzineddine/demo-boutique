// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { can, FREE_SHIPPING, ORDER_FLOW } from '../../src/domain/catalog';
import { deliveryDate, isAddress, isFrenchZip, orderTotals, resolveCart } from '../../src/domain/pricing';
import { productSchema, stateSchema } from '../../src/domain/schema';
import { filtersToQuery, fold, NO_FILTERS, parseFilters, searchProducts } from '../../src/domain/search';
import { seed, seedProducts } from '../../src/domain/seed';

const products = seedProducts();
const product = (id: string) => {
  const p = products.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('order totals (integer cents)', () => {
  it('adds lines, charges delivery under the free threshold and shows the VAT included', () => {
    const t = orderTotals([{ price: 3200, qty: 1 }], 'colissimo', false);
    expect(t).toEqual({ subtotal: 3200, discount: 0, ship: 690, total: 3890, vat: 648 });
  });
  it('offers delivery from the threshold, measured after the discount', () => {
    expect(orderTotals([{ price: FREE_SHIPPING, qty: 1 }], 'relais', false).ship).toBe(0);
    const promo = orderTotals([{ price: FREE_SHIPPING, qty: 1 }], 'relais', true);
    expect(promo.discount).toBe(600);
    expect(promo.ship).toBe(450); // 60 € - 10 % is under the threshold again
  });
  it('rounds the discount to the cent and never drifts', () => {
    const t = orderTotals([{ price: 1999, qty: 3 }, { price: 1, qty: 1 }], 'atelier', true);
    expect(t.subtotal).toBe(5998);
    expect(t.discount).toBe(600);
    expect(t.total).toBe(5398);
    expect(Number.isInteger(t.vat)).toBe(true);
  });
  it('pick-up at the workshop is always free', () => {
    expect(orderTotals([{ price: 1800, qty: 1 }], 'atelier', false).ship).toBe(0);
  });
});

describe('cart against the live catalogue', () => {
  it('drops unknown, unpublished, sold-out pieces and withdrawn glazes, and caps quantities', () => {
    const catalogue = products.map((p) => (p.id === 'vase-galet' ? { ...p, published: false } : p.id === 'gobelet-brume' ? { ...p, stock: 2 } : p));
    const lines = resolveCart([
      { id: 'tasse-matin', glaze: 'celadon', qty: 2 },
      { id: 'tasse-matin', glaze: 'terracotta', qty: 1 }, // not offered in terracotta
      { id: 'deleted', glaze: 'noir', qty: 1 },
      { id: 'vase-galet', glaze: 'sauge', qty: 1 }, // unpublished
      { id: 'plat-escale', glaze: 'miel', qty: 1 }, // sold out
      { id: 'gobelet-brume', glaze: 'cendre', qty: 5 }, // only 2 left
    ], catalogue);
    expect(lines.map((l) => [l.id, l.qty])).toEqual([['tasse-matin', 2], ['gobelet-brume', 2]]);
  });
});

describe('delivery dates and address checks', () => {
  it('counts business days only, plus a day of preparation', () => {
    expect(deliveryDate('colissimo', new Date(2026, 9, 23))).toBe('2026-10-29'); // Friday + 4 working days
    expect(deliveryDate('atelier', new Date(2026, 9, 24))).toBe('2026-10-27'); // Saturday -> Tuesday
  });
  it('accepts mainland French postcodes and real-looking addresses', () => {
    expect(isFrenchZip('44000')).toBe(true);
    expect(isFrenchZip('97400')).toBe(false); // overseas: not delivered
    expect(isFrenchZip('4400')).toBe(false);
    expect(isAddress('12 quai des Antilles')).toBe(true);
    expect(isAddress('<script>')).toBe(false);
  });
});

describe('catalogue search', () => {
  const words = (p: (typeof products)[number]) => `${p.name.fr} ${p.desc.fr} ${p.glazes.join(' ')}`;
  it('ignores case and accents, and needs every word', () => {
    expect(fold('Céladon ÉTÉ')).toBe('celadon ete');
    const hits = searchProducts(products, { ...NO_FILTERS, q: 'BOL riziere' }, words).map((p) => p.id);
    expect(hits).toEqual(['bol-riziere']);
  });
  it('combines category, glaze, price and stock filters', () => {
    const f = { ...NO_FILTERS, cat: 'vases' as const, glazes: ['sauge' as const], max: 40, inStock: true };
    expect(searchProducts(products, f, words).map((p) => p.id)).toEqual(['soliflore-tige']);
  });
  it('keeps sold-out pieces visible but last, whatever the sort', () => {
    const list = searchProducts(products, { ...NO_FILTERS, sort: 'price-asc' }, words);
    expect(list.at(-1)?.id).toBe('plat-escale');
    expect(list[0]?.price).toBeLessThanOrEqual(list[1]?.price ?? 0);
  });
  it('sorts by price and by sales', () => {
    const desc = searchProducts(products, { ...NO_FILTERS, sort: 'price-desc' }, words);
    expect(desc[0]?.id).toBe('coffret-petit-dejeuner');
    const best = searchProducts(products, { ...NO_FILTERS, sort: 'best' }, words);
    expect(best[0]?.id).toBe('assiette-greve');
  });
  it('reads filters from the address defensively and writes them back', () => {
    const f = parseFilters(new URLSearchParams('q=vase&cat=vases&email=noir,<img>,miel&max=99999&dispo=1&tri=hack'));
    expect(f).toEqual({ q: 'vase', cat: 'vases', glazes: ['noir', 'miel'], max: null, inStock: true, sort: 'featured' });
    expect(parseFilters(new URLSearchParams(filtersToQuery(f)))).toEqual(f);
    expect(filtersToQuery(NO_FILTERS)).toBe('');
  });
});

describe('roles', () => {
  it('lets the manager do everything and the packer only move orders', () => {
    expect(can('manager', 'products.edit')).toBe(true);
    expect(can('packer', 'orders.move')).toBe(true);
    expect(can('packer', 'orders.refund')).toBe(false);
    expect(can('packer', 'dashboard')).toBe(false);
    expect(can(null, 'orders.move')).toBe(false);
  });
});

describe('seed data', () => {
  const now = new Date(2026, 9, 23, 12);
  const state = seed(now);
  it('passes the same validation as stored data, and is stable for a day', () => {
    expect(stateSchema.safeParse(state).success).toBe(true);
    expect(seed(now)).toEqual(state);
  });
  it('has consistent totals, unique numbers and a history that matches each status', () => {
    expect(new Set(state.orders.map((o) => o.number)).size).toBe(state.orders.length);
    for (const o of state.orders) {
      expect(o.totals).toEqual(orderTotals(o.items, o.shipping, o.promo));
      expect(o.history.at(-1)?.status).toBe(o.status);
      if (o.status !== 'refunded') expect(o.history.map((h) => h.status)).toEqual(ORDER_FLOW.slice(0, o.history.length));
    }
  });
  it('rejects a product whose photo is not an image data URL', () => {
    const p = product('tasse-matin');
    expect(productSchema.safeParse({ ...p, image: 'javascript:alert(1)' }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, image: 'data:image/svg+xml;base64,PHN2Zz4=' }).success).toBe(false);
    expect(productSchema.safeParse({ ...p, image: 'data:image/webp;base64,UklGRg==' }).success).toBe(true);
  });
});
