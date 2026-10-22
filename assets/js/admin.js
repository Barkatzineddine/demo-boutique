// Admin: dashboard, product editor (with safe photo import), orders workflow, CSV export.
import { h, mount, clean, fieldError, toast, confirmDialog, sha256, euro, euro0, isoDate, addDays, parseDate, download, csv } from './core.js';
import { GLAZES, swatch } from './art.js';
import { CATEGORIES, SHAPES, ADMIN_PIN, ORDER_STATUS, validProduct, category } from './data.js';
import { store } from './state.js';
import { productCard } from './ui.js';

const SESSION_KEY = 'kaolin:admin-session';
const FAIL_KEY = 'kaolin:admin-fails';
const TABS = [['dash', 'Tableau de bord'], ['products', 'Produits'], ['orders', 'Commandes']];
const BADGES = ['', 'Nouveau', 'Best-seller', 'Édition limitée', 'Idée cadeau'];
const NEXT = { 'payée': 'préparée', 'préparée': 'expédiée', 'expédiée': 'livrée' };
const NEXT_LABEL = { 'payée': 'Marquer préparée', 'préparée': 'Marquer expédiée', 'expédiée': 'Marquer livrée' };
const STATUS_LABEL = { 'payée': 'Payée', 'préparée': 'En préparation', 'expédiée': 'Expédiée', 'livrée': 'Livrée', 'remboursée': 'Remboursée' };
const MAX_UPLOAD = 5 * 1024 * 1024;

const session = {
  get: () => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; } },
  set: (v) => { try { v ? sessionStorage.setItem(SESSION_KEY, '1') : sessionStorage.removeItem(SESSION_KEY); } catch { /* blocked */ } },
};

const slugify = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'piece';

/**
 * Photo import: type and size checked, then decoded and redrawn on a canvas.
 * Re-encoding drops EXIF/GPS metadata and anything hidden in the original file.
 */
async function importPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Format accepté : JPEG, PNG ou WebP.');
  if (file.size > MAX_UPLOAD) throw new Error('Image trop lourde (5 Mo maximum).');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Ce fichier n’est pas une image lisible.'); }
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(640, side);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  // centred square crop
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  let url = canvas.toDataURL('image/webp', 0.8);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.82); // Safari without WebP encoding
  return url;
}

