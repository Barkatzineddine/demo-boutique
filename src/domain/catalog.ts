// Shop constants: categories, glazes, shapes, delivery, promo, order flow and staff accounts.
// Money is always an integer number of cents.

export const CATEGORY_IDS = ['tasses', 'bols', 'assiettes', 'vases', 'service', 'coffrets'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const GLAZES = {
  celadon: { c: '#a9c2b0', d: '#7d9c88', tint: '#e6eee6', speckle: false },
  cendre: { c: '#cdc5b8', d: '#a39a8c', tint: '#ece7df', speckle: true },
  miel: { c: '#d39a3f', d: '#a86f22', tint: '#f3e6cf', speckle: false },
  terracotta: { c: '#c4673f', d: '#954527', tint: '#f2ddd2', speckle: false },
  cobalt: { c: '#3b5a92', d: '#243a66', tint: '#dde3ee', speckle: false },
  noir: { c: '#3a3633', d: '#211f1d', tint: '#e4e0db', speckle: false },
  coquille: { c: '#f1ece2', d: '#d3cbbd', tint: '#ece6dc', speckle: true },
  sauge: { c: '#8f9f7f', d: '#69785b', tint: '#e5e9df', speckle: false },
} as const;
export type GlazeId = keyof typeof GLAZES;
export const GLAZE_IDS = Object.keys(GLAZES) as GlazeId[];

export const SHAPE_IDS = ['mug', 'tumbler', 'bowl', 'plate', 'vase', 'budvase', 'pebble', 'pitcher', 'set'] as const;
export type ShapeId = (typeof SHAPE_IDS)[number];

export const BADGES = ['', 'new', 'best', 'limited', 'gift'] as const;
export type Badge = (typeof BADGES)[number];

export const SHIPPING_IDS = ['relais', 'colissimo', 'atelier'] as const;
export type ShippingId = (typeof SHIPPING_IDS)[number];
export const SHIPPING: Readonly<Record<ShippingId, { price: number; days: number }>> = {
  relais: { price: 450, days: 4 },
  colissimo: { price: 690, days: 3 },
  atelier: { price: 0, days: 1 },
};

export const FREE_SHIPPING = 6000;
export const PROMO = { code: 'BIENVENUE10', rate: 0.1 } as const;
export const MAX_PER_LINE = 20;
export const LOW_STOCK = 5;

/** The normal life of an order; "refunded" can happen from any step but the last. */
export const ORDER_FLOW = ['paid', 'preparing', 'shipped', 'delivered'] as const;
export const ORDER_STATUSES = [...ORDER_FLOW, 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ---------- staff (demo accounts: the passwords are public, the hashes are what is stored) ----------
export type StaffRole = 'manager' | 'packer';
export interface StaffAccount { id: string; name: string; role: StaffRole; email: string; salt: string; hash: string }

export const STAFF: readonly StaffAccount[] = [
  { id: 'staff-maelle', name: 'Maëlle', role: 'manager', email: 'atelier@kaolin-cendre.example', salt: 'adccc48f0869be992da87e96451f22f7', hash: 'bc16aaeb52096d38c3f12bda8d64184317e1c8d431c9895b50b440351528ec82' },
  { id: 'staff-samuel', name: 'Samuel', role: 'packer', email: 'colis@kaolin-cendre.example', salt: 'b2c699c8be9ad795041fe93fc4be9ca5', hash: 'c4cba17b7e25cb667c3c17294c0ca49bad62ee78d614c8e1dae4b9be0d97fc55' },
];

export const DEMO_LOGINS: readonly { role: StaffRole; email: string; password: string }[] = [
  { role: 'manager', email: 'atelier@kaolin-cendre.example', password: 'kaolin-gerante' },
  { role: 'packer', email: 'colis@kaolin-cendre.example', password: 'kaolin-colis' },
];

// ---------- permissions: checked by the state functions, not only hidden in the UI ----------
const ALLOWED = {
  manager: ['dashboard', 'orders.move', 'orders.refund', 'orders.export', 'products.edit'],
  packer: ['orders.move'],
} as const satisfies Record<StaffRole, readonly string[]>;
export type Permission = (typeof ALLOWED)['manager'][number];
export const can = (role: StaffRole | null | undefined, permission: Permission): boolean =>
  !!role && (ALLOWED[role] as readonly string[]).includes(permission);
