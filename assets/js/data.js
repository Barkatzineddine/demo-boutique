// Catalogue, seed orders and state validation.
import { uid, isoDate } from './core.js';
import { GLAZES } from './art.js';

export const STORE_KEY = 'kaolin:v1';
export const CART_KEY = 'kaolin:cart';
export const MINE_KEY = 'kaolin:mine';
export const ADMIN_PIN = '1357';
export const FREE_SHIPPING = 60;
export const PROMO = { code: 'BIENVENUE10', rate: 0.1, label: '−10 % première commande' };

export const CATEGORIES = [
  { id: 'tasses', name: 'Tasses & gobelets' },
  { id: 'bols', name: 'Bols & saladiers' },
  { id: 'assiettes', name: 'Assiettes' },
  { id: 'vases', name: 'Vases' },
  { id: 'service', name: 'Pichets & service' },
  { id: 'coffrets', name: 'Coffrets' },
];
export const SHAPES = { mug: 'Tasse', tumbler: 'Gobelet', bowl: 'Bol', plate: 'Assiette', vase: 'Vase', budvase: 'Soliflore', pebble: 'Vase galet', pitcher: 'Pichet', set: 'Coffret' };

export const SHIPPING = [
  { id: 'relais', name: 'Point relais', detail: '3 à 4 jours ouvrés', price: 4.5, days: 4 },
  { id: 'colissimo', name: 'Colissimo à domicile', detail: '2 à 3 jours ouvrés', price: 6.9, days: 3 },
  { id: 'atelier', name: "Retrait à l'atelier (Nantes)", detail: 'Prêt sous 24 h, du mardi au samedi', price: 0, days: 1 },
];

export const ORDER_STATUS = ['payée', 'préparée', 'expédiée', 'livrée', 'remboursée'];

const P = (id, name, cat, shape, price, glazes, stock, extra = {}) => ({
  id, slug: id, name, cat, shape, price, glazes, stock, published: true, badge: '', sold: 0, scale: 1, image: '', ...extra,
});

