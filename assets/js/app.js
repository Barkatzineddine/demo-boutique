import { $, $$, h, mount, clean, demoBanner, toast, euro } from './core.js';
import { scene, GLAZES, swatch } from './art.js';
import { CATEGORIES, FREE_SHIPPING } from './data.js';
import { store, cart } from './state.js';
import { productCard, tile, stepper } from './ui.js';

demoBanner({ prefix: 'kaolin:' });

mount($('#hero-art'), scene([
  ['vase', 'terracotta', 10, 46, 0.95],
  ['budvase', 'cobalt', 300, 150, 0.78],
  ['mug', 'celadon', 430, 196, 0.62],
  ['bowl', 'miel', 520, 236, 0.66],
], 'Vase terracotta, soliflore bleu cobalt, tasse céladon et bol miel posés sur une étagère'));

// ---------- Catalogue filters (kept in the URL so a filtered view can be shared) ----------
const SORTS = [['pop', 'Popularité'], ['asc', 'Prix croissant'], ['desc', 'Prix décroissant'], ['new', 'Nouveautés']];
const PRICES = [['', 'Tous les prix'], ['30', 'Jusqu’à 30 €'], ['60', 'Jusqu’à 60 €'], ['100', 'Jusqu’à 100 €']];
const filters = { q: '', cat: '', glazes: new Set(), max: '', stock: false, sort: 'pop' };

function readFilters(params) {
  filters.q = clean(params.get('q') || '', 40);
  filters.cat = CATEGORIES.some((c) => c.id === params.get('cat')) ? params.get('cat') : '';
  filters.glazes = new Set((params.get('emaux') || '').split(',').filter((g) => Object.hasOwn(GLAZES, g)));
  filters.max = PRICES.some(([v]) => v === params.get('prix')) ? params.get('prix') : '';
  filters.stock = params.get('stock') === '1';
  filters.sort = SORTS.some(([v]) => v === params.get('tri')) ? params.get('tri') : 'pop';
}
function writeFilters() {
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.cat) p.set('cat', filters.cat);
  if (filters.glazes.size) p.set('emaux', [...filters.glazes].join(','));
  if (filters.max) p.set('prix', filters.max);
  if (filters.stock) p.set('stock', '1');
  if (filters.sort !== 'pop') p.set('tri', filters.sort);
  const qs = p.toString();
  history.replaceState(null, '', `#/${qs ? `?${qs}` : ''}`);
}

