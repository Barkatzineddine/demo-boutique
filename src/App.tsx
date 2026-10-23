import { lazy, Suspense, useEffect, useState } from 'react';
import { useFormat } from './format';
import { Home } from './pages/Home';
import { app, cartStore } from './state/app';
import { deviceOrderIds, useSession } from './state/session';
import { Link, match, navigate, useLocation, useScrollOnNavigate } from './shared/router';
import { usePrerenderHandoff } from './shared/prerender';
import { onInstallPrompt } from './shared/sw';
import { FeedbackProvider, useFeedback } from './shared/ui/Feedback';
import { CartDrawer, openCart, useCart } from './ui/shop';

// everything but the catalogue is split out of the first download
const ProductPage = lazy(() => import('./pages/Product'));
const Checkout = lazy(() => import('./pages/Checkout'));
const MyOrders = lazy(() => import('./pages/Orders'));
const Confirmation = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Confirmation })));
const Account = lazy(() => import('./pages/Account'));
const Atelier = lazy(() => import('./pages/Atelier'));
const Admin = lazy(() => import('./pages/admin/Admin'));

export function App() {
  const { t } = useFormat();
  usePrerenderHandoff();
  return (
    <FeedbackProvider closeLabel={t('common.close')}>
      <Shell />
    </FeedbackProvider>
  );
}