export function render(root) {
  const ui = { tab: 'dash', status: '', editing: null };

  function login() {
    const form = h('form', { class: 'form card login', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'pin' }, 'Code administrateur'),
        h('input', { id: 'pin', name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '8', required: true })),
      h('p', { class: 'hint' }, 'Code de démonstration : ', h('strong', null, ADMIN_PIN)),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Entrer'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let fails = [];
      try { fails = (JSON.parse(sessionStorage.getItem(FAIL_KEY)) || []).filter((t) => Date.now() - t < 30e3); } catch { /* ignore */ }
      if (fails.length >= 5) { fieldError(form.pin, 'Trop d’essais. Patientez 30 secondes.'); return; }
      if ((await sha256(form.pin.value)) !== (await sha256(ADMIN_PIN))) {
        try { sessionStorage.setItem(FAIL_KEY, JSON.stringify([...fails, Date.now()])); } catch { /* ignore */ }
        fieldError(form.pin, 'Code incorrect.');
        return;
      }
      session.set(true);
      draw();
    });
    mount(root, h('div', { class: 'wrap narrow' },
      h('a', { class: 'back-link', href: '#/' }, '← Boutique'),
      h('h1', { tabindex: '-1' }, 'Administration'),
      h('p', null, 'Gérez le catalogue, les stocks et les commandes.'),
      form,
      h('p', { class: 'hint' }, 'Démo : le code protège l’accès dans ce navigateur. En production, l’administration est servie par un back-office authentifié (mots de passe hachés, double authentification, journal des actions).')));
    form.pin.focus();
  }

  // ---------- Dashboard ----------
  function dash(state) {
    const now = new Date();
    const since = (days) => state.orders.filter((o) => o.status !== 'remboursée' && now - new Date(o.at) < days * 864e5);
    const month = since(30);
    const revenue = month.reduce((s, o) => s + o.totals.total, 0);
    const out = state.products.filter((p) => p.published && p.stock <= 0);
    const low = state.products.filter((p) => p.published && p.stock > 0 && p.stock <= 5);
    const todo = state.orders.filter((o) => o.status === 'payée' || o.status === 'préparée').length;
    const tile = (label, value, sub) => h('div', { class: 'kpi' }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' }, value), h('p', { class: 'kpi-sub' }, sub));
    const today = isoDate(now);
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    const perDay = days.map((d) => state.orders.filter((o) => o.status !== 'remboursée' && isoDate(new Date(o.at)) === d).reduce((s, o) => s + o.totals.total, 0));
    const max = Math.max(50, ...perDay);
    const bars = h('ol', { class: 'bars bars-30', 'aria-label': `Chiffre d’affaires par jour sur 30 jours, total ${euro0.format(revenue)}` }, days.map((d, i) => {
      const bar = h('span', { class: ['bar', i === 29 && 'today'] });
      bar.style.height = `${Math.max((perDay[i] / max) * 100, 1.5)}%`;
      return h('li', { class: 'bar-col', title: `${d} : ${euro.format(perDay[i])}` }, h('span', { class: 'bar-track' }, bar),
        h('span', { class: 'bar-lab' }, i % 5 === 4 ? String(parseDate(d).getDate()) : ''));
    }));
    const top = [...state.products].sort((a, b) => b.sold - a.sold).slice(0, 5);
    return [
      h('div', { class: 'kpis' },
        tile('CA · 30 jours', euro0.format(revenue), `${month.length} commandes`),
        tile('Panier moyen', euro.format(month.length ? revenue / month.length : 0), 'TTC, livraison comprise'),
        tile('À traiter', String(todo), 'payées ou en préparation'),
        tile('Stocks', String(out.length + low.length), `${out.length} épuisé(s), ${low.length} bas`)),
      h('figure', { class: 'card chart' }, h('figcaption', null, 'Chiffre d’affaires par jour (30 derniers jours)'), bars),
      h('div', { class: 'two-col' },
        h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Meilleures ventes'),
          h('ol', { class: 'rank' }, top.map((p) => h('li', null, h('span', null, p.name), h('span', { class: 'hint' }, `${p.sold} vendus`))))),
        h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Alertes de stock'),
          out.length + low.length ? h('ul', { class: 'rank' }, [...out, ...low].map((p) => h('li', null, h('span', null, p.name),
            h('button', { type: 'button', class: 'linklike', on: { click: () => { ui.tab = 'products'; ui.editing = p.id; draw(); } } }, p.stock ? `${p.stock} restant(s)` : 'Épuisé · réassort'))))
            : h('p', { class: 'hint' }, 'Aucune alerte.')))];
  }

  // ---------- Products ----------
  function products(state) {
    if (ui.editing) return editor(state, ui.editing === 'new' ? null : state.products.find((p) => p.id === ui.editing));
    return [
      h('div', { class: 'row-between' },
        h('p', { class: 'hint' }, `${state.products.length} produits · ${state.products.filter((p) => p.published).length} en ligne`),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', on: { click: () => { ui.editing = 'new'; draw(); } } }, '+ Nouveau produit')),
      h('div', { class: 'table-scroll' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Produit', 'Catégorie', 'Prix', 'Stock', 'En ligne', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', null, state.products.map((p) => {
          const stock = h('input', { type: 'number', min: '0', max: '9999', value: String(p.stock), class: 'stock-input', 'aria-label': `Stock de ${p.name}` });
          stock.addEventListener('change', () => {
            const n = Math.max(0, Math.min(9999, Math.round(Number(stock.value)) || 0));
            store.update((st) => { st.products.find((x) => x.id === p.id).stock = n; });
            toast(`Stock de ${p.name} : ${n}.`);
          });
          const pub = h('input', { type: 'checkbox', checked: p.published, 'aria-label': `${p.name} en ligne` });
          pub.addEventListener('change', () => {
            store.update((st) => { st.products.find((x) => x.id === p.id).published = pub.checked; });
            toast(pub.checked ? `${p.name} est en ligne.` : `${p.name} est masqué de la boutique.`);
          });
          return h('tr', null,
            h('td', null, h('strong', null, p.name), h('br'), h('span', { class: 'hint' }, p.glazes.map((g) => GLAZES[g].name).join(', '))),
            h('td', null, category(p.cat).name),
            h('td', null, euro.format(p.price)),
            h('td', null, stock),
            h('td', null, pub),
            h('td', null, h('div', { class: 'row-actions' },
              h('button', { type: 'button', class: 'btn btn-ghost btn-xs', on: { click: () => { ui.editing = p.id; draw(); } } }, 'Modifier', h('span', { class: 'sr' }, ` ${p.name}`)),
              h('a', { class: 'btn btn-ghost btn-xs', href: `#/produit/${p.slug}` }, 'Voir', h('span', { class: 'sr' }, ` ${p.name}`)))));
        }))))];
  }

  function editor(state, existing) {
    const draft = existing ? structuredClone(existing) : {
      id: '', slug: '', name: '', cat: 'tasses', shape: 'mug', price: 30, glazes: ['cendre'], stock: 10, published: true,
      badge: 'Nouveau', sold: 0, scale: 1, image: '', size: '', desc: '',
    };
    const preview = h('ul', { class: 'grid preview-grid', 'aria-label': 'Aperçu' });
    const refreshPreview = () => mount(preview, productCard({ ...draft, name: draft.name || 'Nom de la pièce', slug: draft.slug || 'apercu', glazes: draft.glazes.length ? draft.glazes : ['cendre'] }));
    const bind = (el, key, fn = (v) => v) => { el.addEventListener('input', () => { draft[key] = fn(el.value); refreshPreview(); }); return el; };

    const glazeBoxes = h('div', { class: 'chips' }, Object.entries(GLAZES).map(([id, g]) => {
      const box = h('input', { type: 'checkbox', id: `g-${id}`, checked: draft.glazes.includes(id) });
      box.addEventListener('change', () => {
        draft.glazes = Object.keys(GLAZES).filter((k) => document.getElementById(`g-${k}`).checked);
        refreshPreview();
      });
      return h('label', { class: 'chip-check', for: `g-${id}` }, box, swatch(id), g.name);
    }));

    const photoInput = h('input', { id: 'e-photo', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const photoInfo = h('p', { class: 'hint', 'aria-live': 'polite' }, draft.image ? 'Photo importée (ré-encodée, sans métadonnées).' : 'Facultatif : sans photo, l’illustration est générée à partir de la forme et de l’émail.');
    const removePhoto = h('button', { type: 'button', class: 'linklike', hidden: !draft.image, on: { click: () => { draft.image = ''; photoInput.value = ''; removePhoto.hidden = true; photoInfo.textContent = 'Photo retirée.'; refreshPreview(); } } }, 'Retirer la photo');
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file) return;
      photoInfo.textContent = 'Traitement de l’image…';
      try {
        draft.image = await importPhoto(file);
        photoInfo.textContent = `Photo importée : recadrée en carré, ré-encodée (${Math.round(draft.image.length * 0.75 / 1024)} Ko), métadonnées supprimées.`;
        removePhoto.hidden = false;
        refreshPreview();
      } catch (err) {
        photoInput.value = '';
        photoInfo.textContent = err.message;
      }
    });

    const form = h('form', { class: 'form', novalidate: true },
      h('div', { class: 'field' }, h('label', { for: 'e-name' }, 'Nom'), bind(h('input', { id: 'e-name', maxlength: '80', value: draft.name, required: true }), 'name')),
      h('div', { class: 'row2' },
        h('div', { class: 'field' }, h('label', { for: 'e-cat' }, 'Catégorie'),
          bind(h('select', { id: 'e-cat' }, CATEGORIES.map((c) => h('option', { value: c.id, selected: c.id === draft.cat }, c.name))), 'cat')),
        h('div', { class: 'field' }, h('label', { for: 'e-shape' }, 'Forme (illustration)'),
          bind(h('select', { id: 'e-shape' }, Object.entries(SHAPES).map(([k, v]) => h('option', { value: k, selected: k === draft.shape }, v))), 'shape'))),
      h('fieldset', null, h('legend', null, 'Émaux proposés'), glazeBoxes),
      h('div', { class: 'row3' },
        h('div', { class: 'field' }, h('label', { for: 'e-price' }, 'Prix TTC (€)'), bind(h('input', { id: 'e-price', type: 'number', min: '1', max: '5000', step: '0.5', value: String(draft.price) }), 'price', Number)),
        h('div', { class: 'field' }, h('label', { for: 'e-stock' }, 'Stock'), bind(h('input', { id: 'e-stock', type: 'number', min: '0', max: '9999', value: String(draft.stock) }), 'stock', (v) => Math.round(Number(v)))),
        h('div', { class: 'field' }, h('label', { for: 'e-badge' }, 'Badge'),
          bind(h('select', { id: 'e-badge' }, BADGES.map((b) => h('option', { value: b, selected: b === draft.badge }, b || 'Aucun'))), 'badge'))),
      h('div', { class: 'field' }, h('label', { for: 'e-size' }, 'Dimensions'), bind(h('input', { id: 'e-size', maxlength: '60', value: draft.size || '', placeholder: '30 cl · H 9,5 cm' }), 'size')),
      h('div', { class: 'field' }, h('label', { for: 'e-desc' }, 'Description'), bind(h('textarea', { id: 'e-desc', maxlength: '600', rows: '4', value: draft.desc }), 'desc')),
      h('div', { class: 'field' }, h('label', { for: 'e-photo' }, 'Photo'), photoInput, photoInfo, removePhoto),
      h('div', { class: 'field check' }, h('input', { id: 'e-pub', type: 'checkbox', checked: draft.published, on: { change: (e) => { draft.published = e.target.checked; } } }), h('label', { for: 'e-pub' }, 'En ligne dans la boutique')),
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn btn-primary' }, existing ? 'Enregistrer' : 'Créer le produit'),
        h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => { ui.editing = null; draw(); } } }, 'Annuler'),
        existing ? h('button', { type: 'button', class: 'btn btn-danger', on: { click: remove } }, 'Supprimer') : null));

    async function remove() {
      if (!(await confirmDialog({ title: `Supprimer ${existing.name} ?`, body: 'Le produit disparaît de la boutique et des paniers. Les commandes passées restent intactes.', ok: 'Supprimer', danger: true }))) return;
      ui.editing = null;
      store.update((st) => { st.products = st.products.filter((p) => p.id !== existing.id); });
      toast('Produit supprimé.');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = {
        ...draft,
        name: clean(draft.name, 80), desc: clean(draft.desc, 600, true), size: clean(draft.size, 60),
        price: Math.round(Number(draft.price) * 100) / 100, stock: Math.max(0, Math.round(Number(draft.stock)) || 0),
      };
      let ok = fieldError(form.querySelector('#e-name'), p.name.length >= 3 ? '' : 'Au moins 3 caractères.');
      ok = fieldError(form.querySelector('#e-price'), p.price >= 1 && p.price <= 5000 ? '' : 'Prix entre 1 et 5 000 €.') && ok;
      ok = fieldError(form.querySelector('#e-desc'), p.desc.length >= 20 ? '' : 'Décrivez la pièce en 20 caractères au moins.') && ok;
      if (!p.glazes.length) { ok = false; toast('Choisissez au moins un émail.', 'err'); }
      if (!ok) { form.querySelector('[aria-invalid=true]')?.focus(); return; }
      if (!existing) {
        let slug = slugify(p.name);
        const taken = new Set(state.products.map((x) => x.slug));
        for (let i = 2; taken.has(slug); i++) slug = `${slugify(p.name)}-${i}`;
        Object.assign(p, { id: slug, slug });
      }
      if (!validProduct(p)) { toast('Données invalides : vérifiez le formulaire.', 'err'); return; }
      ui.editing = null; // set first so the store update re-renders the list
      store.update((st) => {
        if (existing) st.products[st.products.findIndex((x) => x.id === existing.id)] = p;
        else st.products.unshift(p);
      });
      toast(existing ? 'Produit enregistré.' : 'Produit créé : il est visible dans la boutique.');
    });

    refreshPreview();
    return h('div', { class: 'editor' },
      h('h2', { class: 'card-h' }, existing ? `Modifier · ${existing.name}` : 'Nouveau produit'),
      h('div', { class: 'editor-grid' }, h('div', { class: 'card' }, form), h('div', null, h('p', { class: 'hint' }, 'Aperçu en direct'), preview)));
  }

  // ---------- Orders ----------
  function orders(state) {
    const list = state.orders.filter((o) => !ui.status || o.status === ui.status);
    const filter = h('div', { class: 'row-between' },
      h('div', { class: 'field inline' }, h('label', { for: 'o-status' }, 'Statut'),
        h('select', { id: 'o-status', on: { change: (e) => { ui.status = e.target.value; draw(); } } },
          [['', 'Toutes'], ...ORDER_STATUS.map((s) => [s, STATUS_LABEL[s]])].map(([v, l]) => h('option', { value: v, selected: v === ui.status }, l)))),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => exportOrders(list) } }, 'Exporter en CSV'));
    return [filter, h('p', { class: 'hint' }, `${list.length} commande(s)`),
      h('ul', { class: 'plain-list' }, list.slice(0, 60).map((o) => h('li', { class: 'card order-row' },
        h('div', { class: 'row-between' },
          h('p', null, h('strong', null, o.number), ` · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(o.at))}`),
          h('span', { class: ['chip', `st-${o.status}`] }, STATUS_LABEL[o.status])),
        h('p', null, `${o.customer.name} · ${o.customer.zip} ${o.customer.city} · ${o.shipping.name}`),
        h('p', { class: 'hint' }, o.items.map((i) => `${i.qty} × ${i.name} (${GLAZES[i.glaze]?.name || '—'})`).join(' · ')),
        h('div', { class: 'row-between' },
          h('strong', null, euro.format(o.totals.total)),
          h('div', { class: 'row-actions' },
            NEXT[o.status] ? h('button', { type: 'button', class: 'btn btn-primary btn-xs', on: { click: () => advance(o) } }, NEXT_LABEL[o.status], h('span', { class: 'sr' }, ` : ${o.number}`)) : null,
            o.status !== 'remboursée' && o.status !== 'livrée' ? h('button', { type: 'button', class: 'btn btn-danger btn-xs', on: { click: () => refund(o) } }, 'Rembourser', h('span', { class: 'sr' }, ` ${o.number}`)) : null))))),
    ];
  }

  function advance(o) {
    const next = NEXT[o.status]; // read before the update mutates the order
    store.update((st) => { const x = st.orders.find((y) => y.id === o.id); if (x && NEXT[x.status] === next) x.status = next; });
    toast(`${o.number} : ${STATUS_LABEL[next].toLowerCase()}. Le client le voit dans « Mes commandes ».`);
  }

  async function refund(o) {
    if (!(await confirmDialog({ title: `Rembourser ${o.number} ?`, body: `${euro.format(o.totals.total)} seraient recrédités au client (simulation). Les pièces sont remises en stock.`, ok: 'Rembourser', danger: true }))) return;
    store.update((st) => {
      const x = st.orders.find((y) => y.id === o.id);
      if (!x || x.status === 'remboursée') return;
      x.status = 'remboursée';
      for (const i of x.items) { const p = st.products.find((q) => q.id === i.id); if (p) p.stock += i.qty; }
    });
    toast('Commande remboursée, stock mis à jour.');
  }

  function exportOrders(list) {
    const rows = [['Numéro', 'Date', 'Statut', 'Client', 'E-mail', 'Code postal', 'Ville', 'Livraison', 'Articles', 'Total TTC', 'dont TVA'],
      ...list.map((o) => [o.number, o.at.slice(0, 10), STATUS_LABEL[o.status], o.customer.name, o.customer.email, o.customer.zip, o.customer.city, o.shipping.name,
        o.items.map((i) => `${i.qty} x ${i.name}`).join(' | '), o.totals.total.toFixed(2).replace('.', ','), o.totals.vat.toFixed(2).replace('.', ',')])];
    download(`commandes-${isoDate(new Date())}.csv`, csv(rows), 'text/csv;charset=utf-8');
    toast(`${list.length} commandes exportées.`);
  }

  function draw() {
    if (!session.get()) { login(); return; }
    const state = store.get();
    const panel = { dash, products, orders }[ui.tab](state);
    const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' }, TABS.map(([id, label]) => h('button', {
      type: 'button', role: 'tab', id: `tab-${id}`, 'aria-selected': String(ui.tab === id), 'aria-controls': 'panel', tabindex: ui.tab === id ? '0' : '-1',
      on: { click: () => { ui.tab = id; ui.editing = null; draw(); root.querySelector(`#tab-${id}`).focus(); } },
    }, label)));
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = TABS.findIndex(([id]) => id === ui.tab);
      ui.tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      ui.editing = null;
      draw();
      root.querySelector(`#tab-${ui.tab}`).focus();
    });
    mount(root, h('div', { class: 'wrap admin' },
      h('div', { class: 'row-between admin-head' },
        h('div', null, h('a', { class: 'back-link', href: '#/' }, '← Boutique'), h('h1', { tabindex: '-1' }, 'Administration')),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', on: { click: () => { session.set(false); draw(); } } }, 'Se déconnecter')),
      tabs,
      h('div', { id: 'panel', role: 'tabpanel', 'aria-labelledby': `tab-${ui.tab}`, class: 'panel' }, panel)));
  }

  draw();
  // re-render on outside changes, but never while a product form is being edited
  return store.subscribe(() => { if (!ui.editing) draw(); });
}
