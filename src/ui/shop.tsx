// Shop building blocks: product card, stock label, quantity stepper and the cart drawer.
import { useEffect, type CSSProperties } from 'react';
import { create } from 'zustand';
import { FREE_SHIPPING, GLAZES, LOW_STOCK, type GlazeId } from '../domain/catalog';
import { resolveCart } from '../domain/pricing';
import type { Product } from '../domain/schema';
import { useFormat } from '../format';
import { addToCart, removeFromCart, setCartQty, useCartLines, useShop } from '../state/app';
import { Link, navigate, useLocation } from '../shared/router';
import { Dialog } from '../shared/ui/Dialog';
import { useFeedback } from '../shared/ui/Feedback';
import { ProductArt, Swatch } from './Art';

export const useUi = create<{ cartOpen: boolean }>(() => ({ cartOpen: false }));
export const openCart = (open = true) => useUi.setState({ cartOpen: open });

/** The cart as the shop sees it now: lines re-checked against the live catalogue. */
export function useCart() {
  const lines = useCartLines();
  const products = useShop((s) => s.products);
  const resolved = resolveCart(lines, products);
  return { lines: resolved, count: resolved.reduce((n, l) => n + l.qty, 0), subtotal: resolved.reduce((n, l) => n + l.qty * l.product.price, 0) };
}

export function Tile({ product, glaze, className = 'tile' }: { product: Product; glaze: GlazeId; className?: string }) {
  const { artLabel } = useFormat();
  return (
    <div className={className} style={{ '--tint': GLAZES[glaze].tint } as CSSProperties}>
      {product.image
        ? <img className="photo" src={product.image} alt={artLabel(product, glaze)} width="640" height="640" loading="lazy" decoding="async" />
        : <ProductArt id={product.id} shape={product.shape} scale={product.scale} glaze={glaze} label={artLabel(product, glaze)} />}
    </div>
  );
}

export function StockLabel({ stock }: { stock: number }) {
  const { t } = useFormat();
  if (stock <= 0) return <p className="stock out">{t('stock.out')}</p>;
  if (stock <= LOW_STOCK) return <p className="stock low">{t('stock.low', { n: stock })}</p>;
  return <p className="stock ok">{t('stock.ok')}</p>;
}

export function ProductCard({ product, preview = false }: { product: Product; preview?: boolean }) {
  const { t, price, name, category, glaze } = useFormat();
  const { toast } = useFeedback();
  const first = product.glazes[0] ?? 'cendre';
  const out = product.stock <= 0;
  const add = () => {
    const added = addToCart(product.id, first, 1);
    if (added) toast(t('cart.added', { name: name(product) }), 'ok', { label: t('cart.view'), run: () => openCart() });
    else toast(t('cart.max'), 'err');
  };
  return (
    <li className={`card-p ${out ? 'is-out' : ''}`}>
      <Tile product={product} glaze={first} />
      {product.badge ? <span className="badge-p">{t(`badge.${product.badge}`)}</span> : null}
      <div className="card-body">
        <p className="card-cat">{category(product.cat)}</p>
        <h3 className="card-title">
          {preview ? name(product) : <Link to={`/produit/${product.id}`} className="stretched">{name(product)}</Link>}
        </h3>
        <div className="card-meta">
          <span className="card-price">{price(product.price)}</span>
          <span className="swatches" title={product.glazes.map(glaze).join(', ')}>
            {product.glazes.map((g) => <Swatch key={g} glaze={g} />)}
            <span className="sr">{t('product.glazes')} : {product.glazes.map(glaze).join(', ')}</span>
          </span>
        </div>
        <StockLabel stock={product.stock} />
        {!out && !preview ? (
          <button type="button" className="btn btn-ghost btn-sm card-add" onClick={add}>
            {t('cart.add')}<span className="sr"> : {name(product)}, {glaze(first)}</span>
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function QtyStepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  const { t } = useFormat();
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" aria-label={t('qty.less')} disabled={value <= 1} onClick={() => onChange(value - 1)}>−</button>
      <input type="number" inputMode="numeric" min={1} max={max} value={value} aria-label={t('qty.label')}
        onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1) onChange(Math.min(n, max)); }} />
      <button type="button" aria-label={t('qty.more')} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function CartDrawer() {
  const { t, price, name, glaze } = useFormat();
  const open = useUi((s) => s.cartOpen);
  const { path } = useLocation();
  // a modal left open would block the next page: any navigation closes the drawer
  useEffect(() => { openCart(false); }, [path]);
  const { lines, subtotal } = useCart();
  const left = FREE_SHIPPING - subtotal;
  return (
    <Dialog open={open} onClose={() => openCart(false)} title={t('cart.title')} className="drawer">
      <button type="button" className="drawer-close" aria-label={t('common.close')} onClick={() => openCart(false)}>×</button>
      {lines.length ? (
        <>
          <div className="ship-progress">
            <p>{left > 0 ? t('cart.freeLeft', { amount: price(left) }) : t('cart.freeOk')}</p>
            <span className="progress" aria-hidden="true"><span className="progress-bar" style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING) * 100)}%` }} /></span>
          </div>
          <ul className="cart-lines">
            {lines.map((l) => (
              <li key={`${l.id}-${l.glaze}`} className="cart-line">
                <Tile product={l.product} glaze={l.glaze} className="tile tile-sm" />
                <div>
                  <p className="cl-name"><Link to={`/produit/${l.id}?email=${l.glaze}`} onClick={() => openCart(false)}>{name(l.product)}</Link></p>
                  <p className="hint">{glaze(l.glaze)} · {price(l.product.price)}</p>
                  <div className="cl-actions">
                    <QtyStepper value={l.qty} max={l.available} label={t('qty.of', { name: name(l.product) })} onChange={(n) => setCartQty(l.id, l.glaze, n)} />
                    <button type="button" className="linklike" onClick={() => removeFromCart(l.id, l.glaze)}>{t('cart.remove')}<span className="sr"> {name(l.product)}</span></button>
                  </div>
                </div>
                <p className="cl-total">{price(l.product.price * l.qty)}</p>
              </li>
            ))}
          </ul>
          <div className="drawer-foot">
            <p className="row-between"><span>{t('cart.subtotal')}</span><strong>{price(subtotal)}</strong></p>
            <p className="hint">{t('cart.taxes')}</p>
            <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => { openCart(false); navigate('/commande'); }}>{t('cart.checkout')}</button>
          </div>
        </>
      ) : (
        <div className="drawer-empty">
          <p>{t('cart.empty')}</p>
          <button type="button" className="btn btn-primary" onClick={() => { openCart(false); navigate('/'); }}>{t('cart.browse')}</button>
        </div>
      )}
    </Dialog>
  );
}
