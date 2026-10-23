import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_LOGINS, STAFF, type StaffAccount } from '../../src/domain/catalog';
import { orderTotals } from '../../src/domain/pricing';
import { seedProducts } from '../../src/domain/seed';
import { checkImageFile, MAX_UPLOAD } from '../../src/shared/image';
import {
  addToCart, app, canMove, cartStore, clearCart, deleteProduct, logIn, moveOrder, patchProduct, placeOrder, refundOrder, removeFromCart, saveAddress, saveProduct, setCartQty, signUp, slugFor,
  type CheckoutInput,
} from '../../src/state/app';
import { attemptLogin, deviceOrderIds, rememberOrder, setSession, useSession } from '../../src/state/session';

const manager = STAFF.find((s) => s.role === 'manager') as StaffAccount;
const packer = STAFF.find((s) => s.role === 'packer') as StaffAccount;
const customer = { name: 'Léa Martin', email: 'lea@example.com', phone: '06 11 22 33 44', address: '3 rue du Port', zip: '44000', city: 'Nantes' };
const stock = (id: string) => app.get().products.find((p) => p.id === id)?.stock;

beforeEach(() => {
  app.update((s) => { s.products = seedProducts(); s.orders = []; s.clients = []; s.seq = 1201; });
  cartStore.update((c) => { c.lines = []; });
  sessionStorage.clear();
  localStorage.removeItem('kaolin:mine');
});

function checkout(over: Partial<CheckoutInput> = {}): CheckoutInput {
  const lines = cartStore.get().lines.map((l) => ({ price: app.get().products.find((p) => p.id === l.id)?.price ?? 0, qty: l.qty }));
  return { customer, shipping: 'colissimo', promo: false, method: 'card', expectedTotal: orderTotals(lines, 'colissimo', false).total, ...over };
}

describe('cart', () => {
  it('never holds more than the stock, all glazes of a piece together', () => {
    expect(stock('gobelet-brume')).toBe(3);
    expect(addToCart('gobelet-brume', 'cendre', 2)).toBe(2);
    expect(addToCart('gobelet-brume', 'sauge', 5)).toBe(1);
    expect(addToCart('gobelet-brume', 'cobalt', 1)).toBe(0);
  });
  it('refuses unknown pieces, withdrawn glazes and unpublished pieces', () => {
    expect(addToCart('nope', 'noir')).toBe(0);
    expect(addToCart('tasse-matin', 'terracotta')).toBe(0);
    patchProduct('tasse-matin', { published: false }, manager);
    expect(addToCart('tasse-matin', 'celadon')).toBe(0);
  });
});

describe('placing an order', () => {
  it('takes the stock, counts the sale, numbers the order and empties the cart', () => {
    addToCart('tasse-matin', 'miel', 2);
    const result = placeOrder(checkout());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.number).toMatch(/^KC-\d{4}-01201$/);
    expect(result.order.status).toBe('paid');
    expect(result.order.customer.phone).toBe('06 11 22 33 44');
    expect(stock('tasse-matin')).toBe(12);
    expect(app.get().products.find((p) => p.id === 'tasse-matin')?.sold).toBe(184);
    expect(app.get().seq).toBe(1202);
    expect(cartStore.get().lines).toEqual([]);
  });

  it('refuses when the stock dropped meanwhile (another tab bought the last piece)', () => {
    addToCart('gobelet-brume', 'cendre', 3);
    patchProduct('gobelet-brume', { stock: 1 }, manager);
    expect(placeOrder(checkout())).toEqual({ ok: false, error: 'stock' });
    expect(stock('gobelet-brume')).toBe(1);
  });

  it('refuses when the total the customer saw is no longer right (price changed)', () => {
    addToCart('bol-riziere', 'miel', 1);
    const input = checkout();
    const p = app.get().products.find((x) => x.id === 'bol-riziere');
    if (!p) throw new Error('seed');
    saveProduct({ ...p, price: p.price + 500 }, manager, p.id);
    expect(placeOrder(input)).toEqual({ ok: false, error: 'changed' });
  });

  it('refuses an empty cart', () => {
    expect(placeOrder(checkout())).toEqual({ ok: false, error: 'empty' });
  });
});