function Shell() {
  const { t } = useFormat();
  const location = useLocation();
  useScrollOnNavigate(location);
  const { path } = location;
  const product = match('/produit/:id', path);
  const confirmation = match('/confirmation/:number', path);
  const known = ['/', '/commande', '/mes-commandes', '/compte', '/atelier', '/admin'].includes(path) || product || confirmation;

  return (
    <>
      <a className="skip" href="#contenu">{t('nav.skip')}</a>
      <DemoBar />
      <Header />
      <LiveNotifications />
      <main id="contenu" tabIndex={-1}>
        <Suspense fallback={<div className="route-loading" aria-hidden="true" />}>
          {path === '/' || !known ? <Home /> : null}
          {product?.id ? <ProductPage key={product.id} id={product.id} /> : null}
          {path === '/commande' ? <Checkout /> : null}
          {confirmation?.number ? <Confirmation number={confirmation.number} /> : null}
          {path === '/mes-commandes' ? <MyOrders /> : null}
          {path === '/compte' ? <Account /> : null}
          {path === '/atelier' ? <Atelier /> : null}
          {path === '/admin' ? <Admin /> : null}
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}

function DemoBar() {
  const { t, lang, setLang } = useFormat();
  const { confirm, toast } = useFeedback();
  // offered in a toast: a button appearing in the bar would push the page down (layout shift)
  useEffect(() => onInstallPrompt((show) => { if (show) toast(t('demo.installable'), 'info', { label: t('demo.install'), run: () => void show() }); }), [t, toast]);
  const reset = async () => {
    if (!(await confirm({ title: t('demo.resetTitle'), body: t('demo.resetBody'), ok: t('demo.reset'), cancel: t('common.cancel'), danger: true }))) return;
    try {
      Object.keys(localStorage).filter((k) => (k.startsWith('kaolin:') && k !== 'kaolin:lang') || k.startsWith('antispam:')).forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch { /* storage blocked */ }
    app.reset();
    cartStore.reset();
    window.location.hash = '';
    window.location.reload();
  };
  return (
    <div className="demo-bar">
      <p><strong>{t('demo.label')}</strong> · {t('demo.text')} <a href="https://barkatzineddine.github.io/#contact">{t('demo.cta')}</a></p>
      <div className="demo-actions">
        <button type="button" className="demo-btn" title={t('lang.label')} lang={lang === 'fr' ? 'en' : 'fr'} onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}>{t('lang.switch')}</button>
        <button type="button" className="demo-btn" onClick={() => void reset()}>{t('demo.reset')}</button>
      </div>
    </div>
  );
}

function Header() {
  const { t } = useFormat();
  const { path } = useLocation();
  const { count } = useCart();
  const session = useSession((s) => s.session);
  const [bump, setBump] = useState(count);
  // a short pulse on the cart button when its content changes (skipped with reduced motion by CSS)
  const pulse = bump !== count;
  useEffect(() => { if (!pulse) return; const id = window.setTimeout(() => setBump(count), 450); return () => window.clearTimeout(id); }, [pulse, count]);
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link to="/" className="brand">
          <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M12 9h16l-2 4c4 3 6 8 6 13 0 6-5 9-12 9s-12-3-12-9c0-5 2-10 6-13z" fill="#a6481f" /><path d="M8 27c4 2 8-1 12 0s8 2 12 0v3c0 3-5 5-12 5s-12-2-12-5z" fill="#c9a37f" /></svg>
          <span><span className="brand-name">Kaolin &amp; Cendre</span><span className="brand-sub">{t('brand.sub')}</span></span>
        </Link>
        <nav className="nav" aria-label={t('nav.label')}>
          <Link to="/" className="hide-sm" aria-current={path === '/' ? 'page' : undefined}>{t('nav.shop')}</Link>
          <Link to="/atelier" className="hide-sm" aria-current={path === '/atelier' ? 'page' : undefined}>{t('nav.atelier')}</Link>
          <Link to="/mes-commandes" className="hide-xs" aria-current={path === '/mes-commandes' ? 'page' : undefined}>{t('nav.orders')}</Link>
          <Link to={session?.kind === 'staff' ? '/admin' : '/compte'} aria-current={path === '/compte' || path === '/admin' ? 'page' : undefined}>
            {session?.kind === 'staff' ? t('nav.admin') : t('nav.account')}
          </Link>
          <button type="button" className={`cart-btn ${pulse ? 'pulse' : ''}`} aria-haspopup="dialog" onClick={() => openCart()}>
            {t('nav.cart')} <span className="cart-count" aria-hidden="true">{count}</span><span className="sr">{t('nav.cartCount', { n: count })}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

/** Messages from other tabs (BroadcastChannel): the workshop sees orders arrive, customers see them move. */
function LiveNotifications() {
  const { t, status, cents: price } = useFormat();
  const { toast } = useFeedback();
  const session = useSession((s) => s.session);
  useEffect(() => app.onRemoteEvent((event) => {
    const order = typeof event.id === 'string' ? app.get().orders.find((o) => o.id === event.id) : undefined;
    if (!order) return;
    if (session?.kind === 'staff') {
      if (event.type === 'order.created') {
        toast(t('live.newOrder', { number: order.number, total: price(order.totals.total), city: order.customer.city }), 'info', { label: t('live.see'), run: () => navigate(`/admin?tab=board&o=${order.id}`) });
      }
      return;
    }
    const mine = deviceOrderIds().includes(order.id) || (session?.kind === 'client' && order.clientId === session.client.id);
    if (mine && event.type === 'order.status') toast(t('live.yourOrder', { number: order.number, status: status(order.status).toLowerCase() }), 'info');
  }), [session, t, toast, status, price]);
  return null;
}

function Footer() {
  const { t } = useFormat();
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <p className="brand-name">Kaolin &amp; Cendre</p>
          <p>{t('footer.address')}<br /><a href="mailto:bonjour@kaolin-cendre.example">bonjour@kaolin-cendre.example</a></p>
          <p><Link to="/mes-commandes">{t('nav.orders')}</Link> · <Link to="/compte">{t('nav.account')}</Link> · <Link to="/admin">{t('nav.admin')}</Link></p>
        </div>
        <div id="securite">
          <h2 className="footer-title">{t('footer.security')}</h2>
          <ul className="sec-list">
            <li>{t('footer.sec.1')}</li><li>{t('footer.sec.2')}</li><li>{t('footer.sec.3')}</li><li>{t('footer.sec.4')}</li>
          </ul>
        </div>
        <div>
          <h2 className="footer-title">{t('footer.demo')}</h2>
          <p>{t('footer.fiction')}</p>
          <p>{t('footer.engineering')}</p>
          <p>{t('footer.byPre')} <a href="https://barkatzineddine.github.io/#contact">Zineddine Barkat</a>{t('footer.byPost')} <a href="https://github.com/Barkatzineddine/demo-boutique">{t('footer.code')}</a></p>
        </div>
      </div>
    </footer>
  );
}
