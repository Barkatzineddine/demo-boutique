// Shop state: catalogue + orders (store), cart and "my orders" for this device.
import { createStore, toast } from './core.js';
import { STORE_KEY, CART_KEY, MINE_KEY, seed, validState } from './data.js';

export const store = createStore(STORE_KEY, seed, validState, {
  onError: () => toast('Le stockage du navigateur est plein : supprimez une photo de produit ou réinitialisez la démo.', 'err'),
});

export const productById = (id) => store.get().products.find((p) => p.id === id);
export const productBySlug = (slug) => store.get().products.find((p) => p.slug === slug);

// ---------- Cart (lines are re-checked against the catalogue every time they are read) ----------
const cartListeners = new Set();
function readRaw() {
  try {
    const v = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(v) ? v.slice(0, 50) : [];
  } catch { return []; }
}
function writeRaw(lines) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(lines.map(({ id, glaze, qty }) => ({ id, glaze, qty })))); } catch { /* storage blocked */ }
  cartListeners.forEach((fn) => fn());
}
window.addEventListener('storage', (e) => { if (e.key === CART_KEY) cartListeners.forEach((fn) => fn()); });
store.subscribe(() => cartListeners.forEach((fn) => fn()));

export const cart = {
  lines() {
    return readRaw()
      .filter((l) => l && typeof l.id === 'string' && typeof l.glaze === 'string' && Number.isInteger(l.qty) && l.qty > 0)
      .map((l) => ({ ...l, p: productById(l.id) }))
      .filter((l) => l.p && l.p.published && l.p.glazes.includes(l.glaze) && l.p.stock > 0)
      .map((l) => ({ id: l.id, glaze: l.glaze, qty: Math.min(l.qty, l.p.stock, 20), p: l.p }));
  },
  count() { return this.lines().reduce((n, l) => n + l.qty, 0); },
  subtotal() { return this.lines().reduce((n, l) => n + l.qty * l.p.price, 0); },
  add(id, glaze, qty = 1) {
    const lines = this.lines();
    const p = productById(id);
    const line = lines.find((l) => l.id === id && l.glaze === glaze);
    const already = line ? line.qty : 0;
    const wanted = Math.min(already + qty, p.stock, 20);
    if (wanted <= already) return false;
    if (line) line.qty = wanted; else lines.push({ id, glaze, qty: wanted, p });
    writeRaw(lines);
    return true;
  },
  set(id, glaze, qty) {
    const lines = this.lines().map((l) => (l.id === id && l.glaze === glaze ? { ...l, qty: Math.max(0, Math.min(qty, l.p.stock, 20)) } : l));
    writeRaw(lines.filter((l) => l.qty > 0));
  },
  remove(id, glaze) { writeRaw(this.lines().filter((l) => !(l.id === id && l.glaze === glaze))); },
  clear() { writeRaw([]); },
  subscribe(fn) { cartListeners.add(fn); return () => cartListeners.delete(fn); },
};

// ---------- Orders placed from this device ----------
export const mine = {
  ids() {
    try {
      const v = JSON.parse(localStorage.getItem(MINE_KEY));
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length <= 20) : [];
    } catch { return []; }
  },
  add(id) { try { localStorage.setItem(MINE_KEY, JSON.stringify([...new Set([...this.ids(), id])])); } catch { /* blocked */ } },
};
