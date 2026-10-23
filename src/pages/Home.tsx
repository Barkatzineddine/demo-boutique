import { useDeferredValue, useMemo, useState } from 'react';
import { CATEGORY_IDS, GLAZE_IDS } from '../domain/catalog';
import type { Product } from '../domain/schema';
import { filtersToQuery, NO_FILTERS, parseFilters, searchProducts, SORTS, type Filters } from '../domain/search';
import { useFormat } from '../format';
import type { Key } from '../i18n';
import { useShop } from '../state/app';
import { Link, navigate, useLocation, usePage } from '../shared/router';
import { Scene, Swatch } from '../ui/Art';
import { ProductCard } from '../ui/shop';

const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}`;

export function Home() {
  const { t } = useFormat();
  usePage(t('title.home'));
  return (
    <>
      <Hero />
      <Shop />
      <section className="section section-alt" aria-labelledby="t-atelier">
        <div className="wrap atelier">
          <img src={img('atelier-640.webp')} srcSet={`${img('atelier-640.webp')} 640w, ${img('atelier-1100.webp')} 1100w`} sizes="(min-width: 900px) 540px, 100vw"
            width="1100" height="825" loading="lazy" decoding="async" alt={t('atelier.photoAlt')} />
          <div>
            <p className="eyebrow">{t('atelier.eyebrow')}</p>
            <h2 id="t-atelier">{t('atelier.teaserTitle')}</h2>
            <p>{t('atelier.teaser1')}</p>
            <p>{t('atelier.teaser2')}</p>
            <Link className="btn btn-ghost" to="/atelier">{t('atelier.more')}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Hero() {
  const { t } = useFormat();
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-text">
          <p className="eyebrow">{t('hero.eyebrow')}</p>
          <h1 id="hero-title" className="reveal" tabIndex={-1}>{t('hero.title1')} <em>{t('hero.title2')}</em></h1>
          <p className="lead">{t('hero.lead')}</p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href="#boutique">{t('hero.shop')}</a>
            <Link className="btn btn-ghost btn-lg" to="/atelier">{t('hero.atelier')}</Link>
          </div>
        </div>
        <div className="hero-art">
          <Scene label={t('hero.sceneLabel')} pieces={[['vase', 'terracotta', 40, 40, 0.95], ['mug', 'celadon', 300, 180, 0.6], ['bowl', 'miel', 430, 200, 0.62], ['budvase', 'cobalt', 560, 100, 0.8]]} />
        </div>
      </div>
      <ul className="wrap perks">
        {(['1', '2', '3', '4'] as const).map((n) => <li key={n}><strong>{t(`perk.${n}.title` as Key)}</strong> {t(`perk.${n}.text` as Key)}</li>)}
      </ul>
    </section>
  );
}

function Shop() {
  const { t, name, category, glaze, desc } = useFormat();
  const products = useShop((s) => s.products);
  const { path, query } = useLocation();
  const filters = path === '/' ? parseFilters(query) : NO_FILTERS;
  const [open, setOpen] = useState(false);
  // filtering runs on a deferred copy of the filters: typing stays responsive
  const deferredKey = useDeferredValue(filtersToQuery(filters));
  const list = useMemo(() => {
    const words = (p: Product) => [name(p), p.name.fr, category(p.cat), ...p.glazes.map(glaze), desc(p)].join(' ');
    return searchProducts(products, parseFilters(new URLSearchParams(deferredKey)), words);
  }, [products, deferredKey, name, category, glaze, desc]);
  const set = (patch: Partial<Filters>) => {
    const q = filtersToQuery({ ...filters, ...patch });
    navigate(q ? `/?${q}` : '/', { replace: true });
  };
  const active = filtersToQuery({ ...filters, sort: 'featured' }) !== '';

  return (
    <section className="section" id="boutique" aria-labelledby="t-boutique">
      <div className="wrap">
        <div className="shop-head">
          <h2 id="t-boutique">{t('shop.title')}</h2>
          <p className="hint" aria-live="polite">{t('shop.count', { n: list.length })}</p>
        </div>
        <div className="shop-layout">
          <div className="filters">
            <div className="field search-field">
              <label htmlFor="q">{t('shop.search')}</label>
              <input id="q" type="search" placeholder={t('shop.searchPh')} maxLength={60} autoComplete="off" value={filters.q} onChange={(e) => set({ q: e.target.value })} />
            </div>
            <button type="button" className="btn btn-ghost filters-toggle" aria-expanded={open} aria-controls="filters-panel" onClick={() => setOpen(!open)}>
              {open ? t('shop.hideFilters') : t('shop.showFilters')}{active ? ' •' : ''}
            </button>
            <div id="filters-panel" className={`filters-panel ${open ? 'open' : ''}`}>
              <fieldset>
                <legend>{t('shop.category')}</legend>
                <div className="chips">
                  <button type="button" className="chip-btn" aria-pressed={!filters.cat} onClick={() => set({ cat: '' })}>{t('common.all')}</button>
                  {CATEGORY_IDS.map((c) => <button key={c} type="button" className="chip-btn" aria-pressed={filters.cat === c} onClick={() => set({ cat: filters.cat === c ? '' : c })}>{category(c)}</button>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>{t('shop.glaze')}</legend>
                <div className="chips">
                  {GLAZE_IDS.map((g) => (
                    <label key={g} className="chip-check">
                      <input type="checkbox" checked={filters.glazes.includes(g)} onChange={(e) => set({ glazes: e.target.checked ? [...filters.glazes, g] : filters.glazes.filter((x) => x !== g) })} />
                      <Swatch glaze={g} />{glaze(g)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="filter-selects">
                <div className="field">
                  <label htmlFor="f-max">{t('shop.maxPrice')}</label>
                  <select id="f-max" value={filters.max ?? ''} onChange={(e) => set({ max: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">{t('shop.anyPrice')}</option>
                    {[25, 40, 60, 100].map((m) => <option key={m} value={m}>{t('shop.upTo', { n: m })}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="f-sort">{t('shop.sort')}</label>
                  <select id="f-sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value as Filters['sort'] })}>
                    {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}` as Key)}</option>)}
                  </select>
                </div>
                <label className="field check">
                  <input type="checkbox" checked={filters.inStock} onChange={(e) => set({ inStock: e.target.checked })} />
                  <span>{t('shop.inStock')}</span>
                </label>
              </div>
              {active ? <button type="button" className="linklike" onClick={() => navigate('/', { replace: true })}>{t('shop.reset')}</button> : null}
            </div>
          </div>
          <div>
            {list.length ? (
              <ul className="grid" aria-label={t('shop.products')}>
                {list.map((p) => <ProductCard key={p.id} product={p} />)}
              </ul>
            ) : (
              <p className="empty">{t('shop.none')} <button type="button" className="linklike" onClick={() => navigate('/', { replace: true })}>{t('shop.reset')}</button></p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