function visibleProducts() {
  const q = filters.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = store.get().products.filter((p) => {
    if (!p.published) return false;
    if (filters.cat && p.cat !== filters.cat) return false;
    if (filters.glazes.size && !p.glazes.some((g) => filters.glazes.has(g))) return false;
    if (filters.max && p.price > Number(filters.max)) return false;
    if (filters.stock && p.stock <= 0) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.desc} ${p.glazes.map((g) => GLAZES[g].name).join(' ')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
  const sorters = { pop: (a, b) => b.sold - a.sold, asc: (a, b) => a.price - b.price, desc: (a, b) => b.price - a.price, new: (a, b) => (b.badge === 'Nouveau') - (a.badge === 'Nouveau') || b.sold - a.sold };
  return list.sort((a, b) => (b.stock > 0) - (a.stock > 0) || sorters[filters.sort](a, b));
}

function quickAdd(p) {
  if (cart.add(p.id, p.glazes[0], 1)) toast(`${p.name} (${GLAZES[p.glazes[0]].name}) ajouté au panier.`);
  else toast('Stock maximum atteint pour cette pièce.', 'err');
}

function drawGrid() {
  const list = visibleProducts();
  mount($('#grid'), list.map((p) => productCard(p, { onAdd: quickAdd })));
  $('#no-result').hidden = list.length > 0;
  $('#result-count').textContent = `${list.length} pièce${list.length > 1 ? 's' : ''}`;
  const active = (filters.cat ? 1 : 0) + filters.glazes.size + (filters.max ? 1 : 0) + (filters.stock ? 1 : 0) + (filters.q ? 1 : 0);
  const toggle = $('.filters-toggle');
  if (toggle) toggle.textContent = active ? `Filtres (${active})` : 'Filtres';
}

function drawFilters() {
  const search = h('input', { id: 'f-q', type: 'search', placeholder: 'Tasse, vase, céladon…', value: filters.q, maxlength: '40', autocomplete: 'off' });
  search.addEventListener('input', () => { filters.q = clean(search.value, 40); writeFilters(); drawGrid(); });
  const chip = (label, pressed, onClick, extra) => h('button', { type: 'button', class: 'chip-btn', 'aria-pressed': String(pressed), on: { click: onClick } }, extra, label);
  const panel = h('div', { class: 'filters-panel', id: 'filters-panel' },
    h('div', { class: 'field' }, h('label', { for: 'f-q' }, 'Rechercher'), search),
    h('fieldset', null, h('legend', null, 'Catégorie'),
      h('div', { class: 'chips' },
        chip('Tout', !filters.cat, () => { filters.cat = ''; refresh(); }),
        CATEGORIES.map((c) => chip(c.name, filters.cat === c.id, () => { filters.cat = filters.cat === c.id ? '' : c.id; refresh(); })))),
    h('fieldset', null, h('legend', null, 'Émail'),
      h('div', { class: 'chips' }, Object.entries(GLAZES).map(([id, g]) => chip(g.name, filters.glazes.has(id), () => {
        if (filters.glazes.has(id)) filters.glazes.delete(id); else filters.glazes.add(id);
        refresh();
      }, swatch(id))))),
    h('div', { class: 'filter-selects' },
      h('div', { class: 'field' }, h('label', { for: 'f-max' }, 'Prix'),
        h('select', { id: 'f-max', on: { change: (e) => { filters.max = e.target.value; refresh(); } } },
          PRICES.map(([v, l]) => h('option', { value: v, selected: v === filters.max }, l)))),
      h('div', { class: 'field' }, h('label', { for: 'f-sort' }, 'Trier par'),
        h('select', { id: 'f-sort', on: { change: (e) => { filters.sort = e.target.value; refresh(); } } },
          SORTS.map(([v, l]) => h('option', { value: v, selected: v === filters.sort }, l))))),
    h('div', { class: 'field check' },
      h('input', { id: 'f-stock', type: 'checkbox', checked: filters.stock, on: { change: (e) => { filters.stock = e.target.checked; refresh(); } } }),
      h('label', { for: 'f-stock' }, 'Uniquement les pièces en stock')),
    h('button', { type: 'button', class: 'linklike', on: { click: resetFilters } }, 'Effacer les filtres'));
  const toggle = h('button', { type: 'button', class: 'btn btn-ghost filters-toggle', 'aria-expanded': 'false', 'aria-controls': 'filters-panel' }, 'Filtres');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('open', open);
  });
  const wasOpen = $('.filters-panel.open') != null;
  mount($('#filters'), toggle, panel);
  if (wasOpen) { toggle.setAttribute('aria-expanded', 'true'); panel.classList.add('open'); }
}

function refresh() {
  const focusedId = document.activeElement?.id;
  const focusedLabel = document.activeElement?.classList.contains('chip-btn') ? document.activeElement.textContent : null;
  writeFilters();
  drawFilters();
  drawGrid();
  if (focusedLabel) $$('.chip-btn').find((b) => b.textContent === focusedLabel)?.focus();
  else if (focusedId) document.getElementById(focusedId)?.focus();
}
function resetFilters() {
  Object.assign(filters, { q: '', cat: '', glazes: new Set(), max: '', stock: false, sort: 'pop' });
  refresh();
}
$('#reset-filters').addEventListener('click', resetFilters);

