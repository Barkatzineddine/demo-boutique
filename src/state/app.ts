// Shop state and actions. Every action re-validates against the current state (another tab or the
// workshop may have changed stock or prices meanwhile) and staff actions check permissions here,
// not only in the interface.
import { can, ORDER_FLOW, STAFF, type GlazeId, type OrderStatus, type ShippingId, type StaffAccount } from '../domain/catalog';
import { deliveryDate, orderTotals, resolveCart } from '../domain/pricing';
import { cartSchema, productSchema, stateSchema, type Cart, type Client, type Customer, type Order, type Product, type State } from '../domain/schema';
import { seed } from '../domain/seed';
import { hashPassword, normPhone, randomId, verifyPassword } from '../shared/security';
import { createPersistedStore } from '../shared/store';

export const STORE_KEY = 'kaolin:v2';
export const CART_KEY = 'kaolin:cart';
export const app = createPersistedStore<State>(STORE_KEY, stateSchema, () => seed());
export const useShop = <T,>(selector: (s: State) => T): T => app.use((x) => selector(x.data));

export const cartStore = createPersistedStore<Cart>(CART_KEY, cartSchema, () => ({ v: 1, lines: [] }));
export const useCartLines = () => cartStore.use((x) => x.data.lines);

// ---------- cart ----------
/** Adds up to `qty` pieces within the available stock; returns how many were added. */
export function addToCart(id: string, glaze: GlazeId, qty = 1): number {
  const product = app.get().products.find((p) => p.id === id);
  if (!product || !product.published || !product.glazes.includes(glaze)) return 0;
  const lines = resolveCart(cartStore.get().lines, app.get().products);
  const inCart = lines.filter((l) => l.id === id).reduce((n, l) => n + l.qty, 0);
  const room = Math.max(0, Math.min(product.stock, 20) - inCart);
  const added = Math.min(qty, room);
  if (!added) return 0;
  cartStore.update((c) => {
    const line = c.lines.find((l) => l.id === id && l.glaze === glaze);
    if (line) line.qty = Math.min(20, line.qty + added);
    else c.lines.push({ id, glaze, qty: added });
  }, { type: 'cart.changed' });
  return added;
}
export function setCartQty(id: string, glaze: GlazeId, qty: number): void {
  cartStore.update((c) => {
    c.lines = c.lines.map((l) => (l.id === id && l.glaze === glaze ? { ...l, qty: Math.max(0, Math.min(20, Math.round(qty))) } : l)).filter((l) => l.qty > 0);
  }, { type: 'cart.changed' });
}
export const removeFromCart = (id: string, glaze: GlazeId) => cartStore.update((c) => { c.lines = c.lines.filter((l) => !(l.id === id && l.glaze === glaze)); }, { type: 'cart.changed' });
export const clearCart = () => cartStore.update((c) => { c.lines = []; }, { type: 'cart.changed' });

// ---------- checkout ----------
export interface CheckoutInput {
  customer: Customer; shipping: ShippingId; promo: boolean; method: 'card' | 'paypal'; clientId?: string;
  /** The total the customer saw: if prices or stock changed since, the order is refused. */
  expectedTotal: number;
}
export type PlaceResult = { ok: true; order: Order } | { ok: false; error: 'empty' | 'stock' | 'changed' };

export function placeOrder(input: CheckoutInput, now = new Date()): PlaceResult {
  const state = app.get();
  const wanted = cartStore.get().lines;
  const lines = resolveCart(wanted, state.products);
  if (!lines.length) return { ok: false, error: 'empty' };
  // several glazes of a piece share its stock
  const perProduct = new Map<string, number>();
  for (const l of lines) perProduct.set(l.id, (perProduct.get(l.id) ?? 0) + l.qty);
  const short = [...perProduct].some(([id, qty]) => (state.products.find((p) => p.id === id)?.stock ?? 0) < qty)
    || wanted.some((w) => (lines.find((l) => l.id === w.id && l.glaze === w.glaze)?.qty ?? 0) < w.qty);
  if (short) return { ok: false, error: 'stock' };
  const items = lines.map((l) => ({ id: l.id, name: l.product.name, glaze: l.glaze, price: l.product.price, qty: l.qty }));
  const totals = orderTotals(items, input.shipping, input.promo);
  if (totals.total !== input.expectedTotal) return { ok: false, error: 'changed' };

  const order: Order = {
    id: randomId('o'), number: `KC-${now.getFullYear()}-${String(state.seq).padStart(5, '0')}`, at: now.toISOString(), status: 'paid',
    items, shipping: input.shipping, promo: input.promo, method: input.method, totals,
    customer: { ...input.customer, phone: normPhone(input.customer.phone) }, clientId: input.clientId,
    eta: deliveryDate(input.shipping, now), history: [{ status: 'paid', at: now.toISOString(), by: 'customer' }],
  };
  app.update((s) => {
    for (const it of items) {
      const p = s.products.find((x) => x.id === it.id);
      if (p) { p.stock -= it.qty; p.sold += it.qty; }
    }
    s.seq += 1;
    s.orders.unshift(order);
  }, { type: 'order.created', id: order.id });
  clearCart();
  return { ok: true, order };
}

