// Totals in integer cents (no floating-point drift), cart re-checked against the catalogue, delivery dates.
import { FREE_SHIPPING, MAX_PER_LINE, PROMO, SHIPPING, type GlazeId, type ShippingId } from './catalog';
import type { CartLine, Product } from './schema';

export interface Totals { subtotal: number; discount: number; ship: number; total: number; vat: number }

/** Prices include 20 % VAT; delivery is free from FREE_SHIPPING after discount (pick-up is always free). */
export function orderTotals(items: readonly { price: number; qty: number }[], shipping: ShippingId | null, promo: boolean): Totals {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discount = promo ? Math.round(subtotal * PROMO.rate) : 0;
  const price = shipping ? SHIPPING[shipping].price : 0;
  const ship = price && subtotal - discount >= FREE_SHIPPING ? 0 : price;
  const total = subtotal - discount + ship;
  const vat = total - Math.round(total / 1.2);
  return { subtotal, discount, ship, total, vat };
}

export interface ResolvedLine { id: string; glaze: GlazeId; qty: number; product: Product; available: number }

/**
 * The stored cart is only a wish list: every read checks it against the live catalogue (deleted or
 * unpublished piece, glaze withdrawn, stock lowered by another order) and caps the quantities.
 */
export function resolveCart(lines: readonly CartLine[], products: readonly Product[]): ResolvedLine[] {
  const out: ResolvedLine[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.id);
    if (!product || !product.published || !product.glazes.includes(line.glaze) || product.stock <= 0) continue;
    const available = Math.min(product.stock, MAX_PER_LINE);
    out.push({ id: line.id, glaze: line.glaze, qty: Math.min(line.qty, available), product, available });
  }
  return out;
}

/** Date after `days` business days (Monday to Friday), counting one day of preparation. */
export function deliveryDate(shipping: ShippingId, from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let left = SHIPPING[shipping].days + 1;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const isFrenchZip = (zip: string) => /^(?:0[1-9]|[1-8]\d|9[0-5])\d{3}$/.test(zip);
export const isAddress = (address: string) => /^[\p{L}\p{N}][\p{L}\p{N}\p{M}' .,/-]{4,119}$/u.test(address);
