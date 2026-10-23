// Demo data: the catalogue in French and English, and a realistic order history for the dashboard.
// Deterministic for a given day (seeded generator), so tests and screenshots are stable.
import { ORDER_FLOW, SHIPPING_IDS, type Badge, type CategoryId, type GlazeId, type OrderStatus, type ShapeId } from './catalog';
import { deliveryDate, orderTotals } from './pricing';
import type { Order, Product, State } from './schema';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = [id: string, fr: string, en: string, cat: CategoryId, shape: ShapeId, price: number, glazes: GlazeId[], stock: number, size: string, sold: number, badge: Badge, scale: number, descFr: string, descEn: string];

const PRODUCTS: P[] = [
  ['tasse-matin', 'Tasse « Matin »', '“Matin” mug', 'tasses', 'mug', 3200, ['celadon', 'cendre', 'miel', 'noir'], 14, '30 cl · H 9,5 cm', 182, 'best', 1,
    'La tasse du premier café : une anse franche qui se tient à pleine main, un bord fin et un émail qui accroche la lumière. Tournée à la main, chaque pièce est unique.',
    'The first-coffee mug: a generous handle you hold with your whole hand, a thin rim and a glaze that catches the light. Thrown by hand, every piece is unique.'],
  ['espresso-ristretto', 'Tasse à espresso « Ristretto »', '“Ristretto” espresso cup', 'tasses', 'mug', 1900, ['noir', 'miel', 'cobalt'], 22, '9 cl · H 6 cm', 96, '', 0.72,
    'Petite, épaisse et lourde comme il faut : elle garde votre espresso chaud jusqu’à la dernière gorgée.',
    'Small, thick and just heavy enough: it keeps your espresso hot to the last sip.'],
  ['gobelet-brume', 'Gobelet « Brume »', '“Brume” tumbler', 'tasses', 'tumbler', 2400, ['cendre', 'sauge', 'cobalt'], 3, '25 cl · H 11 cm', 141, '', 1,
    'Un gobelet sans anse aux stries de tournage apparentes, pour l’eau, le thé ou le vin du soir.',
    'A handle-less tumbler with visible throwing lines, for water, tea or the evening glass of wine.'],
  ['bol-riziere', 'Bol « Rizière »', '“Rizière” bowl', 'bols', 'bowl', 2800, ['celadon', 'miel', 'coquille'], 18, 'Ø 14 cm · 50 cl', 120, '', 1,
    'Le bol à tout faire : granola, ramen ou soupe du dimanche. Son pied tourné le rend agréable à tenir.',
    'The everyday bowl: granola, ramen or Sunday soup. Its turned foot makes it pleasant to hold.'],
  ['saladier-recolte', 'Saladier « Récolte »', '“Récolte” serving bowl', 'bols', 'bowl', 7800, ['terracotta', 'celadon'], 4, 'Ø 26 cm · 2,5 L', 38, 'limited', 1.12,
    'Un grand saladier généreux pour les tablées. Émail alimentaire, fond légèrement bombé, à poser au centre.',
    'A large, generous bowl for long tables. Food-safe glaze, slightly domed base, made for the centre of the table.'],
  ['assiette-greve', 'Assiette plate « Grève »', '“Grève” dinner plate', 'assiettes', 'plate', 3400, ['coquille', 'cendre', 'noir'], 26, 'Ø 27 cm', 210, 'best', 1,
    'Une assiette plate au marli large et au bord brut, qui met en valeur les couleurs de la cuisine.',
    'A dinner plate with a wide rim and a raw edge that brings out the colours of the food.'],
  ['assiette-dessert-greve', 'Assiette à dessert « Grève »', '“Grève” dessert plate', 'assiettes', 'plate', 2600, ['coquille', 'cendre', 'noir'], 30, 'Ø 21 cm', 134, '', 0.8,
    'La petite sœur de l’assiette Grève, pour les desserts, les entrées ou le pain du matin.',
    'The little sister of the Grève plate, for desserts, starters or the morning bread.'],
  ['plat-escale', 'Plat à tapas « Escale »', '“Escale” tapas dish', 'assiettes', 'plate', 1800, ['terracotta', 'miel', 'sauge'], 0, 'Ø 15 cm', 77, '', 0.62,
    'Petit plat creux pour l’apéritif, les olives ou les épices. De retour au printemps.',
    'A small deep dish for nibbles, olives or spices. Back in spring.'],
  ['vase-dune', 'Vase « Dune »', '“Dune” vase', 'vases', 'vase', 8900, ['terracotta', 'noir', 'coquille'], 5, 'H 24 cm', 52, '', 1,
    'Une silhouette ample et un col étroit pour un bouquet sauvage ou quelques branches. Intérieur émaillé, étanche.',
    'A full body and a narrow neck for a wild bouquet or a few branches. Glazed inside, watertight.'],
  ['soliflore-tige', 'Soliflore « Tige »', '“Tige” bud vase', 'vases', 'budvase', 2900, ['cobalt', 'miel', 'sauge'], 16, 'H 14 cm', 88, 'new', 1,
    'Un vase à une seule fleur, pour la table de chevet, la salle de bains ou le rebord de fenêtre.',
    'A vase for a single flower, for the bedside table, the bathroom or the windowsill.'],
  ['vase-galet', 'Vase « Galet »', '“Galet” vase', 'vases', 'pebble', 5800, ['cendre', 'sauge'], 7, 'H 16 cm · Ø 18 cm', 34, 'new', 1,
    'Rond comme un galet poli par la Loire, il tient seul sur une étagère, avec ou sans fleurs.',
    'Round like a pebble polished by the Loire, it stands on a shelf on its own, with or without flowers.'],
  ['pichet-source', 'Pichet « Source »', '“Source” jug', 'service', 'pitcher', 6400, ['celadon', 'cendre'], 6, '1 L · H 20 cm', 47, '', 1,
    'Un pichet au bec bien dessiné qui verse sans goutter : l’eau, la citronnade ou le cidre.',
    'A jug with a well-drawn spout that pours without dripping: water, lemonade or cider.'],
  ['coffret-petit-dejeuner', 'Coffret « Petit-déjeuner »', '“Breakfast” gift set', 'coffrets', 'set', 10800, ['celadon', 'miel', 'cendre'], 8, '2 × Matin + 2 × Rizière', 63, 'gift', 1,
    'Deux tasses et deux bols assortis, emballés dans une boîte en carton recyclé avec un mot manuscrit.',
    'Two matching mugs and two bowls, packed in a recycled cardboard box with a handwritten note.'],
];

