// UI pieces shared by several views: product visual, product card, quantity stepper.
import { h, euro } from './core.js';
import { art, GLAZES, swatch } from './art.js';
import { category } from './data.js';

/** Uploaded photo if any, otherwise the generated illustration. */
export function visual(p, glaze = p.glazes[0], className = 'art') {
  if (p.image) return h('img', { src: p.image, alt: p.name, class: [className, 'photo'], width: '400', height: '400', decoding: 'async' });
  return art(p, glaze, { className, label: `${p.name}, émail ${GLAZES[glaze].name}` });
}

/** Square tile tinted with the glaze colour (custom property set through CSSOM, allowed by the CSP). */
export function tile(p, glaze = p.glazes[0], className = '') {
  const el = h('div', { class: ['tile', className] }, visual(p, glaze));
  el.style.setProperty('--tint', GLAZES[glaze].tint);
  return el;
}

export function stockLabel(p) {
  if (p.stock <= 0) return { text: 'Épuisé', cls: 'out' };
  if (p.stock <= 5) return { text: `Plus que ${p.stock} en stock`, cls: 'low' };
  return { text: 'En stock · expédié sous 48 h', cls: 'ok' };
}

export function productCard(p, { onAdd } = {}) {
  const st = stockLabel(p);
  const add = p.stock > 0 && onAdd
    ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm card-add', on: { click: () => onAdd(p) } }, 'Ajouter', h('span', { class: 'sr' }, ` ${p.name} au panier`))
    : null;
  return h('li', { class: ['card-p', p.stock <= 0 && 'is-out'] },
    tile(p),
    p.badge ? h('span', { class: 'badge-p' }, p.badge) : null,
    h('div', { class: 'card-body' },
      h('p', { class: 'card-cat' }, category(p.cat)?.name || ''),
      h('h3', { class: 'card-title' }, h('a', { href: `#/produit/${p.slug}`, class: 'stretched' }, p.name)),
      h('div', { class: 'card-meta' },
        h('span', { class: 'card-price' }, euro.format(p.price)),
        h('span', { class: 'swatches', role: 'img', 'aria-label': `Émaux : ${p.glazes.map((g) => GLAZES[g].name).join(', ')}` }, p.glazes.map(swatch))),
      h('p', { class: ['stock', st.cls] }, st.text),
      add));
}

export function stepper({ value, max, label, onChange }) {
  const input = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: String(max), value: String(value), 'aria-label': label });
  const set = (v) => { const n = Math.max(1, Math.min(max, Number.isFinite(v) ? Math.round(v) : 1)); input.value = String(n); onChange(n); };
  input.addEventListener('change', () => set(Number(input.value)));
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': `Retirer un (${label})`, on: { click: () => set(Number(input.value) - 1) } }, '−'),
    input,
    h('button', { type: 'button', 'aria-label': `Ajouter un (${label})`, disabled: value >= max, on: { click: () => set(Number(input.value) + 1) } }, '+'));
}