describe('order workflow and roles', () => {
  const order = () => {
    addToCart('vase-dune', 'noir', 1);
    const r = placeOrder(checkout());
    if (!r.ok) throw new Error(r.error);
    return r.order;
  };

  it('moves one step at a time, forward or back, and keeps a history', () => {
    const o = order();
    expect(canMove('paid', 'shipped')).toBe(false);
    expect(moveOrder(o.id, 'shipped', packer)).toBe('invalid');
    expect(moveOrder(o.id, 'preparing', packer)).toBeNull();
    expect(moveOrder(o.id, 'paid', packer)).toBeNull(); // undo
    const saved = app.get().orders.find((x) => x.id === o.id);
    expect(saved?.status).toBe('paid');
    expect(saved?.history.map((h) => `${h.status}:${h.by}`)).toEqual(['paid:customer', 'preparing:Samuel', 'paid:Samuel']);
  });

  it('lets only the manager refund, and puts the pieces back in stock', () => {
    const o = order();
    expect(stock('vase-dune')).toBe(4);
    expect(refundOrder(o.id, packer)).toBe('forbidden');
    expect(refundOrder(o.id, manager)).toBeNull();
    expect(stock('vase-dune')).toBe(5);
    expect(refundOrder(o.id, manager)).toBe('invalid'); // already refunded
    expect(moveOrder(o.id, 'preparing', manager)).toBe('invalid');
  });

  it('keeps the catalogue for the manager, whatever the interface shows', () => {
    const p = app.get().products[0];
    if (!p) throw new Error('seed');
    expect(patchProduct(p.id, { stock: 99 }, packer)).toBe('forbidden');
    expect(deleteProduct(p.id, packer)).toBe('forbidden');
    expect(saveProduct({ ...p, price: 1 }, manager, p.id)).toBe('invalid'); // below 1 €
    expect(saveProduct({ ...p, id: 'tasse-matin-2', image: 'data:text/html;base64,PHA+' }, manager, null)).toBe('invalid');
    expect(patchProduct(p.id, { stock: -3 }, manager)).toBe('invalid');
  });

  it('gives new products a readable, unique id', () => {
    expect(slugFor('Bol « Lune »', [])).toBe('bol-lune');
    expect(slugFor('Bol « Lune »', ['bol-lune', 'bol-lune-2'])).toBe('bol-lune-3');
    expect(slugFor('???', [])).toBe('piece');
  });
});

describe('accounts', () => {
  it('stores a salted hash and finds the account again', async () => {
    const client = await signUp({ name: 'Léa Martin', email: 'Lea@Example.com', password: 'un mot de passe long' });
    expect(client).not.toBe('exists');
    expect(localStorage.getItem('kaolin:v2')).not.toContain('un mot de passe long');
    expect(await logIn('lea@example.com', 'un mot de passe long')).toMatchObject({ kind: 'client' });
    expect(await logIn('lea@example.com', 'wrong')).toBeNull();
    expect(await logIn('nobody@example.com', 'un mot de passe long')).toBeNull();
  });
  it('cannot register a staff e-mail', async () => {
    expect(await signUp({ name: 'Faux Gérant', email: manager.email, password: 'un mot de passe long' })).toBe('exists');
  });
  it('locks the login for 30 seconds after five failures', async () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) await attemptLogin('x@example.com', 'nope', t0 + i);
    expect(await attemptLogin('x@example.com', 'nope', t0 + 10_000)).toEqual({ ok: false, reason: 'locked', seconds: 20 });
  });
});

describe('photo import checks', () => {
  it('accepts only JPEG, PNG and WebP up to 5 MB', () => {
    expect(checkImageFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(checkImageFile({ type: 'image/svg+xml', size: 1000 })).toBe('type'); // SVG can carry scripts
    expect(checkImageFile({ type: 'image/webp', size: MAX_UPLOAD + 1 })).toBe('size');
  });
});

describe('more cart and catalogue actions', () => {
  it('changes quantities, removes lines and empties the cart', () => {
    addToCart('tasse-matin', 'noir', 1);
    addToCart('bol-riziere', 'miel', 1);
    setCartQty('tasse-matin', 'noir', 4);
    expect(cartStore.get().lines.find((l) => l.id === 'tasse-matin')?.qty).toBe(4);
    setCartQty('tasse-matin', 'noir', 0);
    expect(cartStore.get().lines.map((l) => l.id)).toEqual(['bol-riziere']);
    removeFromCart('bol-riziere', 'miel');
    addToCart('vase-dune', 'noir', 1);
    clearCart();
    expect(cartStore.get().lines).toEqual([]);
  });
  it('lets the manager delete a product and save a customer address', async () => {
    expect(deleteProduct('plat-escale', manager)).toBeNull();
    expect(app.get().products.some((p) => p.id === 'plat-escale')).toBe(false);
    const client = await signUp({ name: 'Léa Martin', email: 'lea2@example.com', password: 'un mot de passe long' });
    if (client === 'exists') throw new Error('setup');
    saveAddress(client.id, { ...customer, phone: '+33611223344' });
    expect(app.get().clients[0]?.address?.phone).toBe('06 11 22 33 44');
  });
});

describe('session', () => {
  it('keeps only the kind and id, and restores the staff from them', async () => {
    const [login] = DEMO_LOGINS;
    expect(await attemptLogin(login?.email ?? '', login?.password ?? '')).toEqual({ ok: true });
    expect(useSession.getState().session?.kind).toBe('staff');
    expect(JSON.parse(sessionStorage.getItem('kaolin:session') ?? '{}')).toEqual({ kind: 'staff', id: 'staff-maelle' });
    setSession(null);
    expect(sessionStorage.getItem('kaolin:session')).toBeNull();
  });
  it('remembers the orders placed on this device, ignoring tampered values', () => {
    rememberOrder('oABC');
    rememberOrder('oABC');
    expect(deviceOrderIds()).toEqual(['oABC']);
    localStorage.setItem('kaolin:mine', JSON.stringify(['ok', 42, 'x'.repeat(50)]));
    expect(deviceOrderIds()).toEqual(['ok']);
    localStorage.setItem('kaolin:mine', '{broken');
    expect(deviceOrderIds()).toEqual([]);
  });
});
