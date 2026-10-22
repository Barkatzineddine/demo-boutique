// Product page: glaze picker redraws the piece, quantity limited by stock, related products.
import { h, mount, toast, euro } from './core.js';
import { GLAZES, swatch } from './art.js';
import { category } from './data.js';
import { store, cart, productBySlug } from './state.js';
import { tile, stockLabel, productCard, stepper } from './ui.js';

const CARE = {
  vases: 'Intérieur émaillé, étanche. Nettoyage à l’eau savonneuse.',
  default: 'Compatible lave-vaisselle et micro-ondes. Éviter les chocs thermiques.',
};

export function render(root, { arg, openCart }) {
  let glaze = null;
  let qty = 1;

  function draw() {
    const p = productBySlug(arg);
    if (!p || !p.published) {
      mount(root, h('div', { class: 'wrap narrow' },
        h('h1', { tabindex: '-1' }, 'Pièce introuvable'),
        h('p', null, 'Cette pièce n’existe pas ou n’est plus en vente.'),
        h('a', { class: 'btn btn-primary', href: '#/' }, 'Retour à la boutique')));
      document.title = 'Pièce introuvable · Kaolin & Cendre';
      return;
    }
    if (!p.glazes.includes(glaze)) glaze = p.glazes[0];
    qty = Math.max(1, Math.min(qty, p.stock || 1));
    document.title = `${p.name} · Kaolin & Cendre (démo)`;
    const st = stockLabel(p);

    const picker = h('fieldset', { class: 'glaze-picker' },
      h('legend', null, 'Émail : ', h('strong', null, GLAZES[glaze].name)),
      h('div', { class: 'glaze-options' }, p.glazes.map((g) => h('label', { class: 'glaze-opt' },
        h('input', { type: 'radio', name: 'glaze', value: g, checked: g === glaze, on: { change: () => { glaze = g; draw(); root.querySelector(`input[value="${g}"]`)?.focus(); } } }),
        swatch(g),
        h('span', { class: 'sr' }, GLAZES[g].name)))));

    const addBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-lg', disabled: p.stock <= 0 }, p.stock > 0 ? 'Ajouter au panier' : 'Épuisé');
    const form = h('form', { class: 'buy', novalidate: true },
      picker,
      p.stock > 0 ? h('div', { class: 'buy-row' },
        stepper({ value: qty, max: Math.min(p.stock, 20), label: 'Quantité', onChange: (n) => { qty = n; } }),
        addBtn) : addBtn,
      h('p', { class: ['stock', st.cls] }, st.text));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (cart.add(p.id, glaze, qty)) {
        toast(`${p.name} · ${GLAZES[glaze].name} ×${qty} ajouté au panier.`);
        openCart();
      } else toast('Vous avez déjà tout le stock disponible dans votre panier.', 'err');
    });

    const related = store.get().products
      .filter((x) => x.published && x.id !== p.id && x.stock > 0)
      .sort((a, b) => (b.cat === p.cat) - (a.cat === p.cat) || b.sold - a.sold)
      .slice(0, 4);

    mount(root, h('div', { class: 'wrap' },
      h('nav', { class: 'crumbs', 'aria-label': 'Fil d’Ariane' },
        h('a', { href: '#/' }, 'Boutique'), ' / ',
        h('a', { href: `#/?cat=${p.cat}` }, category(p.cat).name), ' / ',
        h('span', { 'aria-current': 'page' }, p.name)),
      h('div', { class: 'product' },
        h('div', { class: 'product-visual' }, tile(p, glaze, 'tile-lg'), p.badge ? h('span', { class: 'badge-p' }, p.badge) : null),
        h('div', { class: 'product-info' },
          h('h1', { tabindex: '-1' }, p.name),
          h('p', { class: 'price-lg' }, euro.format(p.price), h('span', { class: 'hint' }, ' TTC')),
          h('p', { class: 'desc' }, p.desc),
          form,
          h('dl', { class: 'specs' },
            h('div', null, h('dt', null, 'Dimensions'), h('dd', null, p.size || '—')),
            h('div', null, h('dt', null, 'Matière'), h('dd', null, 'Grès chamotté, cuisson à 1 280 °C')),
            h('div', null, h('dt', null, 'Entretien'), h('dd', null, CARE[p.cat] || CARE.default)),
            h('div', null, h('dt', null, 'Fabrication'), h('dd', null, 'Tourné et émaillé à la main à Nantes. Chaque pièce est unique : la ligne d’émail varie.'))),
          h('ul', { class: 'reassure' },
            h('li', null, 'Livraison offerte dès 60 €'),
            h('li', null, 'Retours gratuits sous 30 jours'),
            h('li', null, 'Emballage carton et papier recyclés')))),
      related.length ? h('section', { class: 'related', 'aria-labelledby': 'rel-title' },
        h('h2', { id: 'rel-title' }, 'Vous aimerez aussi'),
        h('ul', { class: 'grid grid-4' }, related.map((x) => productCard(x)))) : null));
  }

  draw();
  const off = store.subscribe(draw);
  return () => { off(); document.title = 'Kaolin & Cendre · Céramiques faites main à Nantes · Boutique (démo)'; };
}