export function seedProducts(): Product[] {
  return PRODUCTS.map(([id, fr, en, cat, shape, price, glazes, stock, size, sold, badge, scale, descFr, descEn]) => ({
    id, name: { fr, en }, desc: { fr: descFr, en: descEn }, cat, shape, price, glazes, stock, published: true, badge, sold, scale, size, image: '',
  }));
}

const FIRST = ['Claire', 'Julien', 'Sophie', 'Marc', 'Léa', 'Thomas', 'Camille', 'Nicolas', 'Inès', 'Antoine', 'Manon', 'Hugo', 'Chloé', 'Yanis', 'Emma', 'Lucas'];
const LAST = ['Martin', 'Bernard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'Roux', 'Fournier', 'Girard', 'Bonnet', 'Mercier'];
const CITIES: [string, string][] = [['44000', 'Nantes'], ['35000', 'Rennes'], ['75011', 'Paris'], ['69003', 'Lyon'], ['33000', 'Bordeaux'], ['13006', 'Marseille'], ['59000', 'Lille'], ['31000', 'Toulouse'], ['67000', 'Strasbourg'], ['29200', 'Brest']];
const STREETS = ['rue des Lilas', 'avenue Jean-Jaurès', 'rue de la Paix', 'boulevard Victor-Hugo', 'rue du Port', 'impasse des Tilleuls', 'rue Nationale', 'allée des Cerisiers'];
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function seed(now = new Date()): State {
  const products = seedProducts();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const r = rng(Number(day));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)] as T;
  const orders: Order[] = [];
  const count = 92;
  for (let i = 0; i < count; i++) {
    const at = new Date(now.getTime() - (i * 0.68 + r() * 0.6 + 0.05) * 864e5);
    const items: Order['items'] = [];
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const p = pick(products);
      if (items.some((x) => x.id === p.id)) continue;
      items.push({ id: p.id, name: p.name, glaze: pick(p.glazes), price: p.price, qty: 1 + Math.floor(r() * 2) });
    }
    const shipping = pick(SHIPPING_IDS);
    const promo = r() < 0.2;
    const [zip, city] = pick(CITIES);
    const first = pick(FIRST);
    const last = pick(LAST);
    // the most recent orders are still in progress, older ones delivered (a few refunded)
    const status: OrderStatus = i < 3 ? 'paid' : i < 6 ? 'preparing' : i < 11 ? 'shipped' : r() < 0.05 ? 'refunded' : 'delivered';
    const steps = status === 'refunded' ? ['paid', 'refunded'] as OrderStatus[] : ORDER_FLOW.slice(0, ORDER_FLOW.indexOf(status) + 1);
    orders.push({
      id: `o${Array.from({ length: 8 }, () => pick([...ID_ALPHABET])).join('')}`,
      number: `KC-${now.getFullYear()}-${String(1200 - i).padStart(5, '0')}`,
      at: at.toISOString(),
      status,
      items,
      shipping,
      promo,
      method: r() < 0.8 ? 'card' : 'paypal',
      totals: orderTotals(items, shipping, promo),
      customer: {
        name: `${first} ${last}`,
        email: `${first}.${last}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() + '@example.com',
        phone: `06 39 98 ${10 + Math.floor(r() * 89)} ${10 + Math.floor(r() * 89)}`,
        address: `${1 + Math.floor(r() * 80)} ${pick(STREETS)}`, zip, city,
      },
      eta: deliveryDate(shipping, at),
      history: steps.map((s, k) => ({ status: s, at: new Date(at.getTime() + k * 0.8 * 864e5).toISOString(), by: k === 0 ? 'customer' : 'Maëlle' })),
    });
  }
  return { v: 2, products, orders, clients: [], seq: 1201 };
}