export function seedProducts() {
  return [
    P('tasse-matin', 'Tasse « Matin »', 'tasses', 'mug', 32, ['celadon', 'cendre', 'miel', 'noir'], 14, {
      size: '30 cl · H 9,5 cm', sold: 182, badge: 'Best-seller',
      desc: 'La tasse du premier café : une anse franche qui se tient à pleine main, un bord fin et un émail qui accroche la lumière. Tournée à la main, chaque pièce est unique.' }),
    P('espresso-ristretto', 'Tasse à espresso « Ristretto »', 'tasses', 'mug', 19, ['noir', 'miel', 'cobalt'], 22, {
      size: '9 cl · H 6 cm', sold: 96, scale: 0.72,
      desc: 'Petite, épaisse et lourde comme il faut : elle garde votre espresso chaud jusqu’à la dernière gorgée.' }),
    P('gobelet-brume', 'Gobelet « Brume »', 'tasses', 'tumbler', 24, ['cendre', 'sauge', 'cobalt'], 3, {
      size: '25 cl · H 11 cm', sold: 141,
      desc: 'Un gobelet sans anse aux stries de tournage apparentes, pour l’eau, le thé ou le vin du soir.' }),
    P('bol-riziere', 'Bol « Rizière »', 'bols', 'bowl', 28, ['celadon', 'miel', 'coquille'], 18, {
      size: 'Ø 14 cm · 50 cl', sold: 120,
      desc: 'Le bol à tout faire : granola, ramen ou soupe du dimanche. Son pied tourné le rend agréable à tenir.' }),
    P('saladier-recolte', 'Saladier « Récolte »', 'bols', 'bowl', 78, ['terracotta', 'celadon'], 4, {
      size: 'Ø 26 cm · 2,5 L', sold: 38, scale: 1.12, badge: 'Édition limitée',
      desc: 'Un grand saladier généreux pour les tablées. Émail alimentaire, fond légèrement bombé, à poser au centre.' }),
    P('assiette-greve', 'Assiette plate « Grève »', 'assiettes', 'plate', 34, ['coquille', 'cendre', 'noir'], 26, {
      size: 'Ø 27 cm', sold: 210, badge: 'Best-seller',
      desc: 'Une assiette plate au marli large et au bord brut, qui met en valeur les couleurs de la cuisine.' }),
    P('assiette-dessert-greve', 'Assiette à dessert « Grève »', 'assiettes', 'plate', 26, ['coquille', 'cendre', 'noir'], 30, {
      size: 'Ø 21 cm', sold: 134, scale: 0.8,
      desc: 'La petite sœur de l’assiette Grève, pour les desserts, les entrées ou le pain du matin.' }),
    P('plat-escale', 'Plat à tapas « Escale »', 'assiettes', 'plate', 18, ['terracotta', 'miel', 'sauge'], 0, {
      size: 'Ø 15 cm', sold: 77, scale: 0.62,
      desc: 'Petit plat creux pour l’apéritif, les olives ou les épices. De retour au printemps.' }),
    P('vase-dune', 'Vase « Dune »', 'vases', 'vase', 89, ['terracotta', 'noir', 'coquille'], 5, {
      size: 'H 24 cm', sold: 52,
      desc: 'Une silhouette ample et un col étroit pour un bouquet sauvage ou quelques branches. Intérieur émaillé, étanche.' }),
    P('soliflore-tige', 'Soliflore « Tige »', 'vases', 'budvase', 29, ['cobalt', 'miel', 'sauge'], 16, {
      size: 'H 14 cm', sold: 88, badge: 'Nouveau',
      desc: 'Un vase à une seule fleur, pour la table de chevet, la salle de bains ou le rebord de fenêtre.' }),
    P('vase-galet', 'Vase « Galet »', 'vases', 'pebble', 58, ['cendre', 'sauge'], 7, {
      size: 'H 16 cm · Ø 18 cm', sold: 34, badge: 'Nouveau',
      desc: 'Rond comme un galet poli par la Loire, il tient seul sur une étagère, avec ou sans fleurs.' }),
    P('pichet-source', 'Pichet « Source »', 'service', 'pitcher', 64, ['celadon', 'cendre'], 6, {
      size: '1 L · H 20 cm', sold: 47,
      desc: 'Un pichet au bec bien dessiné qui verse sans goutter : l’eau, la citronnade ou le cidre.' }),
    P('coffret-petit-dejeuner', 'Coffret « Petit-déjeuner »', 'coffrets', 'set', 108, ['celadon', 'miel', 'cendre'], 8, {
      size: '2 tasses Matin + 2 bols Rizière', sold: 63, badge: 'Idée cadeau',
      desc: 'Deux tasses et deux bols assortis, emballés dans une boîte en carton recyclé avec un mot manuscrit.' }),
  ];
}

const FIRST = ['Claire', 'Julien', 'Sophie', 'Marc', 'Léa', 'Thomas', 'Camille', 'Nicolas', 'Inès', 'Antoine', 'Manon', 'Hugo', 'Chloé', 'Yanis', 'Emma', 'Lucas'];
const LAST = ['Martin', 'Bernard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'Roux', 'Fournier', 'Girard', 'Bonnet', 'Mercier'];
const CITIES = [['44000', 'Nantes'], ['35000', 'Rennes'], ['75011', 'Paris'], ['69003', 'Lyon'], ['33000', 'Bordeaux'], ['13006', 'Marseille'], ['59000', 'Lille'], ['31000', 'Toulouse'], ['67000', 'Strasbourg'], ['29200', 'Brest']];
const STREETS = ['rue des Lilas', 'avenue Jean-Jaurès', 'rue de la Paix', 'boulevard Victor-Hugo', 'rue du Port', 'impasse des Tilleuls', 'rue Nationale', 'allée des Cerisiers'];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

export function orderTotals(items, shipping, promo) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = promo ? Math.round(subtotal * PROMO.rate * 100) / 100 : 0;
  const ship = shipping ? (shipping.price && subtotal - discount >= FREE_SHIPPING ? 0 : shipping.price) : 0;
  const total = Math.round((subtotal - discount + ship) * 100) / 100;
  const vat = Math.round((total - total / 1.2) * 100) / 100; // prices include 20 % VAT
  return { subtotal, discount, ship, total, vat };
}