// ---------- order workflow (staff) ----------
export type StaffError = 'forbidden' | 'invalid' | 'not-found';

/** One step forward, or one step back (undo). Refunds have their own action. */
export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  const a = (ORDER_FLOW as readonly OrderStatus[]).indexOf(from);
  const b = (ORDER_FLOW as readonly OrderStatus[]).indexOf(to);
  return a >= 0 && b >= 0 && Math.abs(a - b) === 1;
}

export function moveOrder(id: string, to: OrderStatus, staff: StaffAccount, now = new Date()): StaffError | null {
  if (!can(staff.role, 'orders.move')) return 'forbidden';
  const order = app.get().orders.find((o) => o.id === id);
  if (!order) return 'not-found';
  if (!canMove(order.status, to)) return 'invalid';
  app.update((s) => {
    const o = s.orders.find((x) => x.id === id);
    if (!o) return;
    o.status = to;
    o.history = [...o.history, { status: to, at: now.toISOString(), by: staff.name }].slice(-12);
  }, { type: 'order.status', id, status: to });
  return null;
}

export function refundOrder(id: string, staff: StaffAccount, now = new Date()): StaffError | null {
  if (!can(staff.role, 'orders.refund')) return 'forbidden';
  const order = app.get().orders.find((o) => o.id === id);
  if (!order) return 'not-found';
  if (order.status === 'refunded' || order.status === 'delivered') return 'invalid';
  app.update((s) => {
    const o = s.orders.find((x) => x.id === id);
    if (!o) return;
    o.status = 'refunded';
    o.history = [...o.history, { status: 'refunded' as const, at: now.toISOString(), by: staff.name }].slice(-12);
    for (const i of o.items) {
      const p = s.products.find((q) => q.id === i.id);
      if (p) p.stock = Math.min(9999, p.stock + i.qty);
    }
  }, { type: 'order.status', id, status: 'refunded' });
  return null;
}

// ---------- catalogue (manager) ----------
export function saveProduct(product: Product, staff: StaffAccount, previousId: string | null): StaffError | null {
  if (!can(staff.role, 'products.edit')) return 'forbidden';
  if (!productSchema.safeParse(product).success) return 'invalid';
  if (app.get().products.some((p) => p.id === product.id && p.id !== previousId)) return 'invalid';
  app.update((s) => {
    const i = previousId ? s.products.findIndex((p) => p.id === previousId) : -1;
    if (i >= 0) s.products[i] = product;
    else s.products.unshift(product);
  }, { type: 'product.saved', id: product.id });
  return null;
}
export function deleteProduct(id: string, staff: StaffAccount): StaffError | null {
  if (!can(staff.role, 'products.edit')) return 'forbidden';
  app.update((s) => { s.products = s.products.filter((p) => p.id !== id); }, { type: 'product.deleted', id });
  return null;
}
export function patchProduct(id: string, patch: Partial<Pick<Product, 'stock' | 'published'>>, staff: StaffAccount): StaffError | null {
  if (!can(staff.role, 'products.edit')) return 'forbidden';
  if (patch.stock !== undefined && !(Number.isInteger(patch.stock) && patch.stock >= 0 && patch.stock <= 9999)) return 'invalid';
  app.update((s) => { const p = s.products.find((x) => x.id === id); if (p) Object.assign(p, patch); }, { type: 'product.saved', id });
  return null;
}

/** Unique, readable id from a name: "Bol « Lune »" -> "bol-lune", then "bol-lune-2"... */
export function slugFor(name: string, taken: readonly string[]): string {
  const base = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'piece';
  let slug = base.length >= 2 ? base : `${base}-piece`;
  for (let i = 2; taken.includes(slug); i++) slug = `${base}-${i}`;
  return slug;
}

// ---------- accounts ----------
export async function signUp(input: { name: string; email: string; password: string }): Promise<Client | 'exists'> {
  const email = input.email.toLowerCase();
  if (app.get().clients.some((c) => c.email === email) || STAFF.some((s) => s.email === email)) return 'exists';
  const { salt, hash } = await hashPassword(input.password);
  const client: Client = { id: randomId('c'), name: input.name, email, salt, hash, created: new Date().toISOString() };
  app.update((s) => { s.clients.push(client); });
  return client;
}

export const saveAddress = (clientId: string, address: Customer) =>
  app.update((s) => { const c = s.clients.find((x) => x.id === clientId); if (c) c.address = { ...address, phone: normPhone(address.phone) }; });

export type Session = { kind: 'client'; client: Client } | { kind: 'staff'; staff: StaffAccount } | null;

/** Same answer and similar timing whether the e-mail exists or not (no account enumeration). */
export async function logIn(emailRaw: string, password: string): Promise<Session> {
  const email = emailRaw.toLowerCase();
  const staff = STAFF.find((s) => s.email === email);
  const client = app.get().clients.find((c) => c.email === email);
  const record = staff ?? client;
  const ok = await verifyPassword(password, record?.salt ?? '00000000000000000000000000000000', record?.hash ?? '0'.repeat(64));
  if (!ok || !record) return null;
  return staff ? { kind: 'staff', staff } : { kind: 'client', client: client as Client };
}
