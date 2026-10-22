// Checkout in three steps (details, delivery, simulated payment), confirmation and order history.
import { h, mount, clean, valid, normPhone, fieldError, guard, honeypot, toast, uid, euro } from './core.js';
import { GLAZES } from './art.js';
import { SHIPPING, PROMO, FREE_SHIPPING, orderTotals } from './data.js';
import { store, cart, mine } from './state.js';
import { tile } from './ui.js';

const STATUS_STEPS = ['payée', 'préparée', 'expédiée', 'livrée'];
const STATUS_LABEL = { 'payée': 'Payée', 'préparée': 'En préparation', 'expédiée': 'Expédiée', 'livrée': 'Livrée', 'remboursée': 'Remboursée' };

/** Delivery estimate in business days (Mon-Fri). */
function deliveryDate(days, from = new Date()) {
  const d = new Date(from);
  let left = days + 1; // 24 h of preparation
  while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

const field = (id, label, input, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);

export function render(root) {
  const co = { step: 0, customer: null, shipping: 'colissimo', promo: false, method: 'card', terms: false, busy: false, error: '' };
  let detailsGuard = null;

  function totals() {
    const items = cart.lines().map((l) => ({ price: l.p.price, qty: l.qty }));
    return orderTotals(items, SHIPPING.find((s) => s.id === co.shipping), co.promo);
  }

  function summary() {
    const t = totals();
    const promoForm = h('form', { class: 'promo', novalidate: true },
      h('label', { for: 'promo' }, 'Code promo'),
      h('div', { class: 'promo-row' },
        h('input', { id: 'promo', name: 'promo', maxlength: '20', autocomplete: 'off', placeholder: PROMO.code, disabled: co.promo }),
        h('button', { type: 'submit', class: 'btn btn-ghost btn-sm', disabled: co.promo }, 'Appliquer')),
      h('p', { class: 'hint' }, co.promo ? `${PROMO.label} appliqué.` : `Démo : essayez ${PROMO.code}.`));
    promoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = clean(promoForm.promo.value, 20).toUpperCase();
      if (code !== PROMO.code) { fieldError(promoForm.promo, 'Code inconnu ou expiré.'); return; }
      co.promo = true;
      draw();
      toast('Code promo appliqué : −10 %.');
    });
    return h('aside', { class: 'co-summary card', 'aria-label': 'Récapitulatif de la commande' },
      h('h2', null, 'Récapitulatif'),
      h('ul', { class: 'mini-lines' }, cart.lines().map((l) => h('li', null,
        tile(l.p, l.glaze, 'tile-xs'),
        h('span', null, `${l.p.name}`, h('br'), h('span', { class: 'hint' }, `${GLAZES[l.glaze].name} × ${l.qty}`)),
        h('span', null, euro.format(l.p.price * l.qty))))),
      promoForm,
      h('dl', { class: 'totals' },
        h('div', null, h('dt', null, 'Sous-total'), h('dd', null, euro.format(t.subtotal))),
        t.discount ? h('div', null, h('dt', null, 'Remise'), h('dd', null, `−${euro.format(t.discount)}`)) : null,
        h('div', null, h('dt', null, 'Livraison'), h('dd', null, t.ship ? euro.format(t.ship) : 'Offerte')),
        h('div', { class: 'grand' }, h('dt', null, 'Total TTC'), h('dd', null, euro.format(t.total))),
        h('div', { class: 'vat' }, h('dt', null, 'dont TVA 20 %'), h('dd', null, euro.format(t.vat)))));
  }

  function stepHead(i, title, doneText) {
    const done = co.step > i;
    return h('div', { class: 'co-step-head' },
      h('h2', { class: 'co-step-title', tabindex: '-1' }, h('span', { class: 'n' }, done ? '✓' : String(i + 1)), title),
      done ? h('button', { type: 'button', class: 'linklike', on: { click: () => { co.step = i; co.error = ''; draw(); } } }, 'Modifier', h('span', { class: 'sr' }, ` : ${title}`)) : null,
      done && doneText ? h('p', { class: 'co-done hint' }, doneText) : null);
  }

  function details() {
    const c = co.customer || {};
    const form = h('form', { class: 'form', novalidate: true },
      field('c-email', 'E-mail', h('input', { id: 'c-email', name: 'email', type: 'email', autocomplete: 'email', maxlength: '254', value: c.email || '', required: true }), 'Pour la confirmation et le suivi du colis.'),
      h('div', { class: 'row2' },
        field('c-name', 'Prénom et nom', h('input', { id: 'c-name', name: 'name', autocomplete: 'name', maxlength: '60', value: c.name || '', required: true })),
        field('c-phone', 'Téléphone', h('input', { id: 'c-phone', name: 'phone', type: 'tel', autocomplete: 'tel', maxlength: '20', value: c.phone || '', required: true }), 'Pour le transporteur uniquement.')),
      field('c-address', 'Adresse', h('input', { id: 'c-address', name: 'address', autocomplete: 'street-address', maxlength: '120', value: c.address || '', required: true })),
      h('div', { class: 'row2' },
        field('c-zip', 'Code postal', h('input', { id: 'c-zip', name: 'zip', autocomplete: 'postal-code', inputmode: 'numeric', maxlength: '5', value: c.zip || '', required: true })),
        field('c-city', 'Ville', h('input', { id: 'c-city', name: 'city', autocomplete: 'address-level2', maxlength: '60', value: c.city || '', required: true }))),
      h('p', { class: 'hint' }, 'Livraison en France métropolitaine.'),
      h('div', { class: 'field check' },
        h('input', { id: 'c-news', name: 'news', type: 'checkbox', checked: Boolean(c.news) }),
        h('label', { for: 'c-news' }, 'Recevoir la lettre de l’atelier (nouvelles séries, une fois par mois). Facultatif.')),
      honeypot('company'),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Continuer vers la livraison'));
    detailsGuard = guard(form, { key: 'kaolin:checkout', max: 5, windowMs: 30 * 60e3, minMs: 1500 });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = {
        email: clean(form.email.value, 254).toLowerCase(), name: clean(form.name.value, 60), phone: clean(form.phone.value, 20),
        address: clean(form.address.value, 120), zip: clean(form.zip.value, 5), city: clean(form.city.value, 60), news: form.news.checked,
      };
      let ok = fieldError(form.email, valid.email(v.email) ? '' : 'Adresse e-mail invalide.');
      ok = fieldError(form.name, valid.name(v.name) ? '' : 'Indiquez votre prénom et votre nom.') && ok;
      ok = fieldError(form.phone, valid.phone(v.phone) ? '' : 'Numéro français attendu, par exemple 06 12 34 56 78.') && ok;
      ok = fieldError(form.address, /^[\p{L}\p{N}][\p{L}\p{N}\p{M}' .,/-]{4,119}$/u.test(v.address) ? '' : 'Adresse incomplète.') && ok;
      ok = fieldError(form.zip, /^(?:0[1-9]|[1-8]\d|9[0-5])\d{3}$/.test(v.zip) ? '' : 'Code postal de France métropolitaine (5 chiffres).') && ok;
      ok = fieldError(form.city, valid.name(v.city) ? '' : 'Indiquez la ville.') && ok;
      if (!ok) { form.querySelector('[aria-invalid=true]')?.focus(); return; }
      const verdict = detailsGuard.check();
      if (verdict.silent) return; // bot: stop silently
      if (!verdict.ok) { toast(verdict.msg, 'err'); return; }
      verdict.commit();
      co.customer = { ...v, phone: normPhone(v.phone) };
      co.step = 1;
      draw();
    });
    return form;
  }

  function delivery() {
    const sub = cart.subtotal();
    const form = h('form', { class: 'form', novalidate: true },
      h('fieldset', { class: 'options' }, h('legend', { class: 'sr' }, 'Mode de livraison'),
        SHIPPING.map((s) => {
          const free = s.price === 0 || sub >= FREE_SHIPPING;
          return h('label', { class: 'option' },
            h('input', { type: 'radio', name: 'ship', value: s.id, checked: co.shipping === s.id }),
            h('span', { class: 'o-main' }, h('strong', null, s.name), h('span', { class: 'hint' }, `${s.detail} · arrivée prévue ${deliveryDate(s.days)}`)),
            h('span', { class: 'o-price' }, free ? 'Offert' : euro.format(s.price)));
        })),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Continuer vers le paiement'));
    form.addEventListener('change', () => { co.shipping = form.ship.value; drawSummaryOnly(); });
    form.addEventListener('submit', (e) => { e.preventDefault(); co.shipping = form.ship.value; co.step = 2; draw(); });
    return form;
  }

  function payment() {
    const t = totals();
    const terms = h('input', { id: 'p-terms', type: 'checkbox', checked: co.terms, on: { change: () => { co.terms = terms.checked; fieldError(terms, ''); } } });
    const pay = h('button', { type: 'button', class: 'btn btn-primary btn-lg', disabled: co.busy }, co.busy ? 'Autorisation en cours…' : `Payer ${euro.format(t.total)} (test)`);
    const refuse = h('button', { type: 'button', class: 'btn btn-ghost', disabled: co.busy }, 'Simuler un refus de la banque');
    const method = (id, label, body) => h('label', { class: 'option' },
      h('input', { type: 'radio', name: 'method', value: id, checked: co.method === id, on: { change: () => { co.method = id; draw(); } } }),
      h('span', { class: 'o-main' }, h('strong', null, label), h('span', { class: 'hint' }, body)));
    const attempt = (outcome) => {
      if (!terms.checked) { fieldError(terms, 'Acceptez les conditions de vente pour continuer.'); terms.focus(); return; }
      co.busy = true; co.error = ''; draw();
      setTimeout(() => {
        co.busy = false;
        if (outcome === 'refuse') { co.error = 'Paiement refusé par la banque (simulation : fonds insuffisants). Aucun montant n’a été débité, vous pouvez réessayer.'; draw(); return; }
        placeOrder();
      }, 1400);
    };
    pay.addEventListener('click', () => attempt('ok'));
    refuse.addEventListener('click', () => attempt('refuse'));
    return h('div', { class: 'form' },
      h('p', { class: 'test-banner', role: 'note' }, h('strong', null, 'Mode test'), ' : aucun paiement réel, aucune donnée bancaire demandée.'),
      h('fieldset', { class: 'options' }, h('legend', { class: 'sr' }, 'Moyen de paiement'),
        method('card', 'Carte bancaire (simulation)', 'Carte de test pré-remplie, aucun numéro à saisir.'),
        method('paypal', 'PayPal (simulation)', 'Redirection simulée, sans quitter la page.')),
      co.method === 'card' ? h('div', { class: 'fake-card', 'aria-label': 'Carte de test' },
        h('span', { class: 'fc-chip', 'aria-hidden': 'true' }),
        h('span', { class: 'fc-num' }, '4242 4242 4242 4242'),
        h('span', { class: 'fc-row' }, h('span', null, 'CARTE DE TEST'), h('span', null, '12/34'))) : null,
      co.error ? h('p', { class: 'alert', role: 'alert' }, co.error) : null,
      h('div', { class: 'field check' }, terms, h('label', { for: 'p-terms' }, 'J’accepte les conditions générales de vente (fictives) et le droit de rétractation de 14 jours.')),
      h('div', { class: 'form-actions' }, pay, refuse),
      h('p', { class: 'hint' }, 'En production : paiement 3-D Secure délégué à un prestataire certifié PCI-DSS (Stripe, PayPlug…). Les données de carte ne transitent jamais par la boutique.'));
  }

  function placeOrder() {
    co.busy = true; // no re-render while the order is written and the cart emptied
    const lines = cart.lines();
    const state = store.get();
    // re-check stock at the last moment (another tab or the admin may have changed it)
    const short = lines.find((l) => (state.products.find((p) => p.id === l.id)?.stock ?? 0) < l.qty);
    if (short || !lines.length) { co.busy = false; co.error = 'Le stock a changé pendant votre commande. Vérifiez votre panier.'; draw(); return; }
    const shipping = SHIPPING.find((s) => s.id === co.shipping);
    const items = lines.map((l) => ({ id: l.id, name: l.p.name, glaze: l.glaze, price: l.p.price, qty: l.qty }));
    let order;
    store.update((st) => {
      for (const it of items) { const p = st.products.find((x) => x.id === it.id); p.stock -= it.qty; p.sold += it.qty; }
      order = {
        id: uid('o'), number: `KC-2026-${String(st.seq++).padStart(5, '0')}`, at: new Date().toISOString(), status: 'payée',
        items, shipping: { id: shipping.id, name: shipping.name, price: shipping.price }, promo: co.promo,
        totals: orderTotals(items, shipping, co.promo), customer: co.customer, method: co.method,
        eta: deliveryDate(shipping.days),
      };
      st.orders.unshift(order);
    });
    mine.add(order.id);
    cart.clear();
    location.hash = `#/confirmation/${order.number}`;
  }

  let summaryEl = null;
  function drawSummaryOnly() { const n = summary(); summaryEl.replaceWith(n); summaryEl = n; }

  function draw() {
    if (!cart.lines().length && !co.busy) {
      mount(root, h('div', { class: 'wrap narrow' },
        h('h1', { tabindex: '-1' }, 'Commande'),
        h('p', null, 'Votre panier est vide.'),
        h('a', { class: 'btn btn-primary', href: '#/' }, 'Voir la boutique')));
      return;
    }
    const ship = SHIPPING.find((s) => s.id === co.shipping);
    summaryEl = summary();
    mount(root, h('div', { class: 'wrap' },
      h('a', { class: 'back-link', href: '#/' }, '← Continuer mes achats'),
      h('h1', { tabindex: '-1' }, 'Commande'),
      h('div', { class: 'co-grid' },
        h('div', { class: 'co-steps' },
          h('section', { class: ['card', 'co-step', co.step === 0 && 'active'] },
            stepHead(0, 'Coordonnées', co.customer && `${co.customer.name} · ${co.customer.address}, ${co.customer.zip} ${co.customer.city}`),
            co.step === 0 ? details() : null),
          h('section', { class: ['card', 'co-step', co.step === 1 && 'active'] },
            stepHead(1, 'Livraison', `${ship.name} · arrivée prévue ${deliveryDate(ship.days)}`),
            co.step === 1 ? delivery() : null),
          h('section', { class: ['card', 'co-step', co.step === 2 && 'active'] },
            stepHead(2, 'Paiement'),
            co.step === 2 ? payment() : null)),
        summaryEl)));
    root.querySelector('.co-step.active .co-step-title')?.focus();
  }

  draw();
  return cart.subscribe(() => { if (!co.busy) draw(); });
}

// ---------- Confirmation ----------
export function renderConfirmation(root, { arg }) {
  const order = store.get().orders.find((o) => o.number === arg && mine.ids().includes(o.id));
  if (!order) {
    mount(root, h('div', { class: 'wrap narrow' }, h('h1', { tabindex: '-1' }, 'Commande introuvable'),
      h('p', null, 'Cette commande n’a pas été passée depuis cet appareil.'), h('a', { class: 'btn btn-primary', href: '#/mes-commandes' }, 'Mes commandes')));
    return;
  }
  const c = order.customer;
  mount(root, h('div', { class: 'wrap narrow' },
    h('div', { class: 'card confirm' },
      h('div', { class: 'confirm-mark', 'aria-hidden': 'true' }, '✓'),
      h('h1', { tabindex: '-1' }, `Merci ${c.name.split(' ')[0]} !`),
      h('p', { class: 'lead' }, 'Votre commande ', h('strong', null, order.number), ' est confirmée.'),
      h('p', { class: 'hint' }, `Un e-mail de confirmation partirait vers ${c.email} (désactivé dans la démo). Arrivée prévue ${order.eta}.`)),
    orderDetail(order),
    h('div', { class: 'form-actions no-print' },
      h('button', { type: 'button', class: 'btn btn-ghost', on: { click: () => window.print() } }, 'Imprimer le reçu'),
      h('a', { class: 'btn btn-ghost', href: '#/mes-commandes' }, 'Mes commandes'),
      h('a', { class: 'btn btn-ghost', href: '#/admin' }, 'Voir côté admin'),
      h('a', { class: 'btn btn-primary', href: '#/' }, 'Continuer mes achats'))));
}

function timeline(order) {
  if (order.status === 'remboursée') return h('p', { class: 'chip chip-warn' }, 'Remboursée');
  const at = STATUS_STEPS.indexOf(order.status);
  return h('ol', { class: 'timeline', 'aria-label': `Statut : ${STATUS_LABEL[order.status]}` },
    STATUS_STEPS.map((s, i) => h('li', { class: [i <= at && 'done', i === at && 'now'] }, STATUS_LABEL[s])));
}

function orderDetail(order) {
  const c = order.customer;
  const t = order.totals;
  return h('div', { class: 'card order-detail' },
    timeline(order),
    h('ul', { class: 'mini-lines' }, order.items.map((i) => h('li', null,
      h('span', null, i.name, h('br'), h('span', { class: 'hint' }, `${GLAZES[i.glaze]?.name || ''} × ${i.qty}`)),
      h('span', null, euro.format(i.price * i.qty))))),
    h('dl', { class: 'totals' },
      h('div', null, h('dt', null, 'Sous-total'), h('dd', null, euro.format(t.subtotal))),
      t.discount ? h('div', null, h('dt', null, 'Remise'), h('dd', null, `−${euro.format(t.discount)}`)) : null,
      h('div', null, h('dt', null, order.shipping.name), h('dd', null, t.ship ? euro.format(t.ship) : 'Offerte')),
      h('div', { class: 'grand' }, h('dt', null, 'Total payé (test)'), h('dd', null, euro.format(t.total))),
      h('div', { class: 'vat' }, h('dt', null, 'dont TVA 20 %'), h('dd', null, euro.format(t.vat)))),
    h('p', { class: 'hint' }, `Livraison : ${c.name}, ${c.address}, ${c.zip} ${c.city}`));
}

// ---------- My orders ----------
export function renderOrders(root) {
  function draw() {
    const ids = mine.ids();
    const orders = store.get().orders.filter((o) => ids.includes(o.id));
    mount(root, h('div', { class: 'wrap narrow' },
      h('a', { class: 'back-link', href: '#/' }, '← Retour à la boutique'),
      h('h1', { tabindex: '-1' }, 'Mes commandes'),
      orders.length ? h('ul', { class: 'plain-list' }, orders.map((o) => h('li', null,
        h('h2', { class: 'order-title' }, o.number, h('span', { class: 'hint' }, ` · ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(o.at))}`)),
        orderDetail(o))))
        : h('div', { class: 'card empty' }, h('p', null, 'Aucune commande passée depuis cet appareil.'), h('a', { class: 'btn btn-primary', href: '#/' }, 'Voir la boutique')),
      h('p', { class: 'hint' }, 'Le statut évolue quand l’atelier traite la commande : essayez de la faire avancer depuis l’administration.')));
  }
  draw();
  return store.subscribe(draw);
}
