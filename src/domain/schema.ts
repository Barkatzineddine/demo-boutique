// The persisted state, described once with Zod: types come from the schema and every load from
// localStorage (or message from another tab) is checked against it.
import * as z from 'zod/mini';
import { BADGES, CATEGORY_IDS, GLAZE_IDS, ORDER_STATUSES, SHAPE_IDS, SHIPPING_IDS } from './catalog';

// The strict CSP forbids eval: Zod must not try its compiled fast path.
z.config({ jitless: true });

const text = (max: number) => z.string().check(z.maxLength(max));
const cents = z.int().check(z.gte(0), z.lte(100_000_000));
const both = (max: number) => z.object({ fr: text(max), en: text(max) });
const hex = (length: number) => z.string().check(z.regex(new RegExp(`^[0-9a-f]{${length}}$`)));

/** Uploaded photos are re-encoded in the browser; only these data URLs are accepted back. */
export const IMAGE_DATA_URL = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export const productSchema = z.object({
  id: z.string().check(z.regex(/^[a-z0-9-]{2,60}$/)),
  name: both(80),
  desc: both(600),
  cat: z.enum(CATEGORY_IDS),
  shape: z.enum(SHAPE_IDS),
  price: z.int().check(z.gte(100), z.lte(500_000)),
  glazes: z.array(z.enum(GLAZE_IDS)).check(z.minLength(1), z.maxLength(GLAZE_IDS.length)),
  stock: z.int().check(z.gte(0), z.lte(9999)),
  published: z.boolean(),
  badge: z.enum(BADGES),
  sold: z.int().check(z.gte(0)),
  scale: z.number().check(z.gte(0.4), z.lte(1.4)),
  size: text(60),
  image: z.string().check(z.maxLength(400_000), z.refine((v) => v === '' || IMAGE_DATA_URL.test(v))),
});

export const customerSchema = z.object({
  name: text(60), email: text(254), phone: text(20), address: text(120), zip: z.string().check(z.regex(/^\d{5}$/)), city: text(60),
});

export const orderSchema = z.object({
  id: text(20),
  number: z.string().check(z.regex(/^KC-\d{4}-\d{5}$/)),
  at: text(40),
  status: z.enum(ORDER_STATUSES),
  items: z.array(z.object({
    id: text(60), name: both(80), glaze: z.enum(GLAZE_IDS), price: cents, qty: z.int().check(z.gte(1), z.lte(20)),
  })).check(z.minLength(1), z.maxLength(50)),
  shipping: z.enum(SHIPPING_IDS),
  promo: z.boolean(),
  method: z.enum(['card', 'paypal']),
  totals: z.object({ subtotal: cents, discount: cents, ship: cents, total: cents, vat: cents }),
  customer: customerSchema,
  clientId: z.optional(text(20)),
  eta: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
  history: z.array(z.object({ status: z.enum(ORDER_STATUSES), at: text(40), by: text(40) })).check(z.maxLength(12)),
});

export const clientSchema = z.object({
  id: text(20), name: text(60), email: text(254), salt: hex(32), hash: hex(64), created: text(40),
  address: z.optional(customerSchema),
});

export const stateSchema = z.object({
  v: z.literal(2),
  products: z.array(productSchema).check(z.maxLength(200)),
  orders: z.array(orderSchema).check(z.maxLength(3000)),
  clients: z.array(clientSchema).check(z.maxLength(1000)),
  seq: z.int().check(z.gte(1)),
});

export const cartSchema = z.object({
  v: z.literal(1),
  lines: z.array(z.object({ id: text(60), glaze: z.enum(GLAZE_IDS), qty: z.int().check(z.gte(1), z.lte(20)) })).check(z.maxLength(50)),
});

export type Product = z.infer<typeof productSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Client = z.infer<typeof clientSchema>;
export type State = z.infer<typeof stateSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartLine = Cart['lines'][number];