// ---------- Cart drawer ----------
const drawer = $('#cart');
const cartBtn = $('.cart-btn');
function drawCart() {
  const lines = cart.lines();
  const count = cart.count();
  $('.cart-count').textContent = String(count);
  cartBtn.setAttribute('aria-label', `Panier, ${count} article${count > 1 ? 's' : ''}`);
  const subtotal = cart.subtotal();
  const left = Math.max(0, FREE_SHIPPING - subtotal);
  const bar = h('span', { class: 'progress-bar' });
  bar.style.width = `${Math.min(100, (subtotal / FREE_SHIPPING) * 100)}%`;
  mount(drawer,
    h('div', { class: 'drawer-head' },
      h('h2', { id: 'cart-title' }, 'Votre panier'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => drawer.close() } }, 'Fermer')),
    lines.length ? [
      h('div', { class: 'ship-progress' },
        h('p', null, left > 0 ? `Plus que ${euro.format(left)} pour la livraison offerte.` : 'Livraison offerte !'),
        h('span', { class: 'progress' }, bar)),
      h('ul', { class: 'cart-lines' }, lines.map((l) => h('li', { class: 'cart-line' },
        tile(l.p, l.glaze, 'tile-sm'),
        h('div', null,
          h('p', { class: 'cl-name' }, h('a', { href: `#/produit/${l.p.slug}`, on: { click: () => drawer.close() } }, l.p.name)),
          h('p', { class: 'hint' }, `${GLAZES[l.glaze].name} · ${euro.format(l.p.price)}`),
          h('div', { class: 'cl-actions' },
            stepper({ value: l.qty, max: Math.min(l.p.stock, 20), label: `${l.p.name}, ${GLAZES[l.glaze].name}`, onChange: (n) => cart.set(l.id, l.glaze, n) }),
            h('button', { type: 'button', class: 'linklike', on: { click: () => { cart.remove(l.id, l.glaze); toast(`${l.p.name} retiré du panier.`); } } }, 'Retirer', h('span', { class: 'sr' }, ` ${l.p.name}`)))),
        h('p', { class: 'cl-total' }, euro.format(l.qty * l.p.price))))),
      h('div', { class: 'drawer-foot' },
        h('p', { class: 'row-between' }, h('span', null, 'Sous-total'), h('strong', null, euro.format(subtotal))),
        h('p', { class: 'hint' }, 'Livraison et code promo à l’étape suivante. Prix TTC.'),
        h('a', { class: 'btn btn-primary btn-block', href: '#/commande', on: { click: () => drawer.close() } }, 'Passer commande'))]
      : h('div', { class: 'drawer-empty' }, h('p', null, 'Votre panier est vide.'),
        h('a', { class: 'btn btn-primary', href: '#boutique', on: { click: () => drawer.close() } }, 'Voir la boutique')));
}
cartBtn.addEventListener('click', () => { drawCart(); drawer.showModal(); });
drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });
cart.subscribe(() => {
  const focusedLabel = drawer.open ? document.activeElement?.getAttribute('aria-label') : null;
  drawCart();
  if (focusedLabel) drawer.querySelector(`[aria-label="${CSS.escape(focusedLabel)}"]`)?.focus();
});
export const openCart = () => { drawCart(); drawer.showModal(); };
drawCart();

// ---------- Router ----------
const home = $('#home');
const views = {
  produit: { el: $('#view-product'), load: () => import('./product.js') },
  commande: { el: $('#view-checkout'), load: () => import('./checkout.js') },
  confirmation: { el: $('#view-confirm'), load: () => import('./checkout.js'), fn: 'renderConfirmation' },
  'mes-commandes': { el: $('#view-orders'), load: () => import('./checkout.js'), fn: 'renderOrders' },
  atelier: { el: $('#view-atelier') },
  admin: { el: $('#view-admin'), load: () => import('./admin.js') },
};
let cleanup = null;
async function route() {
  const hash = location.hash || '#/';
  if (!hash.startsWith('#/')) { // in-page anchor: show the home page and scroll
    showView(null);
    if (!$('#grid').children.length) { drawFilters(); drawGrid(); }
    document.getElementById(hash.slice(1))?.scrollIntoView();
    return;
  }
  const [path, query = ''] = hash.slice(2).split('?');
  const [name, arg] = path.split('/');
  const view = views[name] || null;
  showView(view);
  if (!view) {
    readFilters(new URLSearchParams(query));
    drawFilters();
    drawGrid();
    return;
  }
  if (view.load) {
    const mod = await view.load();
    cleanup = mod[view.fn || 'render'](view.el, { arg: decodeURIComponent(arg || ''), openCart }) || null;
  }
  window.scrollTo(0, 0);
  view.el.querySelector('h1')?.focus();
}
function showView(view) {
  cleanup?.(); cleanup = null;
  Object.values(views).forEach((v) => { v.el.hidden = v !== view; });
  home.hidden = Boolean(view);
}
window.addEventListener('hashchange', route);
store.subscribe(() => { if (!home.hidden) drawGrid(); });
route();
