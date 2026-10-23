import { useState } from 'react';
import { MAX_PER_LINE, type GlazeId } from '../domain/catalog';
import { resolveCart } from '../domain/pricing';
import { useFormat } from '../format';
import { addToCart, useCartLines, useShop } from '../state/app';
import { Link, navigate, useLocation, usePage } from '../shared/router';
import { useFeedback } from '../shared/ui/Feedback';
import { Swatch } from '../ui/Art';
import { openCart, ProductCard, QtyStepper, StockLabel, Tile } from '../ui/shop';

export default function ProductPage({ id }: { id: string }) {
  const { t, price, name, desc, category, glaze: glazeName } = useFormat();
  const { toast } = useFeedback();
  const products = useShop((s) => s.products);
  const lines = useCartLines();
  const { query } = useLocation();
  const product = products.find((p) => p.id === id && p.published);
  usePage(product ? `${name(product)} · Kaolin & Cendre` : t('product.notFound'));
  const asked = query.get('email') as GlazeId | null;
  const glaze: GlazeId | undefined = product && asked && product.glazes.includes(asked) ? asked : product?.glazes[0];
  const [qty, setQty] = useState(1);

  if (!product || !glaze) {
    return (
      <div className="wrap narrow view">
        <h1 tabIndex={-1}>{t('product.notFound')}</h1>
        <Link className="btn btn-primary" to="/">{t('cart.browse')}</Link>
      </div>
    );
  }
  // what is left once the cart (all glazes of this piece) is taken into account
  const inCart = resolveCart(lines, products).filter((l) => l.id === product.id).reduce((n, l) => n + l.qty, 0);
  const left = Math.max(0, Math.min(product.stock, MAX_PER_LINE) - inCart);
  const amount = Math.min(qty, Math.max(left, 1));
  const related = products.filter((p) => p.published && p.cat === product.cat && p.id !== product.id).slice(0, 4);

  const add = () => {
    const added = addToCart(product.id, glaze, amount);
    if (!added) { toast(t('cart.max'), 'err'); return; }
    setQty(1);
    openCart();
  };

  return (
    <div className="wrap view">
      <nav className="crumbs" aria-label={t('product.crumbs')}>
        <Link to="/">{t('shop.title')}</Link> › <Link to={`/?cat=${product.cat}`}>{category(product.cat)}</Link> › <span aria-current="page">{name(product)}</span>
      </nav>
      <div className="product">
        <div className="product-visual">
          <Tile product={product} glaze={glaze} className="tile tile-lg" />
          {product.badge ? <span className="badge-p">{t(`badge.${product.badge}`)}</span> : null}
        </div>
        <div>
          <p className="eyebrow">{category(product.cat)}</p>
          <h1 tabIndex={-1}>{name(product)}</h1>
          <p className="price-lg">{price(product.price)}</p>
          <p className="desc">{desc(product)}</p>
          <div className="buy">
            <fieldset>
              <legend>{t('product.glaze')} : <span className="glaze-name">{glazeName(glaze)}</span></legend>
              <div className="glaze-options">
                {product.glazes.map((g) => (
                  <label key={g} className="glaze-opt" title={glazeName(g)}>
                    <input type="radio" name="glaze" value={g} checked={g === glaze} onChange={() => navigate(`/produit/${product.id}?email=${g}`, { replace: true })} />
                    <Swatch glaze={g} className="swatch" />
                    <span className="sr">{glazeName(g)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <StockLabel stock={product.stock} />
            {product.stock > 0 ? (
              <div className="buy-row">
                <QtyStepper value={amount} max={Math.max(left, 1)} onChange={setQty} label={t('qty.label')} />
                <button type="button" className="btn btn-primary btn-lg" disabled={left <= 0} onClick={add}>
                  {left > 0 ? t('cart.addPrice', { price: price(product.price * amount) }) : t('cart.allInCart')}
                </button>
              </div>
            ) : <p className="hint">{t('product.backSoon')}</p>}
          </div>
          <dl className="specs">
            <div><dt>{t('product.size')}</dt><dd>{product.size || '—'}</dd></div>
            <div><dt>{t('product.material')}</dt><dd>{t('product.materialValue')}</dd></div>
            <div><dt>{t('product.care')}</dt><dd>{product.cat === 'vases' ? t('product.careVase') : t('product.careTable')}</dd></div>
          </dl>
          <ul className="reassure">
            <li>{t('product.r1')}</li><li>{t('product.r2')}</li><li>{t('product.r3')}</li>
          </ul>
        </div>
      </div>
      {related.length ? (
        <section className="related" aria-labelledby="t-related">
          <h2 id="t-related">{t('product.related')}</h2>
          <ul className="grid grid-4">{related.map((p) => <ProductCard key={p.id} product={p} />)}</ul>
        </section>
      ) : null}
    </div>
  );
}