export function seed(now = new Date()) {
  const products = seedProducts();
  const r = rng(Number(isoDate(now).replace(/-/g, '')));
  const orders = [];
  for (let i = 0; i < 26; i++) {
    const at = new Date(now.getTime() - (i * 1.15 + r()) * 864e5);
    const n = 1 + Math.floor(r() * 3);
    const items = [];
    for (let k = 0; k < n; k++) {
      const p = products[Math.floor(r() * products.length)];
      if (items.some((x) => x.id === p.id)) continue;
      items.push({ id: p.id, name: p.name, glaze: p.glazes[Math.floor(r() * p.glazes.length)], price: p.price, qty: 1 + Math.floor(r() * 2) });
    }
    const shipping = SHIPPING[Math.floor(r() * SHIPPING.length)];
    const promo = r() < 0.2;
    const [zip, city] = CITIES[Math.floor(r() * CITIES.length)];
    const status = i < 2 ? 'payée' : i < 4 ? 'préparée' : i < 9 ? 'expédiée' : r() < 0.05 ? 'remboursée' : 'livrée';
    const first = FIRST[Math.floor(r() * FIRST.length)];
    const last = LAST[Math.floor(r() * LAST.length)];
    orders.push({
      id: uid('o'), number: `KC-2026-${String(1180 - i).padStart(5, '0')}`, at: at.toISOString(), status,
      items, shipping: { id: shipping.id, name: shipping.name, price: shipping.price }, promo,
      totals: orderTotals(items, shipping, promo),
      customer: { name: `${first} ${last}`, email: `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.com',
        phone: `06 39 98 ${String(10 + Math.floor(r() * 89))} ${String(10 + Math.floor(r() * 89))}`,
        address: `${1 + Math.floor(r() * 80)} ${STREETS[Math.floor(r() * STREETS.length)]}`, zip, city },
    });
  }
  return { v: 1, products, orders, seq: 1181 };
}

const str = (v, max) => typeof v === 'string' && v.length <= max;
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
export function validProduct(p) {
  return p && str(p.id, 60) && /^[a-z0-9-]{2,60}$/.test(p.slug) && str(p.name, 80) && CATEGORIES.some((c) => c.id === p.cat)
    && Object.hasOwn(SHAPES, p.shape) && num(p.price, 0, 10000) && Number.isInteger(p.stock) && p.stock >= 0 && p.stock < 100000
    && Array.isArray(p.glazes) && p.glazes.length > 0 && p.glazes.every((g) => Object.hasOwn(GLAZES, g))
    && str(p.desc, 600) && str(p.size || '', 60) && str(p.badge || '', 30) && typeof p.published === 'boolean'
    && (p.image === '' || (str(p.image, 400000) && /^data:image\/(?:webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(p.image)));
}
export function validState(d) {
  return d && d.v === 1 && Array.isArray(d.products) && d.products.length < 500 && d.products.every(validProduct)
    && Array.isArray(d.orders) && d.orders.length < 5000 && Number.isInteger(d.seq)
    && d.orders.every((o) => str(o.id, 20) && str(o.number, 20) && ORDER_STATUS.includes(o.status) && Array.isArray(o.items)
      && o.items.every((i) => str(i.name, 80) && num(i.price, 0, 10000) && Number.isInteger(i.qty) && i.qty > 0 && i.qty < 100)
      && o.customer && str(o.customer.name, 80) && str(o.customer.email, 254) && o.totals && num(o.totals.total, 0, 1e6));
}

export const category = (id) => CATEGORIES.find((c) => c.id === id);
